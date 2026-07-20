import { Hono } from "hono";
import { cors } from "hono/cors";
import { zValidator } from "@hono/zod-validator";
import { jwtVerify, createRemoteJWKSet } from "jose";
import type { Context } from "hono";
import { stripeFetch, verifyStripeEvent } from "./stripe";
import { buildAuthEmail } from "./auth-emails";
import { reportServerError } from "./monitoring";
import {
  CreateBoardSchema,
  UpdateBoardSchema,
  CreateColumnSchema,
  UpdateColumnSchema,
  CreateTaskSchema,
  UpdateTaskSchema,
  MoveTaskSchema,
  VoteTaskSchema,
  CreateInvitationSchema,
  CreateBetaCategorySchema,
  type BoardWithColumns,
  type Board,
  type Column,
  type Task,
} from "../shared/types";
import { query, one } from "./db";

const app = new Hono().basePath("/api");

app.use("*", cors({
  // Bearer-token auth (no cookies), but restrict browser origins to our own
  // domains + localhost anyway. Non-browser callers (MCP) send no Origin.
  origin: (origin) => {
    if (!origin) return origin;
    if (/^https:\/\/([a-z0-9-]+\.)?canflow\.app$/.test(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin)) return origin;
    return "";
  },
}));

/* ----------------------------- Rate limiting (Neon-backed, IP fixed-window) ----------------------------- */

// On Vercel the client-controlled leftmost x-forwarded-for is spoofable; trust
// x-real-ip (set by the platform) and fall back to the rightmost XFF hop.
const clientIp = (c: Context): string => {
  const real = c.req.header("x-real-ip");
  if (real?.trim()) return real.trim();
  const xff = c.req.header("x-forwarded-for");
  if (xff) { const parts = xff.split(","); return parts[parts.length - 1].trim(); }
  return "unknown";
};

/**
 * Fixed-window per-IP limiter backed by Postgres so it holds across edge
 * instances. Returns true if the request is allowed, false if over the limit.
 * Fails open on any DB hiccup so a limiter outage never blocks the app.
 */
async function rateLimit(c: Context, name: string, limit: number, windowSec: number): Promise<boolean> {
  try {
    const nowSec = Math.floor(Date.now() / 1000);
    const windowStart = nowSec - (nowSec % windowSec);
    const bucket = `${name}:${clientIp(c)}`;
    const row = await one<{ count: number }>(
      `INSERT INTO rate_limits (bucket, window_start, count) VALUES ($1, $2, 1)
       ON CONFLICT (bucket, window_start) DO UPDATE SET count = rate_limits.count + 1
       RETURNING count`,
      [bucket, windowStart]
    );
    // Best-effort cleanup of stale windows (~1% of calls).
    if (Math.random() < 0.01) query("DELETE FROM rate_limits WHERE window_start < $1", [nowSec - 3600]).catch(() => {});
    return (row?.count ?? 1) <= limit;
  } catch {
    return true;
  }
}

// Server-to-server callbacks (Stripe / Neon) are authenticated by signature or
// secret, not by IP, so they're exempt from the per-IP mutation limit.
const RL_EXEMPT = new Set(["/api/billing/webhook", "/api/auth/email"]);

app.use("*", async (c, next) => {
  const m = c.req.method;
  if ((m === "POST" || m === "PUT" || m === "DELETE" || m === "PATCH") && !RL_EXEMPT.has(new URL(c.req.url).pathname)) {
    if (!(await rateLimit(c, "api", 120, 60))) {
      return c.json({ error: "Too many requests. Please slow down and try again in a minute." }, 429);
    }
  }
  await next();
});

// Report any unhandled error thrown by a route to Sentry (no-ops without a DSN).
app.onError((err, c) => {
  reportServerError(err, { path: new URL(c.req.url).pathname, method: c.req.method });
  console.error("api error", err);
  return c.json({ error: "Internal error" }, 500);
});

/* ----------------------------- Auth (Neon Auth / Better Auth) ----------------------------- */

const JWKS_URL =
  process.env.NEON_AUTH_JWKS_URL ||
  "https://ep-soft-brook-atvks9ki.neonauth.c-9.us-east-1.aws.neon.tech/neondb/auth/.well-known/jwks.json";
const jwks = createRemoteJWKSet(new URL(JWKS_URL));

async function sha256hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const escapeHtml = (s: string): string => s.replace(/[<>&"']/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" }[ch]!));

const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

