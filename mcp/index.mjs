#!/usr/bin/env node
/**
 * Canflow MCP server.
 * Lets an MCP client (Claude Code, Codex, etc.) read and update Canflow issue cards.
 *
 * Env:
 *   CANFLOW_TOKEN    (required) — a token from Canflow → Settings → Developer
 *   CANFLOW_API_URL  (optional) — defaults to https://canflow.app
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const TOKEN = process.env.CANFLOW_TOKEN;
const API = (process.env.CANFLOW_API_URL || "https://canflow.app").replace(/\/$/, "");

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

const server = new McpServer({ name: "canflow", version: "1.0.0" });

server.registerTool(
  "list_issues",
  {
    title: "List issues",
    description:
      "List bug/issue cards from your Canflow beta-testing boards. Optionally filter by phase (column name, e.g. \"Issues Identified\") or board_id. Use this to pull the queue of issues to work on.",
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
      "Get full details of one Canflow issue by id: title, description, severity/intensity, category, attached screenshot URL, current phase, and the phases it can be moved to.",
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
      "Optionally pass agent (\"claude\" or \"codex\") and status (\"confirmed\" | \"fixing\" | \"fixed\" | \"blocked\" | \"not_a_bug\") to stamp the card with a status badge, and note to append a short comment/status update onto the card.",
    inputSchema: {
      id: z.number(),
      phase: z.string(),
      agent: z.enum(["claude", "codex"]).optional(),
      status: z.enum(["confirmed", "fixing", "fixed", "blocked", "not_a_bug"]).optional(),
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

await server.connect(new StdioServerTransport());
console.error(`canflow-mcp connected → ${API}`);
