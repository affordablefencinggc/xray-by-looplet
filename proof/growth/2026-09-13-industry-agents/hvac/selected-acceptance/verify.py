import hashlib, json, pathlib, subprocess, tempfile, datetime
root = pathlib.Path(__file__).resolve().parent
source = root / 'source'
for item in json.loads((root/'source-manifest.json').read_text(encoding='utf-8-sig')):
    assert hashlib.sha256((source/item['path']).read_bytes()).hexdigest() == item['sha256'], item['path']
exe = root/'dist/xray-engine-verified.exe'
status = subprocess.run([str(exe), 'contract-status', '--json'], capture_output=True, timeout=30)
assert status.returncode == 0, status.stderr.decode(errors='replace')
status_json = json.loads(status.stdout)
checks=[]
for stem in ['colorbond','timber-paling','chain-wire','concrete-allowance']:
    request=(source/'engine/fixtures/bom-contract'/f'{stem}.request.json').read_bytes()
    expected=json.loads((source/'engine/fixtures/bom-contract'/f'{stem}.response.json').read_text(encoding='utf-8'))
    with tempfile.TemporaryDirectory(prefix='fixture-',dir=root) as scratch:
        result=pathlib.Path(scratch)/'result.json'
        process=subprocess.run([str(exe),'job-to-bom','--request-stdin','--result',str(result)],input=request,capture_output=True,cwd=scratch,timeout=30)
        assert process.returncode == 0, (stem,process.stderr.decode(errors='replace'))
        actual=json.loads(result.read_text(encoding='utf-8'))
        (root/f'{stem}.actual.json').write_text(json.dumps(actual,indent=2))
        assert actual == expected, f'{stem}: differs from frozen response'
        checks.append({'fixture':stem,'exitCode':process.returncode,'exactFrozenResponseMatch':True})
import sys
sys.path.insert(0,str(source/'engine/python'))
from xray.job_bom import compute_input_digest
for layout, expected_sheets in [('equal','13'),('full-bays-terminal-cut','14')]:
    request=json.loads((source/'engine/fixtures/bom-contract/colorbond.request.json').read_text(encoding='utf-8'))
    request['recipeSet']['recipes'][0]['bayLayout']=layout
    request['inputDigest']=compute_input_digest(request)
    with tempfile.TemporaryDirectory(prefix='layout-',dir=root) as scratch:
        result=pathlib.Path(scratch)/'result.json'
        process=subprocess.run([str(exe),'job-to-bom','--request-stdin','--result',str(result)],input=json.dumps(request).encode(),capture_output=True,cwd=scratch,timeout=30)
        assert process.returncode==0,process.stderr.decode(errors='replace')
        actual=json.loads(result.read_text(encoding='utf-8'))
        assert actual['ok'] is True
        lines={line['id']:line for line in actual['bom']['lines']}
        assert lines['bom-cb-sheet']['quantity']['value']==expected_sheets
        assert lines['bom-cb-rail-cut']['quantity']['value']=='10'
        (root/f'layout-{layout}.actual.json').write_text(json.dumps(actual,indent=2))
        checks.append({'fixture':layout,'exitCode':0,'expectedSheets':expected_sheets,'actualSheets':lines['bom-cb-sheet']['quantity']['value']})
(root/'fixture-verdict.json').write_text(json.dumps({'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'executable':str(exe),'sha256':hashlib.sha256(exe.read_bytes()).hexdigest(),'contractStatus':status_json,'checks':checks},indent=2))
print((root/'fixture-verdict.json').read_text(encoding='utf-8'))

request_path=pathlib.Path('C:/Users/danie/XRayBuilds/native-industry-e173b12b942c-ui1/derived-request.json')
request_bytes=request_path.read_bytes()
request_sha=hashlib.sha256(request_bytes).hexdigest()
with tempfile.TemporaryDirectory(prefix='ui-replay-',dir=root) as scratch:
    result=pathlib.Path(scratch)/'result.json'
    process=subprocess.run([str(exe),'job-to-bom','--request-stdin','--result',str(result)],input=request_bytes,capture_output=True,cwd=scratch,timeout=30)
    assert process.returncode==0,process.stderr.decode(errors='replace')
    actual=json.loads(result.read_text(encoding='utf-8'))
    assert actual['ok'] is True, actual
    assert hashlib.sha256(request_path.read_bytes()).hexdigest()==request_sha
    (root/'ui-derived.actual.json').write_text(json.dumps(actual,indent=2))
    (root/'ui-derived-verdict.json').write_text(json.dumps({'requestPath':str(request_path),'requestSHA256':request_sha,'unchanged':True,'ok':True,'requestId':actual['requestId'],'lineCount':len(actual['bom']['lines']),'provenance':'Persisted UI-derived same-build request, not intercepted original network request'},indent=2))
print((root/'ui-derived-verdict.json').read_text(encoding='utf-8'))
