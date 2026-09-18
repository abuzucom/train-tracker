# Changelog

This file documents every notable project change.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
One deviation applies. A version heading parenthesizes the release date.
The format uses `## [1.2.3] (2026-01-01)` instead of a spaced hyphen.
The house style bans that hyphen. `scripts/check_ascii.py` enforces the ban on
this file.
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
