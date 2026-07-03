import { Hono } from "hono";
import { cors } from "hono/cors";
import { zValidator } from "@hono/zod-validator";
import { jwtVerify, createRemoteJWKSet } from "jose";
import type { Context } from "hono";
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

app.use("*", cors());

/* ----------------------------- Auth (Neon Auth / Better Auth) ----------------------------- */

const JWKS_URL =
  process.env.NEON_AUTH_JWKS_URL ||
  "https://ep-soft-brook-atvks9ki.neonauth.c-9.us-east-1.aws.neon.tech/neondb/auth/.well-known/jwks.json";
const jwks = createRemoteJWKSet(new URL(JWKS_URL));

async function sha256hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
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

/* ----------------------------- Boards (auth required) ----------------------------- */

app.get("/boards", async (c) => {
  const uid = await getUserId(c);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
  const boards = await query<Board>("SELECT * FROM boards WHERE owner_id = $1 ORDER BY created_at DESC", [uid]);
  return c.json(boards);
});

app.get("/boards/:id", async (c) => {
  const uid = await getUserId(c);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
  const id = parseInt(c.req.param("id"));
  const board = await one<Board>("SELECT * FROM boards WHERE id = $1 AND owner_id = $2", [id, uid]);
  if (!board) return c.json({ error: "Board not found" }, 404);

  const columns = await query<Column>("SELECT * FROM columns WHERE board_id = $1 ORDER BY position", [id]);
  const boardWithColumns: BoardWithColumns = { ...board, columns: [] };
  for (const column of columns) {
    const tasks = await query<Task>("SELECT * FROM tasks WHERE column_id = $1 ORDER BY position", [column.id]);
    boardWithColumns.columns.push({ ...column, tasks });
  }
  return c.json(boardWithColumns);
});

app.post("/boards", zValidator("json", CreateBoardSchema), async (c) => {
  const uid = await getUserId(c);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
  const data = c.req.valid("json");
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
  const task = await one<Task>(
    `INSERT INTO tasks (column_id, title, description, position, priority, due_date, tags, intensity, category, image_url, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now()) RETURNING *`,
    [data.column_id, data.title, data.description ?? null, data.position, data.priority ?? null, data.due_date ?? null, data.tags ?? null, data.intensity ?? 0, data.category ?? null, data.image_url ?? null]
  );
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
  const task = await one<Task>(
    `UPDATE tasks SET column_id = $1, position = $2, updated_at = now() WHERE id = $3 RETURNING *`,
    [column_id, position, id]
  );
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
  const board = await one<Board>("SELECT * FROM boards WHERE public_key = $1 AND is_public = TRUE", [publicKey]);
  if (!board) return c.json({ error: "Board not found or not public" }, 404);
  const columns = await query<Column>("SELECT * FROM columns WHERE board_id = $1 ORDER BY position", [board.id]);
  const boardWithColumns: BoardWithColumns = { ...board, columns: [] };
  for (const column of columns) {
    const tasks = await query<Task>("SELECT * FROM tasks WHERE column_id = $1 ORDER BY position", [column.id]);
    boardWithColumns.columns.push({ ...column, tasks });
  }
  return c.json(boardWithColumns);
});

app.post("/public/:publicKey/tasks/:id/vote", zValidator("json", VoteTaskSchema), async (c) => {
  const publicKey = c.req.param("publicKey");
  const taskId = parseInt(c.req.param("id"));
  const { vote_type } = c.req.valid("json");
  const board = await one<{ id: number }>("SELECT id FROM boards WHERE public_key = $1 AND is_public = TRUE", [publicKey]);
  if (!board) return c.json({ error: "Board not found or not public" }, 404);
  const column = vote_type === "upvote" ? "upvotes" : "downvotes";
  const task = await one<Task>(`UPDATE tasks SET ${column} = ${column} + 1 WHERE id = $1 RETURNING *`, [taskId]);
  return c.json(task);
});

