# canflow-mcp

An [MCP](https://modelcontextprotocol.io) server that connects **Claude Code**, **Codex**, and other MCP clients to [Canflow](https://canflow.app) — so an AI coding agent can pull bug/issue cards from your beta-testing boards and move them as it works.

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
| `CANFLOW_API_URL` | no | `https://canflow.app` | Override for self-hosted instances |

## Tools

| Tool | Description |
| --- | --- |
| `list_issues` | List issue cards from your beta boards. Filter by `phase` (column name) or `board_id`. |
| `get_issue` | Full details of one issue: title, description, severity/intensity, category, screenshot URL, and valid phases to move to. |
| `move_issue` | Move an issue to another phase (e.g. `Fixing`, `Verified`, `Shipped`) to reflect progress. |

## Example prompt

> Pull the bugs from my Canflow "Issues Identified" phase, fix them one by one, and move each card to Fixing then Verified.

## License

MIT
