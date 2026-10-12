"""Read-only structural consistency, NOT authentic execution or engine acceptance.

Use a quiescent caller-owned copy; no filesystem race isolation is promised. Raw
spec/TOCs are hashed, never evaluated. Toolchain absolute paths are syntax only,
never opened. Test coverage and warnings require separately pinned human review.
"""
from __future__ import annotations

import hashlib
import io
import math
import os
from pathlib import Path
import re
import stat
import xml.etree.ElementTree as ET
import zipfile

import verify_qualification_terminal as t

q = t.q
require = t.require
MIB = 1024 * 1024
MAX_NODES = 25000
TOOLCHAIN_LIMIT = 32 * MIB
BUILD_FILES = tuple("work/xray-engine-verified/" + name for name in (
    "Analysis-00.toc", "PYZ-00.toc", "PKG-00.toc", "EXE-00.toc",
    "warn-xray-engine-verified.txt", "xref-xray-engine-verified.html"))
ENGINE = "dist/xray-engine-verified.exe"


def equal_json(a, b):
    """Exact JSON types, including bool/int and int/float; nonfinite is unequal."""
    if type(a) is not type(b):
        return False
    if type(a) is dict:
        return all(type(k) is str for k in a) and a.keys() == b.keys() and all(
            equal_json(v, b[k]) for k, v in a.items())
    if type(a) is list:
        return len(a) == len(b) and all(equal_json(x, y) for x, y in zip(a, b))
    return type(a) in (str, int, float, bool, type(None)) and (
        type(a) is not float or math.isfinite(a)) and a == b


def safe_name(name):
    require(type(name) is str, "Path must be a string")
    q.safe_name(name)
    require(not re.search(r"[\x7f\ud800-\udfff]", name), "Unsafe path characters")
    require(not any(re.fullmatch(r"(?i)(?:(?:COM|LPT)[¹²³]|CONIN\$|CONOUT\$)(?:\..*)?", p)
                    for p in name.split("/")), "Reserved Windows path")
    return name


def _hash_file(path, limit):
    path = t.plain(path)
    before = path.stat()
    require(stat.S_ISREG(before.st_mode) and before.st_size <= limit,
            "Nonregular file or file size bound exceeded")
    digest, size = hashlib.sha256(), 0
    with path.open("rb") as stream:
        opened = os.fstat(stream.fileno())
        require((before.st_dev, before.st_ino) == (opened.st_dev, opened.st_ino),
                "File changed while opening")
        while chunk := stream.read(min(MIB, limit - size + 1)):
            size += len(chunk)
            require(size <= limit, "File size bound exceeded")
            digest.update(chunk)
        after = os.fstat(stream.fileno())
    final = t.plain(path).stat()
    identity = lambda s: (s.st_dev, s.st_ino, s.st_size, s.st_mtime_ns)
    require(identity(before) == identity(after) == identity(final)
            and size == before.st_size, "File changed while hashing")
    return {"bytes": size, "sha256": digest.hexdigest()}


def file_inventory(root: Path, *, max_file=512 * MIB, max_total=2048 * MIB) -> list:
    """Sorted streaming hashes; bound includes directories and rejects aliases."""
    require(type(max_file) is int and max_file >= 0 and type(max_total) is int
            and max_total >= 0, "Invalid inventory bounds")
    root = t.plain(root)
    require(root.is_dir(), "Inventory root must be a directory")
    pending, seen, result, total, nodes = [root], set(), [], 0, 1
    while pending:
        directory = t.plain(pending.pop())
        with os.scandir(directory) as children:
            for child in children:
                nodes += 1
                require(nodes <= MAX_NODES, "Inventory node bound exceeded")
                path = t.plain(Path(child.path))
                name = safe_name(path.relative_to(root).as_posix())
                require(name.casefold() not in seen, "Casefold path collision")
                seen.add(name.casefold())
                mode = path.lstat().st_mode
                if stat.S_ISDIR(mode):
                    pending.append(path)
                else:
                    require(stat.S_ISREG(mode), "Nonregular inventory node")
                    row = {"path": name, **_hash_file(path, min(max_file, max_total - total))}
                    total += row["bytes"]
                    result.append(row)
    return sorted(result, key=lambda row: row["path"])


