# Project orientation

Supporting detail for the `AGENTS.md` repository orientation section.
`AGENTS.md` controls when this document conflicts with it.

## Commands

Obtain active-human consent before tests, scripts, or Makefile targets.

| Command | Runs |
|---|---|
| `python -m pip install --requirement requirements-checkers.txt` | Checker dependency |
| `make test` | `python3 scripts/run_tests.py` |
| `make check` | `python3 scripts/sync.py --check` |
| `make lint` | Style, spelling, language, and conflict-marker checks |
| `python scripts/check_gate_adoption.py` | Gate completeness |

`npm test` runs `node --test test/`, the Worker suite. The Worker carries no
dependency, runtime or development, so no install step precedes it.

The adopted branch gate allowlists a fixed set of programs and workflow
scripts. `node` is not among them, so an agent cannot run `npm test` locally.
That is designed gate behavior rather than a defect.
`.github/workflows/worker-tests.yml` runs the suite on every pull request, so
CI is where the Worker suite is verified.

## Do not touch

Generated policy copies: `CLAUDE.md`, `GEMINI.md`, `CONVENTIONS.md`,
`.cursorrules`, `.clinerules`, `.windsurfrules`, `.copilot-instructions`, and
`.github/copilot-instructions.md`. Edit `AGENTS.md`, then run
`python scripts/sync.py`.

Adopted from `abuzucom/agents`: `hooks/`, `scripts/`, `tests/`, `tools/`,
`docs/agent-policy/`, and the client settings under `.agents/`, `.claude/`,
`.codex/`, and `.gemini/`. Rule 18 forbids narrowing or disabling a gate.
Rule 22 requires fresh active-human consent for hook and denylist edits.
Upstream fixes arrive by re-adoption, not by local edits.

Adopted from `abuzucom/foucault`: `ci/` and
`.github/workflows/security-review-pr.yml`. Change the pinned revision rather
than the copied content.

## Architecture

A Cloudflare Worker runs on a cron trigger. Each run queries one public ArcGIS
feature service for 11 crossings, writes current state to the `crossing_state`
table in Cloudflare D1, appends a row to `crossing_event` for each crossing
whose status changed, and records the run in `poll_run`.

The upstream service is a state table of 56 rows overwritten roughly every 30
seconds. Change tracking is disabled and no archive exists. The recorded
transition log is therefore the only history that will ever exist, and no
source can backfill it.

## Operational notes

The active human applies all infrastructure. Agents author `wrangler.toml` and
`migrations/` as repository content and run no `wrangler` command, no deploy,
and no `d1 execute`. `hooks/block_infrastructure_access.py` matches cloud
credential paths, Terraform, and Kubernetes, and does not match
`wrangler.toml`. No checker enforces this boundary. It is a human control, and
Rule 13 forbids describing it as an enforced one.

The feed field `timeUpdated` is not a freshness signal. Scheduled batch writes
contaminate it: 12 of 56 rows carry values on exact clock boundaries. An
earlier analysis concluded from this field that the corridor sensors were dead.
That conclusion was wrong and was withdrawn. Derive freshness from the recorded
`observed_at` and from the service-level `editingInfo.lastEditDate` heartbeat.

The feed fields `endTime` and `timeToClear` are predictions revised on every
tick. One crossing reported `6 MIN` and cleared within one minute. Store them.
Never act on them.

Match crossings on `code`, the federal grade crossing identifier. Never match
on `street`. Two distinct crossings carry the name "Post Oak", and only
`743673P` belongs to this corridor.

The service ETag is a table-version token shared across every query shape. An
ETag from one query shape returns 304 against a different one. Replay an ETag
only against a byte-identical URL.

## Read before touching

- Adoption and gates: `docs/agent-policy/adoption.md`
- PR security review: `docs/pr-security-review.md`
- Feed behavior and evidence: `docs/recon/`
