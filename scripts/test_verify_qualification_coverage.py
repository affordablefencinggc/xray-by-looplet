"""Real-file synthetic consistency tests; no collection or engine execution proof."""
import copy
from contextlib import redirect_stderr, redirect_stdout
import hashlib
import io
import json
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest import mock
import xml.etree.ElementTree as ET

import verify_qualification_coverage as c


class CoverageTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.pins = dict(run_id="1" * 12, source_commit="a" * 40)
        paths = ["engine/python/xray/test_a.py", "engine/python/xray/test_b.py"]
        self.snapshot = {"sourceCommit": self.pins["source_commit"], "archiveSha256": "b" * 64,
                         "entries": [{"path": p, "sha256": self.sha(p.encode())}
                                     for p in [*c.t.q.CORE, *paths, "engine/fixtures/test_not_target.py"]]}
        self.write("snapshot.json", self.snapshot)
        self.pins["snapshot_sha256"] = self.digest("snapshot.json")
        self.inventory = dict(schema="xray.collected-tests/v1", runId=self.pins["run_id"],
                              sourceCommit=self.pins["source_commit"],
                              snapshotSha256=self.pins["snapshot_sha256"], pytestVersion="9.1.1",
                              collectionErrors=[], collectionSkips=[], deselected=[], exitCode=0, items=[])
        for path, name in ((paths[0], "test_ok"), (paths[0], "test_more[α::β]"), (paths[1], "test_ok")):
            self.inventory["items"].append(dict(nodeid=path + "::" + name, sourcePath=path,
                sourceSha256=self.sha(path.encode()), classname="xray." + Path(path).stem, name=name))
        self.emit(self.inventory)
        self.junit(self.inventory["items"])

    @staticmethod
    def sha(data):
        return hashlib.sha256(data).hexdigest()

    def digest(self, name):
        return self.sha((self.root / name).read_bytes())

    def write(self, name, value):
        (self.root / name).write_bytes(json.dumps(value, ensure_ascii=True).encode())

    def emit(self, value, *, pin=True):
        self.write("collected-tests.json", value)
        if pin:
            self.pins["collected_tests_sha256"] = self.digest("collected-tests.json")

    def junit(self, items, *, child=None):
        root = ET.Element("testsuites")
        suite = ET.SubElement(root, "testsuite", name="pytest", tests=str(len(items)),
                              skipped=str(int(child == "skipped")), errors="0", failures="0")
        for index, item in enumerate(items):
            case = ET.SubElement(suite, "testcase", classname=item["classname"], name=item["name"])
            if index == 0 and child:
                ET.SubElement(case, child, type="pytest.xfail", message="synthetic reason")
        (self.root / "engine-tests.xml").write_bytes(ET.tostring(root, encoding="utf-8"))

    def validate(self):
        return c.validate_coverage(self.root, **self.pins)

    def reject(self, message=None):
        with self.assertRaisesRegex((ValueError, OSError), message or ".*"):
            self.validate()

    def test_positive_read_only_without_terminal_records(self):
        before = {p.name: (p.read_bytes(), p.stat().st_mtime_ns) for p in self.root.iterdir()}
        result = self.validate()
        self.assertEqual(before, {p.name: (p.read_bytes(), p.stat().st_mtime_ns) for p in self.root.iterdir()})
        self.assertTrue(result["coverageRecordsValid"] and result["allDeclaredTestsPassed"])
        for flag in ("testInventoryAuthenticated", "executionAuthenticated", "freshEngineQualified", "appAccepted"):
            self.assertIs(result[flag], False)
        self.assertEqual((result["sourceTestModuleCount"], result["collectedTestCount"],
                          result["junitTestCount"], result["junitSkippedCount"]), (2, 3, 3, 0))
        for field, filename in (("snapshotSha256", "snapshot.json"), ("collectedTestsSha256", "collected-tests.json"),
                                ("junitSha256", "engine-tests.xml")):
            self.assertEqual(result[field], self.digest(filename))
        self.assertIn("mapper", " ".join(result["limits"]))

    def test_missing_extra_and_duplicate_junit(self):
        items = self.inventory["items"]
        for changed in (items[:-1], items + [{**items[0], "name": "extra"}], items + [items[0]]):
            with self.subTest(items=changed):
                self.junit(changed)
                self.reject()

    def test_same_count_wrong_junit_identity(self):
        items = copy.deepcopy(self.inventory["items"])
        items[0]["classname"] = "another.module"
        self.junit(items)
        self.reject("identity set")

    def test_junit_skips_failures_errors_and_counters(self):
        for child in ("skipped", "failure", "error"):
            with self.subTest(child=child):
                self.junit(self.inventory["items"], child=child)
                self.reject()
        self.junit(self.inventory["items"])
        p = self.root / "engine-tests.xml"
        p.write_bytes(p.read_bytes().replace(b'tests="3"', b'tests="2"'))
        self.reject("counters")

    def test_bad_inventory_fields_values_and_exact_types(self):
        changes = [("rootdir", "source"), ("schema", "other"), ("runId", "2" * 12),
                   ("sourceCommit", "b" * 40), ("snapshotSha256", "b" * 64), ("pytestVersion", "9.1.0"),
                   ("exitCode", False), ("exitCode", True), ("exitCode", 0.0), ("exitCode", 1),
                   ("exitCode", "0"), ("items", []), ("items", {}), ("items", [None])]
        changes += [(field, value) for field in ("collectionErrors", "collectionSkips", "deselected")
                    for value in (["reason"], {}, None, False)]
        for key, value in changes:
            with self.subTest(key=key, value=value):
                self.emit({**self.inventory, key: value})
                self.reject()
        for key in self.inventory:
            with self.subTest(missing=key):
                self.emit({k: v for k, v in self.inventory.items() if k != key})
                self.reject()

    def test_item_fields_strings_source_and_nodeid(self):
        changes = [("extra", "x"), ("name", "wrong"), ("sourceSha256", "f" * 64),
                   ("sourcePath", "engine/python/xray/../test_a.py"),
                   ("sourcePath", "engine/python/xray/job_bom.py"),
                   ("sourcePath", "engine/fixtures/test_not_target.py"),
                   ("sourcePath", "engine/python/xray/test_missing.py"), ("nodeid", "::test_ok")]
        changes += [(field, value) for field in c.ITEM_FIELDS
                    for value in (None, False, "", " ", "bad\ntext", "bad\x00text", "bad\x7ftext", "\ud800", "x" * 4097)]
        for key, value in changes:
            with self.subTest(key=key, value=repr(value)[:50]):
                data = copy.deepcopy(self.inventory)
                data["items"][0][key] = value
                self.emit(data)
                self.reject()
        for key in c.ITEM_FIELDS:
            data = copy.deepcopy(self.inventory)
            del data["items"][0][key]
            self.emit(data)
            self.reject("item fields")

    def test_duplicate_nodeids_and_junit_identities(self):
        for key in ("nodeid", "classname"):
            data = copy.deepcopy(self.inventory)
            data["items"][2][key] = data["items"][0][key]
            self.emit(data)
            self.reject("Duplicate collected")

    def test_case_sensitive_nodeids_and_parameter_separator(self):
        data = copy.deepcopy(self.inventory)
        data["items"][2]["nodeid"] = data["items"][0]["nodeid"].replace("test_a.py", "TEST_A.py")
        self.emit(data)
        self.assertTrue(self.validate()["coverageRecordsValid"])  # Mapping is explicitly NOT proved.

    def test_module_omission_rejected_even_with_matching_junit(self):
        data = copy.deepcopy(self.inventory)
        data["items"] = data["items"][:2]
        self.emit(data)
        self.junit(data["items"])
        self.reject("module omitted")

    def test_case_omission_from_both_records_is_not_authenticated(self):
        data = copy.deepcopy(self.inventory)
        del data["items"][1]  # Both modules remain; function completeness needs external review.
        self.emit(data)
        self.junit(data["items"])
        result = self.validate()
        self.assertTrue(result["allDeclaredTestsPassed"])
        self.assertIs(result["testInventoryAuthenticated"], False)

    def test_unpinned_byte_changes_even_after_internal_rehash(self):
        self.emit(self.inventory, pin=False)
        p = self.root / "collected-tests.json"
        p.write_bytes(p.read_bytes() + b" ")
        self.reject("External pin mismatch")
        self.emit(self.inventory)
        p = self.root / "snapshot.json"
        p.write_bytes(p.read_bytes() + b" ")
        self.emit({**self.inventory, "snapshotSha256": self.digest("snapshot.json")})
        self.reject("External pin mismatch: snapshot")

    def test_strict_json_even_with_new_external_pins(self):
        for filename, field in (("snapshot.json", "snapshot_sha256"), ("collected-tests.json", "collected_tests_sha256")):
            original = (self.root / filename).read_bytes()
            for suffix, message in ((b',"x":1,"x":2}', "Duplicate JSON key"),
                                    (b',"x":NaN}', "Non-finite"), (b',"x":Infinity}', "Non-finite"),
                                    (b',"x":1e999}', "Non-finite")):
                bad = original[:-1] + suffix
                with self.subTest(filename=filename, bad=bad):
                    (self.root / filename).write_bytes(bad)
                    self.pins[field] = self.digest(filename)
                    self.reject(message)
            (self.root / filename).write_bytes(original)
            self.pins[field] = self.digest(filename)

    def test_snapshot_entries_strict_even_when_repinned(self):
        original = self.snapshot["entries"]
        bad_rows = [[], [None], original + [original[-1]], [{"path": 1, "sha256": "a" * 64}],
                    [{"path": "engine/python/xray/test_x.py", "sha256": "A" * 64}],
                    [{"path": "engine/python/xray/test_x.py", "sha256": False}],
                    [{"path": "engine/python/xray/CON.py", "sha256": "a" * 64}],
                    [{"path": "engine/python/xray/../test_x.py", "sha256": "a" * 64}],
                    [{**original[0], "mode": "symlink"}],
                    original + [{"path": "engine/python/XRAY/test_extra.py", "sha256": "a" * 64}]]
        for entries in bad_rows:
            self.write("snapshot.json", {**self.snapshot, "entries": entries})
            self.pins["snapshot_sha256"] = self.digest("snapshot.json")
            self.emit({**self.inventory, "snapshotSha256": self.pins["snapshot_sha256"]})
            self.reject()

    def test_snapshot_commit_mismatch_even_when_repinned(self):
        self.write("snapshot.json", {**self.snapshot, "sourceCommit": "b" * 40})
        self.pins["snapshot_sha256"] = self.digest("snapshot.json")
        self.emit({**self.inventory, "snapshotSha256": self.pins["snapshot_sha256"]})
        self.reject("Snapshot source commit")

    def test_external_pins_required_and_strict(self):
        for key, good in list(self.pins.items()):
            for bad in (None, False, "", "A" * len(good), "b" * len(good)):
                self.pins[key] = bad
                self.reject()
            self.pins[key] = good

    def test_missing_nonregular_and_oversize_files(self):
        for filename in ("snapshot.json", "collected-tests.json", "engine-tests.xml"):
            p = self.root / filename
            original = p.read_bytes()
            p.unlink()
            self.reject()
            p.mkdir()
            self.reject("regular file")
            p.rmdir()
            with p.open("wb") as stream:
                stream.truncate(c.JSON_LIMIT + 1)
            self.reject("size bound")
            p.write_bytes(original)

    def test_reparse_files_root_and_ancestor_rejected_without_privilege(self):
        original = Path.lstat
        for target in (self.root / "snapshot.json", self.root / "collected-tests.json",
                       self.root / "engine-tests.xml", self.root, self.root.parent):
            def attributes(path, *args, **kwargs):
                info = original(path, *args, **kwargs)
                if path == target:
                    return SimpleNamespace(st_mode=info.st_mode, st_file_attributes=0x400)
                return info
            # Inject only the Windows reparse bit, never the parser or file content.
            with self.subTest(target=target), mock.patch.object(Path, "lstat", attributes):
                self.reject("Reparse/symlink")

    def test_item_count_bound(self):
        self.emit({**self.inventory, "items": [self.inventory["items"][0]] * 25001})
        self.reject("item count")

    def test_cli_json_and_nonzero_rejection_without_subprocess(self):
        argv = ["coverage", str(self.root)]
        for key, value in self.pins.items():
            argv.extend(["--" + key.replace("_", "-"), value])
        stdout, stderr = io.StringIO(), io.StringIO()
        with mock.patch.object(sys, "argv", argv), redirect_stdout(stdout), redirect_stderr(stderr):
            self.assertEqual(c.main(), 0)
            self.assertTrue(json.loads(stdout.getvalue())["coverageRecordsValid"])
            (self.root / "engine-tests.xml").unlink()
            self.assertEqual(c.main(), 1)
        self.assertIn("COVERAGE RECORDS REJECTED", stderr.getvalue())


if __name__ == "__main__":
    unittest.main()