def _record(root, name, limit=t.JSON_LIMIT):
    value = t.strict_json(t.read_bytes(root / name, limit))
    require(type(value) is dict, "Expected JSON object: " + name)
    return value


def _source(root):
    snapshot = _record(root, "snapshot.json")
    entries = snapshot.get("entries")
    require(type(entries) is list and 0 < len(entries) <= 5000, "Invalid source entries")
    expected, aliases = {}, {}
    for row in entries:
        require(type(row) is dict and set(row) == {"path", "sha256"}, "Invalid source row")
        name = safe_name(row["path"])
        require(q.selected(name) and t.hex_value(row["sha256"], 64), "Invalid source identity")
        require(name not in expected, "Duplicate source path")
        expected[name] = row["sha256"]
        parts = name.split("/")
        for index in range(1, len(parts) + 1):
            prefix = "/".join(parts[:index])
            require(aliases.get(prefix.casefold(), prefix) == prefix, "Source casefold collision")
            aliases[prefix.casefold()] = prefix
    require(set(q.CORE) <= expected.keys(), "Missing core source")
    require(t.hex_value(snapshot.get("sourceCommit"), 40), "Invalid source commit")
    raw = t.read_bytes(root / "source.zip", 100 * MIB)
    require(hashlib.sha256(raw).hexdigest() == snapshot.get("archiveSha256"), "Source ZIP hash")
    try:
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            members = archive.infolist()
            require(len(members) == len(expected) and {m.filename for m in members} == set(expected),
                    "ZIP member set mismatch")
            require(sum(m.file_size for m in members) <= 100 * MIB, "ZIP total bound")
            for member in members:
                require(member.orig_filename == member.filename, "ZIP member name alias")
                safe_name(member.orig_filename)
                require(member.compress_type == zipfile.ZIP_STORED
                        and member.compress_size == member.file_size, "ZIP must use exact stored members")
                require(not member.is_dir() and not member.flag_bits & 1
                        and not member.external_attr & 0x410
                        and stat.S_IFMT(member.external_attr >> 16) in (0, stat.S_IFREG)
                        and 0 <= member.file_size <= 32 * MIB, "Unsafe ZIP member")
                with archive.open(member) as stream:
                    data = stream.read(32 * MIB + 1)
                require(len(data) == member.file_size and len(data) <= 32 * MIB
                        and hashlib.sha256(data).hexdigest() == expected[member.filename],
                        "ZIP member hash/size mismatch")
    except (zipfile.BadZipFile, NotImplementedError, RuntimeError) as error:
        raise ValueError(f"Invalid source ZIP: {error}") from error
    actual = file_inventory(root / "source", max_file=32 * MIB, max_total=100 * MIB)
    require({r["path"]: r["sha256"] for r in actual} == expected, "Extracted source mismatch")
    engine = [r for r in entries if r["path"].startswith("engine/python/") or r["path"] == q.SCHEMA]
    require(equal_json(t.strict_json(t.read_bytes(root / "source-manifest.json", t.JSON_LIMIT)), engine),
            "Engine source manifest mismatch")
    return len(entries), len(engine)


def _windows_identity(value):
    require(type(value) is str and re.match(r"^[A-Za-z]:[\\/]", value), "Expected Windows absolute path")
    tail = value[3:].replace("\\", "/")
    safe_name(tail)
    return value[:2].casefold() + "/" + tail.casefold()


