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
    expected=json.loads((source/'engine/fixtures/bom-contract'/f'{stem}.response.json').read_text())
    with tempfile.TemporaryDirectory(prefix='fixture-',dir=root) as scratch:
        result=pathlib.Path(scratch)/'result.json'
        process=subprocess.run([str(exe),'job-to-bom','--request-stdin','--result',str(result)],input=request,capture_output=True,cwd=scratch,timeout=30)
        assert process.returncode == 0, (stem,process.stderr.decode(errors='replace'))
        actual=json.loads(result.read_text())
        (root/f'{stem}.actual.json').write_text(json.dumps(actual,indent=2))
        assert actual == expected, f'{stem}: differs from frozen response'
        checks.append({'fixture':stem,'exitCode':process.returncode,'exactFrozenResponseMatch':True})
(root/'fixture-verdict.json').write_text(json.dumps({'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'executable':str(exe),'sha256':hashlib.sha256(exe.read_bytes()).hexdigest(),'contractStatus':status_json,'checks':checks},indent=2))
print((root/'fixture-verdict.json').read_text())
