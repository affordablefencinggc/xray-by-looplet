"""Synthetic record/real-file regressions, never a frozen-engine execution claim."""
import copy
from datetime import datetime, timedelta, timezone
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock

spec = importlib.util.spec_from_file_location(
    "terminal", Path(__file__).with_name("verify_qualification_terminal.py"))
v = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v)


class TerminalTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.run_id = "123456789abc"
        self.commit = "a" * 40
        self.started = "2026-01-01T00:00:00.0000000Z"
        for name in v.TRANSFER_NAMES:
            (self.root / name).write_bytes(b"synthetic input - not executed")
        names = {"src/studio/bomRules.ts", "src/studio/bomContract.ts", "package.json", "package-lock.json", *v.q.CORE}
        names.update(f"engine/fixtures/bom-contract/{stem}.{kind}.json"
                     for stem in v.q.STEMS for kind in ("request", "response"))
        sources = [{"path": name, "sha256": "b" * 64} for name in sorted(names)]
        self.write("snapshot.json", {
            "sourceCommit": self.commit, "archiveSha256": self.digest("source.zip"), "entries": sources})
        self.write("cases.json", {"schema": "xray.frozen-engine-cases/v1", "sourceCommit": self.commit,
                                 "sources": sources, "cases": [{"name": name} for name in
                                 (*v.q.STEMS, "equal", "full-bays-terminal-cut")]})
        self.write("source-manifest.json", [entry for entry in sources
                   if entry["path"].startswith("engine/python/") or entry["path"] == v.q.SCHEMA])
        self.write("transfer.json", {"runId": self.run_id, "entries": [
            {"name": name, "bytes": (self.root / name).stat().st_size,
             "sha256": self.digest(name)} for name in sorted(v.TRANSFER_NAMES)
        ]})
        self.pin = self.digest("transfer.json")
        self.write("owner.json", {
            "host": "DANS1", "ownerPid": 123, "creationTime": self.started,
            "lastTaskActivity": self.started,
            "transferSha256": self.pin, "deadlineSeconds": 1500,
            "executable": "powershell.exe", "command": "reviewed owner command",
            "purpose": "Fresh engine-only qualification; no app build/install",
        })
        self.write("worker-owner.json", {
            "pid": 456, "creationTime": "2026-01-01T00:00:01Z",
            "executable": "reviewed-python.exe", "purpose": self.load("owner.json")["purpose"],
        })
        self.write("exit.json", {"exitCode": 0, "workerExited": True,
                                  "appInstalled": False, "endedAt": "2026-01-01T00:02:00Z"})
        self.write("qualification.json", {
            "qualified": True, "sourceCommit": self.commit, "appBuilt": False,
            "appInstalled": False, "stagingPinUpdated": False,
            "inputIdentities": {name: self.digest(name) for name in v.IDENTITY_NAMES},
        })

    def write(self, name, value):
        (self.root / name).write_text(json.dumps(value), encoding="utf-8")

    def load(self, name):
        return json.loads((self.root / name).read_text(encoding="utf-8-sig"))

    def digest(self, name):
        return hashlib.sha256((self.root / name).read_bytes()).hexdigest()

    def validate(self, **overrides):
        pins = {"run_id": self.run_id, "transfer_sha256": self.pin,
                "source_commit": self.commit, "owner_pid": 123,
                "owner_created_at": self.started}
        pins.update(overrides)
        return v.validate_terminal_records(self.root, **pins)

    def reject_changes(self, name, variants):
        original = self.load(name)
        for changes in variants:
            with self.subTest(file=name, changes=changes):
                self.write(name, {**copy.deepcopy(original), **changes})
                with self.assertRaises(ValueError):
                    self.validate()
        self.write(name, original)

    def test_success_is_only_terminal_prerequisite(self):
        result = self.validate()
        self.assertIs(result["terminalRecordsValid"], True)
        for flag in ("freshEngineQualified", "appAccepted", "fullEvidenceValidated"):
            self.assertIs(result[flag], False)
        self.assertIn("lacks attempt/owner/hash binding", result["limit"])

    def test_qualification_without_exit_is_rejected(self):
        (self.root / "exit.json").unlink()
        with self.assertRaises(OSError):
            self.validate()

    def test_exit_code_requires_exact_integer_zero(self):
        self.reject_changes("exit.json", [{"exitCode": value} for value in
                                           (1, -1, False, True, 0.0, "0", None)])

    def test_terminal_flags_require_exact_booleans(self):
        self.reject_changes("exit.json", [{"workerExited": value} for value in
                                           (False, 1, "true", None)])
        self.reject_changes("exit.json", [{"appInstalled": value} for value in
                                           (True, 0, "false", None)])

    def test_missing_terminal_fields_rejected(self):
        original = self.load("exit.json")
        for key in original:
            with self.subTest(key=key):
                self.write("exit.json", {k: x for k, x in original.items() if k != key})
                with self.assertRaises(ValueError):
                    self.validate()

    def test_duplicate_malformed_nonfinite_json_rejected(self):
        valid = (self.root / "exit.json").read_bytes()
        variants = [valid[:-1] + suffix for suffix in (
            b',"exitCode":0}', b',"unused":NaN}', b',"unused":1e999}',
            b',"unused":{"nested":1,"nested":2}}',
        )]
        for raw in (*variants, b'{}{}', b'{', b'[]', b'\xff', b'null'):
            with self.subTest(raw=raw):
                (self.root / "exit.json").write_bytes(raw)
                with self.assertRaises(ValueError):
                    self.validate()

    def test_powershell_bom_is_supported(self):
        path = self.root / "exit.json"
        path.write_bytes(b"\xef\xbb\xbf" + path.read_bytes())
        self.assertTrue(self.validate()["terminalRecordsValid"])

    def test_wrong_external_pins_rejected(self):
        for pins in ({"run_id": "b" * 12}, {"transfer_sha256": "b" * 64},
                     {"source_commit": "b" * 40}, {"owner_pid": 124},
                     {"owner_pid": True}, {"run_id": "../escape"},
                     {"owner_created_at": "2026-01-01T00:00:00Z"}):
            with self.subTest(pins=pins), self.assertRaises(ValueError):
                self.validate(**pins)

    def test_changed_transfer_bytes_rejected(self):
        with (self.root / "transfer.json").open("ab") as stream:
            stream.write(b"\n")
        with self.assertRaisesRegex(ValueError, "manifest identity"):
            self.validate()

    def test_changed_each_transferred_input_rejected(self):
        for name in v.TRANSFER_NAMES:
            path = self.root / name
            original = path.read_bytes()
            with self.subTest(name=name):
                path.write_bytes(original + b"x")
                with self.assertRaisesRegex(ValueError, "Transferred input changed"):
                    self.validate()
                path.write_bytes(original)

    def test_owner_and_worker_identity_rejected(self):
        self.reject_changes("owner.json", [
            {"host": "DANIELS"}, {"transferSha256": "b" * 64}, {"ownerPid": True},
            {"deadlineSeconds": 1500.0}, {"deadlineSeconds": 1800}, {"command": ""},
        ])
        self.reject_changes("worker-owner.json", [
            {"pid": True}, {"pid": 123}, {"pid": -1}, {"purpose": "other"},
            {"executable": ""}, {"creationTime": "2025-12-31T23:59:59Z"},
        ])

    def test_exit_timestamp_order_bounds_and_timezone(self):
        future = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
        self.reject_changes("exit.json", [{"endedAt": value} for value in (
            "2025-12-31T23:59:59Z", "2026-01-01T00:30:00Z", "not-a-date",
            "2026-01-01T00:02:00", "2026-01-01T01:02:00+01:00", future,
        )])

    def test_qualification_flags_and_identity_rejected(self):
        variants = [{"qualified": x} for x in (False, 1, "true", None)]
        variants += [{"sourceCommit": "b" * 40}, {"inputIdentities": {}},
                     {"appBuilt": True}, {"appInstalled": 0}, {"stagingPinUpdated": True}]
        identities = self.load("qualification.json")["inputIdentities"]
        variants += [{"inputIdentities": {**identities, "transfer.json": "b" * 64}}]
        self.reject_changes("qualification.json", variants)

    def test_source_manifest_tamper_rejected(self):
        self.write("source-manifest.json", [{"changed": True}])
        with self.assertRaisesRegex(ValueError, "source manifest mismatch"):
            self.validate()

    def repin_inputs(self):
        transfer = self.load("transfer.json")
        for entry in transfer["entries"]:
            entry["bytes"] = (self.root / entry["name"]).stat().st_size
            entry["sha256"] = self.digest(entry["name"])
        self.write("transfer.json", transfer)
        self.pin = self.digest("transfer.json")
        owner = self.load("owner.json")
        owner["transferSha256"] = self.pin
        self.write("owner.json", owner)
        qualification = self.load("qualification.json")
        qualification["inputIdentities"] = {name: self.digest(name) for name in v.IDENTITY_NAMES}
        self.write("qualification.json", qualification)

    def test_pinned_but_invalid_case_binding_rejected(self):
        original = self.load("cases.json")
        variants = [dict(original, schema="wrong"), dict(original, cases=[]),
                    dict(original, sources=[]), dict(original, sourceCommit="c" * 40)]
        changed = copy.deepcopy(original)
        changed["sources"][0]["sha256"] = "c" * 64
        variants.append(changed)
        for value in variants:
            with self.subTest(value=value):
                self.write("cases.json", value)
                self.repin_inputs()
                with self.assertRaises(ValueError):
                    self.validate()

    def test_pinned_but_incomplete_snapshot_rejected(self):
        snapshot = self.load("snapshot.json")
        snapshot["entries"] = [e for e in snapshot["entries"] if e["path"] != v.q.CORE[0]]
        self.write("snapshot.json", snapshot)
        self.repin_inputs()
        with self.assertRaisesRegex(ValueError, "core source"):
            self.validate()

    def test_windows_tick_precision_and_deadline(self):
        self.assertEqual(v.utc_time("2026-01-01T00:00:00.0000001Z") - v.utc_time(self.started), 1)
        self.reject_changes("exit.json", [{"endedAt": "2026-01-01T00:00:00.9999999Z"},
                                          {"endedAt": "2026-01-01T00:25:01.0000001Z"}])
        terminal = self.load("exit.json")
        self.write("exit.json", {**terminal, "endedAt": "2026-01-01T00:25:01.0000000Z"})
        self.assertTrue(self.validate()["terminalRecordsValid"])

    def test_owner_activity_order_rejected(self):
        self.reject_changes("owner.json", [{"lastTaskActivity": x} for x in (
            None, "2025-12-31T23:59:59Z", "2026-01-01T00:00:01.0000001Z",
        )])

    def test_externally_pinned_invalid_transfer_inventory_rejected(self):
        original = self.load("transfer.json")
        bad_entries = []
        duplicate = copy.deepcopy(original["entries"])
        duplicate[-1] = copy.deepcopy(duplicate[0])
        bad_entries.extend((duplicate, original["entries"][:-1], [None] * 6))
        for field, value in (("name", "../escape"), ("bytes", True), ("bytes", 0),
                             ("sha256", "A" * 64), ("bytes", v.INPUT_LIMIT + 1)):
            changed = copy.deepcopy(original["entries"])
            changed[0][field] = value
            bad_entries.append(changed)
        for entries in bad_entries:
            with self.subTest(entries=entries):
                self.write("transfer.json", {**original, "entries": entries})
                self.pin = self.digest("transfer.json")
                with self.assertRaisesRegex(ValueError, "transfer"):
                    self.validate()

    def test_missing_owner_worker_or_qualification_is_rejected(self):
        for name in ("owner.json", "worker-owner.json", "qualification.json"):
            with self.subTest(name=name):
                path = self.root / name
                data = path.read_bytes()
                path.unlink()
                with self.assertRaises(OSError):
                    self.validate()
                path.write_bytes(data)

    def test_exit_file_bytes_are_not_modified(self):
        originals = {p.name: p.read_bytes() for p in self.root.iterdir()}
        self.validate()
        self.assertEqual(originals, {p.name: p.read_bytes() for p in self.root.iterdir()})

    def test_failure_marker_rejected(self):
        (self.root / "worker-error.txt").write_text("owner failed", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "Contradictory"):
            self.validate()

    def test_oversize_json_rejected(self):
        (self.root / "exit.json").write_bytes(b" " * (v.JSON_LIMIT + 1))
        with self.assertRaisesRegex(ValueError, "size bound"):
            self.validate()

    def test_nonregular_record_rejected(self):
        path = self.root / "exit.json"
        path.unlink()
        path.mkdir()
        with self.assertRaisesRegex(ValueError, "regular file"):
            self.validate()

    def test_cli_success_and_missing_exit(self):
        args = ["verify_qualification_terminal.py", str(self.root),
                "--run-id", self.run_id, "--transfer-sha256", self.pin,
                "--source-commit", self.commit, "--owner-pid", "123",
                "--owner-created-at", self.started]
        with mock.patch.object(sys, "argv", args):
            self.assertEqual(v.main(), 0)
            (self.root / "exit.json").unlink()
            self.assertEqual(v.main(), 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)