#!/usr/bin/env node
/**
 * canflow-agent — autonomous runner.
 * Polls a Canflow beta-board phase and hands each issue to Claude Code / Codex,
 * moving cards as it works: source → in-progress → done.
 *
 * Env:
 *   CANFLOW_TOKEN            (required) token from Canflow → Settings → Developer
 *   CANFLOW_API_URL          (default https://canflow.app)
 *   CANFLOW_AGENT            claude | codex        (default: claude)
 *   CANFLOW_SOURCE_PHASE     phase to pull from    (default: "Identified Bugs")
 *   CANFLOW_IN_PROGRESS_PHASE                       (default: "Fixing")
 *   CANFLOW_DONE_PHASE                              (default: "Verified")
 *   CANFLOW_BOARD_ID         limit to one board    (optional)
 *   CANFLOW_POLL_SECONDS     poll interval         (default: 30)
 *   CANFLOW_AGENT_CMD        override the command (advanced/testing)
 *
 * Flags: --once  --dry-run  --yes  --agent <claude|codex>  --phase <name>
 */
import { spawn } from "node:child_process";
import { parseArgs } from "node:util";
import readline from "node:readline/promises";

const { values: flags } = parseArgs({
  options: {
    once: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    yes: { type: "boolean", default: false },
    agent: { type: "string" },
    phase: { type: "string" },
  },
});

const TOKEN = process.env.CANFLOW_TOKEN;
const API = (process.env.CANFLOW_API_URL || "https://canflow.app").replace(/\/$/, "");
const AGENT = (flags.agent || process.env.CANFLOW_AGENT || "claude").toLowerCase();
const SOURCE = flags.phase || process.env.CANFLOW_SOURCE_PHASE || "Identified Bugs";
const IN_PROGRESS = process.env.CANFLOW_IN_PROGRESS_PHASE || "Fixing";
const DONE = process.env.CANFLOW_DONE_PHASE || "Verified";
const BOARD = process.env.CANFLOW_BOARD_ID;
const POLL = Math.max(5, parseInt(process.env.CANFLOW_POLL_SECONDS || "30", 10));

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

function buildPrompt(issue) {
  const sev = issue.intensity ? `Severity: ${issue.intensity}/10` : issue.priority ? `Priority: ${issue.priority}` : "";
  return [
    `Fix this issue reported in our Canflow board "${issue.board_title}".`,
    "",
    `Title: ${issue.title}`,
    sev,
    issue.category ? `Category: ${issue.category}` : "",
    issue.description ? `\nDescription:\n${issue.description}` : "",
    "",
    `Investigate the root cause in this codebase, implement a fix, and summarize what you changed.`,
  ].filter((l) => l !== "").join("\n");
}

function agentCommand(prompt) {
  if (process.env.CANFLOW_AGENT_CMD) return [process.env.CANFLOW_AGENT_CMD, [prompt]];
  return AGENT === "codex" ? ["codex", ["exec", prompt]] : ["claude", ["-p", prompt]];
}

function runAgent(prompt) {
  const [cmd, args] = agentCommand(prompt);
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { stdio: "inherit" });
    p.on("close", (code) => resolve(code ?? 1));
    p.on("error", (e) => { console.error(`  ✗ could not launch "${cmd}": ${e.message}`); resolve(1); });
  });
}

let rl;
async function confirm(msg) {
  if (flags.yes) return true;
  if (!process.stdin.isTTY) return true; // non-interactive → assume yes
  rl = rl || readline.createInterface({ input: process.stdin, output: process.stdout });
  const a = (await rl.question(`${msg} [Y/n] `)).trim().toLowerCase();
  return a === "" || a === "y" || a === "yes";
}

async function processOnce() {
  const q = new URLSearchParams({ phase: SOURCE });
  if (BOARD) q.set("board_id", BOARD);
  const issues = await api(`/issues?${q}`);
  if (!issues.length) {
    console.log(`· no issues in "${SOURCE}"`);
    return;
  }
  console.log(`Found ${issues.length} issue(s) in "${SOURCE}".`);
  for (const issue of issues) {
    console.log(`\n▶ #${issue.id}  ${issue.title}  [${issue.board_title}]`);
    if (flags["dry-run"]) {
      console.log("  --- prompt ---");
      console.log(buildPrompt(issue).split("\n").map((l) => "  " + l).join("\n"));
      continue;
    }
    if (!(await confirm(`  Fix with ${AGENT}?`))) { console.log("  skipped"); continue; }
    try {
      await api(`/issues/${issue.id}/move`, { method: "POST", body: JSON.stringify({ phase: IN_PROGRESS }) });
      console.log(`  → moved to "${IN_PROGRESS}", running ${AGENT}…\n`);
      const code = await runAgent(buildPrompt(issue));
      if (code === 0) {
        await api(`/issues/${issue.id}/move`, { method: "POST", body: JSON.stringify({ phase: DONE }) });
        console.log(`  ✓ done → moved to "${DONE}"`);
      } else {
        console.log(`  ✗ ${AGENT} exited ${code} — left in "${IN_PROGRESS}"`);
      }
    } catch (e) {
      console.error(`  ✗ ${e.message}`);
    }
  }
}

console.error(`canflow-agent → ${API} | agent=${AGENT} | "${SOURCE}" → "${IN_PROGRESS}" → "${DONE}"`);
try {
  if (flags.once || flags["dry-run"]) {
    await processOnce();
  } else {
    console.error(`Polling every ${POLL}s. Ctrl-C to stop.`);
    // eslint-disable-next-line no-constant-condition
    for (;;) {
      await processOnce();
      await new Promise((r) => setTimeout(r, POLL * 1000));
    }
  }
} finally {
  rl?.close();
}
