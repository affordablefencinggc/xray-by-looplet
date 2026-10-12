"""Read-only audit of the preserved blocked attempt, NOT engine acceptance."""
from pathlib import Path
import argparse
import hashlib
import json
import subprocess

import qualify_frozen_engine as q

BASELINE = "cbd1d45ef184f04d2a8a3869af50a387783e0f63"
SOURCE = "5a6378320ce16b9ad801db094aea31d216e52a42"
TRANSFER = "3e738b13b05d6079040b76594ccdf82d5a7cbff8a1b10b06d14d31164ab2de8e"
EVIDENCE = "proof/growth/2026-10-11-full-studio-recovery/engine-qualification-preflight"
HELPERS = ("qualify_frozen_engine.py", "test_qualify_frozen_engine.py",
           "frozen-engine-cases.mjs", "run-frozen-engine-qualification.ps1")
RECORDS = ("local-validation.json", "transfer.json", "snapshot.json", "cases.json",
           "remote-transfer-verification.json", "effective-policy.json",
           "blocked-preflight.json", "local-cleanup.json", "ssh-owner.json",
           "ssh-worker.stderr.log", "helper-tests.stderr.log", "helper-tests.stdout.log")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def lf(data):
    # Preserve everything except the explicitly documented CRLF conversion.
    return data.replace(b"\r\n", b"\n")


def check_records(read, helper):
    """Both readers supply bytes. No subprocess, extraction or file mutation."""
    def record(name):
        return q.strict_json(read(name).decode("utf-8-sig"))

    validation = record("local-validation.json")
    require(validation["sourceCommit"] == SOURCE, "Wrong historical source")
    require(set(validation["helperHashes"]) == set(HELPERS), "Helper set changed")
    for name in HELPERS:
        raw = read(name + ".txt")
        require(sha(raw) == validation["helperHashes"][name], "Raw helper hash mismatch: " + name)
        require(lf(raw) == lf(helper(name)), "Maintained/helper source mismatch: " + name)
    require(validation["helperTestsPassed"] == 9 and validation["helperTestExit"] == 0,
            "Historical helper test record changed")
    require(validation["typescriptReferenceCases"] == 6 and validation["caseSnapshotBinding"] is True,
            "Historical reference result changed")
    require(validation["windowsQualificationExecuted"] is False, "Preflight cannot claim qualification")
    require((validation["aggregateCpuCapPercent"], validation["cpuJobFlags"], validation["cpuJobRate"])
            == (20, 5, 2000), "Historical resource policy changed")
    require(sha(read("transfer.json")) == TRANSFER, "Transfer pin mismatch")
    transfer = record("transfer.json")
    remote = record("remote-transfer-verification.json")
    names = {"source.zip", "snapshot.json", "cases.json", *[n for n in HELPERS if n.endswith((".py", ".ps1"))]}
    entries = transfer["entries"]
    require(len(entries) == len(names) and {e["name"] for e in entries} == names,
            "Transfer names missing or duplicated")
    checks = remote["checks"]
    require(len(checks) == len(names) and {e["name"] for e in checks} == names,
            "Remote verification names missing or duplicated")
    require(remote["host"] == "DANS1" and remote["transferSha256"] == TRANSFER
            and remote["engineExecuted"] is False, "Remote record misstates attempt")
    for entry in entries:
        check = next(c for c in checks if c["name"] == entry["name"])
        require(check["matches"] is True and (check["sha256"], check["bytes"])
                == (entry["sha256"], entry["bytes"]), "Remote transfer mismatch")
        if entry["name"] != "source.zip":
            name = entry["name"]
            data = read(name + ".txt" if name in HELPERS else name)
            require((sha(data), len(data)) == (entry["sha256"], entry["bytes"]), "Transferred bytes differ: " + name)
    snapshot = record("snapshot.json")
    require(snapshot["sourceCommit"] == SOURCE and len(snapshot["entries"]) == 109,
            "Historical snapshot scope changed")
    require(snapshot["archiveSha256"] == next(e["sha256"] for e in entries if e["name"] == "source.zip"),
            "Archive pin disagreement")
    q.verify_cases(record("cases.json"), snapshot)
    policy = record("effective-policy.json")
    require(policy["host"] == "DANS1" and policy["effectiveExecutionPolicy"] == "Restricted",
            "Historical policy block changed")
    blocked = record("blocked-preflight.json")
    require(blocked["host"] == "DANS1" and blocked["taskProcesses"] == [], "Blocked cleanup changed")
    for key in ("workerOwnerExists", "sourceExtracted", "distExists", "qualificationExists"):
        require(blocked[key] is False, "Blocked attempt claims execution: " + key)
    cleanup = record("local-cleanup.json")
    require(cleanup["observedProcess"] is None and cleanup["taskOwnedProcessRemaining"] is False,
            "Local cleanup record changed")
    error = read("ssh-worker.stderr.log").decode("utf-8-sig")
    require("running scripts is disabled" in error and "SecurityError" in error
            and "UnauthorizedAccess" in error, "Missing policy failure")
    return snapshot


