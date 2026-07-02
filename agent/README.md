# canflow-agent

An autonomous runner that pulls issues from a [Canflow](https://canflow.app) beta-board phase and hands each one to **Claude Code** or **Codex** in your repo — moving the card as it works (source → in-progress → done).

## Usage

From inside the repo you want fixes applied to:

```bash
# create a token in Canflow → Settings → Developer
export CANFLOW_TOKEN=cf_your_token

# preview what it would do (no changes, no agent run)
npx -y canflow-agent --dry-run

# work the queue once, confirming each card
npx -y canflow-agent --once

# run continuously, fully autonomous, with Codex
CANFLOW_AGENT=codex npx -y canflow-agent --yes
```

## Env

| Variable | Default | Description |
| --- | --- | --- |
| `CANFLOW_TOKEN` | — | **Required.** Token from Canflow → Settings → Developer |
| `CANFLOW_API_URL` | `https://canflow.app` | Override for self-hosted |
| `CANFLOW_AGENT` | `claude` | `claude` or `codex` |
| `CANFLOW_SOURCE_PHASE` | `Identified Bugs` | Phase to pull issues from |
| `CANFLOW_IN_PROGRESS_PHASE` | `Fixing` | Where a card goes when work starts |
| `CANFLOW_DONE_PHASE` | `Verified` | Where a card goes when the agent finishes |
| `CANFLOW_BOARD_ID` | — | Limit to a single board |
| `CANFLOW_POLL_SECONDS` | `30` | Poll interval (continuous mode) |

## Flags

`--once` run a single pass · `--dry-run` show prompts only · `--yes` don't confirm each card · `--agent <claude\|codex>` · `--phase <name>`

## How it works

For each issue in the source phase it: moves the card to *in-progress*, builds a prompt (title, severity, category, description), runs `claude -p '…'` or `codex exec '…'` in the current directory, and — if the agent exits 0 — moves the card to *done*. It runs in **your** environment, so you control the repo and can review the changes before committing.

## License

MIT
