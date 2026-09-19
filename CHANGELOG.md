# Changelog

This file documents every notable project change.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
One deviation applies. A version heading parenthesizes the release date.
The format uses `## [1.2.3] (2026-01-01)` instead of a spaced hyphen.
The house style bans that hyphen. `scripts/check_ascii.py` enforces the ban on
this file.
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.5] (2026-09-18)

### Fixed
- Build the stripped character class from escape sequences rather than a
  regular expression literal holding the separators themselves. The literal
  carried a real `U+2028`, which the JavaScript parser treats as a line
  terminator, so the expression ended early and `src/feed.js` failed to parse.
  Three of eight test files could not import it. The fix for record-boundary
  forging had reproduced that hazard inside its own source.
- Derive the separators in `test/feed.test.js` through `String.fromCharCode`
  for the same reason, keeping the file ASCII.

### Added
- Add a step to `.github/workflows/worker-tests.yml` failing the build on any
  code point above `U+007F` in `src` or `test`. Nothing guarded source files
  before: `check_ascii.py` runs only over the prose list, and pointing it at
  JavaScript would flag ordinary arithmetic under its dash rules.
  `tests/test_worker_tests_workflow.py` asserts the step stays wired.

## [0.2.4] (2026-09-18)

### Fixed
- Enforce the body bound while reading rather than from the declared length
  alone. A body sent with chunked transfer encoding, or with no
  `content-length`, left the guard fail-open and restored the unbounded parse.
  An out-of-memory kill carries the same consequence as a stalled read: the
  invocation dies before the failed run reaches D1, so no `poll_run` row
  appears and the absence reads as "the Worker never ran".
- Extend the stripped character class beyond ASCII to `U+2028`, `U+2029`, the
  bidirectional overrides, and the byte order mark. A JavaScript parser and
  several log viewers end a line on `U+2028` and `U+2029`, so an ASCII-only
  class narrowed the record-boundary forging rather than closing it.

## [0.2.3] (2026-09-18)

### Fixed
- Give the upstream read a 20 second deadline. Without one, an upstream that
  accepts the connection and then stalls holds the invocation until the
  runtime kills it, before the failed run reaches D1. The missing `poll_run`
  row would then read as "the Worker never ran", recording a stalled upstream
  as the one fault it is not and misreporting the gap signal the schema exists
  to provide.
- Reject a body whose declared length exceeds 1 MiB before parsing it. The
  row-count guard runs only after parsing, so an oversized response was
  already resident in memory by the time it was rejected.
- Strip ASCII control characters from upstream text as it enters, and cap the
  fragment repeated back inside an error message. Upstream text reaches
  `poll_run.error`, where an embedded newline forges a record boundary for any
  reader of that column.
- Guard the null attribute bag explicitly. `typeof null` is `"object"`, so a
  feature carrying `attributes: null` reached row parsing and raised a runtime
  `TypeError` instead of the intended malformed-snapshot diagnostic,
  degrading the only forensic record this system keeps.
- Record a thrown value of any shape. Reading `error.message` on a non-Error
  throw stored `undefined` as the reason for the one poll that failed.

## [0.2.2] (2026-09-18)

### Changed
- Record in `docs/pr-security-review.md` that the reusable security review
  checks out the base commit, so `ci/` and
  `scripts/check_pr_review_response.py` are read from `main` rather than from
  the pull request. A pull request adding one of those files cannot make its
  own `security-review` check pass.

### Fixed
- Name this repository's prose files in the four prose and ASCII steps of
  `.github/workflows/sync-check.yml`. The template listed `DRIFT.md` and two
  `adopters/*.md` records, which belong to `abuzucom/agents` and are absent
  here, so `check_us_spelling.py` failed on a missing file. The replacements
  cover more prose than the template's list.

## [0.2.1] (2026-09-18)

### Fixed
- Target the Worker test files explicitly in `npm test`. Node 22 resolves a
  bare `test/` argument as a module path and fails with `MODULE_NOT_FOUND`,
  so the suite never ran. The glob also leaves fixtures and helpers out of the
  run.
- Add `scripts/check_pr_review_response.py`, copied from `abuzucom/foucault`
  at the pinned revision. The reusable security review runs it from the
  caller's checkout, so its absence failed the review job with a missing-file
  error instead of a verdict.

### Added
- Add `tests/test_worker_tests_workflow.py` covering the Worker test
  workflow's wiring and the manifest's test command. `scripts/check_test_first.py`
  counts a workflow file as an executable change and accepts only a Python test
  under `tests/`, and the workflow is the sole place the Worker suite runs
  before review, so its wiring deserves the coverage regardless.

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
