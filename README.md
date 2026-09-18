# train-tracker

Tracks whether freight trains are blocking railroad crossings on the Houston
northwest corridor.

A Cloudflare Worker polls a public ArcGIS feature service on a cron trigger and
records each crossing's blocked or clear state, plus every state transition, in
Cloudflare D1. The upstream service is a state table that is overwritten in
place and keeps no history, so the recorded transition log is the only history
that will exist and no source can backfill it.

## Status

Governance tooling only. The Worker, its schema, and the frontend are not built
yet.

## Repository layout

| Path | Contents |
|---|---|
| `AGENTS.md` | Canonical agent policy, with generated copies beside it |
| `docs/project-orientation.md` | Commands, protected paths, and feed behavior |
| `docs/agent-policy/` | Supporting policy detail |
| `docs/pr-security-review.md` | Model security review wiring and its secret |
| `docs/template-drift.md` | Local differences from the adopted templates |
| `hooks/`, `scripts/`, `tests/` | Adopted gates, checkers, and their tests |
| `ci/` | Model provider adapters for the security review |

## Development

Install the checker dependency, then run the checks:

```console
python -m pip install --requirement requirements-checkers.txt
make test
make check
make lint
```

Policy lives in `AGENTS.md` alone. Edit it and run `python scripts/sync.py` to
regenerate the tool copies. Never edit a generated copy.

## Infrastructure

The active human applies all infrastructure. Agents author `wrangler.toml` and
`migrations/` as repository content and run no `wrangler` command, no deploy,
and no `d1 execute`. No checker enforces that boundary; it is a human control.

## Attribution

The policy template, gates, and checkers are adopted from
[`abuzucom/agents`](https://github.com/abuzucom/agents). The pull request
security review is adopted from
[`abuzucom/foucault`](https://github.com/abuzucom/foucault). Pinned revisions
are recorded in `docs/template-drift.md`.
