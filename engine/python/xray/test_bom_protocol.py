"""Actual subprocess proofs for the frozen compatibility CLI (not native packaging)."""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from . import bom_protocol
from .job_bom import build_bom, compute_input_digest


ROOT = Path(__file__).resolve().parents[3]
PYTHON_ROOT = ROOT / "engine" / "python"
FIXTURES = ROOT / "engine" / "fixtures" / "bom-contract"
PROOF = ROOT / "proof" / "audit" / "IW-ENGINE-PROTOCOL"
GOLDENS = ("colorbond", "timber-paling", "chain-wire", "concrete-allowance")


def fixture(stem: str, kind: str = "request") -> dict:
    return json.loads((FIXTURES / f"{stem}.{kind}.json").read_text(encoding="utf-8"))


def encoded(value: object) -> bytes:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


class BomProtocolTests(unittest.TestCase):
    def setUp(self):
        PROOF.mkdir(exist_ok=True, parents=True)
        self.scratch = tempfile.TemporaryDirectory(prefix="cli-test-", dir=PROOF)
        self.directory = Path(self.scratch.name).resolve()
        self.result = self.directory / "result.json"
        self.environment = {
            **os.environ, "PYTHONDONTWRITEBYTECODE": "1",
            "PYTHONPATH": str(PYTHON_ROOT) + os.pathsep + os.environ.get("PYTHONPATH", ""),
        }

    def tearDown(self):
        self.scratch.cleanup()

    def cli(self, *arguments: str, raw: bytes = b"", code: str | None = None, entry: bool = False):
        prefix = [sys.executable, "-B"]
        prefix += ["-c", code] if code else [str(PYTHON_ROOT / "xray_engine_entry.py")] if entry else ["-m", "xray"]
        return subprocess.run(prefix + list(arguments), input=raw, capture_output=True,
                              cwd=self.directory, env=self.environment, timeout=15)

    def calculate(self, request=None, *, raw=None, result=None, code=None, entry=False):
        return self.cli("job-to-bom", "--request-stdin", "--result", str(result or self.result),
                        raw=encoded(request or fixture("colorbond")) if raw is None else raw,
                        code=code, entry=entry)

    def assert_rejected(self, completed):
        self.assertNotEqual(completed.returncode, 0)
        self.assertEqual(completed.stdout, b"")
        self.assertTrue(completed.stderr.startswith(b"error:"), completed.stderr)
        self.assertLess(len(completed.stderr), 256)
        self.assertNotIn(b"Traceback", completed.stderr)
        self.assertNotIn(str(self.directory).encode(), completed.stderr)
        self.assertFalse(self.result.exists())
        self.assertEqual(list(self.directory.glob(".xray-bom-*")), [])

    def test_status_exact_host_contract_on_both_entrypoints_without_pdf_dependencies(self):
        for entry in (False, True):
            completed = self.cli("contract-status", "--json", entry=entry)
            self.assertEqual(completed.returncode, 0, completed.stderr)
            self.assertEqual(completed.stderr, b"")
            self.assertEqual(json.loads(completed.stdout), {
                "requestSchema": "xray.job-to-bom/v1", "responseSchema": "xray.bom/v1", "ruleset": "fencing-v1",
            })
            self.assertLess(len(completed.stdout), 4096)
        code = "import sys; from xray.cli import main; main(['contract-status','--json']); assert 'xray.engine' not in sys.modules; assert 'xray.markup_writer' not in sys.modules"
        self.assertEqual(self.cli(code=code).returncode, 0)

    def test_all_four_goldens_match_frozen_responses_through_stdin_and_real_files(self):
        for index, stem in enumerate(GOLDENS):
            with self.subTest(stem=stem):
                target = self.directory / f"{stem}.json"
                completed = self.calculate(fixture(stem), result=target, entry=index % 2 == 1)
                self.assertEqual(completed.returncode, 0, completed.stderr)
                self.assertEqual(completed.stdout, b"")
                self.assertEqual(completed.stderr, b"")
                self.assertEqual(json.loads(target.read_bytes()), fixture(stem, "response"))
                self.assertTrue(target.read_bytes().endswith(b"\n"))
        self.assertEqual(list(self.directory.glob(".xray-bom-*")), [])

    def test_well_formed_domain_rejection_publishes_bound_error_response(self):
        request = fixture("colorbond")
        request["runs"][0]["approval"]["entityRevision"] += 1
        request["inputDigest"] = compute_input_digest(request)
        expected = build_bom(request)
        self.assertFalse(expected["ok"])
        completed = self.calculate(request)
        self.assertEqual(completed.returncode, 0, completed.stderr)
        self.assertEqual(completed.stdout, b"")
        self.assertEqual(completed.stderr, b"")
        self.assertEqual(json.loads(self.result.read_bytes()), expected)

    def test_malformed_empty_truncated_extra_json_and_nonobject_rejected(self):
        for raw in (b"", b"{", b"{} {}", b"null", b"[]", b'"text"', encoded(fixture("colorbond"))[:-1]):
            with self.subTest(raw=raw[:15]):
                self.assert_rejected(self.calculate(raw=raw))

    def test_duplicate_keys_invalid_utf8_nonfinite_and_surrogate_json_rejected(self):
        for raw in (b'{"schema":"a","schema":"b"}', b'{"private":"\xff"}', b'{"value":NaN}', b'{"value":Infinity}', b'{"value":-Infinity}', b'{"private":"\\ud800"}', b"[" * 1100 + b"]" * 1100):
            with self.subTest(raw=raw[:30]):
                self.assert_rejected(self.calculate(raw=raw))

    def test_request_size_limit_and_exact_limit_boundary(self):
        raw = encoded(fixture("colorbond"))
        padded = raw + b" " * (bom_protocol.MAX_REQUEST_BYTES - len(raw))
        completed = self.calculate(raw=padded)
        self.assertEqual(completed.returncode, 0, completed.stderr)
        self.result.unlink()
        self.assert_rejected(self.calculate(raw=padded + b" "))
        self.assert_rejected(self.calculate(raw=b"x" * (bom_protocol.MAX_REQUEST_BYTES + 256)))

    def test_request_read_is_bounded_including_one_sentinel_byte(self):
        class BoundedStream(io.BytesIO):
            def read(self, size=-1):
                self.assert_size = size
                if size != bom_protocol.MAX_REQUEST_BYTES + 1:
                    raise AssertionError("Unbounded read")
                return super().read(size)
        stream = BoundedStream(encoded(fixture("colorbond")))
        self.assertEqual(bom_protocol._read_request(stream)["schema"], "xray.job-to-bom/v1")
        self.assertEqual(stream.assert_size, bom_protocol.MAX_REQUEST_BYTES + 1)

    def test_schema_version_unknown_fields_and_digest_mismatch_rejected(self):
        for mutation in (lambda r: r.update(schema="xray.job-to-bom/v2"), lambda r: r.update(unexpected="private-sentinel"), lambda r: r["job"].update(revision=True)):
            request = fixture("colorbond"); mutation(request)
            request["inputDigest"] = compute_input_digest(request)
            self.assert_rejected(self.calculate(request))
        request = fixture("colorbond"); request["inputDigest"] = "0" * 64
        self.assert_rejected(self.calculate(request))

    def test_unknown_commands_and_missing_or_abbreviated_flags_do_not_echo_values(self):
        for arguments in (("private-sentinel",), ("contract-status",), ("contract-status", "--js"), ("job-to-bom", "--request-stdin"), ("job-to-bom", "--result", "private-sentinel"), ("contract-status", "--json", "private-sentinel")):
            completed = self.cli(*arguments)
            self.assert_rejected(completed)
            self.assertNotIn(b"private-sentinel", completed.stderr)

    def test_existing_regular_file_directory_and_hardlink_are_never_overwritten(self):
        for mode in ("file", "directory", "hardlink"):
            with self.subTest(mode=mode):
                if mode == "directory": self.result.mkdir()
                elif mode == "hardlink":
                    victim = self.directory / "victim.txt"; victim.write_bytes(b"original")
                    os.link(victim, self.result)
                else: self.result.write_bytes(b"original")
                completed = self.calculate()
                self.assertNotEqual(completed.returncode, 0)
                self.assertEqual(completed.stdout, b"")
                self.assertNotIn(str(self.result).encode(), completed.stderr)
                if mode == "directory": self.result.rmdir()
                else:
                    self.assertEqual(self.result.read_bytes(), b"original")
                    self.result.unlink()

    def test_relative_outside_missing_parent_reserved_and_stream_paths_rejected(self):
        for target in (Path("relative.json"), self.directory.parent / "outside.json", self.directory / "missing" / "result.json", self.directory / "NUL", self.directory / "result.json:stream", self.directory / ".." / "escape.json"):
            with self.subTest(target=target.name):
                self.assert_rejected(self.calculate(result=target))
        self.assertFalse((self.directory / "missing").exists())

    def test_symlink_output_and_symlink_directory_are_rejected_when_supported(self):
        victim = self.directory / "victim.json"; victim.write_bytes(b"original")
        try:
            self.result.symlink_to(victim)
        except OSError as error:
            self.skipTest(f"Symlink creation unavailable: {type(error).__name__}")
        completed = self.calculate(); self.assertNotEqual(completed.returncode, 0)
        self.assertEqual(victim.read_bytes(), b"original"); self.result.unlink()
        alias = self.directory / "alias"
        alias.symlink_to(self.directory, target_is_directory=True)
        self.assert_rejected(self.calculate(result=alias / "result.json"))

    def test_publish_failure_keeps_no_partial_result_or_staging_file(self):
        for failure in ("fsync", "link"):
            code = f"import sys; import xray.bom_protocol as p; from xray.cli import main; p.os.{failure} = lambda *a,**k: (_ for _ in ()).throw(OSError('private-sentinel')); sys.exit(main())"
            completed = self.calculate(code=code)
            self.assert_rejected(completed)
            self.assertNotIn(b"private-sentinel", completed.stderr)

    def test_missing_result_after_publication_never_reports_success(self):
        code = "import sys; import xray.bom_protocol as p; from xray.cli import main; p.os.link=lambda *a,**k: None; sys.exit(main())"
        self.assert_rejected(self.calculate(code=code))

    def test_staged_file_is_complete_before_atomic_publication(self):
        code = "import sys,json,pathlib; import xray.bom_protocol as p; from xray.cli import main; original=p.os.link\ndef inspect(src,dst,**kw):\n assert not pathlib.Path(dst).exists(); value=json.loads(pathlib.Path(src).read_bytes()); assert value['ok'] is True; return original(src,dst,**kw)\np.os.link=inspect; sys.exit(main())"
        completed = self.calculate(code=code)
        self.assertEqual(completed.returncode, 0, completed.stderr)
        self.assertEqual(completed.stdout, b"")
        self.assertEqual(json.loads(self.result.read_bytes()), fixture("colorbond", "response"))

    def test_concurrent_publication_has_exactly_one_winner(self):
        command = [sys.executable, "-B", "-m", "xray", "job-to-bom", "--request-stdin", "--result", str(self.result)]
        children = [subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, cwd=self.directory, env=self.environment) for _ in range(2)]
        with ThreadPoolExecutor(max_workers=2) as executor:
            outputs = list(executor.map(lambda child: child.communicate(encoded(fixture("colorbond")), timeout=15), children))
        self.assertEqual(sorted(child.returncode for child in children), [0, 2])
        self.assertTrue(all(stdout == b"" for stdout, _ in outputs))
        self.assertEqual(json.loads(self.result.read_bytes()), fixture("colorbond", "response"))
        self.assertEqual(list(self.directory.glob(".xray-bom-*")), [])

    def test_corrupt_response_shape_binding_or_size_never_published(self):
        mutations = ("r['schema']='xray.bom/v2'", "r['bom']['jobId']='other-job'", "r['bom']['extra']='private-sentinel'", "p.MAX_RESPONSE_BYTES=1")
        for mutation in mutations:
            code = "import sys; import xray.bom_protocol as p; from xray.cli import main; original=p.build_bom\ndef altered(request):\n r=original(request); " + mutation + "; return r\np.build_bom=altered; sys.exit(main())"
            completed = self.calculate(code=code)
            self.assert_rejected(completed)
            self.assertNotIn(b"private-sentinel", completed.stderr)

    def test_missing_frozen_asset_and_wrong_asset_digest_fail_status_without_success_json(self):
        for setting in ("sys.frozen=True;sys._MEIPASS=str(pathlib.Path.cwd())", "p.CONTRACT_SHA256='0'*64"):
            code = "import sys,pathlib; import xray.bom_protocol as p; from xray.cli import main; " + setting + "; sys.exit(main())"
            self.assert_rejected(self.cli("contract-status", "--json", code=code))

    def test_asset_hash_and_existing_run_help_missing_input_preserved(self):
        asset = ROOT / "contracts" / bom_protocol.CONTRACT_FILENAME
        self.assertEqual(sha256(asset.read_bytes()).hexdigest(), bom_protocol.CONTRACT_SHA256)
        completed = self.cli("run", "--help")
        self.assertEqual(completed.returncode, 0)
        for flag in (b"--out", b"--report", b"--ocr"): self.assertIn(flag, completed.stdout)
        missing = self.cli("run", "absent.pdf")
        self.assertEqual(missing.returncode, 1)
        self.assertEqual(missing.stdout, b"")
        self.assertIn(b"no such file", missing.stderr)


if __name__ == "__main__":
    unittest.main(verbosity=2)
