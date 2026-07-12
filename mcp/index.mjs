#!/usr/bin/env node
/**
 * Canflow MCP server.
 * Lets an MCP client (Claude Code, Codex, etc.) read and update Canflow issue cards.
 *
 * Env:
 *   CANFLOW_TOKEN    (required) — a token from Canflow → Settings → Developer
 *   CANFLOW_API_URL  (optional) — defaults to https://boards.canflow.app
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const TOKEN = process.env.CANFLOW_TOKEN;
const API = (process.env.CANFLOW_API_URL || "https://boards.canflow.app").replace(/\/$/, "");

if (!TOKEN) {
  console.error("CANFLOW_TOKEN is required. Create one in Canflow → Settings → Developer.");
  process.exit(1);
}

async function api(path, opts = {}) {
  const res = await fetch(`${API}/api${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) throw new Error(typeof data === "string" ? data : JSON.stringify(data));
  return data;
}

const ok = (obj) => ({ content: [{ type: "text", text: JSON.stringify(obj, null, 2) }] });

const server = new McpServer({ name: "canflow", version: "1.5.0" });

server.registerTool(
  "list_queued",
  {
    title: "List queued work",
    description:
      "Your pickup queue. Lists every card a human has queued for a coding agent (agent_status \"queued\") across ALL board types — Task Manager, Roadmap, and Beta. Call this FIRST to find what to work next. Each card includes id, title, description, board_title, phase, board_type, the agent it's queued for, and the board's github_repo if set. " +
      "Per card, the workflow is: update_issue_agent(id, status:\"working\") to claim it → do the work → update_issue_agent(id, status:\"done\", agent_note: one-line summary), plus comment_issue for details and move_issue if the board has phases. Pass your agent identity to see only cards queued for you.",
    inputSchema: { agent: z.string().optional() },
  },
  async ({ agent }) => {
    const rows = await api(`/issues?queued=1`);
    const list = Array.isArray(rows) ? rows : [];
    const filtered = agent ? list.filter((r) => (r.agent || "").toLowerCase().includes(agent.toLowerCase())) : list;
    return ok(filtered);
  }
);

server.registerTool(
  "list_issues",
  {
    title: "List issues",
    description:
      "List bug/issue cards from your Canflow beta-testing boards. Optionally filter by phase (column name, e.g. \"Issues Identified\") or board_id. To find work a human explicitly assigned to you on any board, prefer list_queued.",
    inputSchema: { phase: z.string().optional(), board_id: z.number().optional() },
  },
  async ({ phase, board_id }) => {
    const q = new URLSearchParams();
    if (phase) q.set("phase", phase);
    if (board_id) q.set("board_id", String(board_id));
    return ok(await api(`/issues?${q.toString()}`));
  }
);

server.registerTool(
  "get_issue",
  {
    title: "Get issue",
    description:
      "Get full details of one Canflow issue by id: title, description, severity/intensity, category, attached screenshot URL, current phase, the phases it can be moved to, the current agent attribution (agent / agent_status / agent_note), and the full comments/activity timeline. Read this before working a card to pick up prior context.",
    inputSchema: { id: z.number() },
  },
  async ({ id }) => ok(await api(`/issues/${id}`))
);

server.registerTool(
  "move_issue",
  {
    title: "Move issue",
    description:
      "Move a Canflow issue to a different phase/column to reflect progress (e.g. \"Fixing\" when you start, \"Verified\" or \"Shipped\" when done). " +
      "Optionally pass agent (\"claude\" or \"codex\") and status (\"confirmed\" | \"fixing\" | \"fixed\" | \"verified\" | \"blocked\" | \"not_a_bug\") to stamp the card with a status badge, and note to record a short comment/status update shown in the card's Agent activity section.",
    inputSchema: {
      id: z.number(),
      phase: z.string(),
      agent: z.string().optional(),
      status: z.string().optional(),
      note: z.string().optional(),
    },
  },
  async ({ id, phase, agent, status, note }) => {
    const body = { phase };
    if (agent) body.agent = agent;
    if (status) body.status = status;
    if (note) body.note = note;
    return ok(await api(`/issues/${id}/move`, { method: "POST", body: JSON.stringify(body) }));
  }
);

server.registerTool(
  "update_issue_agent",
  {
    title: "Update issue agent attribution",
    description:
      "Set the coding-agent attribution + status badge on a card WITHOUT moving it. Shows on the board as e.g. \"Working — Claude Code\". Use agent for your identity (e.g. \"claude-code\", \"codex\"), agent_status for the state, and agent_note for a one-line summary of the current state / fix. Claim a queued card with status \"working\", and mark it \"done\" when finished.",
    inputSchema: {
      id: z.number(),
      agent: z.string().optional(),
      agent_status: z.enum(["working", "done", "fixed", "verified", "blocked", "needs-review"]).optional(),
      agent_note: z.string().optional(),
    },
  },
  async ({ id, agent, agent_status, agent_note }) => {
    const body = {};
    if (agent) body.agent = agent;
    if (agent_status) body.status = agent_status;
    if (agent_note !== undefined) body.note = agent_note;
    return ok(await api(`/issues/${id}/agent`, { method: "POST", body: JSON.stringify(body) }));
  }
);

server.registerTool(
  "comment_issue",
  {
    title: "Comment on issue",
    description:
      "Append a comment to a card's activity timeline (append-only — prior comments are preserved). Use this to record root cause, files changed, verification steps, or a fix summary. Markdown supported. Pass author as your agent identity (e.g. \"claude-code\").",
    inputSchema: {
      id: z.number(),
      author: z.string().optional(),
      body: z.string(),
    },
  },
  async ({ id, author, body }) => {
    const payload = { body };
    if (author) payload.author = author;
    return ok(await api(`/issues/${id}/comments`, { method: "POST", body: JSON.stringify(payload) }));
  }
);

await server.connect(new StdioServerTransport());
console.error(`canflow-mcp connected → ${API}`);