def git_reader(repo):
    def git(*args):
        return subprocess.check_output(["git", "-C", str(repo), *args], timeout=60)
    return git


def read_checkpoint(repo, git, baseline, name):
    path = q.plain(repo / name)
    require(path.is_file(), "Evidence is not a regular file")
    data = path.read_bytes()
    for revision in (baseline, "HEAD"):
        entry = git("ls-tree", revision, "--", name).decode().strip()
        require(entry.startswith(("100644 blob ", "100755 blob ")), "Non-regular Git evidence: " + name)
        require(data == git("show", revision + ":" + name), "Evidence differs from immutable Git checkpoint: " + name)
    return data


def verify_sources(repo, git, snapshot):
    entries = q.entries_checked(snapshot["entries"])
    names = {e["path"] for e in entries}
    tree = git("ls-tree", "-r", "HEAD").decode().splitlines()
    modes = {line.split("\t", 1)[1]: line.split(" ", 1)[0] for line in tree}
    current = {n for n in modes if q.selected(n)}
    require(names == current, "Selected source file inventory changed; prepare a new attempt")
    for entry in entries:
        require(modes[entry["path"]] in ("100644", "100755"), "Non-regular Git source: " + entry["path"])
        for revision in (snapshot["sourceCommit"], "HEAD"):
            require(sha(git("show", revision + ":" + entry["path"])) == entry["sha256"], "Snapshot Git source mismatch: " + entry["path"])
    dirty = git("status", "--porcelain", "--untracked-files=all", "--", *sorted(names))
    require(not dirty, "Snapshot source has uncommitted changes")
    q.verify_source(repo, entries)
    return len(entries)


def verify_repository(repo):
    repo = q.plain(repo)
    git = git_reader(repo)

    def read(name):
        return read_checkpoint(repo, git, BASELINE, EVIDENCE + "/" + name)

    for name in (*RECORDS, *(n + ".txt" for n in HELPERS)):
        read(name)

    def helper(name):
        data = q.plain(repo / "scripts" / name).read_bytes()
        require(lf(data) == git("show", "HEAD:scripts/" + name), "Maintained Git/worktree mismatch: " + name)
        return data

    snapshot = check_records(read, helper)
    count = verify_sources(repo, git, snapshot)
    return {"scope": "Preserved blocked-attempt provenance only", "attempt": "1a9f4e6c8202",
            "historicalSourceCommit": SOURCE, "checkpoint": BASELINE, "sourceFiles": count,
            "rawHelpers": len(HELPERS), "freshEngineQualified": False, "remoteStateRechecked": False,
            "sourceArchiveRehashed": False, "appAccepted": False,
            "limit": "ZIP/executable stay external; remote and cleanup observations are historical, not live checks."}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("repo", type=Path)
    print(json.dumps(verify_repository(parser.parse_args().repo), indent=2))