/* ----------------------------- Invitations (auth + ownership) ----------------------------- */

app.post("/invitations", zValidator("json", CreateInvitationSchema), async (c) => {
  const uid = await getUserId(c);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
  const data = c.req.valid("json");
  if (!(await ownsBoard(data.board_id, uid))) return c.json({ error: "Board not found" }, 404);
  const token = crypto.randomUUID();

  try {
    const board = await one<{ title: string }>("SELECT title FROM boards WHERE id = $1", [data.board_id]);
    if (!board) return c.json({ error: "Board not found" }, 404);

    let columnName: string | null = null;
    if (data.column_id) {
      const column = await one<{ title: string }>("SELECT title FROM columns WHERE id = $1", [data.column_id]);
      columnName = column?.title ?? null;
    }

    const invitation = await one(
      `INSERT INTO invitations (board_id, column_id, email, invited_by, token, updated_at)
       VALUES ($1, $2, $3, $4, $5, now()) RETURNING *`,
      [data.board_id, data.column_id ?? null, data.email, data.invited_by ?? null, token]
    );

    const inviteUrl = `${new URL(c.req.url).origin}/invited/${token}`;
    let emailSent = false;
    let emailError: string | null = null;
    const RESEND_API_KEY = process.env.RESEND_API_KEY;

    if (RESEND_API_KEY) {
      try {
        const from = process.env.RESEND_FROM || "Canflow <onboarding@resend.dev>";
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from,
            to: data.email,
            subject: `You're invited to beta test: ${board.title}`,
            html: `<div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h1 style="color:#1f2937">Beta Testing Invitation</h1><h2 style="color:#1f2937">${board.title}</h2>${columnName ? `<p style="color:#6b7280">Phase: <strong>${columnName}</strong></p>` : ""}<p style="color:#6b7280">Help us improve by reporting bugs and feedback.</p><p><a href="${inviteUrl}" style="background:#1d1d1f;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;display:inline-block">Join Beta Testing</a></p><p style="word-break:break-all;background:#f3f4f6;padding:8px;border-radius:4px;font-family:monospace">${inviteUrl}</p></div>`,
          }),
        });
        const rd = (await response.json()) as { message?: string };
        if (response.ok) emailSent = true;
        else emailError = rd.message || `HTTP ${response.status}`;
      } catch (error) {
        emailError = error instanceof Error ? error.message : "Unknown error";
      }
    } else {
      emailError = "RESEND_API_KEY not configured";
    }

    return c.json(
      {
        success: true,
        invitation,
        emailSent,
        emailError,
        inviteUrl,
        message: emailSent
          ? `Invitation email sent successfully to ${data.email}!`
          : `Invitation created successfully! Share this link manually: ${inviteUrl}`,
      },
      201
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

/* ----------------------------- Settings + team (auth required) ----------------------------- */

app.get("/settings", async (c) => {
  const uid = await getUserId(c);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
  const row = await one<{ org_name: string | null }>("SELECT org_name FROM user_settings WHERE user_id = $1", [uid]);
  return c.json({ org_name: row?.org_name ?? null });
});

app.put("/settings", async (c) => {
  const uid = await getUserId(c);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
  const body = await c.req.json().catch(() => ({}));
  const orgName = typeof body.org_name === "string" ? body.org_name.trim() : null;
  await query(
    `INSERT INTO user_settings (user_id, org_name, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (user_id) DO UPDATE SET org_name = EXCLUDED.org_name, updated_at = now()`,
    [uid, orgName || null]
  );
  return c.json({ org_name: orgName || null });
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
    "SELECT id, name, token_prefix, token, created_at, last_used_at FROM api_tokens WHERE user_id = $1 ORDER BY created_at DESC",
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
  const row = await one(
    "INSERT INTO api_tokens (user_id, name, token_hash, token_prefix, token) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, token_prefix, token, created_at",
    [uid, name, hash, prefix, token]
  );
  return c.json(row, 201);
});

app.delete("/tokens/:id", async (c) => {
  const uid = await getUserId(c);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
  await query("DELETE FROM api_tokens WHERE id = $1 AND user_id = $2", [parseInt(c.req.param("id")), uid]);
  return c.json({ success: true });
});

/* ----------------------------- Issues API (agent-facing) ----------------------------- */

// List bug/issue cards from the user's beta-testing boards. Optional ?phase= and ?board_id=.
app.get("/issues", async (c) => {
  const uid = await getUserId(c);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
  const phase = c.req.query("phase");
  const boardId = c.req.query("board_id");
  const params: unknown[] = [uid];
  let sqlText = `
    SELECT t.id, t.title, t.description, t.priority, t.intensity, t.category, t.image_url,
           t.agent, t.agent_status, t.agent_note,
           b.id AS board_id, b.title AS board_title, col.id AS column_id, col.title AS phase
    FROM tasks t
    JOIN columns col ON col.id = t.column_id
    JOIN boards b ON b.id = col.board_id
    WHERE b.owner_id = $1 AND b.board_type = 'beta-testing'`;
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
  return c.json({ ...row, available_phases: phases.map((p) => p.title) });
});

app.post("/issues/:id/move", async (c) => {
  const uid = await getUserId(c);
  if (!uid) return c.json({ error: "Unauthorized" }, 401);
  const id = parseInt(c.req.param("id"));
  const body = await c.req.json().catch(() => ({}));
  const phase = typeof body.phase === "string" ? body.phase.trim() : "";
  const note = typeof body.note === "string" ? body.note.trim() : "";
  const agent = typeof body.agent === "string" && ["claude", "codex"].includes(body.agent.trim().toLowerCase())
    ? body.agent.trim().toLowerCase()
    : "";
  const status = typeof body.status === "string" ? body.status.trim().toLowerCase() : "";
  if (!phase) return c.json({ error: "phase is required" }, 400);
  const t = await one<{ board_id: number }>(
    `SELECT col.board_id FROM tasks t
     JOIN columns col ON col.id = t.column_id
     JOIN boards b ON b.id = col.board_id
     WHERE t.id = $1 AND b.owner_id = $2`,
    [id, uid]
  );
  if (!t) return c.json({ error: "Issue not found" }, 404);
  const target = await one<{ id: number }>("SELECT id FROM columns WHERE board_id = $1 AND lower(title) = lower($2)", [t.board_id, phase]);
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
  return c.json(updated);
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
    `<sub>Filed from Canflow — board "${row.board_title}".</sub>`,
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
  const event = c.req.header("X-GitHub-Event");
  const payload = (await c.req.json().catch(() => null)) as
    | { action?: string; pull_request?: { title?: string; body?: string; merged?: boolean }; repository?: { full_name?: string } }
    | null;
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
  const invitation = await one<{ board_id: number; column_id: number | null }>(
    "SELECT * FROM invitations WHERE token = $1 AND status = 'pending'",
    [token]
  );
  if (!invitation) return c.json({ error: "Invalid or expired invitation" }, 404);
  const board = await one<Board>("SELECT * FROM boards WHERE id = $1", [invitation.board_id]);
  if (!board) return c.json({ error: "Board not found" }, 404);
  const columns = await query<Column>("SELECT * FROM columns WHERE board_id = $1 ORDER BY position", [invitation.board_id]);
  const boardWithColumns: BoardWithColumns = { ...board, columns: [] };
  for (const column of columns) {
    const tasks = await query<Task>("SELECT * FROM tasks WHERE column_id = $1 ORDER BY position", [column.id]);
    boardWithColumns.columns.push({ ...column, tasks });
  }
  return c.json({ board: boardWithColumns, invitation, allowedColumnId: invitation.column_id });
});

export default app;
