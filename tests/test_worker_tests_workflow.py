#!/usr/bin/env python3
"""Cover the Worker test workflow's wiring.

The Worker suite cannot run in an agent session: the branch gate allowlists
neither node nor npm. This workflow is therefore the only place the suite runs
before review, so its wiring is worth asserting rather than assuming.
"""
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORKER_WORKFLOW = ROOT / ".github" / "workflows" / "worker-tests.yml"
PACKAGE_MANIFEST = ROOT / "package.json"


class WorkerTestsWorkflowTest(unittest.TestCase):
    """The workflow runs the Worker suite on every pull request."""

    def setUp(self):
        self.text = WORKER_WORKFLOW.read_text(encoding="utf-8")

    def test_workflow_runs_the_suite(self):
        self.assertIn("run: npm test", self.text)

    def test_workflow_triggers_on_pull_request(self):
        self.assertIn("pull_request:", self.text)
        self.assertIn("branches: [ main ]", self.text)

    def test_checkout_disables_persisted_credentials(self):
        checkout_count = self.text.count("actions/checkout@")
        self.assertGreater(checkout_count, 0)
        self.assertEqual(
            checkout_count,
            self.text.count("persist-credentials: false"),
        )

    def test_every_action_pins_a_full_commit_sha(self):
        for line in self.text.splitlines():
            stripped = line.strip()
            if not stripped.startswith("- uses:") and "uses:" not in stripped:
                continue
            reference = stripped.split("uses:", 1)[1].strip()
            if not reference:
                continue
            self.assertIn("@", reference)
            pin = reference.split("@", 1)[1].split()[0]
            self.assertEqual(len(pin), 40, f"{reference} is not a full SHA")
            self.assertTrue(
                all(character in "0123456789abcdef" for character in pin),
                f"{reference} is not hexadecimal",
            )

    def test_workflow_grants_read_only_permissions(self):
        self.assertIn("permissions:\n  contents: read", self.text)
        self.assertNotIn("write-all", self.text)

    def test_workflow_adds_no_setup_action(self):
        # The runner image already satisfies the engines constraint and the
        # suite uses only the Node standard library. An extra action would be
        # one more pin to maintain for no gain.
        self.assertNotIn("actions/setup-node", self.text)


class WorkerTestCommandTest(unittest.TestCase):
    """The manifest names a command the runner can execute."""

    def setUp(self):
        self.manifest = PACKAGE_MANIFEST.read_text(encoding="utf-8")

    def test_test_script_targets_test_files_explicitly(self):
        # A bare directory argument is resolved as a module path by Node 22
        # and fails with MODULE_NOT_FOUND. A glob selects the test files and
        # leaves fixtures and helpers out of the run.
        self.assertIn('"test": "node --test', self.manifest)
        self.assertIn("test/**/*.test.js", self.manifest)

    def test_worker_declares_no_dependency(self):
        self.assertNotIn('"dependencies"', self.manifest)
        self.assertNotIn('"devDependencies"', self.manifest)


if __name__ == "__main__":
    unittest.main()
