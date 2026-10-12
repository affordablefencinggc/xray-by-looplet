"""Offline declared-test/JUnit consistency, NOT collection or execution authentication.

Read only a quiescent caller-owned evidence directory. External SHA pins are
caller-trusted inputs, not authenticated here; filesystem race isolation is not
provided. No collection, source execution,
terminal validation, engine qualification or installation occurs. A wholly
synthetic consistent inventory and JUnit can pass this standalone gate.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import sys

import qualification_structure as structure
import verify_qualification_terminal as t

require = t.require
JSON_LIMIT = 32 * 1024 * 1024
MAX_ITEMS = 25000
STRING_LIMIT = 4096
FIELDS = {"schema", "runId", "sourceCommit", "snapshotSha256", "pytestVersion",
          "collectionErrors", "collectionSkips", "deselected", "exitCode", "items"}
ITEM_FIELDS = {"nodeid", "sourcePath", "sourceSha256", "classname", "name"}


def _text(value):
    require(type(value) is str and 0 < len(value) <= STRING_LIMIT and value.strip()
            and not re.search(r"[\x00-\x1f\x7f-\x9f\ud800-\udfff]", value),
            "Invalid/bounded inventory string")
    return value


def _pinned(root, name, digest):
    raw = t.read_bytes(root / name, JSON_LIMIT)
    require(hashlib.sha256(raw).hexdigest() == digest, f"External pin mismatch: {name}")
    return t.strict_json(raw)


def validate_coverage(root, *, run_id, source_commit, snapshot_sha256,
                      collected_tests_sha256) -> dict:
    require(t.hex_value(run_id, 12) and t.hex_value(source_commit, 40)
            and t.hex_value(snapshot_sha256, 64) and t.hex_value(collected_tests_sha256, 64),
            "Invalid external identity pin")
    root = t.plain(root)
    require(root.is_dir(), "Evidence root must be a directory")
    snapshot = _pinned(root, "snapshot.json", snapshot_sha256)
    require(type(snapshot) is dict and snapshot.get("sourceCommit") == source_commit,
            "Snapshot source commit mismatch")
    entries = snapshot.get("entries")
    require(type(entries) is list and 0 < len(entries) <= 5000, "Invalid snapshot entries")
    sources, aliases = {}, {}
    for row in entries:
        require(type(row) is dict and set(row) == {"path", "sha256"}, "Invalid snapshot entry")
        name = structure.safe_name(_text(row["path"]))
        require(t.q.selected(name) and t.hex_value(row["sha256"], 64), "Invalid source identity")
        require(name not in sources, "Duplicate source path")
        sources[name] = row["sha256"]
        parts = name.split("/")
        for index in range(1, len(parts) + 1):
            prefix = "/".join(parts[:index])
            require(aliases.get(prefix.casefold(), prefix) == prefix, "Source casefold collision")
            aliases[prefix.casefold()] = prefix
    t.q.entries_checked(entries)
    modules = {name for name in sources if name.startswith("engine/python/xray/")
               and Path(name).name.startswith("test_") and name.endswith(".py")}
    inventory = _pinned(root, "collected-tests.json", collected_tests_sha256)
    require(type(inventory) is dict and set(inventory) == FIELDS, "Invalid inventory fields")
    require(inventory["schema"] == "xray.collected-tests/v1"
            and inventory["runId"] == run_id and inventory["sourceCommit"] == source_commit
            and inventory["snapshotSha256"] == snapshot_sha256
            and inventory["pytestVersion"] == "9.1.1", "Inventory identity/version mismatch")
    for field in ("collectionErrors", "collectionSkips", "deselected"):
        require(type(inventory[field]) is list and not inventory[field], f"Nonempty/invalid {field}")
    require(type(inventory["exitCode"]) is int and inventory["exitCode"] == 0,
            "Unsuccessful/invalid collection exit")
    items = inventory["items"]
    require(type(items) is list and 0 < len(items) <= MAX_ITEMS, "Invalid collected item count")
    nodeids, identities, represented = set(), set(), set()
    for item in items:
        require(type(item) is dict and set(item) == ITEM_FIELDS, "Invalid collected item fields")
        for value in item.values():
            _text(value)
        source = structure.safe_name(item["sourcePath"])
        require(source.startswith("engine/python/xray/") and source in modules
                and t.q.selected(source), "Unexpected test source path")
        require(t.hex_value(item["sourceSha256"], 64)
                and item["sourceSha256"] == sources[source], "Test source hash mismatch")
        nodeid, name = item["nodeid"], item["name"]
        # Do not split on :: inside a parameter ID, or invent a rootdir mapper.
        require(nodeid.endswith("::" + name) and len(nodeid) > len(name) + 2,
                "Nodeid/name suffix mismatch")
        identity = (item["classname"], name)
        require(nodeid not in nodeids and identity not in identities, "Duplicate collected identity")
        nodeids.add(nodeid)
        identities.add(identity)
        represented.add(source)
    require(represented == modules, "Snapshot test module omitted from inventory")
    junit_raw = t.read_bytes(root / "engine-tests.xml", 4 * 1024 * 1024)
    junit = structure._junit(root)
    require(junit_raw == t.read_bytes(root / "engine-tests.xml", 4 * 1024 * 1024),
            "JUnit changed during validation")
    require(junit["skipped"] == junit["errors"] == junit["failures"] == 0,
            "JUnit skips/errors/failures forbidden")
    require(junit["tests"] == len(items)
            and {(row["classname"], row["name"]) for row in junit["identities"]} == identities,
            "Collected/JUnit identity set or count mismatch")
    for filename, digest in (("snapshot.json", snapshot_sha256),
                             ("collected-tests.json", collected_tests_sha256)):
        require(hashlib.sha256(t.read_bytes(root / filename, JSON_LIMIT)).hexdigest() == digest,
                "Pinned evidence changed during validation")
    return {
        "schema": "xray.qualification-coverage-consistency/v1", "runId": run_id,
        "sourceCommit": source_commit, "snapshotSha256": snapshot_sha256,
        "collectedTestsSha256": collected_tests_sha256,
        "junitSha256": hashlib.sha256(junit_raw).hexdigest(),
        "sourceTestModuleCount": len(modules), "collectedTestCount": len(items),
        "junitTestCount": junit["tests"], "junitSkippedCount": junit["skipped"],
        "coverageRecordsValid": True, "allDeclaredTestsPassed": True,
        "testInventoryAuthenticated": False, "executionAuthenticated": False,
        "freshEngineQualified": False, "appAccepted": False,
        "limits": [
            "External snapshot/inventory SHA pins are caller-trusted, not authenticated here.",
            "Module representation does not prove every function/parameter was collected; "
            "a separately authenticated, independently reviewed test inventory baseline is required.",
            "No rootdir observation or full pytest nodeid-to-source/JUnit mapper: only declared "
            "identities and the nodeid/name suffix are checked; sourcePath mapping remains unproven.",
            "Synthetic records can pass. No source bytes, terminal, build, runtime or cleanup "
            "validation; this standalone gate does not replace the artifact gate.",
        ],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", type=Path)
    for flag in ("run-id", "source-commit", "snapshot-sha256", "collected-tests-sha256"):
        parser.add_argument("--" + flag, required=True)
    try:
        result = validate_coverage(**vars(parser.parse_args()))
    except (OSError, ValueError, TypeError, KeyError, RecursionError, OverflowError) as error:
        print(f"COVERAGE RECORDS REJECTED: {error}", file=sys.stderr)
        return 1
    print(json.dumps(result, allow_nan=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())