// Verify a GitHub webhook's X-Hub-Signature-256 (HMAC-SHA256 of the raw body).
async function verifyGithubSignature(secret: string, rawBody: string, header: string): Promise<boolean> {
  if (!header.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return timingSafeEqual(expected, header.slice(7));
}

/**
 * Resolve the current user id from the Authorization header. Accepts either a
 * Neon Auth JWT (browser) or a Canflow API token `cf_…` (MCP server / agents).
 */
async function getUserId(c: Context): Promise<string | null> {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7);

  if (token.startsWith("cf_")) {
    const hash = await sha256hex(token);
    const row = await one<{ user_id: string }>("SELECT user_id FROM api_tokens WHERE token_hash = $1", [hash]);
    if (!row) return null;
    query("UPDATE api_tokens SET last_used_at = now() WHERE token_hash = $1", [hash]).catch(() => {});
    return row.user_id;
  }

  try {
    const { payload } = await jwtVerify(token, jwks);
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

async function ownsBoard(boardId: number, uid: string): Promise<boolean> {
  return !!(await one("SELECT 1 FROM boards WHERE id = $1 AND owner_id = $2", [boardId, uid]));
}
async function ownsColumn(columnId: number, uid: string): Promise<boolean> {
  return !!(await one(
    "SELECT 1 FROM columns c JOIN boards b ON b.id = c.board_id WHERE c.id = $1 AND b.owner_id = $2",
    [columnId, uid]
  ));
}
async function ownsTask(taskId: number, uid: string): Promise<boolean> {
  return !!(await one(
    "SELECT 1 FROM tasks t JOIN columns c ON c.id = t.column_id JOIN boards b ON b.id = c.board_id WHERE t.id = $1 AND b.owner_id = $2",
    [taskId, uid]
  ));
}

function addComment(taskId: number, author: string | null, body: string, isSystem = false) {
  return query(
    "INSERT INTO task_comments (task_id, author, body, is_system) VALUES ($1, $2, $3, $4)",
    [taskId, author, body, isSystem]
  );
}
const cleanAgent = (v: unknown): string => (typeof v === "string" && v.trim() ? v.trim().toLowerCase() : "");

/* ----------------------------- Plans & limits ----------------------------- */

const FREE = { boards: 2, testers: 3, agentActions: 30, historyDays: 14 };

type PlanRow = { plan: string | null; trial_ends_at: string | null; agent_month: string | null; agent_count: number | null };

// Load the account's plan row, creating it on first touch. New accounts start on
// the Free plan (no trial) and upgrade to Pro when they choose.
async function ensureSettings(uid: string): Promise<PlanRow> {
  const existing = await one<PlanRow>("SELECT plan, trial_ends_at, agent_month, agent_count FROM user_settings WHERE user_id = $1", [uid]);
  if (existing) return existing;
  const created = await one<PlanRow>(
    `INSERT INTO user_settings (user_id, updated_at) VALUES ($1, now())
     ON CONFLICT (user_id) DO UPDATE SET updated_at = now()
     RETURNING plan, trial_ends_at, agent_month, agent_count`,
    [uid]
  );
  return created!;
}

function effectivePlan(s: PlanRow): "free" | "pro" {
  if (s.plan === "pro") return "pro";
  if (s.trial_ends_at && new Date(s.trial_ends_at).getTime() > Date.now()) return "pro";
  return "free";
}

const currentMonth = () => new Date().toISOString().slice(0, 7);

// For agent-attributed writes: increment the monthly meter; false when a free account is over its cap.
async function meterAgentAction(uid: string): Promise<{ ok: boolean; count: number; limit: number }> {
  const s = await ensureSettings(uid);
  if (effectivePlan(s) === "pro") return { ok: true, count: s.agent_count ?? 0, limit: FREE.agentActions };
  const month = currentMonth();
  // Atomic increment: rolls the counter over on a new month and only increments
  // while under the cap. Concurrent calls serialize on the row, so the monthly
  // limit can't be raced past.
  const updated = await one<{ agent_count: number }>(
    `UPDATE user_settings
     SET agent_month = $1,
         agent_count = CASE WHEN agent_month = $1 THEN COALESCE(agent_count, 0) + 1 ELSE 1 END,
         updated_at = now()
     WHERE user_id = $2 AND (agent_month IS DISTINCT FROM $1 OR COALESCE(agent_count, 0) < $3)
     RETURNING agent_count`,
    [month, uid, FREE.agentActions]
  );
  if (!updated) return { ok: false, count: FREE.agentActions, limit: FREE.agentActions };
  return { ok: true, count: updated.agent_count, limit: FREE.agentActions };
}

const overLimit = (c: import("hono").Context, code: string, message: string) => c.json({ error: message, code, upgrade: true }, 402);

/* ----------------------------- Boards (auth required) ----------------------------- */

app.get("/boards", async (c) => {
  const uid = await getUserId(c);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
  const boards = await query<Board>("SELECT * FROM boards WHERE owner_id = $1 ORDER BY created_at DESC", [uid]);
  return c.json(boards);
});

// Assemble a board with its columns + tasks in exactly two queries (no N+1).
async function assembleBoard(board: Board): Promise<BoardWithColumns> {
  const columns = await query<Column>("SELECT * FROM columns WHERE board_id = $1 ORDER BY position", [board.id]);
  const tasks = columns.length
    ? await query<Task>("SELECT * FROM tasks WHERE column_id = ANY($1::int[]) ORDER BY position, id", [columns.map((col) => col.id)])
    : [];
  const byCol = new Map<number, Task[]>(columns.map((col) => [col.id, []]));
  for (const t of tasks) byCol.get(t.column_id)?.push(t);
  return { ...board, columns: columns.map((col) => ({ ...col, tasks: byCol.get(col.id) ?? [] })) };
}

app.get("/boards/:id", async (c) => {
  const uid = await getUserId(c);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
  const id = parseInt(c.req.param("id"));
  const board = await one<Board>("SELECT * FROM boards WHERE id = $1 AND owner_id = $2", [id, uid]);
  if (!board) return c.json({ error: "Board not found" }, 404);
  return c.json(await assembleBoard(board));
});

app.post("/boards", zValidator("json", CreateBoardSchema), async (c) => {
  const uid = await getUserId(c);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
  const data = c.req.valid("json");
  if (effectivePlan(await ensureSettings(uid)) === "free") {
    const count = await one<{ n: number }>("SELECT count(*)::int AS n FROM boards WHERE owner_id = $1", [uid]);
    if ((count?.n ?? 0) >= FREE.boards) {
      return overLimit(c, "board_limit", `Free plan is limited to ${FREE.boards} boards. Upgrade to Pro for unlimited boards.`);
    }
  }
  const publicKey = crypto.randomUUID();

  const board = await one<Board>(
    `INSERT INTO boards (title, description, color, board_type, public_key, owner_id, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, now()) RETURNING *`,
    [data.title, data.description ?? null, data.color ?? null, data.board_type ?? "kanban", publicKey, uid]
  );

  const defaultColumns =
    data.board_type === "roadmap"
      ? [
          { title: "Ideas", position: 0, color: "#e0e7ff" },
          { title: "Planned", position: 1, color: "#fef3c7" },
          { title: "In Development", position: 2, color: "#dbeafe" },
          { title: "Released", position: 3, color: "#d1fae5" },
        ]
      : data.board_type === "beta-testing"
      ? [
          { title: "Testing", position: 0, color: "#8b8f96" },
          { title: "Issues Identified", position: 1, color: "#e5484d" },
          { title: "Fixing", position: 2, color: "#f5a623" },
          { title: "Fixed", position: 3, color: "#3b82f6" },
          { title: "Verified", position: 4, color: "#22c55e" },
          { title: "Shipped", position: 5, color: "#8b5cf6" },
        ]
      : [
          { title: "To Do", position: 0, color: "#e2e8f0" },
          { title: "In Progress", position: 1, color: "#fef3c7" },
          { title: "Done", position: 2, color: "#d1fae5" },
        ];

  for (const col of defaultColumns) {
    await query(
      `INSERT INTO columns (board_id, title, position, color, updated_at) VALUES ($1, $2, $3, $4, now())`,
      [board!.id, col.title, col.position, col.color]
    );
  }
  return c.json(board, 201);
});

app.put("/boards/:id", zValidator("json", UpdateBoardSchema), async (c) => {
  const uid = await getUserId(c);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
  const id = parseInt(c.req.param("id"));
  if (!(await ownsBoard(id, uid))) return c.json({ error: "Board not found" }, 404);
  const data = c.req.valid("json");

  const updates: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  const set = (col: string, val: unknown) => {
    if (val !== undefined) {
      updates.push(`${col} = $${i++}`);
      values.push(val);
    }
  };
  set("title", data.title);
  set("description", data.description);
  set("color", data.color);
  set("board_type", data.board_type);
  set("is_public", data.is_public);
  set("public_theme", data.public_theme);
  set("invite_mode", data.invite_mode);
  set("github_repo", data.github_repo);
  if (data.autopilot_agent !== undefined) { updates.push(`autopilot_agent = $${i++}`); values.push(data.autopilot_agent || null); }
  if (data.autopilot_priority !== undefined) { updates.push(`autopilot_priority = $${i++}`); values.push(data.autopilot_priority || null); }

  if (updates.length > 0) {
    updates.push(`updated_at = now()`);
    values.push(id);
    await query(`UPDATE boards SET ${updates.join(", ")} WHERE id = $${i}`, values);
  }
  const board = await one<Board>("SELECT * FROM boards WHERE id = $1", [id]);
  return c.json(board);
});

app.delete("/boards/:id", async (c) => {
  const uid = await getUserId(c);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
  const id = parseInt(c.req.param("id"));
  if (!(await ownsBoard(id, uid))) return c.json({ error: "Board not found" }, 404);
  await query("DELETE FROM boards WHERE id = $1", [id]);
  return c.json({ success: true });
});

/* ----------------------------- Columns (auth + ownership) ----------------------------- */

app.post("/columns", zValidator("json", CreateColumnSchema), async (c) => {
  const uid = await getUserId(c);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
  const data = c.req.valid("json");
  if (!(await ownsBoard(data.board_id, uid))) return c.json({ error: "Board not found" }, 404);
  const column = await one<Column>(
    `INSERT INTO columns (board_id, title, position, color, updated_at) VALUES ($1, $2, $3, $4, now()) RETURNING *`,
    [data.board_id, data.title, data.position, data.color ?? null]
  );
  return c.json(column, 201);
});

app.put("/columns/:id", zValidator("json", UpdateColumnSchema), async (c) => {
  const uid = await getUserId(c);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
  const id = parseInt(c.req.param("id"));
  if (!(await ownsColumn(id, uid))) return c.json({ error: "Column not found" }, 404);
  const data = c.req.valid("json");

  const updates: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  const set = (col: string, val: unknown) => {
    if (val !== undefined) {
      updates.push(`${col} = $${i++}`);
      values.push(val);
    }
  };
  set("title", data.title);
  set("position", data.position);
  set("color", data.color);
  if (updates.length > 0) {
    updates.push(`updated_at = now()`);
    values.push(id);
    await query(`UPDATE columns SET ${updates.join(", ")} WHERE id = $${i}`, values);
  }
  const column = await one<Column>("SELECT * FROM columns WHERE id = $1", [id]);
  return c.json(column);
});

app.delete("/columns/:id", async (c) => {
  const uid = await getUserId(c);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
  const id = parseInt(c.req.param("id"));
  if (!(await ownsColumn(id, uid))) return c.json({ error: "Column not found" }, 404);
  await query("DELETE FROM columns WHERE id = $1", [id]);
  return c.json({ success: true });
});

/* ----------------------------- Tasks (auth + ownership) ----------------------------- */

app.post("/tasks", zValidator("json", CreateTaskSchema), async (c) => {
  const uid = await getUserId(c);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
  const data = c.req.valid("json");
  if (!(await ownsColumn(data.column_id, uid))) return c.json({ error: "Column not found" }, 404);
  // Always append to the end of the column; positions are managed server-side so
  // they stay unique and sequential (the client's position is not trusted).
  const posRow = await one<{ n: number }>("SELECT COALESCE(MAX(position) + 1, 0) AS n FROM tasks WHERE column_id = $1", [data.column_id]);
  const task = await one<Task>(
    `INSERT INTO tasks (column_id, title, description, position, priority, start_date, due_date, tags, intensity, category, image_url, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now()) RETURNING *`,
    [data.column_id, data.title, data.description ?? null, posRow?.n ?? 0, data.priority ?? null, data.start_date ?? null, data.due_date ?? null, data.tags ?? null, data.intensity ?? 0, data.category ?? null, data.image_url ?? null]
  );

  // Autopilot: if the board auto-assigns new cards to an agent (optionally only a
  // given priority), queue this card for that agent automatically.
  const ap = await one<{ autopilot_agent: string | null; autopilot_priority: string | null }>(
    "SELECT b.autopilot_agent, b.autopilot_priority FROM columns c JOIN boards b ON b.id = c.board_id WHERE c.id = $1",
    [data.column_id]
  );
  if (task && ap?.autopilot_agent && (!ap.autopilot_priority || ap.autopilot_priority === (data.priority ?? null))) {
    const queued = await one<Task>(
      "UPDATE tasks SET agent = $1, agent_status = 'queued', updated_at = now() WHERE id = $2 RETURNING *",
      [ap.autopilot_agent, task.id]
    );
    await addComment(task.id, null, `Auto-queued for ${ap.autopilot_agent === "codex" ? "Codex" : "Claude Code"} by autopilot.`, true);
    return c.json(queued, 201);
  }
  return c.json(task, 201);
});

app.put("/tasks/:id", zValidator("json", UpdateTaskSchema), async (c) => {
  const uid = await getUserId(c);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
  const id = parseInt(c.req.param("id"));
  if (!(await ownsTask(id, uid))) return c.json({ error: "Task not found" }, 404);
  const data = c.req.valid("json");

  const updates: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  const set = (col: string, val: unknown) => {
    if (val !== undefined) {
      updates.push(`${col} = $${i++}`);
      values.push(val);
    }
  };
  set("column_id", data.column_id);
  set("title", data.title);
  set("description", data.description);
  set("position", data.position);
  set("priority", data.priority);
  set("start_date", data.start_date);
  set("due_date", data.due_date);
  set("tags", data.tags);
  set("intensity", data.intensity);
  set("category", data.category);
  set("image_url", data.image_url);
  if (updates.length > 0) {
    updates.push(`updated_at = now()`);
    values.push(id);
    await query(`UPDATE tasks SET ${updates.join(", ")} WHERE id = $${i}`, values);
  }
  const task = await one<Task>("SELECT * FROM tasks WHERE id = $1", [id]);
  return c.json(task);
});

app.patch("/tasks/:id/move", zValidator("json", MoveTaskSchema), async (c) => {
  const uid = await getUserId(c);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
  const id = parseInt(c.req.param("id"));
  if (!(await ownsTask(id, uid))) return c.json({ error: "Task not found" }, 404);
  const { column_id, position } = c.req.valid("json");
  // Move to the target column, then renumber that column so the card lands at
  // `position` and every card has a unique, sequential position (0,1,2,…).
  await query("UPDATE tasks SET column_id = $1, updated_at = now() WHERE id = $2", [column_id, id]);
  const siblings = await query<{ id: number }>(
    "SELECT id FROM tasks WHERE column_id = $1 AND id <> $2 ORDER BY position, updated_at, id",
    [column_id, id]
  );
  const order = siblings.map((s) => s.id);
  order.splice(Math.max(0, Math.min(position, order.length)), 0, id);
  await query(
    `UPDATE tasks t SET position = v.pos
     FROM (SELECT unnest($1::int[]) AS tid, generate_subscripts($1::int[], 1) - 1 AS pos) v
     WHERE t.id = v.tid`,
    [order]
  );
  const task = await one<Task>("SELECT * FROM tasks WHERE id = $1", [id]);
  return c.json(task);
});

app.delete("/tasks/:id", async (c) => {
  const uid = await getUserId(c);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
  const id = parseInt(c.req.param("id"));
  if (!(await ownsTask(id, uid))) return c.json({ error: "Task not found" }, 404);
  await query("DELETE FROM tasks WHERE id = $1", [id]);
  return c.json({ success: true });
});

/* ----------------------------- Public (open, no auth) ----------------------------- */

app.get("/public/:publicKey", async (c) => {
  const publicKey = c.req.param("publicKey");
  const board = await one<Board & { owner_id: string }>("SELECT * FROM boards WHERE public_key = $1 AND is_public = TRUE", [publicKey]);
  if (!board) return c.json({ error: "Board not found or not public" }, 404);
  const boardWithColumns = await assembleBoard(board);
  // Owner's org branding, so their logo/name shows on the public board.
  const settings = await one<{ org_name: string | null; org_image: string | null }>(
    "SELECT org_name, org_image FROM user_settings WHERE user_id = $1",
    [board.owner_id]
  );
  return c.json({ ...boardWithColumns, org: { name: settings?.org_name ?? null, image: settings?.org_image ?? null } });
});

app.post("/public/:publicKey/tasks/:id/vote", zValidator("json", VoteTaskSchema), async (c) => {
  const publicKey = c.req.param("publicKey");
  const taskId = parseInt(c.req.param("id"));
  const { vote_type } = c.req.valid("json");
  const board = await one<{ id: number }>("SELECT id FROM boards WHERE public_key = $1 AND is_public = TRUE", [publicKey]);
  if (!board) return c.json({ error: "Board not found or not public" }, 404);
  const column = vote_type === "upvote" ? "upvotes" : "downvotes";
  // Scope the task to THIS board so a public link can't touch other boards'
  // cards, and return only the vote counts (never the full row).
  const task = await one<{ id: number; upvotes: number; downvotes: number }>(
    `UPDATE tasks t SET ${column} = ${column} + 1, updated_at = now()
     FROM columns c
     WHERE t.id = $1 AND t.column_id = c.id AND c.board_id = $2
     RETURNING t.id, t.upvotes, t.downvotes`,
    [taskId, board.id]
  );
  if (!task) return c.json({ error: "Task not found" }, 404);
  return c.json(task);
});

/* ----------------------------- Invitations (auth + ownership) ----------------------------- */

async function sendInviteEmail(opts: {
  email: string;
  boardTitle: string;
  columnName: string | null;
  isBeta: boolean;
  inviteUrl: string;
}): Promise<{ sent: boolean; error: string | null }> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) return { sent: false, error: "RESEND_API_KEY not configured" };
  // Escape owner-controlled text before it goes into the email HTML.
  const boardTitleHtml = escapeHtml(opts.boardTitle);
  const columnNameHtml = opts.columnName ? escapeHtml(opts.columnName) : null;
  const { isBeta, inviteUrl } = opts;
  try {
    const from = process.env.RESEND_FROM || "Canflow <onboarding@resend.dev>";
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: opts.email,
        subject: isBeta ? `You're invited to beta test: ${opts.boardTitle}` : `You're invited to collaborate on: ${opts.boardTitle}`,
        html: `<div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h1 style="color:#1f2937">${isBeta ? "Beta Testing Invitation" : "You're invited"}</h1><h2 style="color:#1f2937">${boardTitleHtml}</h2>${columnNameHtml ? `<p style="color:#6b7280">Phase: <strong>${columnNameHtml}</strong></p>` : ""}<p style="color:#6b7280">${isBeta ? "Help us improve by reporting bugs and feedback." : `You've been given access to the ${columnNameHtml ? `"${columnNameHtml}" phase` : "board"}. Add and view items there.`}</p><p><a href="${inviteUrl}" style="background:#1d1d1f;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;display:inline-block">${isBeta ? "Join Beta Testing" : "Open the board"}</a></p><p style="word-break:break-all;background:#f3f4f6;padding:8px;border-radius:4px;font-family:monospace">${inviteUrl}</p></div>`,
      }),
    });
    const rd = (await response.json()) as { message?: string };
    if (response.ok) return { sent: true, error: null };
    return { sent: false, error: rd.message || `HTTP ${response.status}` };
  } catch (error) {
    return { sent: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

app.post("/invitations", zValidator("json", CreateInvitationSchema), async (c) => {
  if (!(await rateLimit(c, "invite", 20, 60))) return c.json({ error: "Too many invites at once. Please wait a minute." }, 429);
  const uid = await getUserId(c);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
  const data = c.req.valid("json");
  if (!(await ownsBoard(data.board_id, uid))) return c.json({ error: "Board not found" }, 404);

  try {
    const board = await one<{ title: string; board_type: string }>("SELECT title, board_type FROM boards WHERE id = $1", [data.board_id]);
    if (!board) return c.json({ error: "Board not found" }, 404);
    const isBeta = board.board_type === "beta-testing";

    // Re-inviting an email that already has an invite on this board reuses the
    // existing row (same token/link) instead of consuming another tester slot.
    const existing = await one<{ id: number; token: string }>(
      "SELECT id, token FROM invitations WHERE board_id = $1 AND lower(email) = lower($2)",
      [data.board_id, data.email]
    );

    if (!existing && effectivePlan(await ensureSettings(uid)) === "free") {
      const count = await one<{ n: number }>(
        "SELECT count(*)::int AS n FROM invitations i JOIN boards b ON b.id = i.board_id WHERE b.owner_id = $1",
        [uid]
      );
      if ((count?.n ?? 0) >= FREE.testers) {
        return overLimit(c, "tester_limit", `Free plan is limited to ${FREE.testers} testers. Upgrade to Pro to invite unlimited testers.`);
      }
    }

    let invitation;
    if (existing) {
      invitation = await one(
        `UPDATE invitations SET column_id = $1, updated_at = now() WHERE id = $2 RETURNING *`,
        [data.column_id ?? null, existing.id]
      );
    } else {
      invitation = await one(
        `INSERT INTO invitations (board_id, column_id, email, invited_by, token, updated_at)
         VALUES ($1, $2, $3, $4, $5, now()) RETURNING *`,
        [data.board_id, data.column_id ?? null, data.email, data.invited_by ?? null, crypto.randomUUID()]
      );
    }

    let columnName: string | null = null;
    if (data.column_id) {
      const column = await one<{ title: string }>("SELECT title FROM columns WHERE id = $1", [data.column_id]);
      columnName = column?.title ?? null;
    }

    const inviteUrl = `${new URL(c.req.url).origin}/invited/${(invitation as { token: string }).token}`;
    const { sent: emailSent, error: emailError } = await sendInviteEmail({
      email: data.email,
      boardTitle: board.title,
      columnName,
      isBeta,
      inviteUrl,
    });

    return c.json(
      {
        success: true,
        invitation,
        reinvited: !!existing,
        emailSent,
        emailError,
        inviteUrl,
        message: emailSent
          ? `Invitation email sent successfully to ${data.email}!`
          : `Invitation created successfully! Share this link manually: ${inviteUrl}`,
      },
      existing ? 200 : 201
    );
  } catch (error) {
    console.error("Database error creating invitation:", error);
    return c.json({ error: "Failed to create invitation", details: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

app.get("/invitations/:boardId", async (c) => {
  const uid = await getUserId(c);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
  const boardId = parseInt(c.req.param("boardId"));
  if (!(await ownsBoard(boardId, uid))) return c.json({ error: "Board not found" }, 404);
  const invitations = await query("SELECT * FROM invitations WHERE board_id = $1 ORDER BY created_at DESC", [boardId]);
  return c.json(invitations);
});

// Re-send the invite email for an existing invitation (same link/token).
app.post("/invitations/:id/resend", async (c) => {
  if (!(await rateLimit(c, "invite", 20, 60))) return c.json({ error: "Too many invites at once. Please wait a minute." }, 429);
  const uid = await getUserId(c);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
  const id = parseInt(c.req.param("id"));
  const inv = await one<{ id: number; email: string; token: string; column_id: number | null; title: string; board_type: string }>(
    `SELECT i.id, i.email, i.token, i.column_id, b.title, b.board_type
     FROM invitations i JOIN boards b ON b.id = i.board_id
     WHERE i.id = $1 AND b.owner_id = $2`,
    [id, uid]
  );
  if (!inv) return c.json({ error: "Invitation not found" }, 404);
  let columnName: string | null = null;
  if (inv.column_id) {
    const column = await one<{ title: string }>("SELECT title FROM columns WHERE id = $1", [inv.column_id]);
    columnName = column?.title ?? null;
  }
  const inviteUrl = `${new URL(c.req.url).origin}/invited/${inv.token}`;
  const { sent: emailSent, error: emailError } = await sendInviteEmail({
    email: inv.email,
    boardTitle: inv.title,
    columnName,
    isBeta: inv.board_type === "beta-testing",
    inviteUrl,
  });
  return c.json({ success: true, emailSent, emailError, inviteUrl });
});

// Revoke an invitation — its link stops working immediately.
app.delete("/invitations/:id", async (c) => {
  const uid = await getUserId(c);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
  const id = parseInt(c.req.param("id"));
  const row = await one<{ id: number }>(
    `DELETE FROM invitations i USING boards b
     WHERE i.id = $1 AND b.id = i.board_id AND b.owner_id = $2
     RETURNING i.id`,
    [id, uid]
  );
  if (!row) return c.json({ error: "Invitation not found" }, 404);
  return c.json({ success: true });
});

/* ----------------------------- Beta categories (auth + ownership) ----------------------------- */

app.post("/beta-categories", zValidator("json", CreateBetaCategorySchema), async (c) => {
  const uid = await getUserId(c);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
  const data = c.req.valid("json");
  if (!(await ownsBoard(data.board_id, uid))) return c.json({ error: "Board not found" }, 404);
  const category = await one(
    `INSERT INTO beta_categories (board_id, name, color, updated_at) VALUES ($1, $2, $3, now()) RETURNING *`,
    [data.board_id, data.name, data.color ?? "#6b7280"]
  );
  return c.json(category, 201);
});

app.get("/beta-categories/:boardId", async (c) => {
  const uid = await getUserId(c);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
  const boardId = parseInt(c.req.param("boardId"));
  if (!(await ownsBoard(boardId, uid))) return c.json({ error: "Board not found" }, 404);
  const categories = await query("SELECT * FROM beta_categories WHERE board_id = $1 ORDER BY name", [boardId]);
  return c.json(categories);
});

/* ----------------------------- Plan / billing ----------------------------- */

app.get("/plan", async (c) => {
  const uid = await getUserId(c);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
  const s = await ensureSettings(uid);
  const plan = effectivePlan(s);
  const trialing = plan === "pro" && s.plan !== "pro" && !!s.trial_ends_at && new Date(s.trial_ends_at).getTime() > Date.now();
  const boards = await one<{ n: number }>("SELECT count(*)::int AS n FROM boards WHERE owner_id = $1", [uid]);
  const testers = await one<{ n: number }>(
    "SELECT count(*)::int AS n FROM invitations i JOIN boards b ON b.id = i.board_id WHERE b.owner_id = $1",
    [uid]
  );
  const agentUsed = s.agent_month === currentMonth() ? (s.agent_count ?? 0) : 0;
  const billing = await one<{ stripe_customer_id: string | null; subscription_status: string | null; onboarded: boolean | null }>(
    "SELECT stripe_customer_id, subscription_status, onboarded FROM user_settings WHERE user_id = $1",
    [uid]
  );
  return c.json({
    plan,
    trialing,
    trial_ends_at: trialing ? s.trial_ends_at : null,
    limits: FREE,
    usage: { boards: boards?.n ?? 0, testers: testers?.n ?? 0, agentActions: agentUsed },
    price: { pro_monthly: 7 },
    manageable: !!billing?.stripe_customer_id,
    subscription_status: billing?.subscription_status ?? null,
    billing_enabled: !!process.env.STRIPE_SECRET_KEY,
    onboarded: !!billing?.onboarded,
  });
});

// Mark first-run onboarding complete.
app.post("/onboarding/complete", async (c) => {
  const uid = await getUserId(c);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
  await ensureSettings(uid);
  await query("UPDATE user_settings SET onboarded = true, updated_at = now() WHERE user_id = $1", [uid]);
  return c.json({ ok: true });
});

/* ----------------------------- Stripe billing ----------------------------- */

const stripeKey = () => process.env.STRIPE_SECRET_KEY || "";
const stripePrice = () => process.env.STRIPE_PRICE_ID || "";

// Start a Stripe Checkout session for a Pro subscription; returns the hosted checkout URL.
app.post("/billing/checkout", async (c) => {
  if (!(await rateLimit(c, "checkout", 8, 60))) return c.json({ error: "Too many checkout attempts. Please wait a minute." }, 429);
  const uid = await getUserId(c);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
  if (!stripeKey() || !stripePrice()) return c.json({ error: "Billing isn't configured yet." }, 503);
  await ensureSettings(uid);
  const body = await c.req.json().catch(() => ({}));
  const email = typeof body.email === "string" && body.email.trim() ? body.email.trim() : undefined;
  const origin = new URL(c.req.url).origin;
  try {
    let s = await one<{ stripe_customer_id: string | null }>("SELECT stripe_customer_id FROM user_settings WHERE user_id = $1", [uid]);
    let customer = s?.stripe_customer_id ?? "";
    if (!customer) {
      const cust = await stripeFetch(stripeKey(), "customers", { email, "metadata[uid]": uid });
      customer = cust.id;
      await query("UPDATE user_settings SET stripe_customer_id = $1, updated_at = now() WHERE user_id = $2", [customer, uid]);
    }
    const session = await stripeFetch(stripeKey(), "checkout/sessions", {
      mode: "subscription",
      customer,
      "line_items[0][price]": stripePrice(),
      "line_items[0][quantity]": 1,
      success_url: `${origin}/?billing=success`,
      cancel_url: `${origin}/?billing=cancel`,
      client_reference_id: uid,
      "subscription_data[metadata][uid]": uid,
      allow_promotion_codes: "true",
    });
    return c.json({ url: session.url });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "Checkout failed" }, 500);
  }
});

// Open the Stripe billing portal (manage / cancel subscription).
app.post("/billing/portal", async (c) => {
  const uid = await getUserId(c);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
  if (!stripeKey()) return c.json({ error: "Billing isn't configured yet." }, 503);
  const s = await one<{ stripe_customer_id: string | null }>("SELECT stripe_customer_id FROM user_settings WHERE user_id = $1", [uid]);
  if (!s?.stripe_customer_id) return c.json({ error: "No billing account yet." }, 400);
  const origin = new URL(c.req.url).origin;
  try {
    const session = await stripeFetch(stripeKey(), "billing_portal/sessions", { customer: s.stripe_customer_id, return_url: `${origin}/` });
    return c.json({ url: session.url });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "Could not open billing portal" }, 500);
  }
});

// Stripe webhook - the source of truth for subscription state. No user auth (Stripe-signed).
app.post("/billing/webhook", async (c) => {
  const raw = await c.req.text();
  const sig = c.req.header("stripe-signature") || "";
  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    event = await verifyStripeEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET || "");
  } catch {
    return c.json({ error: "Invalid signature" }, 400);
  }
  const obj = event.data.object as Record<string, string>;
  if (event.type === "checkout.session.completed") {
    const uid = obj.client_reference_id;
    if (uid) {
      await query(
        "UPDATE user_settings SET plan = 'pro', stripe_customer_id = $1, stripe_subscription_id = $2, subscription_status = 'active', updated_at = now() WHERE user_id = $3",
        [obj.customer, obj.subscription, uid]
      );
    }
  } else if (event.type === "customer.subscription.updated") {
    const status = obj.status;
    const plan = ["active", "trialing", "past_due"].includes(status) ? "pro" : "free";
    await query("UPDATE user_settings SET plan = $1, subscription_status = $2, updated_at = now() WHERE stripe_customer_id = $3", [plan, status, obj.customer]);
  } else if (event.type === "customer.subscription.deleted") {
    await query("UPDATE user_settings SET plan = 'free', subscription_status = 'canceled', updated_at = now() WHERE stripe_customer_id = $1", [obj.customer]);
  }
  return c.json({ received: true });
});

/* ----------------------------- Auth emails (Neon Auth webhook → Resend) ----------------------------- */

// Neon Auth calls this on send.otp / send.magic_link so we deliver branded emails.
// Secured by a shared secret in the query string (configured in the webhook URL).
app.post("/auth/email", async (c) => {
  const secret = process.env.AUTH_EMAIL_SECRET || "";
  if (!secret || !timingSafeEqual(c.req.query("key") || "", secret)) return c.json({ error: "Unauthorized" }, 401);
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) return c.json({ error: "Email not configured" }, 503);
  const evt = await c.req.json().catch(() => null);
  if (!evt) return c.json({ error: "Bad payload" }, 400);
  const mail = buildAuthEmail(evt);
  if (!mail) return c.json({ received: true, skipped: true }); // unrelated event → ack
  const from = process.env.RESEND_FROM || "Canflow <noreply@canflow.app>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: mail.to, subject: mail.subject, html: mail.html }),
  });
  if (!res.ok) {
    const d = (await res.json().catch(() => ({}))) as { message?: string };
    return c.json({ error: d.message || `Resend ${res.status}` }, 502);
  }
  return c.json({ received: true });
});

