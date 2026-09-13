import json,pathlib
r=pathlib.Path('C:/Users/danie/XRayBuilds/industry-visible-20260913')
a=json.loads((r/'native-engine-selected-20260913/ui-derived.actual.json').read_text())
b=json.loads((r/'selected-recipe-ts-replay/response.json').read_text(encoding='utf-8-sig'))
if a != b:
    import difflib
    print('\n'.join(difflib.unified_diff(json.dumps(a,sort_keys=True,indent=2).splitlines(),json.dumps(b,sort_keys=True,indent=2).splitlines(),fromfile='python',tofile='typescript')))
    raise SystemExit(1)
(r/'native-engine-selected-20260913/parity.json').write_text(json.dumps({'exactPythonTypeScriptResponseMatch':True,'requestId':a['requestId']},indent=2))
print('Exact Python/TypeScript response parity passed')
