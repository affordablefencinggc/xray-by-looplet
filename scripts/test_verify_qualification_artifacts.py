"""Complete SYNTHETIC bundles: no executable or DANS1 acceptance is implied."""
import copy
import hashlib
import json
from pathlib import Path
import stat
import sys
import tempfile
import unittest
from unittest import mock
import zipfile

import verify_qualification_artifacts as v


class ArtifactTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.run_id = "123456789abc"
        self.remote = v.REMOTE_PARENT / self.run_id
        self.python = v.EXPECTED_PYTHON
        self.commit = "a"*40
        self.start = "2026-01-01T00:00:00Z"
        self.cases = []
        for name in v.POSITIVE:
            self.cases.append({"name": name, "request": {"inputDigest": "b"*64, "schema": "xray.job-to-bom/v1",
                               "requestId": "synthetic", "recipeSet": {"recipes": [{"id": "synthetic"}]}},
                               "expected": {"ok": True, "requestId": "synthetic", "bom": {"inputDigest": "b"*64, "lines": [
                                   {"id": "bom-cb-sheet", "quantity": {"value": "13" if name == "equal" else "14"}},
                                   {"id": "bom-cb-rail-cut", "quantity": {"value": "10"}}]}}})
            if name not in v.t.q.STEMS:
                self.cases[-1]["request"]["recipeSet"]["recipes"][0]["bayLayout"] = name
                self.cases[-1]["request"]["inputDigest"] = "c"*64
                self.cases[-1]["expected"]["bom"]["inputDigest"] = "c"*64
        source = {n: b"synthetic unexecuted source" for n in (*v.t.q.CORE, "src/studio/bomRules.ts",
                  "src/studio/bomContract.ts", "package.json", "package-lock.json")}
        for case in self.cases[:4]:
            for kind, value in (("request", case["request"]), ("response", case["expected"])):
                source[f"engine/fixtures/bom-contract/{case['name']}.{kind}.json"] = v.encoded(value)
        self.sources = [{"path": n, "sha256": hashlib.sha256(b).hexdigest()} for n, b in sorted(source.items())]
        with zipfile.ZipFile(self.root / "source.zip", "w") as z:
            for name, data in sorted(source.items()):
                info = zipfile.ZipInfo(name)
                info.external_attr = (stat.S_IFREG | 0o644) << 16
                z.writestr(info, data)
                self.raw("source/" + name, data)
        self.write("snapshot.json", {"schema": "xray.engine-snapshot/v1", "sourceCommit": self.commit,
                   "archiveSha256": self.digest("source.zip"), "entries": self.sources})
        self.write("cases.json", {"schema": "xray.frozen-engine-cases/v1", "sourceCommit": self.commit,
                                 "sources": self.sources, "cases": self.cases})
        engine_sources = [e for e in self.sources if e["path"].startswith("engine/python/") or e["path"] == v.t.q.SCHEMA]
        self.write("source-manifest.json", engine_sources)
        for name in v.t.TRANSFER_NAMES - {"source.zip", "snapshot.json", "cases.json"}:
            self.raw(name, b"synthetic unexecuted input")
        self.write("owner.json", {"host": "DANS1", "ownerPid": 123, "creationTime": self.start,
                   "lastTaskActivity": self.start, "transferSha256": "0"*64, "deadlineSeconds": 1500,
                   "executable": "powershell.exe", "command": "synthetic owner", "purpose": "synthetic qualification"})
        self.write("worker-owner.json", {"pid": 456, "creationTime": "2026-01-01T00:00:01Z",
                                        "executable": self.python, "purpose": "synthetic qualification"})
        self.write("exit.json", {"exitCode": 0, "workerExited": True, "appInstalled": False,
                                 "endedAt": "2026-01-01T00:02:00Z"})
        self.raw("dist/xray-engine-verified.exe", b"MZsynthetic-not-executed")
        self.raw("spec/xray-engine-verified.spec", b"# synthetic, never executed")
        for name in ("Analysis-00.toc", "PYZ-00.toc", "PKG-00.toc", "EXE-00.toc",
                     "warn-xray-engine-verified.txt", "xref-xray-engine-verified.html"):
            self.raw("work/xray-engine-verified/" + name, b"synthetic build evidence")
        toolchain = {"version": "3.12.0 synthetic", "executable": self.python, "packages": dict(v.t.q.PINNED),
                     "files": [{"distribution": name, "path": f"C:\\Python\\Lib\\site-packages\\{name}\\file.py",
                                "sha256": "a"*64} for name in v.t.q.PINNED], "limit": "Synthetic metadata, not attestation"}
        toolchain["files"].append({"distribution": "python-runtime", "path": self.python, "sha256": "b"*64})
        toolchain["files"].sort(key=lambda e: (e["distribution"], e["path"]))
        self.write("toolchain-before.json", toolchain)
        self.write("toolchain-after.json", toolchain)
        self.raw("engine-tests.xml", b'<testsuites><testsuite name="pytest" tests="1" failures="0" errors="0" skipped="0" time="0.1"><testcase classname="xray.test_synthetic" name="test_not_executed" time="0.1" /></testsuite></testsuites>')
        self.write("resources.json", {"host": "DANS1", "ownerPid": 456, "logicalProcessors": 16,
                   "jobHandle": 789, "highPriority": True, "killOnClose": True, "assignedBeforeChildren": True})
        self.raw("worker.stdout.log", b"")
        self.raw("worker.stderr.log", b"")
        for index, (name, args, cwd, timeout, limit, data) in enumerate(v.step_plan(self.remote, self.python, self.cases)):
            self.write(name + ".owner.json", {"pid": 1000+index, "ownerPid": 456, "purpose": name,
                       "args": args, "cwd": str(cwd), "startedEpoch": 1767225602.0+index,
                       "timeoutSeconds": timeout, "logLimitBytes": limit})
            self.write(name + ".result.json", {"exitCode": 2 if name in v.NEGATIVE else 0, "elapsedSeconds": 0.1})
            self.raw(name + ".stdin.bin", data)
            self.raw(name + ".stdout.log", v.encoded(v.STATUS) if name == "contract-status" else b"")
            self.raw(name + ".stderr.log", b"")
            if name in (*v.POSITIVE, *v.NEGATIVE):
                (self.root / "unrelated-cwd" / name).mkdir(parents=True, exist_ok=True)
        self.write("build-result.json", self.load("build.result.json"))
        rows = []
        for case in self.cases:
            name = case["name"]
            self.write(f"unrelated-cwd/{name}/result.json", case["expected"])
            row = {"fixture": name, "exitCode": 0, "exactPythonTypeScriptResponseMatch": True,
                   "requestSha256": self.digest(name + ".stdin.bin"),
                   "actualFileSha256": self.digest(f"unrelated-cwd/{name}/result.json")}
            if name in v.t.q.STEMS:
                row["exactFrozenResponseMatch"] = True
            else:
                row.update(expectedSheets="13" if name == "equal" else "14", actualSheets="13" if name == "equal" else "14")
            rows.append(row)
        self.write("fixture-verdict.json", {"executable": str(self.remote / "dist/xray-engine-verified.exe"),
                   "sha256": self.digest("dist/xray-engine-verified.exe"), "contractStatus": v.STATUS, "checks": rows})
        self.write("parity.json", {"exactPythonTypeScriptResponseMatch": True, "cases": 6,
                                   "caseFileSha256": self.digest("cases.json")})
        self.raw("unrelated-cwd/existing-result/result.json", v.SENTINEL)
        self.write("negative-verdict.json", [{"name": name, "exitCode": 2, "noPublicationOrOverwrite": True} for name in v.NEGATIVE])
        self.write("qualification.json", {"qualified": True, "sourceCommit": self.commit,
                   "sha256": self.digest("dist/xray-engine-verified.exe"),
                   "bytes": (self.root / "dist/xray-engine-verified.exe").stat().st_size,
                   "statusSeconds": 0.1, "cases": 6, "negativeChecks": 8, "sourceFiles": len(engine_sources),
                   "toolchainUnchanged": True, "runtimePath": r"C:\Windows\System32",
                   "appInstalled": False, "appBuilt": False, "stagingPinUpdated": False})
        self.repin()

    def raw(self, name, data):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    def write(self, name, value):
        self.raw(name, v.encoded(value))

    def load(self, name):
        return json.loads((self.root / name).read_bytes())

    def digest(self, name):
        return hashlib.sha256((self.root / name).read_bytes()).hexdigest()

    def repin(self):
        self.write("transfer.json", {"runId": self.run_id, "entries": [
            {"name": n, "bytes": (self.root / n).stat().st_size, "sha256": self.digest(n)} for n in sorted(v.t.TRANSFER_NAMES)]})
        self.pin = self.digest("transfer.json")
        self.change("owner.json", {"transferSha256": self.pin})
        self.change("qualification.json", {"inputIdentities": {n: self.digest(n) for n in v.t.IDENTITY_NAMES}})
        self.write("worker.stdout.log", self.load("qualification.json"))

    def change(self, name, fields):
        self.write(name, {**self.load(name), **fields})

    def validate(self):
        return v.validate_artifacts(self.root, run_id=self.run_id, transfer_sha256=self.pin,
                                   source_commit=self.commit, owner_pid=123, owner_created_at=self.start)

    def test_complete_synthetic_structure_is_not_execution(self):
        result = self.validate()
        self.assertTrue(result["artifactRecordsValid"])
        self.assertEqual(result["steps"], 18)
        for key in ("executionAuthenticated", "collectionBindingValid", "fullEvidenceValidated", "freshEngineQualified", "appAccepted"):
            self.assertIs(result[key], False)

    def test_required_artifact_classes_missing(self):
        names = ("exit.json", "resources.json", "worker.stdout.log", "worker.stderr.log", "build-result.json",
                 "toolchain-after.json", "dist/xray-engine-verified.exe", "engine-tests.xml", "parity.json",
                 "negative-verdict.json", "fixture-verdict.json", "source/"+v.t.q.CORE[0])
        for name in names:
            with self.subTest(name=name):
                data = (self.root / name).read_bytes()
                (self.root / name).unlink()
                with self.assertRaises((ValueError, OSError)):
                    self.validate()
                self.raw(name, data)

    def test_every_step_requires_all_five_files(self):
        for name in ("pip-check", "engine-tests", "build", "contract-status", *v.POSITIVE, *v.NEGATIVE):
            for suffix in (".owner.json", ".result.json", ".stdin.bin", ".stdout.log", ".stderr.log"):
                with self.subTest(name=name, suffix=suffix):
                    path = self.root / (name+suffix)
                    data = path.read_bytes()
                    path.unlink()
                    with self.assertRaises((ValueError, OSError)):
                        self.validate()
                    path.write_bytes(data)

    def test_step_identity_command_and_policy_rejections(self):
        original = self.load("build.owner.json")
        for fields in ({"pid": True}, {"pid": 456}, {"ownerPid": True}, {"ownerPid": 9},
                       {"args": ["untrusted.exe"]}, {"cwd": "C:\\elsewhere"}, {"purpose": "other"},
                       {"timeoutSeconds": True}, {"timeoutSeconds": 601}, {"logLimitBytes": 1},
                       {"startedEpoch": True}, {"startedEpoch": 0}, {"startedEpoch": 1767225900}):
            with self.subTest(fields=fields):
                self.write("build.owner.json", {**original, **fields})
                with self.assertRaises(ValueError):
                    self.validate()
        self.write("build.owner.json", original)

    def test_strict_result_values(self):
        original = self.load("build.result.json")
        for fields in ({"exitCode": False}, {"exitCode": 1}, {"elapsedSeconds": True},
                       {"elapsedSeconds": -1}, {"elapsedSeconds": 601}):
            with self.subTest(fields=fields):
                self.write("build.result.json", {**original, **fields})
                with self.assertRaises(ValueError):
                    self.validate()
        for raw in (b'{"exitCode":0,"elapsedSeconds":NaN}', b'{"exitCode":0,"elapsedSeconds":1e999}',
                    b'{"exitCode":0,"elapsedSeconds":0.1,"exitCode":0}'):
            self.raw("build.result.json", raw)
            with self.assertRaises(ValueError):
                self.validate()

    def test_altered_input_for_every_step(self):
        for name, *_ in v.step_plan(self.remote, self.python, self.cases):
            with self.subTest(name=name):
                path = self.root / (name + ".stdin.bin")
                original = path.read_bytes()
                path.write_bytes(b"wrong")
                with self.assertRaisesRegex(ValueError, "stdin"):
                    self.validate()
                path.write_bytes(original)

    def test_negative_publications_and_sentinel(self):
        for name in v.NEGATIVE[:-1]:
            with self.subTest(name=name):
                path = self.root / "unrelated-cwd" / name / "result.json"
                path.write_bytes(b"unexpected")
                with self.assertRaisesRegex(ValueError, "negative publication"):
                    self.validate()
                path.unlink()
        self.raw("unrelated-cwd/existing-result/result.json", b"changed")
        with self.assertRaisesRegex(ValueError, "sentinel"):
            self.validate()

    def test_negative_zero_exit_and_fabricated_verdict(self):
        self.change("invalid-json.result.json", {"exitCode": 0})
        with self.assertRaisesRegex(ValueError, "exit mismatch"):
            self.validate()
        self.change("invalid-json.result.json", {"exitCode": 2})
        rows = self.load("negative-verdict.json")
        rows[0]["exitCode"] = True
        self.write("negative-verdict.json", rows)
        with self.assertRaisesRegex(ValueError, "Negative verdict"):
            self.validate()

    def test_actual_response_and_boolean_confusion(self):
        for name in v.POSITIVE:
            with self.subTest(name=name):
                path = f"unrelated-cwd/{name}/result.json"
                original = self.load(path)
                self.write(path, {**original, "ok": 1})
                with self.assertRaisesRegex(ValueError, "response mismatch"):
                    self.validate()
                self.write(path, original)

    def test_verdict_row_hashes_and_exact_types(self):
        original = self.load("fixture-verdict.json")
        for field, value in (("requestSha256", "0"*64), ("actualFileSha256", "0"*64), ("exitCode", False),
                             ("exactPythonTypeScriptResponseMatch", 1), ("exactFrozenResponseMatch", 1)):
            changed = copy.deepcopy(original)
            changed["checks"][0][field] = value
            self.write("fixture-verdict.json", changed)
            with self.assertRaisesRegex(ValueError, "Fixture verdict"):
                self.validate()

    def test_parity_status_build_alias_and_counts(self):
        for name, fields in (("parity.json", {"cases": True}), ("build-result.json", {"exitCode": False}),
                             ("qualification.json", {"cases": True}), ("qualification.json", {"sourceFiles": 999}),
                             ("qualification.json", {"statusSeconds": 0.2}),
                             ("qualification.json", {"runtimePath": r"C:\Python"})):
            with self.subTest(name=name, fields=fields):
                original = self.load(name)
                self.change(name, fields)
                with self.assertRaises(ValueError):
                    self.validate()
                self.write(name, original)
        self.write("contract-status.stdout.log", {**v.STATUS, "extra": True})
        with self.assertRaisesRegex(ValueError, "status"):
            self.validate()

    def test_log_bounds_are_actual_bytes(self):
        self.raw("contract-status.stderr.log", b"x"*4097)
        with self.assertRaisesRegex(ValueError, "size bound"):
            self.validate()

    def test_resource_types_and_worker_binding(self):
        original = self.load("resources.json")
        for fields in ({"ownerPid": 123}, {"logicalProcessors": 15}, {"highPriority": 1},
                       {"killOnClose": 1}, {"assignedBeforeChildren": False}, {"jobHandle": True}):
            self.write("resources.json", {**original, **fields})
            with self.assertRaisesRegex(ValueError, "Resource"):
                self.validate()

    def test_unexpected_step_rejected(self):
        self.write("unreviewed.result.json", {"exitCode": 0})
        with self.assertRaisesRegex(ValueError, "step files"):
            self.validate()

    def test_unexpected_step_log_rejected(self):
        self.raw("unreviewed.stdout.log", b"")
        with self.assertRaisesRegex(ValueError, "step files"):
            self.validate()

    def test_sequential_step_overlap_rejected(self):
        self.change("build.owner.json", {"startedEpoch": self.load("engine-tests.owner.json")["startedEpoch"]})
        with self.assertRaisesRegex(ValueError, "timestamp"):
            self.validate()

    def test_millisecond_rounding_boundary(self):
        previous = self.load("engine-tests.owner.json")["startedEpoch"]
        self.change("build.owner.json", {"startedEpoch": previous + 0.099})
        self.assertTrue(self.validate()["artifactRecordsValid"])
        self.change("build.owner.json", {"startedEpoch": previous + 0.0989})
        with self.assertRaisesRegex(ValueError, "timestamp"):
            self.validate()

    def test_worker_stdout_must_equal_qualification(self):
        self.write("worker.stdout.log", {**self.load("qualification.json"), "cases": 1})
        with self.assertRaisesRegex(ValueError, "Worker stdout"):
            self.validate()

    def test_consistent_wrong_python_is_rejected(self):
        wrong = r"C:\Elsewhere\python.exe"
        for name in ("toolchain-before.json", "toolchain-after.json"):
            value = self.load(name)
            value["executable"] = wrong
            for row in value["files"]:
                if row["distribution"] == "python-runtime":
                    row["path"] = wrong
            self.write(name, value)
        self.change("worker-owner.json", {"executable": wrong})
        for name in ("pip-check", "engine-tests", "build"):
            args = self.load(name+".owner.json")["args"]
            args[0] = wrong
            self.change(name+".owner.json", {"args": args})
        with self.assertRaisesRegex(ValueError, "executable mismatch"):
            self.validate()

    def test_malformed_layout_and_response_shapes(self):
        original = self.load("cases.json")
        for field, value in (("recipeSet", None), ("recipeSet", {"recipes": []}),
                             ("recipeSet", {"recipes": [None]}), ("inputDigest", True)):
            changed = copy.deepcopy(original)
            changed["cases"][4]["request"][field] = value
            self.write("cases.json", changed)
            self.repin()
            with self.assertRaises(ValueError):
                self.validate()
        self.write("cases.json", original)
        self.repin()
        for value, error in ((None, "Response request identity"), ([], "Response request identity"),
                             ({"inputDigest": "c"*64, "lines": [None]}, "Invalid layout BOM lines"),
                             ({"inputDigest": "c"*64, "lines": [{"id": "a", "quantity": None}]}, "Invalid layout BOM lines")):
            changed = copy.deepcopy(original)
            changed["cases"][4]["expected"]["bom"] = value
            self.write("cases.json", changed)
            self.write("unrelated-cwd/equal/result.json", changed["cases"][4]["expected"])
            self.repin()
            with self.assertRaisesRegex(ValueError, error):
                self.validate()

    def test_cli_corrupt_zip_returns_clean_rejection(self):
        self.raw("source.zip", b"not a zip")
        self.change("snapshot.json", {"archiveSha256": self.digest("source.zip")})
        self.repin()
        args = ["verify_qualification_artifacts.py", str(self.root), "--run-id", self.run_id,
                "--transfer-sha256", self.pin, "--source-commit", self.commit, "--owner-pid", "123",
                "--owner-created-at", self.start]
        with mock.patch.object(sys, "argv", args):
            self.assertEqual(v.main(), 1)

    def test_independent_command_and_serialization_contract(self):
        rows = {row[0]: row for row in v.step_plan(self.remote, self.python, self.cases)}
        base = r"C:\Users\danie\XRayBuilds\engine-qualification\123456789abc"
        self.assertEqual(rows["pip-check"][1], [self.python, "-I", "-m", "pip", "check"])
        self.assertEqual(rows["engine-tests"][1], [self.python, "-B", "-m", "pytest", "-q", "-p",
                         "no:cacheprovider", "engine/python/xray", "--junitxml="+base+r"\engine-tests.xml"])
        self.assertEqual(rows["build"][1], [self.python, "-B", "-I", "-m", "PyInstaller", "--clean", "--console",
                         "--onefile", "--noupx", "--name", "xray-engine-verified", "--distpath", base+r"\dist",
                         "--workpath", base+r"\work", "--specpath", base+r"\spec", "--paths", base+r"\source\engine\python",
                         "--add-data", base+r"\source\contracts\xray-job-bom-v1.schema.json:contracts",
                         base+r"\source\engine\python\xray\__main__.py"])
        self.assertEqual(rows["contract-status"][1], [base+r"\dist\xray-engine-verified.exe", "contract-status", "--json"])
        self.assertEqual(rows["invalid-json"][5], b"{")
        self.assertEqual(rows["duplicate-json"][5], b'{"x":1,"x":2}')
        self.assertEqual(rows["invalid-utf8"][5], b"\xff")
        self.assertEqual(rows["oversize"][5], b" "*1048577)
        self.assertIn(b'"schema": "wrong"', rows["bad-schema"][5])
        self.assertIn(b'"schema":"xray.job-to-bom/v1"', rows["colorbond"][5])
        self.assertIn(b'"schema": "xray.job-to-bom/v1"', rows["existing-result"][5])

    def test_validator_read_only_and_never_executes_or_extracts(self):
        before = {p.relative_to(self.root).as_posix(): p.read_bytes() for p in self.root.rglob("*") if p.is_file()}
        with mock.patch("subprocess.Popen", side_effect=AssertionError("No execution")), \
                mock.patch.object(zipfile.ZipFile, "extractall", side_effect=AssertionError("No extraction")), \
                mock.patch.object(zipfile.ZipFile, "extract", side_effect=AssertionError("No extraction")):
            self.validate()
        after = {p.relative_to(self.root).as_posix(): p.read_bytes() for p in self.root.rglob("*") if p.is_file()}
        self.assertEqual(before, after)

    def test_cli_missing_terminal_returns_failure(self):
        args = ["verify_qualification_artifacts.py", str(self.root), "--run-id", self.run_id,
                "--transfer-sha256", self.pin, "--source-commit", self.commit, "--owner-pid", "123",
                "--owner-created-at", self.start]
        (self.root / "exit.json").unlink()
        with mock.patch.object(sys, "argv", args):
            self.assertEqual(v.main(), 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)