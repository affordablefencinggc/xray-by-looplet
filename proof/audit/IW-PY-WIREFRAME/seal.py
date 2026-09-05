import difflib
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'proof/audit/IW-PY-WIREFRAME'
paths=['engine/python/xray/wireframe.py','engine/python/xray/sources/dxf.py','engine/python/xray/source_wireframe.py','engine/python/xray/test_wireframe.py','engine/python/xray/test_source_wireframe.py','engine/python/xray/test_wireframe_dxf.py','engine/server/mcp_server.py','engine/server/test_mcp_boundaries.py']
hashes=[];patch=[]
for name in paths:
    content=(ROOT/name).read_bytes();original=subprocess.run(['git','show','HEAD:'+name],cwd=ROOT,capture_output=True)
    patch.extend(difflib.unified_diff(original.stdout.decode('utf-8').splitlines(keepends=True) if original.returncode==0 else [],content.decode('utf-8').splitlines(keepends=True),fromfile='a/'+name,tofile='b/'+name))
    hashes.append({'path':name,'sha256':hashlib.sha256(content).hexdigest(),'bytes':len(content)})
(OUT/'code.patch').write_text(''.join(patch),encoding='utf-8')
(OUT/'source-hashes.json').write_text(json.dumps(hashes,indent=2),encoding='utf-8')
dependencies=[]
for name in ['dependency-report.json','mcp-dependency-report.json']:
    report=json.loads((OUT/name).read_bytes())
    dependencies.append({'report':name,'packages':[{'name':p['metadata']['name'],'version':p['metadata']['version'],'url':p['download_info']['url'],'hashes':p['download_info']['archive_info']['hashes']} for p in report['install']]})
(OUT/'dependency-provenance.json').write_text(json.dumps(dependencies,indent=2),encoding='utf-8')
from xray.source_wireframe import extract_pdf,render_viewer,render_svg
checks=[]
for key,name in [('residential','residential-ruffles-seeka'),('shed','shed-manners-aline')]:
    data=extract_pdf(ROOT/f'engine/fixtures/{name}.pdf');folder=OUT/f'{key}-final'
    assert json.loads((folder/'scene.json').read_text())==data
    assert (folder/'index.html').read_text(encoding='utf-8')==render_viewer(data)
    for page in data['pages']:
        if page['paths']:assert (folder/f'page-{page["page"]}.svg').read_text()==render_svg(page)
    complete=json.loads((folder/'complete.json').read_text())
    for file,digest in complete['artifacts'].items():assert hashlib.sha256((folder/file).read_bytes()).hexdigest()==digest
    checks.append({'source':name,'currentExtractionMatchesCapturedViewer':True,'allArtifactHashesValid':True,'pathCount':sum(p['pathCount'] for p in data['pages'])})
(OUT/'final-extraction-recheck.json').write_text(json.dumps(checks,indent=2),encoding='utf-8')
print(json.dumps({'sourceFiles':len(hashes),'extraction':checks,'codePatchSha256':hashlib.sha256((OUT/'code.patch').read_bytes()).hexdigest()},indent=2))
