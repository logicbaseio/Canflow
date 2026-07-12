# canflow-mcp

An [MCP](https://modelcontextprotocol.io) server that connects **Claude Code**, **Codex**, and other MCP clients to [Canflow](https://canflow.app) — so an AI coding agent can pick up the cards you assign it, work them, and write status back to the board in real time.

## Setup

1. In Canflow, go to **Settings → Developer** and create an access token.
2. Connect your agent:

**Claude Code**

```bash
claude mcp add canflow --env CANFLOW_TOKEN=cf_your_token -- npx -y canflow-mcp
```

**Codex** — add to `~/.codex/config.toml`:

```toml
[mcp_servers.canflow]
command = "npx"
args = ["-y", "canflow-mcp"]
env = { CANFLOW_TOKEN = "cf_your_token" }
```

## Environment

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `CANFLOW_TOKEN` | yes | — | Access token from Canflow → Settings → Developer |
| `CANFLOW_API_URL` | no | `https://boards.canflow.app` | Override for self-hosted instances |

## Tools

| Tool | Description |
| --- | --- |
| `list_queued` | **Your pickup queue.** Lists every card a human queued for an agent (`agent_status: "queued"`) across **all** board types — Task Manager, Roadmap, Beta. Pass your `agent` identity to see only yours. Call this first. |
| `list_issues` | List bug/issue cards from beta boards. Filter by `phase` (column name) or `board_id`. |
| `get_issue` | Full details of one card: title, description, severity/intensity, category, screenshot URL, valid phases, agent attribution, and the comments/activity timeline. Read before working a card. |
| `update_issue_agent` | Set the agent badge + status without moving the card. `agent_status`: `working \| done \| fixed \| verified \| blocked \| needs-review`. |
| `move_issue` | Move a card to another phase (e.g. `Fixing`, `Verified`, `Shipped`) to reflect progress. Can also stamp agent/status/note. |
| `comment_issue` | Append a markdown comment to the card's activity timeline (append-only). |

## The agent workflow

Once a card is assigned to you (a human clicks **Assign to agent**, or a board's **Autopilot** auto-assigns new cards), it lands in your queue:

1. `list_queued({ agent: "claude" })` — find work assigned to you.
2. `get_issue({ id })` — read full context before starting.
3. `update_issue_agent({ id, agent: "claude", agent_status: "working", agent_note: "…" })` — claim it; the card shows a live "Working" badge.
4. Do the work in the repo (the card includes `github_repo` when set).
5. `comment_issue({ id, body: "root cause, files changed, verification…" })` — record details.
6. `update_issue_agent({ id, agent_status: "done", agent_note: "Fixed + tests" })` and/or `move_issue({ id, phase: "Done" })`.

## Example prompt

> Check my Canflow queue with list_queued, then work each card end to end: mark it working, fix it in the repo, open a PR, comment the summary, and mark it done.

## Changelog

- **1.5.0** — Added `list_queued` (cross-board pickup queue for cards a human assigned to an agent). `update_issue_agent` now accepts `done` and `verified`. Docs cover the full assign → work → done loop.
- **1.4.0** — `move_issue`, `update_issue_agent`, `comment_issue`, and the activity timeline.

## License

MIT
