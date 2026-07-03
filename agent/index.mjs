#!/usr/bin/env node
/**
 * canflow-agent — autonomous QA loop for Canflow beta-testing boards.
 *
 * Connects to Canflow with your API token and drives Claude Code / Codex through
 * the board, moving cards as it works:
 *
 *   Testing ──(verify: is it a real bug?)──► Issues Identified        (real)
 *           └─────────────────────────────► Verified               (can't reproduce)
 *   Issues Identified ──► Fixing ──(implement + self-check)──► Verified
 *
 *   Verified ──► Shipped   and   Verified ──► Testing   are left to YOU (the human).
 *
 * The agent emits a verdict line the runner reads:
 *   CANFLOW_VERDICT: CONFIRMED | NOT_A_BUG | FIXED | BLOCKED
 *
 * Env:
 *   CANFLOW_TOKEN            (required) token from Canflow → Settings → Developer
 *   CANFLOW_API_URL          (default https://canflow.app)
 *   CANFLOW_AGENT            claude | codex        (default: claude)
 *   CANFLOW_BOARD_ID         limit to one board    (optional but recommended)
 *   CANFLOW_POLL_SECONDS     poll interval         (default: 30)
 *   CANFLOW_AGENT_CMD        override the command (advanced/testing)
 *   CANFLOW_TESTING_PHASE    (default: "Testing")
 *   CANFLOW_BUGS_PHASE       (default: "Issues Identified")
 *   CANFLOW_FIXING_PHASE     (default: "Fixing")
 *   CANFLOW_VERIFIED_PHASE   (default: "Verified")
 *
 * Flags:
 *   --mode <loop|verify|fix>   loop = triage + fix (default)
 *   --board <id>               limit to one board
 *   --agent <claude|codex>
 *   --once                     one pass and exit
 *   --dry-run                  print prompts, move nothing
 *   --yes                      don't ask for confirmation (autonomous)
 */
import { spawn } from "node:child_process";
import { parseArgs } from "node:util";
import readline from "node:readline/promises";

const { values: flags } = parseArgs({
  options: {
    mode: { type: "string" },
    board: { type: "string" },
    agent: { type: "string" },
    once: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    yes: { type: "boolean", default: false },
  },
});

const TOKEN = process.env.CANFLOW_TOKEN;
const API = (process.env.CANFLOW_API_URL || "https://canflow.app").replace(/\/$/, "");
const AGENT = (flags.agent || process.env.CANFLOW_AGENT || "claude").toLowerCase();
const MODE = (flags.mode || "loop").toLowerCase();
const BOARD = flags.board || process.env.CANFLOW_BOARD_ID;
const POLL = Math.max(5, parseInt(process.env.CANFLOW_POLL_SECONDS || "30", 10));

const TESTING = process.env.CANFLOW_TESTING_PHASE || "Testing";
const BUGS = process.env.CANFLOW_BUGS_PHASE || "Issues Identified";
const FIXING = process.env.CANFLOW_FIXING_PHASE || "Fixing";
const VERIFIED = process.env.CANFLOW_VERIFIED_PHASE || "Verified";

