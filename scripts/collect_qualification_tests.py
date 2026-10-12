"""Contained-caller-only pytest 9.1.1 collect-only observer, NOT authentication.

Collection IMPORTS SOURCE CODE. The caller must provide isolation, an owned job,
deadlines and log/disk quotas. This program provides none of those protections.
Use a fresh extracted source and sibling output directory; do not run against a
working checkout. observation.json is published last; its absence means failure.
Neither this receipt nor an inventory hash authenticates preparation/execution.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import importlib.metadata
import importlib.util
import json
import os
from pathlib import Path
import sys
from types import ModuleType
import warnings

import qualification_structure as s
import verify_qualification_coverage as coverage
import verify_qualification_terminal as t

require = t.require
LIMIT = 32 * 1024 * 1024
TARGET = "engine/python/xray"
VERSION = "9.1.1"
CONFIG_NAMES = {"pytest.ini", ".pytest.ini", "pytest.toml", ".pytest.toml",
                "pyproject.toml", "tox.ini", "setup.cfg", "setup.py"}
BASE_ENV = {"SYSTEMROOT", "WINDIR", "COMSPEC", "SYSTEMDRIVE", "USERPROFILE", "APPDATA",
            "LOCALAPPDATA", "PROGRAMDATA", "COMPUTERNAME"}
CONTROL_ENV = {"PATH", "TEMP", "TMP", "PYTHONDONTWRITEBYTECODE", "PYTHONIOENCODING",
               "PYTHONNOUSERSITE", "PYTEST_DISABLE_PLUGIN_AUTOLOAD", "PYINSTALLER_CONFIG_DIR", "PYTHONPATH"}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def read(path, limit=LIMIT):
    path = t.plain(path)
    require(path.stat().st_nlink == 1, "Hardlinked input rejected")
    return t.read_bytes(path, limit)


def encoded(value):
    data = json.dumps(value, ensure_ascii=True, allow_nan=False, sort_keys=True).encode("utf-8") + b"\n"
    require(len(data) <= LIMIT, "Output JSON size bound")
    return data


def source_inventory(source, expected):
    rows = s.file_inventory(source, max_file=LIMIT, max_total=100 * 1024 * 1024)
    require(len(rows) <= 5000 and {r["path"]: r["sha256"] for r in rows} == expected,
            "Extracted source differs from snapshot")
    for row in rows:
        require(t.plain(source / row["path"]).stat().st_nlink == 1, "Hardlinked source rejected")
    return rows


def context_checked(source, expected):
    directories = {source, *source.parents}
    for name in expected:
        directories.update((source / name).parents)
    for directory in directories:
        t.plain(directory)
        require(not any(os.path.lexists(directory / name) for name in CONFIG_NAMES),
                "Configuration/setup file in collection context")
        conftest = directory / "conftest.py"
        if os.path.lexists(conftest):
            require(conftest.is_relative_to(source)
                    and conftest.relative_to(source).as_posix() in expected,
                    "Unmanifested/ancestor conftest rejected before import")
            read(conftest)


def environment_checked(source):
    require(all(k.upper() in BASE_ENV | CONTROL_ENV for k in os.environ), "Unexpected environment variable")
    fixed = {"PYTHONDONTWRITEBYTECODE": "1", "PYTHONIOENCODING": "utf-8",
             "PYTHONNOUSERSITE": "1", "PYTEST_DISABLE_PLUGIN_AUTOLOAD": "1",
             "PYTHONPATH": str(source / "engine/python")}
    require(all(os.environ.get(k) == v for k, v in fixed.items()) and sys.dont_write_bytecode
            and sys.flags.no_user_site,
            "Required Python/pytest environment mismatch")
    suffix = os.environ["SYSTEMROOT"] + "\\System32" if os.name == "nt" else os.defpath
    require(os.environ.get("PATH") == str(Path(sys.executable).parent) + os.pathsep + suffix,
            "Unexpected executable search PATH")
    for key in ("TEMP", "TMP", "PYINSTALLER_CONFIG_DIR"):
        path = t.plain(os.environ[key])
        require(path.is_dir() and not path.is_relative_to(source), "Unsafe caller scratch directory")
    return dict(os.environ)


def runtime():
    distribution = importlib.metadata.distribution("pytest")
    require(distribution.version == VERSION, "Expected installed pytest 9.1.1")
    for name in ("pytest", "_pytest"):
        expected = t.plain(distribution.locate_file(name + "/__init__.py"))
        spec = importlib.util.find_spec(name)
        require(spec is not None and spec.origin is not None and t.plain(spec.origin) == expected,
                "Shadowed pytest import origin")
    import pytest
    from _pytest import junitxml
    from _pytest.config import findpaths, get_config
    require(pytest.__version__ == VERSION, "Expected runtime pytest 9.1.1")
    files = {"pytest": Path(pytest.__file__), "mapper": Path(junitxml.__file__),
             "rootDiscovery": Path(findpaths.__file__), "observer": Path(__file__)}
    identities = {key: {"path": str(t.plain(path)), "sha256": sha(read(path))}
                  for key, path in files.items()}
    return pytest, junitxml, get_config, identities


class Observer:
    def __init__(self, source, expected, root_relative, args, pytest, mapper, baseline):
        self.source, self.expected, self.root_relative, self.args = source, expected, root_relative, args
        self.pytest, self.mapper = pytest, mapper
        self.option_defaults = copy.deepcopy(vars(baseline._parser.parse(args, namespace=copy.copy(baseline.option))))
        self.ini_defaults = {key: copy.deepcopy(value[2]) for key, value in baseline._parser._inidict.items()}
        # Config.parse registers these only after discovery (9.1.1).
        self.ini_defaults.update(addopts=[], minversion="", pythonpath=[], required_plugins=[])
        self.builtin_paths = {plugin.__name__: t.plain(plugin.__file__)
                              for _, plugin in baseline.pluginmanager.list_name_plugin()
                              if isinstance(plugin, ModuleType)}
        pytest_root = t.plain(Path(mapper.__file__).parent)
        self.builtin_paths["_pytest.config"] = pytest_root / "config/__init__.py"
        if sys.platform == "win32":  # terminal.py registers this during configure on Windows only.
            self.builtin_paths["_pytest.terminalprogress"] = pytest_root / "terminalprogress.py"
        self.items, self.markers, self.events = [], [], []
        self.plugin_history = []
        self.phase = "registration"
        self.config = None
        self.session = None
        self.exitstatus = None
        self.finished = False
        self.observed = {}
        self.final_observed = {}

    def event(self, kind, detail):
        require(len(self.events) < coverage.MAX_ITEMS, "Collection event count bound")
        self.events.append({"kind": kind, "detail": str(detail)[:4096]})

    def plugin_identity(self, plugin):
        module_name = plugin.__module__ if isinstance(plugin, type) else type(plugin).__module__
        module = plugin if isinstance(plugin, ModuleType) else sys.modules.get(module_name)
        require(module is not None and getattr(module, "__file__", None), "Unknown plugin origin")
        path = t.plain(module.__file__)
        builtin = self.builtin_paths.get(module.__name__) == path
        conftest = (path.is_relative_to(self.source) and path.name == "conftest.py"
                    and path.relative_to(self.source).as_posix() in self.expected)
        require(builtin or conftest, "Unexpected registered plugin")
        if conftest:
            require(not any(getattr(module, key, None) for key in ("collect_ignore", "collect_ignore_glob", "pytest_plugins")),
                    "Conftest selection/plugin override")
        return {"module": module.__name__, "path": str(path), "sha256": sha(read(path))}

    def pytest_plugin_registered(self, plugin, plugin_name, manager):
        # Historic replay includes initial plugins; later transient registrations
        # remain checked even when removed before collection/cleanup snapshots.
        if plugin is self:
            return
        require(len(self.plugin_history) < 5000, "Plugin registration count bound")
        self.plugin_history.append({"phase": self.phase, "name": coverage._text(plugin_name),
                                    **self.plugin_identity(plugin)})

    def check_config(self, config):
        require(self.pytest.__version__ == VERSION, "Runtime pytest version changed")
        root = t.plain(config.rootpath)
        require(root.is_relative_to(self.source) and root.relative_to(self.source).as_posix() == self.root_relative,
                "Observed rootdir differs from external expectation")
        require(config.inipath is None and not config._inicfg, "Unexpected pytest configuration")
        require(list(config.invocation_params.args) == self.args and config.args == [TARGET]
                and config.invocation_params.dir == self.source, "Changed pytest invocation/selection")
        require(s.equal_json(vars(config.option), self.option_defaults), "Nondefault effective pytest options")
        require(set(config._parser._inidict) == set(self.ini_defaults), "Custom pytest configuration keys")
        ini = {key: copy.deepcopy(config.getini(key)) for key in self.ini_defaults}
        # Builtin plugins append their documented markers during configure.
        for key in ini.keys() - {"markers"}:
            require(s.equal_json(ini[key], self.ini_defaults[key]), "Nondefault effective ini: " + key)
        plugins = []
        for _, plugin in config.pluginmanager.list_name_plugin():
            if plugin is None or plugin is self:
                continue
            require(len(plugins) < 5000, "Plugin snapshot count bound")
            plugins.append(self.plugin_identity(plugin))
        return {"phase": self.phase, "rootpath": str(root), "rootRelative": self.root_relative, "inipath": None,
                "effectiveOptions": copy.deepcopy(vars(config.option)), "effectiveIni": ini,
                "plugins": sorted(plugins, key=lambda row: (row["module"], row["path"]))}

    def pytest_configure(self, config):
        self.phase = "configure"
        self.config = config
        self.check_config(config)

    def pytest_collectreport(self, report):
        if report.failed or report.skipped:
            self.event("collection-error" if report.failed else "collection-skip", report.nodeid)

    def pytest_deselected(self, items):
        self.event("deselected", len(items))

    def pytest_warning_recorded(self, warning_message, when, nodeid, location):
        self.event("warning", warning_message.message)

    def pytest_runtest_logreport(self, report):
        self.event("unexpected-runtime-report", report.nodeid)

    def pytest_collection_finish(self, session):
        self.phase = "collection-finish"
        self.observed = self.check_config(session.config)
        self.session = session
        self.finished = True

    def pytest_sessionfinish(self, session, exitstatus):
        self.phase = "session-finish"
        self.session = session
        self.exitstatus = int(exitstatus)

    def final_items(self):
        require(self.finished and self.session is not None, "Missing completed collection")
        self.phase = "post-main"
        self.final_observed = self.check_config(self.config)
        items = self.session.items  # After ALL modification/session/unconfigure hooks have returned.
        require(0 < len(items) <= coverage.MAX_ITEMS, "Empty/oversized collection")
        require(type(self.session.testscollected) is int and self.session.testscollected == len(items),
                "Session collected count differs from final items")
        seen, identities, modules = set(), set(), set()
        for item in items:
            require(type(item).__module__ in ("_pytest.python", "_pytest.unittest")
                    and isinstance(item, self.pytest.Function), "Custom/non-Python collected item")
            path = t.plain(item.path)
            require(path.is_relative_to(self.source), "Item source outside snapshot")
            source = path.relative_to(self.source).as_posix()
            require(source.startswith(TARGET + "/") and path.name.startswith("test_")
                    and path.suffix == ".py" and source in self.expected, "Unexpected collected source")
            require(t.plain(item.module.__file__) == path, "Item module origin mismatch")
            nodeid = coverage._text(item.nodeid)
            nodepath = s.safe_name(nodeid.partition("::")[0])
            require(t.plain(self.config.rootpath / nodepath) == path, "Nodeid/source path mismatch")
            names = self.mapper.mangle_test_address(nodeid)
            classname, name = ".".join(names[:-1]), self.mapper.bin_xml_escape(names[-1])
            coverage._text(classname)
            coverage._text(name)
            require(name == item.name and nodeid.endswith("::" + name), "Unsupported mapped testcase name")
            identity = (classname, name)
            require(nodeid not in seen and identity not in identities, "Duplicate nodeid/JUnit identity")
            seen.add(nodeid)
            identities.add(identity)
            modules.add(source)
            self.items.append(dict(nodeid=nodeid, sourcePath=source, sourceSha256=self.expected[source],
                                   classname=classname, name=name))
            markers = sorted({mark.name for mark in item.iter_markers() if mark.name in {"skip", "skipif", "xfail"}})
            if markers:
                self.markers.append({"nodeid": nodeid, "markers": markers})
        expected_modules = {name for name in self.expected if name.startswith(TARGET + "/")
                            and Path(name).name.startswith("test_") and name.endswith(".py")}
        require(modules == expected_modules, "Snapshot test module omitted")


def collect(source_root, snapshot_path, output_dir, *, run_id, source_commit, snapshot_sha256,
            expected_root_relative):
    require(t.hex_value(run_id, 12) and t.hex_value(source_commit, 40) and t.hex_value(snapshot_sha256, 64),
            "Invalid external identity pins")
    if expected_root_relative != ".":
        s.safe_name(coverage._text(expected_root_relative))
    source = t.plain(source_root)
    require(source.is_dir(), "Source root must be a directory")
    snapshot_raw = read(snapshot_path)
    require(sha(snapshot_raw) == snapshot_sha256, "Snapshot external pin mismatch")
    snapshot = t.strict_json(snapshot_raw)
    require(type(snapshot) is dict and snapshot.get("sourceCommit") == source_commit, "Snapshot source mismatch")
    entries = snapshot.get("entries")
    require(type(entries) is list and 0 < len(entries) <= 5000, "Invalid snapshot entries")
    for row in entries:
        require(type(row) is dict and set(row) == {"path", "sha256"}, "Invalid snapshot row")
        name = s.safe_name(coverage._text(row["path"]))
        require("[" not in name and t.q.selected(name) and t.hex_value(row["sha256"], 64), "Unsafe source identity")
    expected = {row["path"]: row["sha256"] for row in t.q.entries_checked(entries)}
    require(set(t.q.CORE) <= expected.keys(), "Missing core snapshot source")
    before = source_inventory(source, expected)
    context_checked(source, expected)
    environment = environment_checked(source)
    output = Path(os.path.abspath(output_dir))
    t.plain(output.parent)
    s.safe_name(output.name)
    require(output.parent == source.parent and output != source, "Output must be a fresh source sibling")
    require(not os.path.lexists(output), "Output directory already exists")
    pytest, mapper, get_config, tools = runtime()
    output.mkdir()  # Exclusive owned output; partial files are not a success receipt.
    args = ["-q", "-p", "no:cacheprovider", TARGET, "--junitxml=" + str(output / "collect-only.xml"), "--collect-only"]
    previous_cwd, previous_path = Path.cwd(), sys.path[:]
    try:
        os.chdir(source)
        # Match -m's cwd and producer PYTHONPATH, after installed pytest was checked.
        sys.path[:] = [str(source), str(source / "engine/python")] + [p for p in sys.path
                         if p not in (str(source), str(source / "engine/python"), str(Path(__file__).parent))]
        baseline = get_config(args)
        observer = Observer(source, expected, expected_root_relative, args, pytest, mapper, baseline)
        pytest_path = sys.path[:]
        # Pytest's cleanup warning context uses record=False, so those warnings
        # do not reach pytest_warning_recorded; retain an outer record as well.
        with warnings.catch_warnings(record=True) as cleanup_warnings:
            warnings.simplefilter("always")
            code = pytest.main(args, plugins=[observer])
            require(int(code) == 0 and observer.exitstatus == 0, "Unsuccessful collection exit")
            require(not observer.events, "Collection diagnostics rejected: " + str(observer.events[:3]))
            observer.final_items()
            require(not observer.events, "Collection diagnostics rejected: " + str(observer.events[:3]))
        require(not cleanup_warnings, "Collection cleanup warnings rejected")
    finally:
        os.chdir(previous_cwd)
        sys.path[:] = previous_path
    require(dict(os.environ) == environment, "Collection mutated environment")
    require(before == source_inventory(source, expected), "Source changed during collection")
    context_checked(source, expected)
    require(read(snapshot_path) == snapshot_raw, "Snapshot changed during collection")
    for identity in tools.values():
        require(sha(read(identity["path"])) == identity["sha256"], "Observer/runtime source changed")
    output_rows = s.file_inventory(output, max_file=4 * 1024 * 1024, max_total=4 * 1024 * 1024)
    require([row["path"] for row in output_rows] == ["collect-only.xml"], "Unexpected collection output")
    diagnostic = read(output / "collect-only.xml", 4 * 1024 * 1024)
    inventory = {"schema": "xray.collected-tests/v1", "runId": run_id, "sourceCommit": source_commit,
                 "snapshotSha256": snapshot_sha256, "pytestVersion": VERSION, "collectionErrors": [],
                 "collectionSkips": [], "deselected": [], "exitCode": 0,
                 "items": sorted(observer.items, key=lambda row: row["nodeid"])}
    inventory_bytes = encoded(inventory)
    observation = {
        "schema": "xray.pytest-collection-observation/v1", "runId": run_id, "sourceCommit": source_commit,
        "snapshotSha256": snapshot_sha256, "tools": tools, "pytestVersion": VERSION,
        "python": {"executable": str(t.plain(sys.executable)), "version": sys.version},
        "invocation": {"entryMode": "pytest.main(args, plugins=[observer]); NOT python -m pytest",
                       "processArgv": sys.argv, "pytestArgs": args, "cwd": str(source), "sysPath": pytest_path,
                       "environmentKeys": sorted(environment), "controlledEnvironment": {
                           key: environment[key] for key in CONTROL_ENV}},
        "context": {**observer.observed, "expectedRootRelative": expected_root_relative},
        "finalContext": observer.final_observed, "pluginRegistrationHistory": observer.plugin_history,
        "sourceInventorySha256": sha(encoded(before)), "sourceUnchanged": True,
        "collection": {"itemCount": len(observer.items), "returnedExitCode": int(code),
                       "sessionExitCode": observer.exitstatus, "diagnostics": [],
                       "runtimeMarkerDiagnostics": observer.markers},
        "inventory": {"path": "collected-tests.json", "bytes": len(inventory_bytes), "sha256": sha(inventory_bytes)},
        "collectOnlyJunit": {"path": "collect-only.xml", "bytes": len(diagnostic), "sha256": sha(diagnostic)},
        "testInventoryAuthenticated": False, "executionAuthenticated": False,
        "fullSourceTestCoverageVerified": False, "freshEngineQualified": False, "appAccepted": False,
        "limits": ["Collect-only imports source; caller must provide isolation, owned job, watchdog and disk/log quotas.",
                   "Direct plugin entry differs from producer module entry; observed configuration is not producer attestation.",
                   "Hashes are observations, not authentication. Independently reviewed source/parameter baseline still required.",
                   "No runtime test reports were observed; source imports are executable and not isolated. "
                   "Runtime skip/xfail markers are unevaluated diagnostics, not collection skips.",
                   "No DANS1 preparation, toolchain authenticity, process cleanup or engine/application acceptance proof."],
    }
    observation_bytes = encoded(observation)  # Validate BOTH serialized bounds before publication.
    for filename, data in (("collected-tests.json", inventory_bytes), ("observation.json", observation_bytes)):
        t.plain(output)
        with (output / filename).open("xb") as stream:
            stream.write(data)
    return observation


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("source-root", "snapshot-path", "output-dir"):
        parser.add_argument("--" + name, type=Path, required=True)
    for name in ("run-id", "source-commit", "snapshot-sha256", "expected-root-relative"):
        parser.add_argument("--" + name, required=True)
    try:
        result = collect(**vars(parser.parse_args()))
    except (OSError, ValueError, TypeError, KeyError, RuntimeError, RecursionError, OverflowError) as error:
        print(f"COLLECTION REJECTED: {error}", file=sys.stderr)
        return 1
    print(json.dumps(result, allow_nan=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())