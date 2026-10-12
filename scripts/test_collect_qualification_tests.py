"""Fresh synthetic pytest subprocesses, not a real engine or authenticated prep.

The lead must provide XRAY_OBSERVER_PYTHON and launch under the owned capped job.
Missing interpreter/dependency is failure, never a skipped test.
"""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import threading
from types import SimpleNamespace
import unittest
from unittest import mock
import xml.etree.ElementTree as ET

import collect_qualification_tests as observer
import verify_qualification_coverage as coverage


class ObserverTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        configured = os.environ.get("XRAY_OBSERVER_PYTHON")
        if not configured or not Path(configured).is_absolute() or not Path(configured).is_file():
            raise RuntimeError("XRAY_OBSERVER_PYTHON must name the lead-pinned installed pytest interpreter")
        cls.python = configured

    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.source = self.root / "source"
        self.source.mkdir()
        self.output = self.root / "observation"
        self.snapshot = self.root / "snapshot.json"
        for name in ("temp", "cache"):
            (self.root / name).mkdir()
        for name in observer.t.q.CORE:
            self.put(name, b"# synthetic core\n")
        self.put("engine/python/xray/test_one.py", b"def test_ok():\n    assert True\n")
        self.put("engine/python/xray/test_two.py", b"class TestGroup:\n    def test_ok(self):\n        assert True\n")
        self.env = {k: v for k, v in os.environ.items() if k.upper() in observer.BASE_ENV}
        suffix = os.environ["SYSTEMROOT"] + "\\System32" if os.name == "nt" else os.defpath
        self.env.update(PATH=str(Path(self.python).parent) + os.pathsep + suffix,
                        TEMP=str(self.root / "temp"), TMP=str(self.root / "temp"),
                        PYINSTALLER_CONFIG_DIR=str(self.root / "cache"),
                        PYTHONDONTWRITEBYTECODE="1", PYTHONIOENCODING="utf-8", PYTHONNOUSERSITE="1",
                        PYTEST_DISABLE_PLUGIN_AUTOLOAD="1", PYTHONPATH=str(self.source / "engine/python"))
        self.freeze()

    def put(self, name, data):
        path = self.source / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    def freeze(self):
        rows = [{"path": p.relative_to(self.source).as_posix(), "sha256": self.digest(p)}
                for p in sorted(self.source.rglob("*")) if p.is_file()]
        self.snapshot.write_text(json.dumps({"sourceCommit": "a" * 40, "archiveSha256": "b" * 64,
                                             "entries": rows}), encoding="utf-8")

    @staticmethod
    def digest(path):
        return hashlib.sha256(path.read_bytes()).hexdigest()

    def child(self, args, env=None):
        # Bound retained output independently of timeout; reader kills on overflow.
        logs, over = [bytearray(), bytearray()], threading.Event()
        proc = subprocess.Popen([self.python, "-B", *args], cwd=self.source, env=env or self.env,
                                stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        def drain(stream, buffer):
            while data := stream.read(4096):
                room = 256 * 1024 - len(buffer)
                buffer.extend(data[:room])
                if len(data) > room:
                    over.set()
                    proc.kill()
                    break
            stream.close()
        threads = [threading.Thread(target=drain, args=(stream, logs[i]), daemon=True)
                   for i, stream in enumerate((proc.stdout, proc.stderr))]
        for thread in threads:
            thread.start()
        try:
            code = proc.wait(timeout=30)
        finally:
            if proc.poll() is None:
                proc.kill()
                proc.wait(timeout=5)
            for thread in threads:
                thread.join(timeout=5)
            self.assertTrue(all(not thread.is_alive() for thread in threads), "Owned log reader did not exit")
        self.assertFalse(over.is_set(), "Synthetic child exceeded log quota")
        return code, bytes(logs[0] + logs[1]).decode("utf-8", errors="replace")

    def command(self, **changes):
        options = {"source-root": str(self.source), "snapshot-path": str(self.snapshot),
                   "output-dir": str(self.output), "run-id": "1" * 12, "source-commit": "a" * 40,
                   "snapshot-sha256": self.digest(self.snapshot), "expected-root-relative": "."}
        options.update(changes)
        return [str(Path(observer.__file__).absolute()), *[part for k, v in options.items() for part in ("--" + k, v)]]

    def run_observer(self, *, good=False, env=None, **changes):
        code, log = self.child(self.command(**changes), env=env)
        output = Path(changes.get("output-dir", self.output))
        if good:
            self.assertEqual(code, 0, log)
            self.assertTrue((output / "observation.json").is_file(), log)
            return json.loads((output / "observation.json").read_bytes())
        self.assertNotEqual(code, 0, log)
        self.assertFalse((output / "observation.json").exists(), log)
        self.assertFalse((output / "collected-tests.json").exists(), log)
        return log

    def test_collect_only_never_executes_bodies_and_keeps_source(self):
        sentinel = self.root / "body-ran"
        self.put("engine/python/xray/test_one.py",
                 f"def test_never_runs():\n    open({str(sentinel)!r}, 'w').write('ran')\n    raise AssertionError\n".encode())
        self.freeze()
        before = {p: p.read_bytes() for p in self.source.rglob("*") if p.is_file()}
        result = self.run_observer(good=True)
        self.assertFalse(sentinel.exists())
        self.assertEqual(before, {p: p.read_bytes() for p in self.source.rglob("*") if p.is_file()})
        self.assertEqual(result["collection"]["itemCount"], 2)
        self.assertEqual(result["context"]["rootRelative"], ".")
        self.assertEqual(result["context"]["phase"], "collection-finish")
        self.assertEqual(result["finalContext"]["phase"], "post-main")
        active_junit = [p for p in result["context"]["plugins"] if p["module"] == "_pytest.junitxml"]
        final_junit = [p for p in result["finalContext"]["plugins"] if p["module"] == "_pytest.junitxml"]
        self.assertGreater(len(active_junit), len(final_junit))  # LogXML instance was active, then unregistered.
        self.assertTrue(result["pluginRegistrationHistory"])
        self.assertIn("NOT python -m", result["invocation"]["entryMode"])
        for flag in ("testInventoryAuthenticated", "executionAuthenticated", "fullSourceTestCoverageVerified",
                     "freshEngineQualified", "appAccepted"):
            self.assertIs(result[flag], False)
        self.assertEqual(result["inventory"]["sha256"], self.digest(self.output / "collected-tests.json"))

    def test_independent_real_junit_mapper_and_coverage_oracle(self):
        self.put("engine/python/xray/test_one.py", """import pytest
import unittest
@pytest.mark.parametrize('x', [1, 2, 3], ids=['a::b[x]/z.py', 'α::β', '<&>'])
def test_params(x):
    assert x
def test_λ():
    assert True
class CheckCases(unittest.TestCase):
    def test_unittest(self):
        self.assertTrue(True)
""".encode("utf-8"))
        self.freeze()
        self.run_observer(good=True)
        code, log = self.child(["-m", "pytest", "-q", "-p", "no:cacheprovider", observer.TARGET,
                               "--junitxml=" + str(self.output / "engine-tests.xml")])
        self.assertEqual(code, 0, log)
        inventory = json.loads((self.output / "collected-tests.json").read_bytes())
        actual = {(node.get("classname"), node.get("name"))
                  for node in ET.parse(self.output / "engine-tests.xml").iter("testcase")}
        declared = {(row["classname"], row["name"]) for row in inventory["items"]}
        self.assertEqual(actual, declared)
        self.assertIn(("engine.python.xray.test_one", "test_params[a::b[x]/z.py]"), declared)
        self.assertIn(("engine.python.xray.test_one", "test_λ"), declared)
        self.assertIn(("engine.python.xray.test_one.CheckCases", "test_unittest"), declared)
        (self.output / "snapshot.json").write_bytes(self.snapshot.read_bytes())
        verdict = coverage.validate_coverage(self.output, run_id="1" * 12, source_commit="a" * 40,
                    snapshot_sha256=self.digest(self.snapshot),
                    collected_tests_sha256=self.digest(self.output / "collected-tests.json"))
        self.assertTrue(verdict["coverageRecordsValid"])
        self.assertIs(verdict["executionAuthenticated"], False)

    def test_runtime_skip_markers_are_diagnostics_not_collection_skips(self):
        self.put("engine/python/xray/test_one.py", b"import pytest\n@pytest.mark.skip(reason='runtime only')\ndef test_skip(): pass\n")
        self.freeze()
        result = self.run_observer(good=True)
        self.assertEqual(result["collection"]["runtimeMarkerDiagnostics"][0]["markers"], ["skip"])
        self.assertEqual(json.loads((self.output / "collected-tests.json").read_bytes())["collectionSkips"], [])

    def test_expected_root_mismatch(self):
        self.assertIn("rootdir", self.run_observer(**{"expected-root-relative": "engine"}))

    def test_environment_addopts_and_plugins_contamination(self):
        for key in ("PYTEST_ADDOPTS", "PYTEST_PLUGINS", "PYTHONWARNINGS"):
            with self.subTest(key=key):
                self.assertIn("environment", self.run_observer(env={**self.env, key: "unexpected"}))

    def test_required_autoload_policy(self):
        self.assertIn("environment", self.run_observer(env={**self.env, "PYTEST_DISABLE_PLUGIN_AUTOLOAD": "0"}))

    def test_ancestor_configuration_and_conftest_before_import(self):
        marker = self.root / "ancestor-ran"
        for name, content in (("pytest.ini", "[pytest]\naddopts=-k missing\n"),
                              ("conftest.py", f"open({str(marker)!r}, 'w').write('bad')\n")):
            path = self.root / name
            path.write_text(content, encoding="utf-8")
            self.run_observer()
            self.assertFalse(marker.exists())
            path.unlink()

    def test_snapshot_pin_and_source_bytes(self):
        self.assertIn("pin", self.run_observer(**{"snapshot-sha256": "f" * 64}))
        self.put("engine/python/xray/test_one.py", b"def test_changed(): pass\n")
        self.assertIn("snapshot", self.run_observer())

    def test_mutated_source_during_import(self):
        self.put("engine/python/xray/test_one.py", b"from pathlib import Path\nPath(__file__).write_text('changed')\ndef test_ok(): pass\n")
        self.freeze()
        self.assertIn("snapshot", self.run_observer())

    def test_collection_import_error(self):
        self.put("engine/python/xray/test_one.py", b"raise RuntimeError('synthetic import failure')\n")
        self.freeze()
        self.assertIn("Unsuccessful collection", self.run_observer())

    def test_module_collection_skip(self):
        self.put("engine/python/xray/test_one.py", b"import pytest\npytest.skip('synthetic', allow_module_level=True)\n")
        self.freeze()
        self.assertIn("collection-skip", self.run_observer())

    def test_warning_fails_closed(self):
        self.put("engine/python/xray/test_one.py", b"import warnings\nwarnings.warn('synthetic warning')\ndef test_ok(): pass\n")
        self.freeze()
        self.assertIn("warning", self.run_observer())

    def test_empty_module_omission(self):
        self.put("engine/python/xray/test_one.py", b"# no collected test in this module\n")
        self.freeze()
        self.assertIn("module omitted", self.run_observer())

    def test_deselection_and_nondefault_effective_options(self):
        for code, diagnostic in (("def pytest_collection_modifyitems(config, items):\n    removed=items.pop()\n    config.hook.pytest_deselected(items=[removed])\n", "deselected"),
                                 ("def pytest_configure(config):\n    config.option.keyword='tampered'\n", "Nondefault")):
            with self.subTest(code=code):
                self.put("engine/python/xray/conftest.py", code.encode())
                self.freeze()
                self.assertIn(diagnostic, self.run_observer(**{"output-dir": str(self.root / ("out-" + diagnostic))}))

    def test_duplicate_nodeids_and_nodeid_source_mismatch(self):
        for assignment in ("items.append(items[0])", "items[0]._nodeid='engine/python/xray/test_two.py::test_ok'"):
            self.put("engine/python/xray/conftest.py",
                     ("def pytest_collection_modifyitems(items):\n    " + assignment + "\n").encode())
            self.freeze()
            log = self.run_observer(**{"output-dir": str(self.root / ("out-" + str(len(assignment))))})
            self.assertTrue("Duplicate nodeid" in log or "Nodeid/source" in log, log)

    def test_no_overwrite_output_and_unsafe_manifest(self):
        self.output.mkdir()
        sentinel = self.output / "sentinel"
        sentinel.write_bytes(b"preserved")
        self.assertIn("already exists", self.run_observer())
        self.assertEqual(sentinel.read_bytes(), b"preserved")
        self.put("engine/python/xray/test_[ambiguous].py", b"def test_ok(): pass\n")
        self.freeze()
        self.assertIn("Unsafe source", self.run_observer())

    def test_wrong_runtime_version(self):
        self.put("engine/python/xray/conftest.py", b"import pytest\ndef pytest_configure(config):\n    pytest.__version__='0.0'\n")
        self.freeze()
        self.assertIn("version changed", self.run_observer())

    def test_unexpected_plugin(self):
        self.put("engine/python/xray/plugin_extra.py", b"def pytest_configure(config): pass\n")
        self.put("engine/python/xray/conftest.py", b"pytest_plugins=['plugin_extra']\n")
        self.freeze()
        self.run_observer()

    def test_transient_plugin_registration_before_cleanup_unregistration(self):
        self.put("engine/python/xray/plugin_extra.py", b"class Plugin: pass\n")
        self.put("engine/python/xray/conftest.py", b"""from plugin_extra import Plugin
plugin = Plugin()
def pytest_collection_finish(session):
    session.config.pluginmanager.register(plugin, 'transient-unapproved')
def pytest_unconfigure(config):
    config.pluginmanager.unregister(plugin)
""")
        self.freeze()
        self.assertIn("Unexpected registered plugin", self.run_observer())

    def test_cleanup_warning_rejected(self):
        self.put("engine/python/xray/conftest.py", b"""import warnings
def pytest_unconfigure(config):
    warnings.warn('synthetic cleanup warning')
""")
        self.freeze()
        self.assertIn("cleanup warnings", self.run_observer())

    def test_late_effective_option_mutation(self):
        self.put("engine/python/xray/conftest.py", b"""def pytest_unconfigure(config):
    config.option.keyword = 'late-tamper'
""")
        self.freeze()
        self.assertIn("Nondefault effective pytest options", self.run_observer())

    def test_no_items_is_unsuccessful_collection(self):
        for name in ("test_one.py", "test_two.py"):
            self.put(observer.TARGET + "/" + name, b"# empty\n")
        self.freeze()
        self.assertIn("Unsuccessful collection", self.run_observer())

    def test_strict_snapshot_json_with_external_repin(self):
        original = self.snapshot.read_bytes()
        for tail, diagnostic in ((b',"entries":[]}', "Duplicate JSON key"), (b',"extra":NaN}', "Non-finite")):
            self.snapshot.write_bytes(original[:-1] + tail)
            self.assertIn(diagnostic, self.run_observer())

    def test_hardlinked_source(self):
        path = self.source / observer.TARGET / "test_one.py"
        os.link(path, self.root / "source-alias")
        self.assertIn("Hardlinked source", self.run_observer())

    def test_reader_reparse_and_bounds_without_privilege_skip(self):
        original = Path.lstat
        def attributes(path, *args, **kwargs):
            info = original(path, *args, **kwargs)
            if path == self.snapshot:
                return SimpleNamespace(st_mode=info.st_mode, st_file_attributes=0x400)
            return info
        with mock.patch.object(Path, "lstat", attributes), self.assertRaisesRegex(ValueError, "Reparse"):
            observer.read(self.snapshot)
        with self.snapshot.open("wb") as stream:
            stream.truncate(observer.LIMIT + 1)
        with self.assertRaisesRegex(ValueError, "size bound"):
            observer.read(self.snapshot)


if __name__ == "__main__":
    unittest.main()