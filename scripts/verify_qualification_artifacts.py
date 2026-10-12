"""Read-only consistency checks for a quiescent legacy qualification bundle.

No engine runs, extraction, collection authentication or acceptance occurs here.
Even a wholly synthetic consistent bundle can pass. External trusted execution,
source preparation, test coverage, warning review and cleanup remain mandatory.
"""
from __future__ import annotations

import argparse
import copy
from decimal import Decimal
import hashlib
import json
import math
import os
from pathlib import Path, PureWindowsPath
import sys

import verify_qualification_terminal as t
import qualification_structure as structure

require = t.require
POSITIVE = (*t.q.STEMS, "equal", "full-bays-terminal-cut")
NEGATIVE = ("invalid-json", "duplicate-json", "invalid-utf8", "oversize",
            "bad-digest", "bad-schema", "commercial-field", "existing-result")
STATUS = {"requestSchema": "xray.job-to-bom/v1", "responseSchema": "xray.bom/v1",
          "ruleset": "fencing-v1"}
REMOTE_PARENT = PureWindowsPath("C:/Users/danie/XRayBuilds/engine-qualification")
EXPECTED_PYTHON = (r"C:\Users\danie\XRayBuilds\industry-visible-20260913"
                   r"\native-engine-20260913-1037\venv\Scripts\python.exe")
SENTINEL = b"preserve-owned-sentinel"


def same(left, right):
    """JSON equality without Python's True == 1 ambiguity."""
    if type(left) is not type(right):
        return False
    if type(left) is dict:
        return left.keys() == right.keys() and all(same(left[k], right[k]) for k in left)
    if type(left) is list:
        return len(left) == len(right) and all(same(a, b) for a, b in zip(left, right))
    return left == right


def number(value, maximum, label):
    require(type(value) in (int, float) and math.isfinite(value)
            and 0 <= value <= maximum, f"Invalid {label}")
    return value


def load(root, name):
    return t.strict_json(t.read_bytes(root / name, t.JSON_LIMIT))


def encoded(value, *, compact=False):
    kwargs = {"separators": (",", ":")} if compact else {}
    return json.dumps(value, ensure_ascii=False, allow_nan=False, **kwargs).encode("utf-8")


def step_plan(remote, python, cases):
    """Mirror the preserved producer's declared invocations; never execute them."""
    source = remote / "source"
    exe = str(remote / "dist/xray-engine-verified.exe")
    rows = [
        ("pip-check", [python, "-I", "-m", "pip", "check"], remote, 60, 8*1024*1024, b""),
        ("engine-tests", [python, "-B", "-m", "pytest", "-q", "-p", "no:cacheprovider",
                          "engine/python/xray", f"--junitxml={remote / 'engine-tests.xml'}"],
         source, 600, 8*1024*1024, b""),
        ("build", [python, "-B", "-I", "-m", "PyInstaller", "--clean", "--console", "--onefile",
                   "--noupx", "--name", "xray-engine-verified", "--distpath", str(remote / "dist"),
                   "--workpath", str(remote / "work"), "--specpath", str(remote / "spec"),
                   "--paths", str(source / "engine/python"), "--add-data",
                   str(source / t.q.SCHEMA) + ":contracts", str(source / "engine/python/xray/__main__.py")],
         remote, 600, 8*1024*1024, b""),
        ("contract-status", [exe, "contract-status", "--json"], remote / "unrelated-cwd", 10, 4096, b""),
    ]
    inputs = [(c["name"], encoded(c["request"], compact=True)) for c in cases]
    valid = cases[0]["request"]
    inputs.extend((("invalid-json", b"{"), ("duplicate-json", b'{"x":1,"x":2}'),
                   ("invalid-utf8", b"\xff"), ("oversize", b" " * 1_048_577)))
    for name, key, value in (("bad-digest", "inputDigest", "0"*64),
                             ("bad-schema", "schema", "wrong"), ("commercial-field", "unitPrice", "99.00")):
        inputs.append((name, encoded({**valid, key: value})))
    inputs.append(("existing-result", encoded(valid)))
    for name, data in inputs:
        cwd = remote / "unrelated-cwd" / name
        rows.append((name, [exe, "job-to-bom", "--request-stdin", "--result", str(cwd / "result.json")],
                     cwd, 30, 65536, data))
    return rows


