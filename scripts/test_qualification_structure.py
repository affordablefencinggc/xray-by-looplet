"""Synthetic real-file structural checks; never executes the synthetic engine."""
import copy
from contextlib import contextmanager
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess
import tempfile
from types import SimpleNamespace
import unittest
from unittest import mock
import zipfile

import qualification_structure as s


class StructureTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        names = {*s.q.CORE, "package.json", "package-lock.json", "src/studio/bomRules.ts",
                 "src/studio/bomContract.ts", "engine/python/xray/test_engine.py"}
        names.update(f"engine/fixtures/bom-contract/{stem}.{kind}.json"
                     for stem in s.q.STEMS for kind in ("request", "response"))
        self.payloads = {name: ("synthetic source " + name).encode() for name in sorted(names)}
        self.archive(self.payloads)
        entries = []
        for name, data in self.payloads.items():
            self.put("source/" + name, data)
            entries.append({"path": name, "sha256": self.sha(data)})
        self.write("snapshot.json", {"entries": entries, "archiveSha256": self.digest("source.zip"),
                                     "sourceCommit": "a" * 40})
        engine_entries = [e for e in entries if e["path"].startswith("engine/python/") or e["path"] == s.q.SCHEMA]
        self.write("source-manifest.json", engine_entries)
        packages = dict(s.q.PINNED)
        toolchain = {"version": "3.13 synthetic", "executable": r"C:\Python\python.exe",
                     "packages": packages, "limit": "Synthetic, not attested", "files": [
                         {"distribution": n, "path": rf"C:\Python\Lib\{n}.py", "sha256": "b" * 64}
                         for n in packages] + [{"distribution": "python-runtime",
                                                "path": r"C:\Python\python.exe", "sha256": "c" * 64}]}
        self.toolchain(toolchain)
        for name in (*s.BUILD_FILES, "spec/xray-engine-verified.spec"):
            self.put(name, b"unparsed synthetic build artifact")
        self.put(s.ENGINE, b"MZsynthetic-not-executed")
        self.write("qualification.json", {"bytes": len((self.root / s.ENGINE).read_bytes()),
                   "sha256": self.digest(s.ENGINE), "sourceFiles": len(engine_entries), "toolchainUnchanged": True})
        self.write("fixture-verdict.json", {"sha256": self.digest(s.ENGINE),
                   "executable": r"C:\Evidence\dist\xray-engine-verified.exe"})
        self.xml = ('<?xml version="1.0" encoding="utf-8"?><testsuites>'
                    '<testsuite name="pytest" tests="1" errors="0" failures="0" skipped="0" time="0.01">'
                    '<testcase classname="xray.test_engine" name="test_ok" time="0.01"/>'
                    '</testsuite></testsuites>')
        self.put("engine-tests.xml", self.xml.encode())

    @staticmethod
    def sha(data):
        return hashlib.sha256(data).hexdigest()

    def digest(self, name):
        return self.sha((self.root / name).read_bytes())

    def put(self, name, data):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    def write(self, name, value):
        self.put(name, json.dumps(value).encode())

    def load(self, name):
        return json.loads((self.root / name).read_bytes())

    def toolchain(self, value):
        for name in ("toolchain-before.json", "toolchain-after.json"):
            self.write(name, value)

    def archive(self, payloads):
        with zipfile.ZipFile(self.root / "source.zip", "w") as archive:
            for name, data in payloads.items():
                archive.writestr(name, data)

    def repin_archive(self):
        value = self.load("snapshot.json")
        value["archiveSha256"] = self.digest("source.zip")
        self.write("snapshot.json", value)

    def validate(self):
        return s.validate_structure(self.root)

    def reject(self):
        with self.assertRaises((ValueError, OSError, zipfile.BadZipFile)):
            self.validate()

    def test_complete_synthetic_structure_not_acceptance(self):
        result = self.validate()
        self.assertEqual(result["sourceFileCount"], len(self.payloads))
        self.assertEqual(result["engine"]["sha256"], self.digest(s.ENGINE))
        self.assertEqual(result["junit"]["tests"], 1)
        self.assertEqual(result["toolchainFileCount"], len(s.q.PINNED) + 1)
        self.assertTrue(result["reviewRequired"])
        self.assertFalse(any(type(value) is bool and value for value in result.values()))
        self.assertEqual(result["buildInventory"], sorted(result["buildInventory"], key=lambda row: row["path"]))

    def test_source_mutations_and_extras(self):
        name = next(iter(self.payloads))
        self.put("source/" + name, b"changed")
        self.reject()
        self.put("source/" + name, self.payloads[name])
        self.put("source/unmanifested.txt", b"extra")
        self.reject()

    def test_zip_mutations_even_with_updated_archive_hash(self):
        for payloads in ({**self.payloads, "extra": b"x"},
                         {**self.payloads, next(iter(self.payloads)): b"changed"},
                         {n: b for n, b in self.payloads.items() if n != s.q.CORE[0]}):
            with self.subTest(payloads=len(payloads)):
                self.archive(payloads)
                self.repin_archive()
                self.reject()

    def test_zip_nonregular_and_oversize_members(self):
        original = (self.root / "source.zip").read_bytes()
        for mode in (stat.S_IFLNK, stat.S_IFDIR):
            with self.subTest(mode=mode):
                with zipfile.ZipFile(self.root / "source.zip", "w") as archive:
                    for name, data in self.payloads.items():
                        info = zipfile.ZipInfo(name)
                        info.external_attr = mode << 16
                        archive.writestr(info, data)
                self.repin_archive()
                self.reject()
        self.put("source.zip", original)
        self.repin_archive()
        original_infos = zipfile.ZipFile.infolist
        def oversized(archive):
            rows = original_infos(archive)
            rows[0].file_size = 32 * s.MIB + 1
            return rows
        with mock.patch.object(zipfile.ZipFile, "infolist", oversized):
            self.reject()

    def test_zip_raw_nul_filename_alias_rejected(self):
        approved = s.q.CORE[0]
        written_name, aliased_name = approved + "Xsuffix", approved + "\x00suffix"
        self.archive({written_name if n == approved else n: data for n, data in self.payloads.items()})
        raw = (self.root / "source.zip").read_bytes()
        self.assertEqual(raw.count(written_name.encode()), 2)  # Local and central names.
        changed = raw.replace(written_name.encode(), aliased_name.encode())
        self.assertEqual(len(changed), len(raw))
        self.put("source.zip", changed)
        self.repin_archive()  # Manifest intentionally retains the approved truncated name.
        with zipfile.ZipFile(self.root / "source.zip") as archive:
            member = archive.getinfo(approved)
            self.assertEqual(member.orig_filename, aliased_name)
            self.assertEqual(member.filename, approved)
            self.assertEqual(archive.read(member), self.payloads[approved])
        with self.assertRaisesRegex(ValueError, "ZIP member name alias"):
            self.validate()

    def test_zip_compressed_members_rejected_after_repin(self):
        with zipfile.ZipFile(self.root / "source.zip", "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for name, data in self.payloads.items():
                archive.writestr(name, data)
        self.repin_archive()
        with zipfile.ZipFile(self.root / "source.zip") as archive:
            self.assertTrue(all(m.compress_type == zipfile.ZIP_DEFLATED for m in archive.infolist()))
            self.assertEqual({m.filename: archive.read(m) for m in archive.infolist()}, self.payloads)
        with self.assertRaisesRegex(ValueError, "ZIP must use exact stored members"):
            self.validate()

    def test_zip_invalid_and_crc_errors_are_clean_value_errors(self):
        raw = bytearray((self.root / "source.zip").read_bytes())
        with zipfile.ZipFile(self.root / "source.zip") as archive:
            header = archive.infolist()[0].header_offset
        name_size = int.from_bytes(raw[header + 26:header + 28], "little")
        extra_size = int.from_bytes(raw[header + 28:header + 30], "little")
        raw[header + 30 + name_size + extra_size] ^= 1  # Payload only; keep recorded CRC.
        for data, message in ((b"not a ZIP", "File is not a zip file"), (bytes(raw), "Bad CRC")):
            with self.subTest(message=message):
                self.put("source.zip", data)
                self.repin_archive()
                with self.assertRaisesRegex(ValueError, "Invalid source ZIP: .*" + message) as caught:
                    self.validate()
                self.assertIsInstance(caught.exception.__cause__, zipfile.BadZipFile)

    def test_manifest_bad_types_hash_paths_and_duplicates(self):
        original = self.load("snapshot.json")
        for row in ({"path": True, "sha256": "a" * 64},
                    {"path": "../escape", "sha256": "a" * 64},
                    {"path": "engine/python/NUL.txt", "sha256": "a" * 64},
                    {"path": "engine/python/test.py", "sha256": False}, original["entries"][0]):
            with self.subTest(row=row):
                value = copy.deepcopy(original)
                value["entries"].append(row)
                self.write("snapshot.json", value)
                self.reject()

    def test_missing_core_and_engine_manifest_mismatch(self):
        original = self.load("source-manifest.json")
        self.write("source-manifest.json", [])
        with self.assertRaisesRegex(ValueError, "Engine source manifest mismatch"):
            self.validate()
        self.write("source-manifest.json", original)
        value = self.load("snapshot.json")
        value["entries"] = [r for r in value["entries"] if r["path"] != s.q.CORE[0]]
        self.write("snapshot.json", value)
        with self.assertRaisesRegex(ValueError, "Missing core source"):
            self.validate()

    def test_build_missing_raw_files_and_extra_inventory(self):
        for name in (*s.BUILD_FILES, "spec/xray-engine-verified.spec", s.ENGINE):
            with self.subTest(name=name):
                path = self.root / name
                data = path.read_bytes()
                path.unlink()
                self.reject()
                path.write_bytes(data)
        self.put("work/extra.bin", b"extra")
        self.assertIn("work/extra.bin", [r["path"] for r in self.validate()["buildInventory"]])
        self.put("work/xray-engine-verified/COLLECT-00.toc", b"unexpected")
        self.reject()

    def test_executable_and_qualification_counts_strict(self):
        original = self.load("qualification.json")
        for field, values in (("bytes", [True, 1.0, 0, "22"]),
                              ("sourceFiles", [False, 0, "4", 4.0]),
                              ("toolchainUnchanged", [1, False, "true"]),
                              ("sha256", ["a" * 64, None])):
            for value in values:
                with self.subTest(field=field, value=value):
                    self.write("qualification.json", {**original, field: value})
                    self.reject()
        self.write("qualification.json", original)
        self.put(s.ENGINE, b"changed engine")
        self.reject()

    def test_fixture_identity_rejected(self):
        original = self.load("fixture-verdict.json")
        for changes in ({"sha256": "a" * 64}, {"executable": "../dist/xray-engine-verified.exe"},
                        {"executable": r"C:\wrong.exe"}):
            self.write("fixture-verdict.json", {**original, **changes})
            self.reject()

    def test_toolchain_changed_and_duplicate_runtime_policy(self):
        value = self.load("toolchain-before.json")
        value["version"] += " changed"
        self.write("toolchain-after.json", value)
        self.reject()
        self.toolchain(value)
        value["files"].append(copy.deepcopy(value["files"][-1]))
        self.toolchain(value)
        result = self.validate()
        self.assertEqual(result["toolchainFileCount"], len(s.q.PINNED) + 1)
        self.assertTrue(any("identical overlapping" in note for note in result["reviewRequired"]))
        value["files"][-1]["sha256"] = "d" * 64
        self.toolchain(value)
        self.reject()

    def test_toolchain_pins_package_aliases_and_file_syntax(self):
        original = self.load("toolchain-before.json")
        mutations = [lambda v: v["packages"].update(pytest="0"),
                     lambda v: v["packages"].update(PyTest=s.q.PINNED["pytest"]),
                     lambda v: v["packages"].update(pytest=True),
                     lambda v: v["files"].pop(),
                     lambda v: v["files"].append(copy.deepcopy(v["files"][0])),
                     lambda v: v["files"][0].update(path=r"C:\Python\..\escape"),
                     lambda v: v["files"][0].update(path=r"C:\Python\NUL.txt"),
                     lambda v: v["files"][0].update(sha256=True),
                     lambda v: v["files"][0].update(distribution="unknown")]
        for mutate in mutations:
            value = copy.deepcopy(original)
            mutate(value)
            self.toolchain(value)
            self.reject()

    def test_toolchain_has_separate_32mib_bound_and_never_opens_recorded_paths(self):
        value = self.load("toolchain-before.json")
        value["limit"] = "x" * (4 * s.MIB + 1)
        self.toolchain(value)
        self.assertEqual(self.validate()["toolchainFileCount"], len(s.q.PINNED) + 1)
        with mock.patch.object(s, "TOOLCHAIN_LIMIT", 100):
            self.reject()

    def test_junit_counter_failure_shape_and_duplicate_mutations(self):
        case = '<testcase classname="xray.test_engine" name="test_ok" time="0.01"/>'
        variants = [self.xml.replace('tests="1"', 'tests="0"'),
                    self.xml.replace('errors="0"', 'errors="1"'),
                    self.xml.replace('failures="0"', 'failures="1"'),
                    self.xml.replace('skipped="0"', 'skipped="true"'),
                    self.xml.replace(' time="0.01"', ' time="NaN"'),
                    self.xml.replace(case, case + case).replace('tests="1"', 'tests="2"'),
                    self.xml.replace(case, case.replace('/>', '><failure/></testcase>')),
                    self.xml.replace(case, case.replace('/>', '><error/></testcase>')),
                    self.xml.replace(case, '').replace('tests="1"', 'tests="0"'),
                    self.xml.replace('testcase', 'unexpected'),
                    self.xml.replace('classname="xray.test_engine"', ''),
                    self.xml.replace('<testsuites>', '<testsuites tests="2">')]
        for xml in variants:
            with self.subTest(xml=xml):
                self.put("engine-tests.xml", xml.encode())
                self.reject()

    def test_junit_skips_are_explicit_review_not_approval(self):
        xml = self.xml.replace('skipped="0"', 'skipped="1"').replace(
            'name="test_ok" time="0.01"/>', 'name="test_ok"><skipped message="optional module missing"/></testcase>')
        self.put("engine-tests.xml", xml.encode())
        result = self.validate()
        self.assertEqual(result["junit"]["skipped"], 1)
        self.assertIn("optional module missing", result["junit"]["skips"][0]["reason"])
        self.assertTrue(any("JUnit skip" in note for note in result["reviewRequired"]))
        self.put("engine-tests.xml", xml.replace(' message="optional module missing"', '').encode())
        self.reject()

    def test_junit_dtd_entities_encoding_and_bounds(self):
        declaration = '<!DOCTYPE testsuites [<!ENTITY x "expanded">]>'
        xml = self.xml.replace("?>", "?>" + declaration, 1).replace('name="test_ok"', 'name="&x;"')
        self.assertEqual(s.ET.fromstring(xml).find("./testsuite/testcase").get("name"), "expanded")
        self.put("engine-tests.xml", xml.encode())
        with self.assertRaisesRegex(ValueError, "DTD/entities forbidden"):
            self.validate()
        for raw in (self.xml.encode("utf-16"), xml.encode("utf-16"), self.xml.encode("utf-32"),
                    b"<testsuites>", b"x" * (4 * s.MIB + 1)):
            self.put("engine-tests.xml", raw)
            self.reject()

    def test_json_duplicates_and_nonfinite_rejected(self):
        original = (self.root / "qualification.json").read_bytes()
        for suffix in (b',"bytes":1}', b',"extra":NaN}', b',"extra":1e999}'):
            self.put("qualification.json", original[:-1] + suffix)
            self.reject()

    def test_inventory_bounds_nonregular_and_windows_paths(self):
        base = self.root / "dist"
        for kwargs in ({"max_file": 1}, {"max_total": 1}, {"max_file": True}, {"max_total": -1}):
            with self.assertRaises(ValueError):
                s.file_inventory(base, **kwargs)
        with mock.patch.object(s, "MAX_NODES", 1), self.assertRaises(ValueError):
            s.file_inventory(base)
        for name in ("a/../b", "CON.txt", "aux", "a.", "a ", "a:b", "a\\b", "LPT¹.txt", "CONOUT$", "a//b"):
            with self.subTest(name=name), self.assertRaises(ValueError):
                s.safe_name(name)
        if hasattr(os, "mkfifo"):
            os.mkfifo(base / "pipe")
            with self.assertRaises(ValueError):
                s.file_inventory(base)

    def test_inventory_real_reparse_child_and_ancestor_rejected(self):
        link, target = self.root / "dist/link", self.root / "source"
        sentinel = "source/" + s.q.CORE[0]
        original_hash = self.digest(sentinel)
        try:
            if os.name == "nt":
                # Junction creation needs no symlink privilege. This bounded child
                # is executed only by the lead's inherited capped test job.
                result = subprocess.run(
                    ["cmd.exe", "/d", "/c", "mklink", "/J", str(link), str(target)],
                    stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=10,
                    check=False)
                self.assertEqual(result.returncode, 0, (result.stdout, result.stderr))
                self.assertTrue(link.lstat().st_file_attributes & 0x400)
            else:
                link.symlink_to(target, target_is_directory=True)
                self.assertTrue(link.is_symlink())
            with self.assertRaisesRegex(ValueError, "Reparse/symlink"):
                s.file_inventory(self.root / "dist")
            with self.assertRaisesRegex(ValueError, "Reparse/symlink"):
                s.file_inventory(link / "engine/python")
        finally:
            if os.path.lexists(link):
                if os.name == "nt":
                    os.rmdir(link)  # Remove the junction itself, never its target.
                else:
                    link.unlink()
        self.assertTrue(target.is_dir())
        self.assertEqual(self.digest(sentinel), original_hash)

    def test_casefold_directory_aliases_rejected(self):
        # ZIP manifest names exercise Windows collisions on any host filesystem.
        value = self.load("snapshot.json")
        value["entries"].extend([
            {"path": "engine/python/Extra/a.py", "sha256": "a" * 64},
            {"path": "engine/python/extra/b.py", "sha256": "a" * 64}])
        self.write("snapshot.json", value)
        with self.assertRaisesRegex(ValueError, "casefold collision"):
            self.validate()

    def test_inventory_reparse_attributes_fail_without_symlink_permission(self):
        original = Path.lstat
        target = self.root / s.ENGINE
        def attributes(path, *args, **kwargs):
            result = original(path, *args, **kwargs)
            if path == target:
                return SimpleNamespace(st_mode=result.st_mode, st_file_attributes=0x400)
            return result
        with mock.patch.object(Path, "lstat", attributes), self.assertRaisesRegex(ValueError, "Reparse"):
            s.file_inventory(self.root / "dist")

    def test_inventory_casefold_collisions(self):
        base = self.root / "aliases"
        self.put("aliases/Foo/a", b"x")
        self.put("aliases/foo/b", b"x")
        if len(list(base.iterdir())) == 2:
            with self.assertRaisesRegex(ValueError, "Casefold path collision"):
                s.file_inventory(base)
            return
        # Case-insensitive filesystems cannot store both directory names. Inject
        # only duplicate enumeration of an actual DirEntry; all path validation,
        # lstat and collision logic remain real. Manifest aliases are tested above.
        original = os.scandir
        with original(base) as children:
            entries = list(children)
        self.assertEqual(len(entries), 1)
        @contextmanager
        def duplicate_entry(path):
            if Path(path) == base:
                yield iter([entries[0], entries[0]])
            else:
                with original(path) as children:
                    yield children
        with mock.patch.object(os, "scandir", duplicate_entry):
            with self.assertRaisesRegex(ValueError, "Casefold path collision"):
                s.file_inventory(base)

    def test_exact_type_aware_json_equality(self):
        for a, b in ((True, 1), (1, 1.0), ({"x": [True]}, {"x": [1]}),
                     (float("inf"), float("inf")), (float("nan"), float("nan"))):
            self.assertFalse(s.equal_json(a, b))
        self.assertTrue(s.equal_json({"x": [None, True, 1, 1.0]}, {"x": [None, True, 1, 1.0]}))


if __name__ == "__main__":
    unittest.main()