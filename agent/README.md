# canflow-agent

An autonomous **QA loop** for [Canflow](https://canflow.app) beta-testing boards. Connects with your API token and drives **Claude Code** or **Codex** in your repo, moving cards as it works:

```
Testing ──(verify: is it a real bug?)──► Issues Identified   (real)
        └─────────────────────────────► Verified          (can't reproduce)
Issues Identified ──► Fixing ──(implement + self-check)──► Fixed
Fixed ──(mode verify-fix, optional)──► Verified  |  back to Issues Identified
```

`Fixed → Verified` and `Verified → Shipped` normally stay with **you** (or run `--mode verify-fix` to let the agent verify fixes). Every auto-move writes a short 🤖 note on the card explaining what the agent found or changed.

## Usage

From inside the repo you want fixes applied to:

```bash
# create a token in Canflow → Settings → Developer
export CANFLOW_TOKEN=cf_your_token

# preview what it would do (no changes, no agent run)
npx -y canflow-agent --dry-run

# run the full loop once, confirming each card
npx -y canflow-agent --once

# run continuously, fully autonomous, scoped to one board
npx -y canflow-agent --board 12 --yes

# use Codex instead of Claude Code
npx -y canflow-agent --agent codex --yes
```

## Modes

| `--mode` | What it does |
| --- | --- |
| `loop` *(default)* | Triage `Testing` **and** fix `Issues Identified` each pass (fixes land in `Fixed`) |
| `verify` | Only triage: `Testing` → `Issues Identified` / `Verified` |
| `fix` | Only fix: `Issues Identified` → `Fixing` → `Fixed` |
| `verify-fix` | Verify fixes: `Fixed` → `Verified`, or back to `Issues Identified` if regressed |

## How the verdict works

The agent is asked to end its reply with exactly one line, which the runner reads to decide the move:

```
CANFLOW_VERDICT: CONFIRMED   # real bug  → Issues Identified
CANFLOW_VERDICT: NOT_A_BUG   # can't reproduce → Verified
CANFLOW_VERDICT: FIXED       # fix applied → Fixed
CANFLOW_VERDICT: BLOCKED     # couldn't fix → stays in Fixing
CANFLOW_VERDICT: VERIFIED    # fix confirmed → Verified
CANFLOW_VERDICT: REGRESSED   # still broken → back to Issues Identified
```

## Env

| Variable | Default | Description |
| --- | --- | --- |
| `CANFLOW_TOKEN` | — | **Required.** Token from Canflow → Settings → Developer |
| `CANFLOW_API_URL` | `https://canflow.app` | Override for self-hosted |
| `CANFLOW_AGENT` | `claude` | `claude` or `codex` |
| `CANFLOW_BOARD_ID` | — | Limit to a single board |
| `CANFLOW_POLL_SECONDS` | `30` | Poll interval (continuous mode) |
| `CANFLOW_TESTING_PHASE` | `Testing` | Column reports come from |
| `CANFLOW_BUGS_PHASE` | `Issues Identified` | Confirmed bugs |
| `CANFLOW_FIXING_PHASE` | `Fixing` | In-progress fixes |
| `CANFLOW_FIXED_PHASE` | `Fixed` | Fix applied, awaiting verification |
| `CANFLOW_VERIFIED_PHASE` | `Verified` | Awaiting your confirmation |

## Flags

`--mode <loop\|verify\|fix>` · `--board <id>` · `--agent <claude\|codex>` · `--once` single pass · `--dry-run` show prompts only · `--yes` don't confirm each card

It runs in **your** environment, so you control the repo and can review every change (nothing is committed for you).

## License

MIT
