"""Execute existing source modules before any pipeline repair; no output inference."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'proof/audit/IW-PY-WIREFRAME/baseline'
OUT.mkdir(parents=True, exist_ok=True)
env = {**os.environ, 'PYTHONPATH': str(ROOT / 'engine/python'), 'PYTHONDONTWRITEBYTECODE': '1', 'PYTHONIOENCODING': 'utf-8'}
rows = []
for name in ['residential-ruffles-seeka', 'shed-manners-aline', 'electrical-schedule']:
    source = ROOT / f'engine/fixtures/{name}.pdf'
    destination = OUT / f'{name}.xray.json'
    code = 'import json,sys;from xray.engine import run;from pathlib import Path;Path(sys.argv[2]).write_text(json.dumps(run(sys.argv[1]),indent=2),encoding="utf-8")'
    commands = [[sys.executable, '-c', code, str(source), str(destination)], [sys.executable, '-m', 'xray.wireframe', str(destination), '--out', str(OUT)]]
    run_rows = []
    for index, command in enumerate(commands):
        start = time.monotonic()
        result = subprocess.run(command, cwd=ROOT, env=env, capture_output=True, timeout=120)
        (OUT / f'{name}.{index}.stdout.log').write_bytes(result.stdout)
        (OUT / f'{name}.{index}.stderr.log').write_bytes(result.stderr)
        run_rows.append({'command': command, 'exitCode': result.returncode, 'elapsedSeconds': round(time.monotonic() - start, 3)})
        if result.returncode: break
    row = {'source': str(source.relative_to(ROOT)), 'bytes': source.stat().st_size, 'sha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'runs': run_rows}
    if destination.exists():
        takeoff = json.loads(destination.read_text(encoding='utf-8'))
        row.update(pages=len(takeoff['document']['pages']), entities=len(takeoff['entities']), symbols=len(takeoff.get('symbols', [])), geometry=len(takeoff.get('geometry', [])), quantities=len(takeoff['quantities']))
    scene_file = OUT / f'{name}.scene.json'
    if scene_file.exists():
        row['sceneElements'] = len(json.loads(scene_file.read_text(encoding='utf-8'))['elements'])
        row['usableWireframe'] = row['sceneElements'] > 0
    rows.append(row)
    print(json.dumps(row), flush=True)
(OUT / 'results.json').write_text(json.dumps(rows, indent=2), encoding='utf-8')
