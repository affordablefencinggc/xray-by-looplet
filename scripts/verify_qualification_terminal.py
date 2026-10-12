"""Offline prerequisite only: require consistent, successful owner terminal records.

This does NOT qualify an engine. Legacy exit.json has no attempt/owner/hash binding,
so plausible transplanted terminal records cannot be authenticated by this gate.
Full artifact/log/source/toolchain validation and trusted collection remain required.
Read only a quiescent, caller-owned evidence copy; filesystem race isolation is not
provided. No executable, remote command, extraction, staging or installation occurs.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import re
import stat
import sys

import qualify_frozen_engine as q


JSON_LIMIT = 4 * 1024 * 1024
INPUT_LIMIT = 100 * 1024 * 1024
TRANSFER_NAMES = frozenset((
    "source.zip", "snapshot.json", "cases.json", "qualify_frozen_engine.py",
    "test_qualify_frozen_engine.py", "run-frozen-engine-qualification.ps1",
))
IDENTITY_NAMES = (TRANSFER_NAMES - {"test_qualify_frozen_engine.py"}) | {
    "transfer.json", "source-manifest.json",
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def plain(path):
    path = Path(os.path.abspath(path))
    for part in (path, *path.parents):
        info = part.lstat()
        require(not stat.S_ISLNK(info.st_mode)
                and not getattr(info, "st_file_attributes", 0) & 0x400,
                "Reparse/symlink evidence rejected")
    return path


def read_bytes(path, limit):
    path = plain(path)
    before = path.stat()
    require(stat.S_ISREG(before.st_mode), "Evidence must be a regular file")
    require(before.st_size <= limit, "Evidence size bound exceeded")
    with path.open("rb") as stream:
        opened = os.fstat(stream.fileno())
        require((before.st_dev, before.st_ino) == (opened.st_dev, opened.st_ino),
                "Evidence changed while opening")
        data = stream.read(limit + 1)
        after = os.fstat(stream.fileno())
    require(len(data) <= limit and len(data) == before.st_size
            and (before.st_size, before.st_mtime_ns) == (after.st_size, after.st_mtime_ns),
            "Evidence changed or exceeded size bound")
    return data


def strict_json(data):
    def unique(pairs):
        value = {}
        for key, item in pairs:
            require(key not in value, "Duplicate JSON key")
            value[key] = item
        return value

    def finite(value):
        number = float(value)
        require(math.isfinite(number), "Non-finite JSON number")
        return number

    def nonfinite(_):
        raise ValueError("Non-finite JSON number")

    return json.loads(data.decode("utf-8-sig"), object_pairs_hook=unique,
                      parse_float=finite, parse_constant=nonfinite)


def record(root, name):
    value = strict_json(read_bytes(root / name, JSON_LIMIT))
    require(type(value) is dict, f"Expected object: {name}")
    return value


def hex_value(value, length):
    return type(value) is str and re.fullmatch(f"[a-f0-9]{{{length}}}", value) is not None


def utc_time(value):
    require(type(value) is str and re.fullmatch(
        r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?(?:Z|\+00:00)", value),
        "Expected explicit UTC timestamp")
    # PowerShell roundtrip times carry 100ns ticks; datetime alone drops digit 7.
    base = datetime.fromisoformat(value[:19]).replace(tzinfo=timezone.utc)
    delta = base - datetime(1970, 1, 1, tzinfo=timezone.utc)
    fraction = re.search(r"\.(\d+)", value)
    ticks = int(fraction.group(1).ljust(7, "0")) if fraction else 0
    return (delta.days * 86400 + delta.seconds) * 10_000_000 + ticks


def positive_pid(value):
    return type(value) is int and 0 < value <= 0xFFFFFFFF


def validate_terminal_records(root, *, run_id, transfer_sha256, source_commit,
                              owner_pid, owner_created_at):
    require(hex_value(run_id, 12) and hex_value(transfer_sha256, 64)
            and hex_value(source_commit, 40), "Invalid external identity pin")
    require(positive_pid(owner_pid), "Invalid external owner PID")
    expected_start = utc_time(owner_created_at)
    root = plain(root)
    require(root.is_dir(), "Evidence root must be a directory")
    transfer_raw = read_bytes(root / "transfer.json", JSON_LIMIT)
    require(hashlib.sha256(transfer_raw).hexdigest() == transfer_sha256,
            "Transfer manifest identity mismatch")
    transfer = strict_json(transfer_raw)
    require(type(transfer) is dict and transfer.get("runId") == run_id,
            "Transfer attempt mismatch")
    entries = transfer.get("entries")
    require(type(entries) is list and len(entries) == len(TRANSFER_NAMES),
            "Incomplete transfer entries")
    seen, input_hashes = set(), {}
    for entry in entries:
        require(type(entry) is dict, "Invalid transfer entry")
        name, size, digest = entry.get("name"), entry.get("bytes"), entry.get("sha256")
        require(type(name) is str and name in TRANSFER_NAMES and name not in seen,
                "Unexpected/duplicate transfer entry")
        require(type(size) is int and 0 < size <= INPUT_LIMIT and hex_value(digest, 64),
                "Invalid transfer size/hash")
        data = read_bytes(root / name, INPUT_LIMIT)
        require(len(data) == size and hashlib.sha256(data).hexdigest() == digest,
                f"Transferred input changed: {name}")
        input_hashes[name] = digest
        seen.add(name)
    require(seen == TRANSFER_NAMES, "Incomplete transfer inventory")
    snapshot, cases = record(root, "snapshot.json"), record(root, "cases.json")
    require(snapshot.get("sourceCommit") == source_commit
            and cases.get("sourceCommit") == source_commit,
            "Transferred source commit mismatch")
    require(snapshot.get("archiveSha256") == input_hashes["source.zip"],
            "Snapshot archive identity mismatch")
    source_entries = q.entries_checked(snapshot.get("entries"))
    require(set(q.CORE).issubset({entry["path"] for entry in source_entries}),
            "Incomplete core source manifest")
    q.verify_cases(cases, snapshot)
    source_manifest_raw = read_bytes(root / "source-manifest.json", JSON_LIMIT)
    require(strict_json(source_manifest_raw) == [entry for entry in source_entries
            if entry["path"].startswith("engine/python/") or entry["path"] == q.SCHEMA],
            "Derived engine source manifest mismatch")

    owner = record(root, "owner.json")
    worker = record(root, "worker-owner.json")
    terminal = record(root, "exit.json")
    qualification = record(root, "qualification.json")
    require(owner.get("host") == "DANS1"
            and owner.get("transferSha256") == transfer_sha256,
            "Owner host/transfer mismatch")
    require(positive_pid(owner.get("ownerPid")) and owner["ownerPid"] == owner_pid
            and owner.get("creationTime") == owner_created_at,
            "Owner identity mismatch")
    require(type(owner.get("deadlineSeconds")) is int and owner["deadlineSeconds"] == 1500,
            "Owner deadline mismatch")
    for item, keys in ((owner, ("executable", "command", "purpose")),
                       (worker, ("executable", "purpose"))):
        for key in keys:
            require(type(item.get(key)) is str and item[key].strip(),
                    f"Missing process identity field: {key}")
    require(positive_pid(worker.get("pid")) and worker["pid"] != owner_pid
            and worker["purpose"] == owner["purpose"], "Worker identity mismatch")
    worker_start = utc_time(worker.get("creationTime"))
    owner_activity = utc_time(owner.get("lastTaskActivity"))
    ended = utc_time(terminal.get("endedAt"))
    require(expected_start <= owner_activity <= worker_start <= ended
            <= utc_time(datetime.now(timezone.utc).isoformat()),
            "Terminal timestamp order/future time rejected")
    # Deliberately conservative successful-record budget, not proof of watchdog
    # enforcement. Anchor to worker creation, not owner's prelaunch hashing time.
    require(ended - worker_start <= owner["deadlineSeconds"] * 10_000_000,
            "Terminal record exceeds conservative worker-time budget")
    require(type(terminal.get("exitCode")) is int and terminal["exitCode"] == 0,
            "Missing/unsuccessful owner exit")
    require(terminal.get("workerExited") is True and terminal.get("appInstalled") is False,
            "Worker not exited or installation flag missing/true")
    require(qualification.get("qualified") is True
            and qualification.get("sourceCommit") == source_commit,
            "Qualification success/source mismatch")
    for name in ("appInstalled", "appBuilt", "stagingPinUpdated"):
        require(qualification.get(name) is False, "Qualification crossed app/staging boundary")
    identities = qualification.get("inputIdentities")
    require(type(identities) is dict and set(identities) == IDENTITY_NAMES,
            "Incomplete qualification input identities")
    input_hashes["transfer.json"] = transfer_sha256
    input_hashes["source-manifest.json"] = hashlib.sha256(source_manifest_raw).hexdigest()
    for name in IDENTITY_NAMES:
        require(identities[name] == input_hashes[name], "Qualification input identity mismatch")
    require(not os.path.lexists(root / "worker-error.txt"), "Contradictory owner failure record")
    return {
        "scope": "Offline terminal-record prerequisite only; NOT engine acceptance",
        "runId": run_id, "sourceCommit": source_commit, "ownerPid": owner_pid,
        "terminalRecordsValid": True, "fullEvidenceValidated": False,
        "freshEngineQualified": False, "appAccepted": False,
        "limit": "Legacy exit lacks attempt/owner/hash binding. Process command/executable "
                 "strings are not authenticated. No live process, source-member, toolchain, "
                 "executable, build-log, fixture or resource-policy validation.",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", type=Path)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--transfer-sha256", required=True)
    parser.add_argument("--source-commit", required=True)
    parser.add_argument("--owner-pid", type=int, required=True)
    parser.add_argument("--owner-created-at", required=True)
    args = vars(parser.parse_args())
    try:
        result = validate_terminal_records(**args)
    except (OSError, ValueError, TypeError, KeyError, RecursionError) as error:
        print(f"TERMINAL RECORDS REJECTED: {error}", file=sys.stderr)
        return 1
    print(json.dumps(result, allow_nan=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())