"""Real PDFs plus explicitly synthetic nested native CAD source; capture actual CLIs."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time

import ezdxf
from ezdxf.math import Matrix44
import pypdfium2 as pdfium

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'proof/audit/IW-PY-WIREFRAME'
ENV = {**os.environ, 'PYTHONPATH': os.pathsep.join([str(OUT/'python-deps'), str(ROOT/'engine/python')]), 'PYTHONDONTWRITEBYTECODE': '1', 'PYTHONIOENCODING': 'utf-8'}


def cad_fixture():
    source = OUT / 'synthetic-nested-plan.dxf'
    if source.exists(): return source
    doc = ezdxf.new('R2013'); doc.units = 6
    for name, shape in [('DOOR', 2), ('LIGHT', 1), ('BRACKET', .5)]:
        block = doc.blocks.new(name)
        block.add_lwpolyline([(0,0), (shape,0), (shape,shape), (0,shape)], close=True)
    nest = doc.blocks.new('NEST', base_point=(1,2))
    nest.add_blockref('LIGHT', (3,4), dxfattribs={'rotation': 30})
    nest.add_blockref('BRACKET', (-2,3), dxfattribs={'rotation': 60})
    assembly = doc.blocks.new('ASSEMBLY')
    assembly.add_blockref('DOOR', (2,2))
    assembly.add_blockref('NEST', (5,2), dxfattribs={'rotation': 90, 'xscale': -1})
    model = doc.modelspace()
    for y in range(8):
        for x in range(12):
            model.add_blockref('ASSEMBLY', (x*18,y*18), dxfattribs={'rotation': [0,90,180,270][(x+y)%4], 'xscale': -1 if x%2 else 1})
    model.add_lwpolyline([(-10,-10),(220,-10),(220,150),(-10,150)], close=True)
    doc.saveas(source)
    return source


def expected_cad(source):
    doc = ezdxf.readfile(source); expected = []
    def walk(container, parent, chain=()):
        for e in container:
            if e.dxftype() != 'INSERT': continue
            identity = chain + (e.dxf.handle,)
            point = parent.transform(e.dxf.insert)
            expected.append({'id': '/'.join(identity), 'name': e.dxf.name, 'x': point.x, 'y': point.y})
            block = doc.blocks.get(e.dxf.name)
            if block is not None: walk(block, e.matrix44() @ parent, identity)
    walk(doc.modelspace(), Matrix44())
    return expected


def capture(attempt):
    folder = OUT / attempt; folder.mkdir(exist_ok=False)
    results = []
    sources = [ROOT/'engine/fixtures/residential-ruffles-seeka.pdf', ROOT/'engine/fixtures/shed-manners-aline.pdf', ROOT/'engine/fixtures/electrical-schedule.pdf', cad_fixture()]
    for source in sources:
        target = folder/source.stem; target.mkdir()
        command = [sys.executable, '-m', 'xray', 'run', str(source), '--out', str(target), '--report']
        start = time.monotonic(); result = subprocess.run(command, cwd=ROOT, env=ENV, capture_output=True, timeout=90)
        (target/'cli.stdout.log').write_bytes(result.stdout); (target/'cli.stderr.log').write_bytes(result.stderr)
        row = {'source': source.relative_to(ROOT).as_posix(), 'sourceKind': 'synthetic-stress-fixture' if source.suffix == '.dxf' or source.stem == 'electrical-schedule' else 'existing-project-plan-set', 'sha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'command': command, 'exitCode': result.returncode, 'elapsedSeconds': round(time.monotonic()-start,3)}
        if result.returncode == 0:
            takeoff = json.loads((target/(source.stem+'.xray.json')).read_text(encoding='utf-8'))
            row.update(pages=len(takeoff['document']['pages']), symbols=len(takeoff.get('symbols', [])), entities=len(takeoff['entities']), quantities=len(takeoff['quantities']))
            if source.suffix == '.dxf':
                expected = expected_cad(source); actual = {s['id']:s for s in takeoff['symbols']}
                mismatches = [e for e in expected if e['id'] not in actual or abs(actual[e['id']]['x']-e['x'])>1e-8 or abs(actual[e['id']]['y']-e['y'])>1e-8]
                row.update(expectedSymbols=len(expected), positionMismatches=len(mismatches), firstMismatch=mismatches[:1])
                (target/'expected-placements.json').write_text(json.dumps(expected,indent=2),encoding='utf-8')
                wire_command = [sys.executable, '-m', 'xray.wireframe', str(target/(source.stem+'.xray.json')), '--out', str(target), '--height', '8']
                wire = subprocess.run(wire_command,cwd=ROOT,env=ENV,capture_output=True,timeout=30)
                (target/'wireframe.stdout.log').write_bytes(wire.stdout); (target/'wireframe.stderr.log').write_bytes(wire.stderr)
                row.update(wireframeCommand=wire_command,wireframeExitCode=wire.returncode)
        results.append(row); print(json.dumps(row),flush=True)
    (folder/'results.json').write_text(json.dumps(results,indent=2),encoding='utf-8')


if __name__ == '__main__': capture(sys.argv[1])
