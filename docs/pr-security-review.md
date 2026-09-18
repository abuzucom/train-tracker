# Pull request security review

This repository calls the `abuzucom/foucault` reusable model security review.
Foucault's `docs/pr-security-review.md` owns the architecture and the trust
boundary. This document records only the local wiring.

## What runs

`.github/workflows/security-review-pr.yml` triggers on completion of the
`Immutable Compliance` workflow, resolves the pull request from the workflow
run head, and calls foucault's `security-review.yml`. The review loads
`AUDIT.md` from foucault at the pinned revision, sends one review envelope to
the configured provider, posts a fenced report, and publishes a
`security-review` check run.

Both the reusable workflow and `audit_ref` are pinned to foucault commit
`551a8000a33ba1955d5e9ed79c9f08daacc4ae99`, release 3.3.8. Keeping one
revision for both means the policy and its runner never diverge. Change the
pin deliberately, and record the change in `CHANGELOG.md` and
`docs/template-drift.md`.

`ci/build_pr_case.py`, `ci/run_model_command.py`, `ci/call_model.py`, and
`ci/model_providers.json` are copied from that same foucault revision and run
from this repository's checkout. Foucault supplies only `AUDIT.md` at runtime.

`scripts/check_pr_review_response.py` is copied from the same revision and is
also required. The reusable workflow runs it to validate the model's response
contract, retrying the model call once when the first response fails
validation. Foucault's own `docs/pr-security-review.md` lists only the `ci/`
directory under what the adopter supplies, so this file is easy to miss.
Without it the review job fails with `No such file or directory` instead of
returning a verdict. It uses only the Python standard library.

**These files are read from the base branch, not from the pull request.** The
reusable workflow checks out `base_sha`, so `ci/` and
`scripts/check_pr_review_response.py` must already exist on `main` for the
review to run. That is the trust boundary: pull request content stays review
data and is never executed.

The consequence is a bootstrap case. A pull request that adds one of these
files cannot make its own `security-review` check pass, because the check runs
the base branch's copy, which does not have it yet. The file has to reach
`main` first, either by merging that pull request with the check red or by an
active human committing it to `main`. Every later pull request then gets a real
verdict. The same shape applies to any future change to `ci/` or to this
checker: the new code takes effect for the pull request after the one that
introduces it.

`fail_on_block: true`, so a `BLOCK` or `NEEDS-HUMAN` verdict fails the check.

A pull request from a fork receives an explicit skip result and no provider
secret.

## Required repository secret

The review does not run until an active human adds the provider API key as a
repository secret. No agent sets it, and no agent commits it.

The active provider profile in `ci/model_providers.json` is Ollama with
`kimi-k2.7-code`. The caller maps `secrets.OLLAMA_API_KEY` to the reusable
workflow's `MODEL_API_KEY`.

Add it under Settings, Secrets and variables, Actions, as `OLLAMA_API_KEY`.

Until the secret exists, the `security-review` check fails. That failure is the
absent secret, not a finding against the diff.

To use another provider, change the active profile in
`ci/model_providers.json` and the secret name in the caller's `secrets` block
together. Provider endpoints stay allowlisted in the adapter.

## Adopter record owed upstream

Foucault's `adopters/README.md` asks each adopter to add
`adopters/<repo>.md` in `abuzucom/foucault` recording the pinned revision and
whether the reusable workflow is wired. That record is owed and not yet filed,
because it requires a pull request against a repository this repository's
automation does not write to.

The record should state: adopter `abuzucom/train-tracker`, `AUDIT.md` pinned at
`551a8000a33ba1955d5e9ed79c9f08daacc4ae99`, the reusable workflow wired at the
same commit, and no customization of `AUDIT.md`.