def validate_steps(root, remote, python, cases):
    worker = t.record(root, "worker-owner.json")
    owner = t.record(root, "owner.json")
    started = Decimal(t.utc_time(worker["creationTime"])) / 10_000_000
    ended = Decimal(t.utc_time(t.record(root, "exit.json")["endedAt"])) / 10_000_000
    previous_end = started
    results = {}
    expected_files = set()
    for name, args, cwd, timeout, limit, data in step_plan(remote, python, cases):
        record = t.record(root, name + ".owner.json")
        result = t.record(root, name + ".result.json")
        require(t.positive_pid(record.get("pid")) and record["pid"] not in (worker["pid"], owner["ownerPid"])
                and type(record.get("ownerPid")) is int and record["ownerPid"] == worker["pid"],
                f"Step process identity mismatch: {name}")
        require(same(record.get("args"), args) and record.get("cwd") == str(cwd)
                and record.get("purpose") == name, f"Step invocation mismatch: {name}")
        require(type(record.get("timeoutSeconds")) is int and record["timeoutSeconds"] == timeout
                and type(record.get("logLimitBytes")) is int and record["logLimitBytes"] == limit,
                f"Step policy mismatch: {name}")
        epoch = Decimal(str(number(record.get("startedEpoch"), 1e12, "step start")))
        elapsed = number(result.get("elapsedSeconds"), timeout, "step elapsed time")
        # Producer stores wall-clock times and rounds elapsed to milliseconds.
        # This is consistency, not monotonic watchdog proof or cross-host ordering.
        require(started <= epoch <= ended and previous_end - Decimal("0.001") <= epoch
                and epoch + Decimal(str(elapsed)) <= ended + Decimal("0.001"),
                f"Step timestamp mismatch: {name}")
        previous_end = epoch + Decimal(str(elapsed))
        code = result.get("exitCode")
        require(type(code) is int and -0x80000000 <= code <= 0xFFFFFFFF
                and ((code != 0) if name in NEGATIVE else (code == 0)), f"Step exit mismatch: {name}")
        require(t.read_bytes(root / (name + ".stdin.bin"), 1_048_577) == data,
                f"Step stdin mismatch: {name}")
        for suffix in (".stdout.log", ".stderr.log"):
            t.read_bytes(root / (name + suffix), limit)
        expected_files.update(name + suffix for suffix in
                              (".owner.json", ".result.json", ".stdin.bin", ".stdout.log", ".stderr.log"))
        results[name] = result
    suffixes = (".owner.json", ".result.json", ".stdin.bin", ".stdout.log", ".stderr.log")
    actual_steps = {p.name for p in root.iterdir() if p.name.endswith(suffixes)}
    require(actual_steps == expected_files | {"worker.stdout.log", "worker.stderr.log"},
            "Unexpected or missing step files")
    require(same(t.record(root, "build-result.json"), results["build"]), "Build result alias mismatch")
    return results


def validate_fixtures(root, remote, cases, results):
    verdict = t.record(root, "fixture-verdict.json")
    require(verdict.get("executable") == str(remote / "dist/xray-engine-verified.exe")
            and same(verdict.get("contractStatus"), STATUS), "Fixture executable/status mismatch")
    require(same(load(root, "contract-status.stdout.log"), STATUS), "Actual status mismatch")
    expected_rows = []
    for case in cases:
        name = case["name"]
        raw = t.read_bytes(root / "unrelated-cwd" / name / "result.json", 4*1024*1024)
        actual = t.strict_json(raw)
        require(same(actual, case["expected"]) and type(actual) is dict and actual.get("ok") is True,
                f"Actual fixture response mismatch: {name}")
        require(type(actual.get("bom")) is dict and actual.get("requestId") == case["request"]["requestId"]
                and actual["bom"].get("inputDigest") == case["request"]["inputDigest"],
                "Response request identity mismatch")
        row = {"fixture": name, "exitCode": 0, "exactPythonTypeScriptResponseMatch": True,
               "requestSha256": hashlib.sha256(encoded(case["request"], compact=True)).hexdigest(),
               "actualFileSha256": hashlib.sha256(raw).hexdigest()}
        if name in t.q.STEMS:
            for kind, value in (("request", case["request"]), ("response", actual)):
                require(same(load(root, f"source/engine/fixtures/bom-contract/{name}.{kind}.json"), value),
                        f"Frozen fixture mismatch: {name}")
            row["exactFrozenResponseMatch"] = True
        else:
            lines = actual["bom"].get("lines")
            require(type(lines) is list and all(type(line) is dict and type(line.get("id")) is str
                    and type(line.get("quantity")) is dict for line in lines),
                    "Invalid layout BOM lines")
            by_id = {line["id"]: line for line in lines}
            require(len(by_id) == len(lines), "Duplicate BOM line identity")
            sheets = "13" if name == "equal" else "14"
            require(by_id["bom-cb-sheet"]["quantity"]["value"] == sheets
                    and by_id["bom-cb-rail-cut"]["quantity"]["value"] == "10", "Layout quantity mismatch")
            row.update(expectedSheets=sheets, actualSheets=sheets)
        expected_rows.append(row)
    require(same(verdict.get("checks"), expected_rows), "Fixture verdict mismatch")
    require(same(t.record(root, "parity.json"), {"exactPythonTypeScriptResponseMatch": True, "cases": 6,
                 "caseFileSha256": hashlib.sha256(t.read_bytes(root / "cases.json", t.JSON_LIMIT)).hexdigest()}),
            "Parity verdict mismatch")
    expected_negative = []
    for name in NEGATIVE:
        path = root / "unrelated-cwd" / name / "result.json"
        t.plain(path.parent)
        if name == "existing-result":
            require(t.read_bytes(path, len(SENTINEL)) == SENTINEL, "Existing-result sentinel changed")
        else:
            require(not os.path.lexists(path), f"Forbidden negative publication: {name}")
        expected_negative.append({"name": name, "exitCode": results[name]["exitCode"], "noPublicationOrOverwrite": True})
    require(same(load(root, "negative-verdict.json"), expected_negative), "Negative verdict mismatch")


