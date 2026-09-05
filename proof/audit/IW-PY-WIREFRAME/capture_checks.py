import json
import os
from pathlib import Path
import subprocess
import sys
import time
ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT/'proof/audit/IW-PY-WIREFRAME'
env = {**os.environ,'PYTHONPATH':os.pathsep.join([str(OUT/'python-deps'),str(ROOT/'engine/python')]),'PYTHONDONTWRITEBYTECODE':'1','PYTHONIOENCODING':'utf-8'}
commands = {
    'pytest-attempt-02': [sys.executable,'-m','pytest','engine/python/xray','-q','-p','no:cacheprovider'],
    'electrical-path-rejection': [sys.executable,'-m','xray.source_wireframe','engine/fixtures/electrical-schedule.pdf','--out',str(OUT/'must-not-exist')],
    'empty-wireframe-rejection': [sys.executable,'-m','xray.wireframe',str(OUT/'baseline/electrical-schedule.xray.json'),'--out',str(OUT/'must-not-exist')],
    'frozen-protocol-status': [sys.executable,'-m','xray','contract-status','--json'],
    'mcp-existing-suite': [sys.executable,'-m','pytest','engine/server/test_mcp.py','-q','-p','no:cacheprovider'],
}
results=[]
for name,command in commands.items():
    started=time.monotonic();r=subprocess.run(command,cwd=ROOT,env=env,capture_output=True,timeout=120)
    (OUT/(name+'.stdout.log')).write_bytes(r.stdout);(OUT/(name+'.stderr.log')).write_bytes(r.stderr)
    row={'name':name,'command':command,'exitCode':r.returncode,'elapsedSeconds':round(time.monotonic()-started,3)}
    results.append(row);print(json.dumps(row),flush=True)
(OUT/'checks.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