def _toolchain(root, review):
    before = _record(root, "toolchain-before.json", TOOLCHAIN_LIMIT)
    require(equal_json(before, _record(root, "toolchain-after.json", TOOLCHAIN_LIMIT)),
            "Toolchain before/after mismatch")
    require(set(before) == {"version", "executable", "packages", "files", "limit"}, "Toolchain shape")
    require(all(type(before[k]) is str and before[k].strip() for k in ("version", "limit")),
            "Invalid toolchain description")
    executable = _windows_identity(before["executable"])
    packages, normalized = before["packages"], {}
    require(type(packages) is dict and 0 < len(packages) <= MAX_NODES, "Invalid packages")
    normalize = lambda name: re.sub(r"[-_.]+", "-", name).lower()
    for name, version in packages.items():
        require(type(name) is str and re.fullmatch(r"[A-Za-z0-9](?:[A-Za-z0-9_.-]*[A-Za-z0-9])?", name)
                and type(version) is str and version.strip(), "Invalid package identity")
        key = normalize(name)
        require(key not in normalized and key != "python-runtime", "Duplicate/reserved package")
        normalized[key] = version
    require(all(normalized.get(n) == v for n, v in q.PINNED.items()), "Package pin mismatch")
    rows, seen, distributions, duplicate_count = before["files"], {}, set(), 0
    require(type(rows) is list and 0 < len(rows) <= MAX_NODES, "Invalid toolchain files")
    for row in rows:
        require(type(row) is dict and set(row) == {"distribution", "path", "sha256"}, "Toolchain file shape")
        dist = row["distribution"]
        require(type(dist) is str and (dist == "python-runtime" or dist in packages)
                and t.hex_value(row["sha256"], 64), "Toolchain file identity")
        identity = _windows_identity(row["path"])
        if identity in seen:
            # Producer glob roots can overlap. Tolerate only byte-identical runtime
            # rows, never aliases, conflicting hashes or duplicate package rows.
            require(dist == "python-runtime" and equal_json(row, seen[identity]), "Duplicate toolchain path")
            duplicate_count += 1
        else:
            seen[identity] = row
        distributions.add(normalize(dist))
    require(set(normalized) <= distributions and executable in seen
            and seen[executable]["distribution"] == "python-runtime", "Incomplete toolchain inventory")
    if duplicate_count:
        review.append(f"Toolchain has {duplicate_count} identical overlapping python-runtime rows; deduplicated count only.")
    review.append("Toolchain inventory is observed metadata, not independent wheel/base-library attestation.")
    return len(seen)


def _junit(root):
    raw = t.read_bytes(root / "engine-tests.xml", 4 * MIB)
    text = raw.decode("utf-8-sig")  # UTF-16/32 are rejected, not token-scan bypasses.
    require("\x00" not in text and not re.search(r"<!\s*(?:DOCTYPE|ENTITY)", text, re.I), "DTD/entities forbidden")
    declaration = re.match(r"\s*<\?xml\b(.*?)\?>", text, re.S)
    require(not declaration or not re.search(r"encoding\s*=\s*['\"](?!utf-8['\"])", declaration[1], re.I),
            "Only UTF-8 JUnit supported")
    try:
        tree = ET.fromstring(text)
    except ET.ParseError as error:
        raise ValueError("Invalid JUnit XML") from error
    require(tree.tag == "testsuites" and len(tree) > 0, "JUnit testsuites shape")
    require(sum(1 for _ in tree.iter()) <= MAX_NODES, "JUnit node bound")
    attributes = {"testsuites": {"name", "tests", "errors", "failures", "skipped", "time"},
                  "testsuite": {"name", "tests", "errors", "failures", "skipped", "time", "timestamp", "hostname"},
                  "testcase": {"classname", "name", "time", "file", "line", "url"},
                  "skipped": {"type", "message"}}
    for node in tree.iter():
        require(node.tag in attributes and set(node.attrib) <= attributes[node.tag], "Unexpected JUnit attributes/element")
        if "time" in node.attrib:
            value = node.get("time")
            require(re.fullmatch(r"[0-9]+(?:\.[0-9]+)?", value)
                    and math.isfinite(float(value)), "Invalid JUnit duration")
        require(not (node.tail or "").strip() and (node.tag == "skipped"
                or not (node.text or "").strip()), "Unexpected JUnit text")
    identities, skips, tests = set(), [], 0
    def count(node, field):
        value = node.get(field)
        require(type(value) is str and re.fullmatch(r"[0-9]{1,8}", value), "JUnit counter missing/invalid")
        return int(value)
    for suite in tree:
        require(suite.tag == "testsuite" and suite.get("name", "").strip(), "JUnit suite shape")
        local_tests = local_skips = 0
        for case in suite:
            require(case.tag == "testcase" and case.get("name", "").strip()
                    and case.get("classname", "").strip(), "JUnit testcase shape")
            identity = (case.get("classname"), case.get("name"))
            require(identity not in identities, "Duplicate JUnit testcase identity")
            identities.add(identity)
            require(len(case) <= 1 and all(c.tag == "skipped" and len(c) == 0 for c in case),
                    "JUnit failure/error or unexpected testcase child")
            if len(case):
                reason = (case[0].get("message", "") + " " + (case[0].text or "")).strip()
                require(bool(reason), "JUnit skip lacks reason")
                skips.append({"classname": identity[0], "name": identity[1], "reason": reason})
                local_skips += 1
            local_tests += 1
        require(local_tests > 0 and count(suite, "tests") == local_tests
                and count(suite, "skipped") == local_skips
                and count(suite, "failures") == count(suite, "errors") == 0, "JUnit counters/failure")
        tests += local_tests
    totals = {"tests": tests, "skipped": len(skips), "failures": 0, "errors": 0}
    for key, value in totals.items():
        if key in tree.attrib:
            require(count(tree, key) == value, "JUnit aggregate counters")
    return {**totals, "skips": skips, "identities": [dict(classname=c, name=n) for c, n in sorted(identities)]}


