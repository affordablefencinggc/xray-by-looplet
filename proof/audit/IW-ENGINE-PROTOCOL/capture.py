"""Capture actual source CLI evidence without PowerShell stderr formatting."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time

PROOF = Path(__file__).resolve().parent
ROOT = PROOF.parents[2]
attempt = PROOF / "attempt-03"
attempt.mkdir(exist_ok=False)
environment = {**os.environ, "PYTHONDONTWRITEBYTECODE": "1", "PYTHONPATH": os.pathsep.join([str(ROOT / "engine/python"), str(PROOF / "python-deps")])}
commands = []

def run(name, arguments, raw=b"", cwd=ROOT):
    started = time.monotonic()
    result = subprocess.run([sys.executable, "-B", *arguments], input=raw, capture_output=True, env=environment, cwd=cwd, timeout=60)
    (attempt / f"{name}.stdout.log").write_bytes(result.stdout)
    (attempt / f"{name}.stderr.log").write_bytes(result.stderr)
    commands.append({"name": name, "arguments": arguments, "cwd": str(cwd), "exitCode": result.returncode, "durationSeconds": round(time.monotonic() - started, 3), "stdoutBytes": len(result.stdout), "stderrBytes": len(result.stderr)})
    return result

suite = run("tests", ["-m", "unittest", "-v", "xray.test_bom_protocol", "xray.test_job_bom", "xray.test_job_bom_contract_boundary"])
status = run("status", ["-m", "xray", "contract-status", "--json"], cwd=attempt)
checks = {"suite": suite.returncode == 0, "status": status.returncode == 0}
for stem in ("colorbond", "timber-paling", "chain-wire", "concrete-allowance"):
    request = (ROOT / "engine/fixtures/bom-contract" / f"{stem}.request.json").read_bytes()
    target = attempt / f"{stem}.result.json"
    completed = run(stem, ["-m", "xray", "job-to-bom", "--request-stdin", "--result", str(target)], raw=request, cwd=attempt)
    golden = json.loads((ROOT / "engine/fixtures/bom-contract" / f"{stem}.response.json").read_bytes())
    checks[stem] = completed.returncode == 0 and completed.stdout == b"" and completed.stderr == b"" and json.loads(target.read_bytes()) == golden

owned = [ROOT / "engine/python/xray" / name for name in ("cli.py", "bom_protocol.py", "test_bom_protocol.py")]
owned.append(ROOT / "contracts/xray-job-bom-v1.schema.json")
manifest = [{"path": str(path.relative_to(ROOT)).replace("\\", "/"), "sha256": hashlib.sha256(path.read_bytes()).hexdigest()} for path in owned]
report = json.loads((PROOF / "dependency-report.json").read_text(encoding="utf-8"))
dependencies = [{"name": item["metadata"]["name"], "version": item["metadata"]["version"], "url": item["download_info"]["url"], "sha256": item["download_info"]["archive_info"]["hashes"]["sha256"]} for item in report["install"]]
summary = {"status": "awaiting-verification", "nativePackageVerified": False, "python": sys.version.split()[0], "pythonExecutable": sys.executable, "checks": checks, "commands": commands, "sourceHashes": manifest, "isolatedDependencies": dependencies}
(attempt / "summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"checks": checks, "evidence": str(attempt), "nativePackageVerified": False}))
raise SystemExit(0 if all(checks.values()) else 1)