def validate_artifacts(root, **pins):
    t.validate_terminal_records(root, **pins)
    root = t.plain(root)
    # Inventory before/after detects ordinary concurrent changes; not adversarial
    # race isolation. Quiescent owned input remains a precondition.
    inventory = structure.file_inventory(root)
    detail = structure.validate_structure(root)
    remote = REMOTE_PARENT / pins["run_id"]
    toolchain = t.strict_json(t.read_bytes(root / "toolchain-before.json", 32*1024*1024))
    python = toolchain["executable"]
    require(python == EXPECTED_PYTHON and t.record(root, "worker-owner.json")["executable"] == python,
            "Worker/toolchain executable mismatch")
    cases = t.record(root, "cases.json")["cases"]
    require(type(cases) is list and len(cases) == 6
            and all(type(c) is dict for c in cases)
            and [c.get("name") for c in cases] == list(POSITIVE), "Case inventory mismatch")
    for case in cases:
        require(type(case.get("request")) is dict and type(case.get("expected")) is dict
                and case["expected"].get("ok") is True, "Incomplete case payload")
        request = case["request"]
        require(type(request.get("requestId")) is str and bool(request["requestId"])
                and t.hex_value(request.get("inputDigest"), 64), "Invalid request identity")
        if case["name"] not in t.q.STEMS:
            base = copy.deepcopy(cases[0]["request"])
            require(type(base.get("recipeSet")) is dict and type(base["recipeSet"].get("recipes")) is list
                    and len(base["recipeSet"]["recipes"]) > 0
                    and type(base["recipeSet"]["recipes"][0]) is dict, "Malformed base layout recipe")
            base["recipeSet"]["recipes"][0]["bayLayout"] = case["name"]
            base["inputDigest"] = request["inputDigest"]
            require(same(request, base) and request["inputDigest"] != cases[0]["request"]["inputDigest"],
                    "Layout request does not derive from colorbond fixture")
    results = validate_steps(root, remote, python, cases)
    validate_fixtures(root, remote, cases, results)
    qualification = t.record(root, "qualification.json")
    for name, expected in (("cases", 6), ("negativeChecks", 8), ("sourceFiles", detail["engineSourceFileCount"])):
        require(type(qualification.get(name)) is int and qualification[name] == expected, "Qualification count mismatch")
    require(qualification.get("toolchainUnchanged") is True
            and same(qualification.get("statusSeconds"), results["contract-status"]["elapsedSeconds"]),
            "Qualification toolchain/status mismatch")
    require(qualification.get("runtimePath") == r"C:\Windows\System32", "Unexpected runtime PATH claim")
    resources = t.record(root, "resources.json")
    require(resources.get("host") == "DANS1" and type(resources.get("ownerPid")) is int
            and resources["ownerPid"] == t.record(root, "worker-owner.json")["pid"]
            and type(resources.get("logicalProcessors")) is int and resources["logicalProcessors"] == 16
            and type(resources.get("jobHandle")) is int and resources["jobHandle"] > 0
            and all(resources.get(key) is True for key in ("highPriority", "killOnClose", "assignedBeforeChildren")),
            "Resource record mismatch")
    for name in ("worker.stdout.log", "worker.stderr.log"):
        t.read_bytes(root / name, 8*1024*1024)
    require(same(load(root, "worker.stdout.log"), qualification), "Worker stdout qualification mismatch")
    require(inventory == structure.file_inventory(root), "Evidence changed during validation")
    return {"schema": "xray.qualification-artifact-consistency/v1", "runId": pins["run_id"],
            "sourceCommit": pins["source_commit"], "transferSha256": pins["transfer_sha256"],
            "terminalRecordsValid": True, "artifactRecordsValid": True, "steps": len(results),
            "structure": detail, "files": inventory, "executionAuthenticated": False,
            "collectionBindingValid": False, "fullEvidenceValidated": False,
            "freshEngineQualified": False, "appAccepted": False,
            "limits": ["Self-consistent records do not authenticate execution or cleanup.",
                       "Legacy exit/owner/process/environment/resource claims remain unauthenticated.",
                       "Source Git provenance, toolchain bytes and complete test coverage need trusted preparation/collection.",
                       "JS per-case serialization hashes are metadata; whole cases file is transfer-pinned.",
                       "Build warnings and skips require explicit review; no staging/native/UI acceptance."]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", type=Path)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--transfer-sha256", required=True)
    parser.add_argument("--source-commit", required=True)
    parser.add_argument("--owner-pid", required=True, type=int)
    parser.add_argument("--owner-created-at", required=True)
    try:
        result = validate_artifacts(**vars(parser.parse_args()))
    except (OSError, ValueError, TypeError, KeyError, RecursionError, OverflowError) as error:
        print(f"ARTIFACT RECORDS REJECTED: {error}", file=sys.stderr)
        return 1
    print(json.dumps(result, allow_nan=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())