def validate_structure(root: Path) -> dict:
    root = t.plain(root)
    source_count, engine_count = _source(root)
    review = ["JUnit test coverage is unknown without a separately pinned reviewed test/skip list.",
              "Review raw spec, TOCs, warnings and xref; hashes/presence do not establish build correctness."]
    toolchain_count = _toolchain(root, review)
    inventory, remaining = [], 2048 * MIB
    for name in ("work", "spec", "dist"):
        rows = file_inventory(root / name, max_total=remaining)
        remaining -= sum(row["bytes"] for row in rows)
        inventory.extend({**row, "path": name + "/" + row["path"]} for row in rows)
    by_path = {row["path"]: row for row in inventory}
    required = (*BUILD_FILES, "spec/xray-engine-verified.spec", ENGINE)
    require(all(name in by_path for name in required), "Missing build artifact")
    require(all(by_path[name]["bytes"] > 0 for name in required if "/warn-" not in name), "Empty build artifact")
    require(not any(Path(name).name.casefold().startswith("collect-") for name in by_path), "Unexpected COLLECT in onefile build")
    warning = by_path["work/xray-engine-verified/warn-xray-engine-verified.txt"]
    review.append(f"Raw PyInstaller warning file requires review: {warning['path']} ({warning['bytes']} bytes, sha256 {warning['sha256']}).")
    engine = by_path[ENGINE]
    qualification, fixture = _record(root, "qualification.json"), _record(root, "fixture-verdict.json")
    require(type(qualification.get("bytes")) is int and qualification["bytes"] == engine["bytes"]
            and qualification.get("sha256") == fixture.get("sha256") == engine["sha256"], "Executable size/hash mismatch")
    require(type(qualification.get("sourceFiles")) is int and qualification["sourceFiles"] == engine_count
            and qualification.get("toolchainUnchanged") is True, "Qualification source/toolchain mismatch")
    require(_windows_identity(fixture.get("executable")).endswith("/" + ENGINE.casefold()), "Fixture executable path mismatch")
    junit = _junit(root)
    review.extend(f"JUnit skip {row['classname']}::{row['name']}: {row['reason']}" for row in junit["skips"])
    return {"sourceFileCount": source_count, "engineSourceFileCount": engine_count,
            "engine": engine, "junit": junit, "buildInventory": sorted(inventory, key=lambda row: row["path"]),
            "toolchainFileCount": toolchain_count, "reviewRequired": review}