"""Regression tests use the actual preserved records, never fabricated passes."""
import json
from pathlib import Path
import unittest
import tempfile

import verify_recovery_preflight as v


class PreflightEvidenceTests(unittest.TestCase):
    def setUp(self):
        root = Path(__file__).resolve().parents[1]
        self.data = {n: (root / v.EVIDENCE / n).read_bytes()
                     for n in (*v.RECORDS, *(n + ".txt" for n in v.HELPERS))}
        self.helpers = {n: (root / "scripts" / n).read_bytes() for n in v.HELPERS}

    def check(self):
        return v.check_records(self.data.__getitem__, self.helpers.__getitem__)

    def change(self, name, mutate):
        value = json.loads(self.data[name].decode("utf-8-sig"))
        mutate(value)
        self.data[name] = json.dumps(value).encode()

    def test_actual_preserved_records(self):
        self.assertEqual(len(self.check()["entries"]), 109)

    def test_git_lf_is_equivalent_but_raw_pin_stays_exact(self):
        self.helpers = {n: v.lf(b) for n, b in self.helpers.items()}
        self.check()
        name = "qualify_frozen_engine.py.txt"
        self.assertIn(b"\r\n", self.data[name])
        self.data[name] = v.lf(self.data[name])
        with self.assertRaisesRegex(ValueError, "Raw helper hash"):
            self.check()

    def test_source_edit_is_not_line_ending_normalization(self):
        self.helpers["qualify_frozen_engine.py"] += b"\n# real change\n"
        with self.assertRaisesRegex(ValueError, "Maintained/helper"):
            self.check()

    def test_transfer_pin_cannot_be_rewritten(self):
        self.data["transfer.json"] += b" "
        with self.assertRaisesRegex(ValueError, "Transfer pin"):
            self.check()

    def test_false_remote_match_rejected(self):
        self.change("remote-transfer-verification.json", lambda x: x["checks"][0].update(matches=False))
        with self.assertRaisesRegex(ValueError, "Remote transfer"):
            self.check()

    def test_duplicated_remote_entry_rejected(self):
        self.change("remote-transfer-verification.json", lambda x: x["checks"].__setitem__(0, x["checks"][1]))
        with self.assertRaisesRegex(ValueError, "missing or duplicated"):
            self.check()

    def test_preflight_cannot_be_promoted_to_execution(self):
        self.change("local-validation.json", lambda x: x.update(windowsQualificationExecuted=True))
        with self.assertRaisesRegex(ValueError, "cannot claim qualification"):
            self.check()

    def test_remote_execution_claim_rejected(self):
        self.change("remote-transfer-verification.json", lambda x: x.update(engineExecuted=True))
        with self.assertRaisesRegex(ValueError, "misstates attempt"):
            self.check()

    def test_blocked_attempt_cannot_contain_build(self):
        self.change("blocked-preflight.json", lambda x: x.update(distExists=True))
        with self.assertRaisesRegex(ValueError, "claims execution"):
            self.check()

    def test_task_cleanup_cannot_be_assumed(self):
        self.change("local-cleanup.json", lambda x: x.update(taskOwnedProcessRemaining=True))
        with self.assertRaisesRegex(ValueError, "cleanup record"):
            self.check()

    def test_restriction_and_error_required(self):
        self.change("effective-policy.json", lambda x: x.update(effectiveExecutionPolicy="RemoteSigned"))
        with self.assertRaisesRegex(ValueError, "policy block"):
            self.check()

    def test_missing_failure_log_rejected(self):
        self.data["ssh-worker.stderr.log"] = b""
        with self.assertRaisesRegex(ValueError, "Missing policy failure"):
            self.check()

    def test_bom_and_duplicate_json_handling(self):
        self.data["effective-policy.json"] = b'\xef\xbb\xbf{"host":"DANS1","host":"other"}'
        with self.assertRaisesRegex(ValueError, "Duplicate JSON"):
            self.check()


class RepositoryEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.git = v.git_reader(self.root)
        self.git("init", "--quiet")
        self.git("config", "user.name", "Isolated test")
        self.git("config", "user.email", "test@example.invalid")
        self.git("config", "core.autocrlf", "false")
        self.git("config", "core.hooksPath", str(self.root / "no-hooks"))
        self.name = "engine/python/test_source.py"
        self.file = self.root / self.name
        self.file.parent.mkdir(parents=True)
        self.file.write_bytes(b"source\n")
        (self.root / "evidence.txt").write_bytes(b"exact\r\n")
        self.git("add", "--", self.name, "evidence.txt")
        self.commit()
        self.base = self.git("rev-parse", "HEAD").decode().strip()
        self.snapshot = {"sourceCommit": self.base, "entries": [{"path": self.name, "sha256": v.sha(self.file.read_bytes())}]}

    def commit(self):
        self.git("-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "isolated fixture")

    def check(self):
        return v.verify_sources(self.root, self.git, self.snapshot)

    def test_real_git_sources_and_raw_checkpoint(self):
        self.assertEqual(self.check(), 1)
        self.assertEqual(v.read_checkpoint(self.root, self.git, self.base, "evidence.txt"), b"exact\r\n")

    def test_dirty_source_rejected(self):
        self.file.write_bytes(b"different\n")
        with self.assertRaisesRegex(ValueError, "uncommitted"):
            self.check()

    def test_committed_changed_source_rejected(self):
        self.file.write_bytes(b"different\n")
        self.git("add", "--", self.name)
        self.commit()
        with self.assertRaisesRegex(ValueError, "Git source mismatch"):
            self.check()

    def test_untracked_source_rejected(self):
        self.file.with_name("extra.py").write_bytes(b"extra")
        with self.assertRaisesRegex(ValueError, "Unmanifested"):
            self.check()

    def test_committed_addition_rejected(self):
        self.file.with_name("extra.py").write_bytes(b"extra")
        self.git("add", "--", "engine/python/extra.py")
        self.commit()
        with self.assertRaisesRegex(ValueError, "inventory changed"):
            self.check()

    def test_committed_deletion_rejected(self):
        self.git("rm", "--", self.name)
        self.commit()
        with self.assertRaisesRegex(ValueError, "inventory changed"):
            self.check()

    def test_git_link_mode_rejected_even_with_regular_checkout(self):
        oid = self.git("rev-parse", "HEAD:" + self.name).decode().strip()
        self.git("update-index", "--cacheinfo", "120000," + oid + "," + self.name)
        self.commit()
        self.assertTrue(self.file.is_file())
        with self.assertRaisesRegex(ValueError, "Non-regular Git source"):
            self.check()

    def test_committed_evidence_tamper_rejected(self):
        (self.root / "evidence.txt").write_bytes(b"changed")
        self.git("add", "--", "evidence.txt")
        self.commit()
        with self.assertRaisesRegex(ValueError, "immutable Git checkpoint"):
            v.read_checkpoint(self.root, self.git, self.base, "evidence.txt")


if __name__ == "__main__":
    unittest.main()