/* ----------------------------- Settings + team (auth required) ----------------------------- */

app.get("/settings", async (c) => {
  const uid = await getUserId(c);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
  const row = await one<{ org_name: string | null; org_image: string | null }>(
    "SELECT org_name, org_image FROM user_settings WHERE user_id = $1",
    [uid]
  );
  return c.json({ org_name: row?.org_name ?? null, org_image: row?.org_image ?? null });
});

app.put("/settings", async (c) => {
  const uid = await getUserId(c);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
  const body = await c.req.json().catch(() => ({}));
  const orgName = typeof body.org_name === "string" && body.org_name.trim() ? body.org_name.trim() : null;
  const orgImage = typeof body.org_image === "string" && body.org_image ? body.org_image : null;
  await query(
    `INSERT INTO user_settings (user_id, org_name, org_image, updated_at) VALUES ($1, $2, $3, now())
     ON CONFLICT (user_id) DO UPDATE SET org_name = EXCLUDED.org_name, org_image = EXCLUDED.org_image, updated_at = now()`,
    [uid, orgName, orgImage]
  );
  return c.json({ org_name: orgName, org_image: orgImage });
});

/** All beta-tester invitations across the user's boards (for the Members view). */
app.get("/invitations", async (c) => {
  const uid = await getUserId(c);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
  const rows = await query(
    `SELECT i.id, i.email, i.status, i.token, i.created_at, i.board_id, b.title AS board_title
     FROM invitations i JOIN boards b ON b.id = i.board_id
     WHERE b.owner_id = $1
     ORDER BY i.created_at DESC`,
    [uid]
  );
  return c.json(rows);
});

