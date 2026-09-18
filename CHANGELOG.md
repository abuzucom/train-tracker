# Changelog

This file documents every notable project change.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
One deviation applies. A version heading parenthesizes the release date.
The format uses `## [1.2.3] (2026-01-01)` instead of a spaced hyphen.
The house style bans that hyphen. `scripts/check_ascii.py` enforces the ban on
this file.
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] (2026-09-18)

### Added
- Add the crossing poller: `src/index.js` runs one poll per cron invocation,
  `src/feed.js` reads and validates the upstream snapshot, `src/store.js`
  persists state and transitions, and `src/corridor.js` holds the 11 corridor
  crossings as the single source of truth.
- Add `migrations/0001_init.sql` creating `crossing`, `crossing_state`,
  `crossing_event`, and `poll_run`, and `migrations/0002_seed_crossings.sql`
  seeding the corridor. Both are re-runnable.
- Add `wrangler.toml` with the every-minute cron trigger and the D1 binding.
  The file is authored as repository content and applied only by an active
  human, per `docs/deploy.md`.
- Add `package.json` declaring `npm test` as `node --test test/`. The Worker
  carries no dependency, runtime or development.
- Add the test suite under `test/`, covering URL stability, snapshot
  validation, failure containment, transition detection, idempotency, and
  agreement between the seed migration and `src/corridor.js`.
- Add `.github/workflows/worker-tests.yml` running the suite on pull requests
  and pushes to `main`.
- Add `docs/recon/feed-behavior.md` recording the observed feed behavior, the
  four traps, the open question about corridor sensors, and the timezone
  handling rule. Add `docs/deploy.md` with the human deployment steps.

## [0.1.1] (2026-09-18)

### Fixed
- Restore the handoff guidance in `README.md` that the adopted wiring tests
  `test_handoff_requires_active_user_request` and
  `test_handoff_prescribes_no_pre_consent_git_command` assert on. The rewritten
  project README had dropped it.

## [0.1.0] (2026-09-18)

### Added
- Adopt the `abuzucom/agents` policy template, hooks, checkers, tests, client
  settings, and compliance workflows at commit
  `f00081fddac53e0cf1a3c308e2802b712747233e`.
- Add `docs/project-orientation.md` carrying the repository orientation detail
  that exceeds the 32 KiB canonical policy limit.
- Wire the `abuzucom/foucault` pull request security review at commit
  `551a8000a33ba1955d5e9ed79c9f08daacc4ae99`, with the `ci/` provider adapters
  and a caller workflow gating on the model verdict.
- Record the adoption in `DRIFT.md` and `adopters/train-tracker.md`.
- Document the provider secret setup in `docs/pr-security-review.md`.

### Changed
- Replace the Python injection and hashing examples in
  `docs/agent-policy/security.md` with the JavaScript and D1 equivalents this
  repository uses.