if (!TOKEN) {
  console.error("CANFLOW_TOKEN is required. Create one in Canflow → Settings → Developer.");
  process.exit(1);
}
if (!["loop", "verify", "fix"].includes(MODE)) {
  console.error(`Unknown --mode "${MODE}". Use loop, verify, or fix.`);
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

function listIssues(phase) {
  const q = new URLSearchParams({ phase });
  if (BOARD) q.set("board_id", BOARD);
  return api(`/issues?${q}`);
}

// Move a card and stamp it with which agent acted and a short status the card renders as a badge.
function move(id, phase, { note, status } = {}) {
  const body = { phase, agent: AGENT };
  if (note) body.note = note;
  if (status) body.status = status;
  return api(`/issues/${id}/move`, { method: "POST", body: JSON.stringify(body) });
}

function severity(issue) {
  return issue.intensity ? `Severity: ${issue.intensity}/10` : issue.priority ? `Priority: ${issue.priority}` : "";
}

function buildVerifyPrompt(issue) {
  return [
    `A beta tester reported a possible bug in our app "${issue.board_title}" (tracked in Canflow).`,
    `VERIFY whether this is a real, reproducible bug in THIS codebase. Do NOT fix it yet — only investigate and try to reproduce it.`,
    "",
    `Title: ${issue.title}`,
    severity(issue),
    issue.category ? `Category: ${issue.category}` : "",
    issue.description ? `\nReport:\n${issue.description}` : "",
    issue.image_url ? `\n(A screenshot is attached to Canflow card #${issue.id}.)` : "",
    "",
    `Locate the relevant code, reproduce the problem if you can, and decide whether it is genuinely broken.`,
    `Finish with a one-line summary, then EXACTLY one verdict line:`,
    `  CANFLOW_VERDICT: CONFIRMED   — a real, reproducible bug that needs fixing`,
    `  CANFLOW_VERDICT: NOT_A_BUG   — cannot reproduce, or it works as intended`,
  ].filter((l) => l !== "").join("\n");
}

function buildFixPrompt(issue) {
  return [
    `Fix this confirmed bug in our app "${issue.board_title}" (tracked in Canflow).`,
    "",
    `Title: ${issue.title}`,
    severity(issue),
    issue.category ? `Category: ${issue.category}` : "",
    issue.description ? `\nReport:\n${issue.description}` : "",
    issue.image_url ? `\n(A screenshot is attached to Canflow card #${issue.id}.)` : "",
    "",
    `Investigate the root cause, implement a fix, and verify the fix actually resolves the issue.`,
    `Finish with a one-line summary of what you changed, then EXACTLY one verdict line:`,
    `  CANFLOW_VERDICT: FIXED     — you implemented and verified a fix`,
    `  CANFLOW_VERDICT: BLOCKED   — you could not fix it (say why)`,
  ].filter((l) => l !== "").join("\n");
}

function agentCommand(prompt) {
  if (process.env.CANFLOW_AGENT_CMD) return [process.env.CANFLOW_AGENT_CMD, [prompt]];
  return AGENT === "codex" ? ["codex", ["exec", prompt]] : ["claude", ["-p", prompt]];
}

/** Run the agent, streaming its output to the terminal while capturing it for verdict parsing. */
function runAgent(prompt) {
  const [cmd, args] = agentCommand(prompt);
  return new Promise((resolve) => {
    let output = "";
    let p;
    try {
      p = spawn(cmd, args, { stdio: ["inherit", "pipe", "pipe"] });
    } catch (e) {
      console.error(`  ✗ could not launch "${cmd}": ${e.message}`);
      return resolve({ code: 1, output });
    }
    p.stdout.on("data", (d) => { const s = d.toString(); output += s; process.stdout.write(s); });
    p.stderr.on("data", (d) => { const s = d.toString(); output += s; process.stderr.write(s); });
    p.on("close", (code) => resolve({ code: code ?? 1, output }));
    p.on("error", (e) => { console.error(`  ✗ could not launch "${cmd}": ${e.message}`); resolve({ code: 1, output }); });
  });
}

function parseVerdict(output) {
  const m = [...output.matchAll(/CANFLOW_VERDICT:\s*([A-Z_]+)/gi)];
  return m.length ? m[m.length - 1][1].toUpperCase() : null;
}

/** A short, human-readable tail of the agent's output to attach as a card note. */
function summarize(output) {
  const clean = output.replace(/CANFLOW_VERDICT:.*$/gim, "").replace(/\s+$/g, "").trim();
  if (!clean) return "";
  const tail = clean.slice(-500).trim();
  return tail.length < clean.length ? "…" + tail : tail;
}

let rl;
async function confirm(msg) {
  if (flags.yes) return true;
  if (!process.stdin.isTTY) return true; // non-interactive → assume yes
  rl = rl || readline.createInterface({ input: process.stdin, output: process.stdout });
  const a = (await rl.question(`${msg} [Y/n] `)).trim().toLowerCase();
  return a === "" || a === "y" || a === "yes";
}

function printPrompt(prompt) {
  console.log("  --- prompt ---");
  console.log(prompt.split("\n").map((l) => "  " + l).join("\n"));
}

// Stage 1: verify reports in Testing are real bugs.
async function triageStage() {
  const issues = await listIssues(TESTING);
  if (!issues.length) { console.log(`· no reports in "${TESTING}"`); return; }
  console.log(`\nTriage — ${issues.length} report(s) in "${TESTING}":`);
  for (const issue of issues) {
    console.log(`\n🔎 verify #${issue.id}  ${issue.title}  [${issue.board_title}]`);
    if (flags["dry-run"]) { printPrompt(buildVerifyPrompt(issue)); continue; }
    if (!(await confirm(`  Verify with ${AGENT}?`))) { console.log("  skipped"); continue; }
    const { output } = await runAgent(buildVerifyPrompt(issue));
    const verdict = parseVerdict(output);
    const summary = summarize(output);
    try {
      if (verdict === "NOT_A_BUG") {
        await move(issue.id, VERIFIED, { status: "not_a_bug", note: `Triaged by ${AGENT}: could not reproduce / not a bug — please confirm or add repro steps.${summary ? "\n" + summary : ""}` });
        console.log(`  → "${VERIFIED}" (not reproducible)`);
      } else {
        const label = verdict === "CONFIRMED" ? "confirmed a real bug" : "triage inconclusive — treating as a bug";
        await move(issue.id, BUGS, { status: "confirmed", note: `Triaged by ${AGENT}: ${label}.${summary ? "\n" + summary : ""}` });
        console.log(`  → "${BUGS}"${verdict ? "" : " (inconclusive)"}`);
      }
    } catch (e) { console.error(`  ✗ ${e.message}`); }
  }
}

// Stage 2: fix bugs in Issues Identified.
async function fixStage() {
  const issues = await listIssues(BUGS);
  if (!issues.length) { console.log(`· no bugs in "${BUGS}"`); return; }
  console.log(`\nFix — ${issues.length} bug(s) in "${BUGS}":`);
  for (const issue of issues) {
    console.log(`\n🛠  fix #${issue.id}  ${issue.title}  [${issue.board_title}]`);
    if (flags["dry-run"]) { printPrompt(buildFixPrompt(issue)); continue; }
    if (!(await confirm(`  Fix with ${AGENT}?`))) { console.log("  skipped"); continue; }
    try {
      await move(issue.id, FIXING, { status: "fixing" });
      console.log(`  → "${FIXING}", running ${AGENT}…\n`);
      const { code, output } = await runAgent(buildFixPrompt(issue));
      const verdict = parseVerdict(output);
      const summary = summarize(output);
      if (code === 0 && verdict !== "BLOCKED") {
        await move(issue.id, VERIFIED, { status: "fixed", note: `Fixed by ${AGENT} — please verify, then move to Shipped.${summary ? "\n" + summary : ""}` });
        console.log(`  ✓ → "${VERIFIED}"`);
      } else {
        await move(issue.id, FIXING, { status: "blocked", note: `${AGENT} could not fix this (exit ${code}${verdict ? ", " + verdict : ""}) — needs a human.${summary ? "\n" + summary : ""}` });
        console.log(`  ✗ left in "${FIXING}"`);
      }
    } catch (e) { console.error(`  ✗ ${e.message}`); }
  }
}

async function processOnce() {
  if (MODE === "verify" || MODE === "loop") await triageStage();
  if (MODE === "fix" || MODE === "loop") await fixStage();
}

const flow =
  MODE === "verify" ? `"${TESTING}" → "${BUGS}" / "${VERIFIED}"`
  : MODE === "fix" ? `"${BUGS}" → "${FIXING}" → "${VERIFIED}"`
  : `"${TESTING}" → "${BUGS}" → "${FIXING}" → "${VERIFIED}"`;
console.error(`canflow-agent → ${API} | agent=${AGENT} | mode=${MODE} | ${flow}${BOARD ? ` | board=${BOARD}` : ""}`);

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
