"""Fresh actual stdin/status checks; artifacts remain confined to this packet."""
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent / 'protocol-final-attempt-02'
OUT.mkdir(exist_ok=False)
FIX = ROOT / 'engine/fixtures/bom-contract'
rows = []
def execute(name, args, raw=b''):
    command = [sys.executable, '-B', '-m', 'xray', *args]
    result = subprocess.run(command, input=raw, capture_output=True, cwd=OUT, timeout=20)
    (OUT / (name + '.stdout.log')).write_bytes(result.stdout)
    (OUT / (name + '.stderr.log')).write_bytes(result.stderr)
    rows.append({'scenario': name, 'command': command, 'exitCode': result.returncode,
                 'stdoutBytes': len(result.stdout), 'stderrBytes': len(result.stderr)})
    return result

status = execute('status', ['contract-status', '--json'])
assert status.returncode == 0 and not status.stderr
assert json.loads(status.stdout) == {'requestSchema': 'xray.job-to-bom/v1', 'responseSchema': 'xray.bom/v1', 'ruleset': 'fencing-v1'}
for name in ['colorbond', 'timber-paling', 'chain-wire', 'concrete-allowance']:
    target = OUT / (name + '.result.json')
    result = execute(name, ['job-to-bom', '--request-stdin', '--result', str(target)], (FIX / (name + '.request.json')).read_bytes())
    assert result.returncode == 0 and not result.stdout and not result.stderr and target.is_file()
    assert json.loads(target.read_bytes()) == json.loads((FIX / (name + '.response.json')).read_bytes())
for name, raw in [('malformed', b'{'), ('future-schema', json.dumps({'schema': 'xray.job-to-bom/v99'}).encode())]:
    target = OUT / (name + '.result.json')
    result = execute(name, ['job-to-bom', '--request-stdin', '--result', str(target)], raw)
    assert result.returncode != 0 and not result.stdout and result.stderr.startswith(b'error:') and not target.exists()
(OUT / 'summary.json').write_text(json.dumps({'status': 'bounded-pass', 'scenarios': rows, 'nativePackaging': 'not-proven'}, indent=2), encoding='utf-8')
print(json.dumps({'actualSubprocessScenarios': len(rows), 'goldenParity': 4, 'invalidRejectedWithoutOutput': 2, 'status': 'bounded-pass'}))