/* ----------------------------- API tokens (for MCP / agents) ----------------------------- */

app.get("/tokens", async (c) => {
  const uid = await getUserId(c);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
  const rows = await query(
    "SELECT id, name, token_prefix, created_at, last_used_at FROM api_tokens WHERE user_id = $1 ORDER BY created_at DESC",
    [uid]
  );
  return c.json(rows);
});

app.post("/tokens", async (c) => {
  const uid = await getUserId(c);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
  const body = await c.req.json().catch(() => ({}));
  const name = (typeof body.name === "string" && body.name.trim()) || "Token";
  const rand = [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const token = `cf_${rand}`;
  const hash = await sha256hex(token);
  const prefix = `${token.slice(0, 11)}…`;
  // Store only the hash — never the plaintext. The token is returned once here
  // and can never be retrieved again.
  const row = await one<Record<string, unknown>>(
    "INSERT INTO api_tokens (user_id, name, token_hash, token_prefix) VALUES ($1, $2, $3, $4) RETURNING id, name, token_prefix, created_at",
    [uid, name, hash, prefix]
  );
  return c.json({ ...row, token }, 201);
});

app.delete("/tokens/:id", async (c) => {
  const uid = await getUserId(c);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
  await query("DELETE FROM api_tokens WHERE id = $1 AND user_id = $2", [parseInt(c.req.param("id")), uid]);
  return c.json({ success: true });
});

/* ----------------------------- Issues API (agent-facing) ----------------------------- */

// List cards for agents. Default: bug/issue cards from beta-testing boards.
// ?queued=1 returns every card a human queued for an agent across ALL board
// types (Task Manager, Roadmap, Beta) — the agent's pickup queue. Optional
// ?phase= and ?board_id=.
app.get("/issues", async (c) => {
  const uid = await getUserId(c);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
  const phase = c.req.query("phase");
  const boardId = c.req.query("board_id");
  const queued = c.req.query("queued");
  const params: unknown[] = [uid];
  let sqlText = `
    SELECT t.id, t.title, t.description, t.priority, t.intensity, t.category, t.image_url,
           t.agent, t.agent_status, t.agent_note,
           b.id AS board_id, b.title AS board_title, b.board_type, b.github_repo,
           col.id AS column_id, col.title AS phase
    FROM tasks t
    JOIN columns col ON col.id = t.column_id
    JOIN boards b ON b.id = col.board_id
    WHERE b.owner_id = $1`;
  if (queued) sqlText += ` AND t.agent_status = 'queued'`;
  else sqlText += ` AND b.board_type = 'beta-testing'`;
  if (boardId) { params.push(parseInt(boardId)); sqlText += ` AND b.id = $${params.length}`; }
  if (phase) { params.push(phase); sqlText += ` AND lower(col.title) = lower($${params.length})`; }
  sqlText += ` ORDER BY b.id, col.position, t.position`;
  const rows = await query(sqlText, params);
  return c.json(rows);
});

app.get("/issues/:id", async (c) => {
  const uid = await getUserId(c);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
  const id = parseInt(c.req.param("id"));
  const row = await one<{ board_id: number }>(
    `SELECT t.id, t.title, t.description, t.priority, t.intensity, t.category, t.image_url,
            t.agent, t.agent_status, t.agent_note,
            b.id AS board_id, b.title AS board_title, col.id AS column_id, col.title AS phase
     FROM tasks t
     JOIN columns col ON col.id = t.column_id
     JOIN boards b ON b.id = col.board_id
     WHERE t.id = $1 AND b.owner_id = $2`,
    [id, uid]
  );
  if (!row) return c.json({ error: "Issue not found" }, 404);
  const phases = await query<{ title: string }>("SELECT title FROM columns WHERE board_id = $1 ORDER BY position", [row.board_id]);
  // Free plan only sees the recent activity window; Pro sees the full history.
  const free = effectivePlan(await ensureSettings(uid)) === "free";
  const comments = free
    ? await query(
        `SELECT id, author, body, is_system, created_at FROM task_comments
         WHERE task_id = $1 AND created_at > now() - ($2 || ' days')::interval ORDER BY created_at ASC, id ASC`,
        [id, String(FREE.historyDays)]
      )
    : await query(
        "SELECT id, author, body, is_system, created_at FROM task_comments WHERE task_id = $1 ORDER BY created_at ASC, id ASC",
        [id]
      );
  return c.json({ ...row, available_phases: phases.map((p) => p.title), comments });
});

app.post("/issues/:id/move", async (c) => {
  const uid = await getUserId(c);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
  const id = parseInt(c.req.param("id"));
  const body = await c.req.json().catch(() => ({}));
  const phase = typeof body.phase === "string" ? body.phase.trim() : "";
  const note = typeof body.note === "string" ? body.note.trim() : "";
  const agent = cleanAgent(body.agent);
  const status = typeof body.status === "string" ? body.status.trim().toLowerCase() : "";
  if (!phase) return c.json({ error: "phase is required" }, 400);
  const t = await one<{ board_id: number; current_phase: string }>(
    `SELECT col.board_id, col.title AS current_phase FROM tasks t
     JOIN columns col ON col.id = t.column_id
     JOIN boards b ON b.id = col.board_id
     WHERE t.id = $1 AND b.owner_id = $2`,
    [id, uid]
  );
  if (!t) return c.json({ error: "Issue not found" }, 404);
  // An agent-attributed move counts against the monthly agent-action meter (free plan).
  if (agent) {
    const m = await meterAgentAction(uid);
    if (!m.ok) return overLimit(c, "agent_limit", `You've used all ${m.limit} agent actions on the Free plan this month. Upgrade to Pro for unlimited automation.`);
  }
  const target = await one<{ id: number; title: string }>("SELECT id, title FROM columns WHERE board_id = $1 AND lower(title) = lower($2)", [t.board_id, phase]);
  if (!target) {
    const phases = await query<{ title: string }>("SELECT title FROM columns WHERE board_id = $1 ORDER BY position", [t.board_id]);
    return c.json({ error: `Phase "${phase}" not found`, available_phases: phases.map((p) => p.title) }, 400);
  }
  const sets = ["column_id = $1"];
  const vals: unknown[] = [target.id];
  let i = 2;
  if (note) { sets.push(`agent_note = $${i++}`); vals.push(note); }
  if (agent) { sets.push(`agent = $${i++}`); vals.push(agent); }
  if (status) { sets.push(`agent_status = $${i++}`); vals.push(status); }
  sets.push("updated_at = now()");
  vals.push(id);
  const updated = await one(`UPDATE tasks SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`, vals);
  // Timeline: a system note for the phase change, plus the agent's write-up as a comment.
  if (t.current_phase.toLowerCase() !== target.title.toLowerCase()) {
    await addComment(id, agent || null, `Moved **${t.current_phase}** → **${target.title}**`, true);
  }
  if (note) await addComment(id, agent || null, note, false);
  return c.json(updated);
});

// Set agent attribution + status (badge) without moving the card.
// A human assigns a card to a coding agent, queuing it for pickup via MCP. This
// is a human action (not an agent write), so it does NOT count against the
// monthly agent-action meter. Pass agent:"" to unassign.
app.post("/tasks/:id/assign", async (c) => {
  const uid = await getUserId(c);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
  const id = parseInt(c.req.param("id"));
  if (!(await ownsTask(id, uid))) return c.json({ error: "Task not found" }, 404);
  const body = await c.req.json().catch(() => ({}));
  const agent = cleanAgent(body.agent);
  const updated = agent
    ? await one(
        "UPDATE tasks SET agent = $1, agent_status = 'queued', agent_note = NULL, updated_at = now() WHERE id = $2 RETURNING *",
        [agent, id]
      )
    : await one(
        "UPDATE tasks SET agent = NULL, agent_status = NULL, agent_note = NULL, updated_at = now() WHERE id = $1 RETURNING *",
        [id]
      );
  if (agent) await addComment(id, null, `Queued for ${agent === "codex" ? "Codex" : "Claude Code"}.`, true);
  return c.json(updated);
});

app.post("/issues/:id/agent", async (c) => {
  const uid = await getUserId(c);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
  const id = parseInt(c.req.param("id"));
  if (!(await ownsTask(id, uid))) return c.json({ error: "Issue not found" }, 404);
  const meter = await meterAgentAction(uid);
  if (!meter.ok) return overLimit(c, "agent_limit", `You've used all ${meter.limit} agent actions on the Free plan this month. Upgrade to Pro for unlimited automation.`);
  const body = await c.req.json().catch(() => ({}));
  const agent = cleanAgent(body.agent);
  const status = typeof body.status === "string" ? body.status.trim().toLowerCase() : undefined;
  const note = typeof body.note === "string" ? body.note.trim() : undefined;
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  if (agent) { sets.push(`agent = $${i++}`); vals.push(agent); }
  if (status !== undefined) { sets.push(`agent_status = $${i++}`); vals.push(status || null); }
  if (note !== undefined) { sets.push(`agent_note = $${i++}`); vals.push(note || null); }
  if (!sets.length) return c.json({ error: "Provide at least one of agent, status, note" }, 400);
  sets.push("updated_at = now()");
  vals.push(id);
  const updated = await one(`UPDATE tasks SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`, vals);
  return c.json(updated);
});

// Read the activity log / comments for a card.
app.get("/issues/:id/comments", async (c) => {
  const uid = await getUserId(c);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
  const id = parseInt(c.req.param("id"));
  if (!(await ownsTask(id, uid))) return c.json({ error: "Issue not found" }, 404);
  // Free plan only sees the recent activity window; Pro sees the full history.
  const free = effectivePlan(await ensureSettings(uid)) === "free";
  const comments = free
    ? await query(
        `SELECT id, author, body, is_system, created_at FROM task_comments
         WHERE task_id = $1 AND created_at > now() - ($2 || ' days')::interval ORDER BY created_at ASC, id ASC`,
        [id, String(FREE.historyDays)]
      )
    : await query(
        "SELECT id, author, body, is_system, created_at FROM task_comments WHERE task_id = $1 ORDER BY created_at ASC, id ASC",
        [id]
      );
  return c.json(comments);
});

// Append a comment to a card's activity log.
app.post("/issues/:id/comments", async (c) => {
  const uid = await getUserId(c);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
  const id = parseInt(c.req.param("id"));
  if (!(await ownsTask(id, uid))) return c.json({ error: "Issue not found" }, 404);
  const body = await c.req.json().catch(() => ({}));
  const text = typeof body.body === "string" ? body.body.trim() : "";
  const author = typeof body.author === "string" && body.author.trim() ? body.author.trim() : null;
  if (!text) return c.json({ error: "body is required" }, 400);
  const row = await one(
    "INSERT INTO task_comments (task_id, author, body, is_system) VALUES ($1, $2, $3, false) RETURNING id, author, body, is_system, created_at",
    [id, author, text]
  );
  return c.json(row, 201);
});

/* ----------------------------- GitHub bridge ----------------------------- */

app.get("/github", async (c) => {
  const uid = await getUserId(c);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
  const s = await one<{ github_token: string | null }>("SELECT github_token FROM user_settings WHERE user_id = $1", [uid]);
  return c.json({ connected: !!s?.github_token });
});

app.put("/github", async (c) => {
  const uid = await getUserId(c);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
  const body = await c.req.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token.trim() : "";
  // Connecting GitHub is a Pro feature (disconnecting is always allowed).
  if (token && effectivePlan(await ensureSettings(uid)) === "free") {
    return overLimit(c, "pro_feature", "The GitHub bridge is a Pro feature. Upgrade to connect a repo.");
  }
  let login: string | null = null;
  if (token) {
    const r = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${token}`, "User-Agent": "canflow", Accept: "application/vnd.github+json" },
    });
    if (!r.ok) return c.json({ error: "That GitHub token was rejected. Check the token and its scopes (needs 'repo')." }, 400);
    login = ((await r.json()) as { login?: string }).login ?? null;
  }
  await query(
    `INSERT INTO user_settings (user_id, github_token, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (user_id) DO UPDATE SET github_token = EXCLUDED.github_token, updated_at = now()`,
    [uid, token || null]
  );
  return c.json({ connected: !!token, login });
});

// Create a GitHub issue in the board's repo from a card.
app.post("/issues/:id/github", async (c) => {
  const uid = await getUserId(c);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
  const id = parseInt(c.req.param("id"));
  const row = await one<{ title: string; description: string | null; intensity: number | null; priority: string | null; category: string | null; github_repo: string | null; board_title: string }>(
    `SELECT t.title, t.description, t.intensity, t.priority, t.category, b.github_repo, b.title AS board_title
     FROM tasks t JOIN columns col ON col.id = t.column_id JOIN boards b ON b.id = col.board_id
     WHERE t.id = $1 AND b.owner_id = $2`,
    [id, uid]
  );
  if (!row) return c.json({ error: "Issue not found" }, 404);
  if (!row.github_repo) return c.json({ error: "This board has no GitHub repo. Set one via the board's Edit menu." }, 400);
  const s = await one<{ github_token: string | null }>("SELECT github_token FROM user_settings WHERE user_id = $1", [uid]);
  if (!s?.github_token) return c.json({ error: "Connect GitHub in Settings → Developer first." }, 400);

  const sev = row.intensity ? `**Severity:** ${row.intensity}/10` : row.priority ? `**Priority:** ${row.priority}` : "";
  const issueBody = [
    row.description || "",
    "",
    sev,
    row.category ? `**Category:** ${row.category}` : "",
    "",
    `<sub>Filed from Canflow - board "${row.board_title}".</sub>`,
  ].filter(Boolean).join("\n");

  const gh = await fetch(`https://api.github.com/repos/${row.github_repo}/issues`, {
    method: "POST",
    headers: { Authorization: `Bearer ${s.github_token}`, "User-Agent": "canflow", Accept: "application/vnd.github+json", "Content-Type": "application/json" },
    body: JSON.stringify({ title: row.title, body: issueBody }),
  });
  const gd = (await gh.json()) as { number?: number; html_url?: string; message?: string };
  if (!gh.ok) return c.json({ error: `GitHub: ${gd.message || gh.status}` }, 400);
  await query("UPDATE tasks SET github_issue_number = $1, github_url = $2, updated_at = now() WHERE id = $3", [gd.number ?? null, gd.html_url ?? null, id]);
  return c.json({ number: gd.number, url: gd.html_url });
});

// GitHub webhook → sync card status from PR lifecycle. Register at repo Settings → Webhooks.
app.post("/github/webhook", async (c) => {
  const raw = await c.req.text();
  // Require a configured secret and a valid signature — otherwise ignore the
  // event (fail closed) so forged payloads can't move anyone's cards.
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) return c.json({ ok: true, skipped: "webhook secret not configured" });
  if (!(await verifyGithubSignature(secret, raw, c.req.header("X-Hub-Signature-256") || ""))) {
    return c.json({ error: "Invalid signature" }, 401);
  }
  const event = c.req.header("X-GitHub-Event");
  let payload: { action?: string; pull_request?: { title?: string; body?: string; merged?: boolean }; repository?: { full_name?: string } } | null = null;
  try { payload = JSON.parse(raw); } catch { payload = null; }
  if (!payload || event !== "pull_request") return c.json({ ok: true });

  const pr = payload.pull_request;
  const repo = payload.repository?.full_name;
  const action = payload.action;
  if (!pr || !repo) return c.json({ ok: true });

  let phase: string | null = null;
  if (action === "opened" || action === "reopened") phase = "Fixing";
  if (action === "closed" && pr.merged) phase = "Verified";
  if (!phase) return c.json({ ok: true });

  const nums = [...`${pr.title || ""} ${pr.body || ""}`.matchAll(/#(\d+)/g)].map((m) => parseInt(m[1]));
  for (const n of nums) {
    const task = await one<{ id: number; board_id: number }>(
      `SELECT t.id, col.board_id FROM tasks t JOIN columns col ON col.id = t.column_id JOIN boards b ON b.id = col.board_id
       WHERE t.github_issue_number = $1 AND b.github_repo = $2`,
      [n, repo]
    );
    if (!task) continue;
    const col = await one<{ id: number }>("SELECT id FROM columns WHERE board_id = $1 AND lower(title) = lower($2)", [task.board_id, phase]);
    if (col) await query("UPDATE tasks SET column_id = $1, updated_at = now() WHERE id = $2", [col.id, task.id]);
  }
  return c.json({ ok: true });
});

/* ----------------------------- Invited access (open, token-scoped) ----------------------------- */

app.get("/invited/:token", async (c) => {
  const token = c.req.param("token");
  const invitation = await one<{ board_id: number; column_id: number | null; status: string }>(
    "SELECT * FROM invitations WHERE token = $1 AND status IN ('pending', 'accepted')",
    [token]
  );
  if (!invitation) return c.json({ error: "Invalid or expired invitation" }, 404);
  // First open marks the invite accepted, so the owner can see who joined.
  if (invitation.status === "pending") {
    await query("UPDATE invitations SET status = 'accepted', updated_at = now() WHERE token = $1", [token]);
  }
  const board = await one<Board>("SELECT * FROM boards WHERE id = $1", [invitation.board_id]);
  if (!board) return c.json({ error: "Board not found" }, 404);
  const boardWithColumns = await assembleBoard(board);
  return c.json({ board: boardWithColumns, invitation, allowedColumnId: invitation.column_id });
});

// Invited members add items ONLY to the column they were granted. The column is
// taken from the invite token, never the client, so access can't be widened.
app.post("/invited/:token/tasks", async (c) => {
  if (!(await rateLimit(c, "invited-task", 30, 60))) return c.json({ error: "Too many requests. Please wait a minute." }, 429);
  const token = c.req.param("token");
  const invitation = await one<{ column_id: number | null }>(
    "SELECT column_id FROM invitations WHERE token = $1 AND status IN ('pending', 'accepted')",
    [token]
  );
  if (!invitation || !invitation.column_id) return c.json({ error: "Invalid or expired invitation" }, 404);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return c.json({ error: "Title is required" }, 400);
  const colId = invitation.column_id;
  const posRow = await one<{ n: number }>("SELECT COALESCE(MAX(position) + 1, 0) AS n FROM tasks WHERE column_id = $1", [colId]);
  const task = await one<Task>(
    `INSERT INTO tasks (column_id, title, description, position, priority, start_date, due_date, category, intensity, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now()) RETURNING *`,
    [
      colId,
      title,
      typeof body.description === "string" ? body.description : null,
      posRow?.n ?? 0,
      typeof body.priority === "string" ? body.priority : null,
      typeof body.start_date === "string" ? body.start_date : null,
      typeof body.due_date === "string" ? body.due_date : null,
      typeof body.category === "string" ? body.category : null,
      typeof body.intensity === "number" ? body.intensity : 0,
    ]
  );
  return c.json(task, 201);
});

export default app;
