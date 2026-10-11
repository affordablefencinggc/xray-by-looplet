"""Offline, engine-only Windows qualification. Never installs or stages an app.

Snapshot ZIPs are generated from Git blobs, not filesystem traversal. Extraction
permits only the exact regular-file manifest, with bounded size and no overwrite.
The Windows runner joins a kill-on-close Job before spawning any child. Its outer
PowerShell owner supplies the whole-run deadline; any failed child aborts the run.
"""
from __future__ import annotations

import argparse
import ctypes
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import subprocess
import sys
import time
import zipfile

SCHEMA = "contracts/xray-job-bom-v1.schema.json"
STEMS = ("colorbond", "timber-paling", "chain-wire", "concrete-allowance")
CORE = ("engine/python/xray/__main__.py", "engine/python/xray/job_bom.py", "engine/python/xray/bom_protocol.py", SCHEMA)
PINNED = {"pypdfium2": "5.12.1", "pikepdf": "10.10.0", "jsonschema": "4.26.0", "ezdxf": "1.4.4", "pytest": "9.1.1", "pyinstaller": "6.22.3"}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def digest(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def write_json(path, value):
    with Path(path).open("x", encoding="utf-8", newline="\n") as stream:
        json.dump(value, stream, indent=2, ensure_ascii=False, allow_nan=False)
        stream.write("\n")


def load(path):
    return strict_json(Path(path).read_text(encoding="utf-8-sig"))


def strict_json(data):
    def unique(pairs):
        obj = {}
        for key, value in pairs:
            if key in obj:
                raise ValueError("Duplicate JSON key")
            obj[key] = value
        return obj
    def nonfinite(_):
        raise ValueError("Non-finite JSON number")
    return json.loads(data, object_pairs_hook=unique, parse_constant=nonfinite)


def plain(path):
    path = Path(os.path.abspath(path))
    for part in (path, *path.parents):
        if part.exists() or part.is_symlink():
            info = part.lstat()
            if stat.S_ISLNK(info.st_mode) or getattr(info, "st_file_attributes", 0) & 0x400:
                raise ValueError("Reparse/symlink path rejected")
    return path


def safe_name(name):
    if (not isinstance(name, str) or not name or re.search(r'[\\:*?"<>|\x00-\x1f]', name)
            or name.startswith("/") or any(p in ("", ".", "..") or p.endswith((".", " ")) for p in name.split("/"))):
        raise ValueError("Unsafe snapshot path")
    if any(re.fullmatch(r"(?i)(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?", p) for p in name.split("/")):
        raise ValueError("Reserved snapshot path")
    return PurePosixPath(name)


def entries_checked(entries):
    if not isinstance(entries, list) or not entries or len(entries) > 5000:
        raise ValueError("Invalid source manifest")
    seen = set()
    for e in entries:
        safe_name(e["path"])
        key = e["path"].lower()
        if key in seen or not re.fullmatch("[a-f0-9]{64}", e["sha256"]):
            raise ValueError("Duplicate path or invalid digest")
        seen.add(key)
    return entries


def selected(name):
    return ((name.startswith(("engine/python/", "engine/fixtures/", "public/models/caroline/"))
             and "__pycache__" not in name.split("/") and not name.endswith(".pyc"))
            or name in (SCHEMA, "src/studio/bomRules.ts", "src/studio/bomContract.ts", "package.json", "package-lock.json"))


def snapshot(repo, destination):
    repo, destination = plain(repo), plain(destination)
    def git(*args):
        return subprocess.check_output(["git", "-C", str(repo), *args], timeout=30)
    commit = git("rev-parse", "HEAD").decode().strip()
    names = [n for n in git("ls-files", "-z").decode().split("\0") if n and selected(n)]
    if not set(CORE).issubset(names):
        raise ValueError("Incomplete engine snapshot")
    if git("diff", "HEAD", "--", *names).strip():
        raise ValueError("Engine snapshot source is dirty")
    payloads = [(n, git("show", f"{commit}:{n}")) for n in sorted(names)]
    # Disallow Git symlinks too; show would otherwise package their target text.
    modes = git("ls-files", "--stage", "--", *names).decode().splitlines()
    if any(not line.startswith("100644 ") and not line.startswith("100755 ") for line in modes):
        raise ValueError("Only regular Git files may be packaged")
    destination.mkdir(parents=True, exist_ok=False)
    entries = [{"path": n, "sha256": sha(b)} for n, b in payloads]
    with zipfile.ZipFile(destination / "source.zip", "x", compression=zipfile.ZIP_STORED) as archive:
        for name, data in payloads:
            safe_name(name)
            archive.writestr(name, data)
    write_json(destination / "snapshot.json", {"sourceCommit": commit, "archiveSha256": digest(destination / "source.zip"), "entries": entries})
    print(json.dumps({"sourceCommit": commit, "files": len(entries), "bytes": (destination / "source.zip").stat().st_size}))


def unpack(archive, record, source):
    entries = entries_checked(record["entries"])
    if digest(archive) != record["archiveSha256"]:
        raise ValueError("Archive identity mismatch")
    source = plain(source)
    if source.exists():
        raise ValueError("Snapshot destination already exists")
    expected = {e["path"]: e["sha256"] for e in entries}
    with zipfile.ZipFile(archive) as z:
        members = z.infolist()
        if len(members) != len(expected) or {m.filename for m in members} != set(expected):
            raise ValueError("Archive members differ from manifest")
        if sum(m.file_size for m in members) > 100 * 1024 * 1024:
            raise ValueError("Snapshot too large")
        for m in members:
            safe_name(m.filename)
            mode = m.external_attr >> 16
            if m.is_dir() or m.flag_bits & 1 or stat.S_IFMT(mode) not in (0, stat.S_IFREG) or m.file_size > 32 * 1024 * 1024:
                raise ValueError("Non-regular or oversized archive member")
        source.mkdir()
        for m in members:
            data = z.read(m)
            if sha(data) != expected[m.filename]:
                raise ValueError("Member digest mismatch")
            target = plain(source / m.filename)
            target.parent.mkdir(parents=True, exist_ok=True)
            with target.open("xb") as stream:
                stream.write(data)


def verify_source(source, entries):
    for e in entries_checked(entries):
        if digest(plain(source / e["path"])) != e["sha256"]:
            raise ValueError(f"Source changed: {e['path']}")
    expected = {e["path"] for e in entries}
    for directory in ("engine/python", "engine/fixtures", "public/models/caroline"):
        base = source / directory
        if base.exists():
            for path in base.rglob("*"):
                plain(path)
                if path.is_file() and selected(path.relative_to(source).as_posix()) and path.relative_to(source).as_posix() not in expected:
                    raise ValueError("Unmanifested source file")


def verify_cases(cases, record):
    if (cases.get("schema") != "xray.frozen-engine-cases/v1" or cases["sourceCommit"] != record["sourceCommit"]
            or [c["name"] for c in cases["cases"]] != [*STEMS, "equal", "full-bays-terminal-cut"]):
        raise ValueError("Case set/source identity mismatch")
    case_entries = entries_checked(cases["sources"])
    case_map = {e["path"]: e["sha256"] for e in case_entries}
    required = {"src/studio/bomRules.ts", "src/studio/bomContract.ts", "package.json", "package-lock.json", SCHEMA}
    required.update(f"engine/fixtures/bom-contract/{n}.{kind}.json" for n in STEMS for kind in ("request", "response"))
    source_map = {e["path"]: e["sha256"] for e in entries_checked(record["entries"])}
    if not required.issubset(case_map) or not required.issubset(source_map):
        raise ValueError("Incomplete TypeScript case provenance")
    for name in required:
        if case_map[name] != source_map[name]:
            raise ValueError("TypeScript case input source mismatch")


def windows_job():
    # Assign self before creating children; retain a non-inheritable handle until
    # process exit. An outer owner timeout closes it by terminating this runner.
    from ctypes import wintypes as w
    class BASIC(ctypes.Structure):
        _fields_ = [("process_time", ctypes.c_int64), ("job_time", ctypes.c_int64), ("flags", w.DWORD),
                    ("min_ws", ctypes.c_size_t), ("max_ws", ctypes.c_size_t), ("active", w.DWORD),
                    ("affinity", ctypes.c_size_t), ("priority", w.DWORD), ("scheduling", w.DWORD)]
    class IO(ctypes.Structure):
        _fields_ = [(n, ctypes.c_uint64) for n in ("r", "w", "o", "rb", "wb", "ob")]
    class EXTENDED(ctypes.Structure):
        _fields_ = [("basic", BASIC), ("io", IO), ("process_memory", ctypes.c_size_t), ("job_memory", ctypes.c_size_t),
                    ("peak_process", ctypes.c_size_t), ("peak_job", ctypes.c_size_t)]
    k = ctypes.WinDLL("kernel32", use_last_error=True)
    k.CreateJobObjectW.argtypes, k.CreateJobObjectW.restype = (w.LPVOID, w.LPCWSTR), w.HANDLE
    k.GetCurrentProcess.restype = w.HANDLE
    k.SetInformationJobObject.argtypes = (w.HANDLE, ctypes.c_int, w.LPVOID, w.DWORD)
    k.AssignProcessToJobObject.argtypes = (w.HANDLE, w.HANDLE)
    k.IsProcessInJob.argtypes = (w.HANDLE, w.HANDLE, ctypes.POINTER(w.BOOL))
    k.QueryInformationJobObject.argtypes = (w.HANDLE, ctypes.c_int, w.LPVOID, w.DWORD, w.LPVOID)
    handle = k.CreateJobObjectW(None, None)
    limits = EXTENDED()
    limits.basic.flags, limits.basic.priority = 0x2000 | 0x20 | 0x10, 0x80
    limits.basic.affinity = (1 << os.cpu_count()) - 1
    if not handle or not k.SetInformationJobObject(handle, 9, ctypes.byref(limits), ctypes.sizeof(limits)):
        raise ctypes.WinError(ctypes.get_last_error())
    if not k.AssignProcessToJobObject(handle, k.GetCurrentProcess()):
        raise ctypes.WinError(ctypes.get_last_error())
    member, actual = w.BOOL(), EXTENDED()
    if (not k.IsProcessInJob(k.GetCurrentProcess(), handle, ctypes.byref(member)) or not member.value
            or not k.QueryInformationJobObject(handle, 9, ctypes.byref(actual), ctypes.sizeof(actual), None)
            or actual.basic.flags & 0x2030 != 0x2030 or actual.basic.priority != 0x80
            or actual.basic.affinity != limits.basic.affinity):
        raise RuntimeError("Job resource policy verification failed")
    return handle  # deliberately retained until process exit


def toolchain():
    packages, files = {}, []
    for d in importlib.metadata.distributions():
        name = d.metadata["Name"].lower().replace("_", "-")
        if name in packages:
            raise ValueError("Duplicate installed distribution")
        packages[name] = d.version
        for f in d.files or []:
            p = plain(d.locate_file(f))
            if p.is_file() and p.suffix != ".pyc" and "__pycache__" not in p.parts:
                files.append({"distribution": name, "path": str(p), "sha256": digest(p)})
    if any(packages.get(n) != v for n, v in PINNED.items()):
        raise ValueError("Build dependency pins do not match")
    for base in {Path(sys.executable).parent, Path(sys.base_prefix)}:
        for pattern in ("python*.exe", "python*.dll"):
            for p in base.glob(pattern):
                files.append({"distribution": "python-runtime", "path": str(plain(p)), "sha256": digest(p)})
    return {"version": sys.version, "executable": sys.executable, "packages": packages,
            "files": sorted(files, key=lambda e: (e["distribution"], e["path"])),
            "limit": "Observed installed toolchain inventory; not independent wheel or base-standard-library attestation."}


def run_step(root, name, args, cwd, env, timeout, data=None, expect_success=True, log_limit=8 * 1024 * 1024):
    started = time.time()
    deadline = time.monotonic() + timeout
    if data is not None and len(data) > 1_048_577:
        raise ValueError("Qualification input exceeds declared negative-test bound")
    input_path = root / f"{name}.stdin.bin"
    with input_path.open("xb") as stream:
        stream.write(data or b"")
    with (root / f"{name}.stdout.log").open("xb") as out, (root / f"{name}.stderr.log").open("xb") as err, input_path.open("rb") as inp:
        proc = subprocess.Popen(args, cwd=cwd, env=env, stdin=inp, stdout=out, stderr=err)
        try:
            write_json(root / f"{name}.owner.json", {"pid": proc.pid, "ownerPid": os.getpid(), "startedEpoch": started,
                       "args": args, "cwd": str(cwd), "purpose": name, "timeoutSeconds": timeout, "logLimitBytes": log_limit})
            while True:
                if os.fstat(out.fileno()).st_size > log_limit or os.fstat(err.fileno()).st_size > log_limit:
                    raise ValueError("Child log size limit exceeded")
                if proc.poll() is not None:
                    break
                if time.monotonic() >= deadline:
                    raise TimeoutError(f"{name} deadline exceeded")
                time.sleep(0.05)
        except BaseException:
            if proc.poll() is None:
                proc.kill()
            proc.wait(timeout=10)
            raise  # caller exits; containing Job then kills any descendants
    result = {"exitCode": proc.returncode, "elapsedSeconds": round(time.time() - started, 3)}
    write_json(root / f"{name}.result.json", result)
    if (proc.returncode == 0) != expect_success:
        raise RuntimeError(f"{name} failed with exit {proc.returncode}")
    return result


def qualify(root):
    if sys.platform != "win32" or os.environ.get("COMPUTERNAME") != "DANS1":
        raise RuntimeError("Qualification is restricted to DANS1 Windows")
    root = plain(root)
    root.relative_to(Path("C:/Users/danie/XRayBuilds/engine-qualification"))
    job = windows_job()
    write_json(root / "resources.json", {"host": "DANS1", "ownerPid": os.getpid(), "jobHandle": job,
               "highPriority": True, "killOnClose": True, "assignedBeforeChildren": True, "logicalProcessors": os.cpu_count()})
    env = {key: value for key, value in os.environ.items() if key.upper() in
           {"SYSTEMROOT", "WINDIR", "COMSPEC", "SYSTEMDRIVE", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "PROGRAMDATA", "COMPUTERNAME"}}
    for name in ("temp", "cache", "unrelated-cwd"):
        (root / name).mkdir()
    env.update(PATH=str(Path(sys.executable).parent) + os.pathsep + os.environ["SYSTEMROOT"] + "\\System32",
               TEMP=str(root / "temp"), TMP=str(root / "temp"), PYTHONDONTWRITEBYTECODE="1", PYTHONIOENCODING="utf-8",
               PYTHONNOUSERSITE="1", PYTEST_DISABLE_PLUGIN_AUTOLOAD="1", PYINSTALLER_CONFIG_DIR=str(root / "cache"))
    record = load(root / "snapshot.json")
    cases = load(root / "cases.json")
    verify_cases(cases, record)
    source = root / "source"
    unpack(root / "source.zip", record, source)
    verify_source(source, record["entries"])
    engine_entries = [e for e in record["entries"] if e["path"].startswith("engine/python/") or e["path"] == SCHEMA]
    write_json(root / "source-manifest.json", engine_entries)
    before = toolchain()
    write_json(root / "toolchain-before.json", before)
    run_step(root, "pip-check", [sys.executable, "-I", "-m", "pip", "check"], root, env, 60)
    test_env = {**env, "PYTHONPATH": str(source / "engine/python")}
    run_step(root, "engine-tests", [sys.executable, "-B", "-m", "pytest", "-q", "-p", "no:cacheprovider", "engine/python/xray",
             f"--junitxml={root / 'engine-tests.xml'}"], source, test_env, 600)
    args = [sys.executable, "-B", "-I", "-m", "PyInstaller", "--clean", "--console", "--onefile", "--noupx",
            "--name", "xray-engine-verified", "--distpath", str(root / "dist"), "--workpath", str(root / "work"),
            "--specpath", str(root / "spec"), "--paths", str(source / "engine/python"), "--add-data",
            str(source / SCHEMA) + ":contracts", str(source / "engine/python/xray/__main__.py")]
    build = run_step(root, "build", args, root, env, 600)
    write_json(root / "build-result.json", build)
    exe = plain(root / "dist/xray-engine-verified.exe")
    executable_hash = digest(exe)
    runtime_env = {k: v for k, v in env.items() if not k.startswith("PYTHON") and k != "PYINSTALLER_CONFIG_DIR"}
    runtime_env["PATH"] = os.environ["SYSTEMROOT"] + "\\System32"
    status_run = run_step(root, "contract-status", [str(exe), "contract-status", "--json"], root / "unrelated-cwd", runtime_env, 10, log_limit=4096)
    raw_status = (root / "contract-status.stdout.log").read_bytes()
    if len(raw_status) > 4096:
        raise ValueError("Status exceeds host bound")
    status = strict_json(raw_status)
    if status != {"requestSchema": "xray.job-to-bom/v1", "responseSchema": "xray.bom/v1", "ruleset": "fencing-v1"}:
        raise ValueError("Wrong engine status")
    checks = []
    for c in cases["cases"]:
        name = c["name"]
        cwd = root / "unrelated-cwd" / name
        cwd.mkdir()
        request = json.dumps(c["request"], ensure_ascii=False, separators=(",", ":")).encode()
        result = cwd / "result.json"
        run_step(root, name, [str(exe), "job-to-bom", "--request-stdin", "--result", str(result)], cwd, runtime_env, 30, request, log_limit=65536)
        plain(result)
        if not stat.S_ISREG(result.lstat().st_mode) or result.stat().st_size > 4 * 1024 * 1024:
            raise ValueError("Response exceeds host limit")
        actual = load(result)
        if actual != c["expected"] or actual.get("ok") is not True:
            raise ValueError(f"Frozen/TypeScript parity failed: {name}")
        row = {"fixture": name, "exitCode": 0, "exactPythonTypeScriptResponseMatch": True,
               "requestSha256": sha(request), "actualFileSha256": digest(result)}
        if name in STEMS:
            if actual != load(source / f"engine/fixtures/bom-contract/{name}.response.json") or c["request"] != load(source / f"engine/fixtures/bom-contract/{name}.request.json"):
                raise ValueError("Frozen fixture mismatch")
            row["exactFrozenResponseMatch"] = True
        else:
            lines = {line["id"]: line for line in actual["bom"]["lines"]}
            expected_sheets = "13" if name == "equal" else "14"
            if lines["bom-cb-sheet"]["quantity"]["value"] != expected_sheets or lines["bom-cb-rail-cut"]["quantity"]["value"] != "10":
                raise ValueError("Layout check failed")
            row.update(expectedSheets=expected_sheets, actualSheets=lines["bom-cb-sheet"]["quantity"]["value"])
        checks.append(row)
    valid = cases["cases"][0]["request"]
    raw_valid = json.dumps(valid, ensure_ascii=False).encode()
    invalid = [("invalid-json", b"{"), ("duplicate-json", b'{"x":1,"x":2}'), ("invalid-utf8", b"\xff"),
               ("oversize", b" " * 1_048_577)]
    for name, key, value in (("bad-digest", "inputDigest", "0" * 64), ("bad-schema", "schema", "wrong"),
                             ("commercial-field", "unitPrice", "99.00")):
        request = {**valid, key: value}
        invalid.append((name, json.dumps(request, ensure_ascii=False).encode()))
    invalid.append(("existing-result", raw_valid))
    negative_checks = []
    for name, request in invalid:
        cwd = root / "unrelated-cwd" / name
        cwd.mkdir()
        result = cwd / "result.json"
        if name == "existing-result":
            result.write_bytes(b"preserve-owned-sentinel")
        run = run_step(root, name, [str(exe), "job-to-bom", "--request-stdin", "--result", str(result)], cwd, runtime_env,
                       30, request, expect_success=False, log_limit=65536)
        if name == "existing-result":
            if plain(result).read_bytes() != b"preserve-owned-sentinel":
                raise ValueError("Existing result overwritten")
        elif result.exists() or result.is_symlink():
            raise ValueError("Invalid request published a result")
        negative_checks.append({"name": name, "exitCode": run["exitCode"], "noPublicationOrOverwrite": True})
    verify_source(source, record["entries"])
    after = toolchain()
    write_json(root / "toolchain-after.json", after)
    if after != before or digest(exe) != executable_hash:
        raise ValueError("Toolchain/executable changed during qualification")
    write_json(root / "fixture-verdict.json", {"executable": str(exe), "sha256": executable_hash, "contractStatus": status, "checks": checks})
    write_json(root / "parity.json", {"exactPythonTypeScriptResponseMatch": True, "cases": 6, "caseFileSha256": digest(root / "cases.json")})
    write_json(root / "negative-verdict.json", negative_checks)
    write_json(root / "qualification.json", {"qualified": True, "sourceCommit": record["sourceCommit"], "sha256": executable_hash,
               "bytes": exe.stat().st_size, "statusSeconds": status_run["elapsedSeconds"], "cases": 6,
               "sourceFiles": len(engine_entries), "toolchainUnchanged": True, "runtimePath": runtime_env["PATH"], "negativeChecks": len(negative_checks),
               "inputIdentities": {n: digest(root / n) for n in ("source.zip", "snapshot.json", "source-manifest.json", "cases.json", "transfer.json", "qualify_frozen_engine.py", "run-frozen-engine-qualification.ps1")},
               "appInstalled": False, "appBuilt": False, "stagingPinUpdated": False,
               "scope": "Windows frozen-engine source tests and six declared BOM fixtures only; no native host/UI/installation/release acceptance."})
    print(json.dumps(load(root / "qualification.json")), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    s = sub.add_parser("snapshot")
    s.add_argument("repo", type=Path)
    s.add_argument("destination", type=Path)
    q = sub.add_parser("qualify")
    q.add_argument("root", type=Path)
    options = parser.parse_args()
    if options.command == "snapshot":
        snapshot(options.repo, options.destination)
    else:
        qualify(options.root)