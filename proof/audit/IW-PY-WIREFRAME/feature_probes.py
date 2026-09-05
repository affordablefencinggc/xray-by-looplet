"""Bounded execution inventory: observed behavior, never blanket feature approval."""
import collections
import dataclasses
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
from types import SimpleNamespace

ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'proof/audit/IW-PY-WIREFRAME';DEST=OUT/'feature-probes';DEST.mkdir(exist_ok=True)
hits=collections.Counter();results=[]
def profile(frame,event,arg):
    if event=='call' and '/engine/python/xray/' in frame.f_code.co_filename.replace('\\','/'):
        hits[Path(frame.f_code.co_filename).name+':'+frame.f_code.co_name]+=1
def record(name,fn):
    try:
        output=fn();value={'scenario':name,'outcome':'executed','result':output}
    except Exception as error:value={'scenario':name,'outcome':'raised','exception':type(error).__name__,'message':str(error)}
    results.append(value);print(json.dumps(value,default=str),flush=True)
sys.setprofile(profile)
from xray import engine
takeoffs={}
for name in ['residential-ruffles-seeka','shed-manners-aline','electrical-schedule']:
    takeoffs[name]=engine.run(str(ROOT/f'engine/fixtures/{name}.pdf'))
    record(name+'-real-pipeline',lambda n=name:{'entities':len(takeoffs[n]['entities']),'checks':len(takeoffs[n]['checks']),'quantities':takeoffs[n]['quantities']})
svg=engine.run(str(ROOT/'engine/fixtures/svg/sample-plan.svg'))
record('synthetic-svg-structural',lambda:svg['quantities'])
from xray.preflight import check_input
for name,content in [('empty.pdf',b''),('wrong.pdf',b'not PDF'),('broken.pdf',b'%PDF-1.7\ntruncated')]:
    source=DEST/name;source.write_bytes(content);record(name,lambda p=source:check_input(p))
from xray.packs import PackContext,run_packs,_registry,Pack
from xray.sources.base import Measure,Symbol
from xray.packs_fencing import FencingPack
ctx=PackContext([],[],[],[],symbols=[Symbol('GATE','FENCE',2,0,id='gate1')],geometry=[Measure('line',5,'FENCE',unit='m',id='run1')],units={'resolved':'m','verified':True})
fence=FencingPack().quantify(ctx);fence_json={'quantities':[dataclasses.asdict(q) for q in fence[0]]}
record('synthetic-fence-five-metres',lambda:fence_json)
(DEST/'fence.json').write_text(json.dumps(fence_json),encoding='utf-8')
from xray.fence_bom import fence_bom,SYSTEMS
for system in SYSTEMS:record('synthetic-fence-bom-'+system,lambda s=system:fence_bom(fence_json,s))
record('legacy-pricing-import',lambda:__import__('pricing.costing'))
from xray.packs_structural import StructuralCountPack
open_ctx=PackContext([],[],[],[],geometry=[Measure('polyline',4,'COLUMNS',unit='m',id='open-not-member',area=None)])
record('open-polyline-on-column-layer',lambda:[dataclasses.asdict(q) for q in StructuralCountPack().quantify(open_ctx)[0]])
from xray.packs_survey import SurveyPack
survey=PackContext([],[],[],[],points=[SimpleNamespace(kind='survey',id='a',x=0,y=0,z=1000),SimpleNamespace(kind='survey',id='b',x=10,y=0,z=2000)],units={'resolved':'mm','verified':True})
record('survey-millimetre-elevation',lambda:[dataclasses.asdict(q) for q in SurveyPack().quantify(survey)[0]])
class BrokenPack(Pack):
    name='audit-broken'
    def detect(self,ctx):return True
    def quantify(self,ctx):raise ValueError('owned deliberate failure')
_registry.append(BrokenPack())
record('pack-failure-isolation',lambda:{'quantities':len(run_packs(ctx)[0]),'checks':[dataclasses.asdict(c) for c in run_packs(ctx)[1]]})
_registry.pop()
from xray.ocr import available_backend,StubBackend,recognize_page
record('ocr-real-backend-probe',lambda:{'backend':getattr(available_backend(),'name',None)})
record('ocr-synthetic-plumbing-only',lambda:{'words':len(recognize_page(ROOT/'engine/fixtures/electrical-schedule.pdf',StubBackend())),'recognitionClaim':False})
from xray.assemblies import WallInput,expand_wall
record('explicit-synthetic-wall-assembly',lambda:[dataclasses.asdict(q) for q in expand_wall(WallInput(6,2.4,('synthetic-wall',)))])
from xray.graph import build_graph,count_by_type
cad=engine.run(str(OUT/'synthetic-nested-plan.dxf'))
record('synthetic-cad-graph',lambda:count_by_type(build_graph(cad)))
from xray.solid import build_solids,roundtrip_check,to_gltf
record('synthetic-cad-box-solid-presentation',lambda:{'roundtrip':roundtrip_check(build_solids(cad,default_height=8),cad),'gltfNodes':len(to_gltf(build_solids(cad,default_height=8)).get('nodes',[]))})
from xray.rollup import project_rollup
record('explicit-three-floor-rollup',lambda:project_rollup(svg,3,3.2))
record('negative-floor-rollup',lambda:project_rollup(svg,-2,3.2))
from xray.sources.svg import SvgAdapter
path=DEST/'transformed.svg';path.write_text('<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="100mm" viewBox="0 0 100 100"><g id="FENCE" transform="scale(2)"><line x1="0" y1="0" x2="10" y2="0"/></g></svg>')
record('svg-double-scale-length',lambda:[dataclasses.asdict(g) for g in SvgAdapter().read(path).geometry])
from xray.sources.ifc import IfcAdapter
ifc=DEST/'synthetic.ifc';ifc.write_text("ISO-10303-21;\nHEADER;\nENDSEC;\nDATA;\n#1=IFCCARTESIANPOINT((0.,0.,0.));\n#2=IFCCOLUMN('column-id',$,'Column',$,$,$,$,$);\nENDSEC;\nEND-ISO-10303-21;")
record('minimal-ifc-adapter',lambda:dataclasses.asdict(IfcAdapter().read(ifc)))
record('http-worker-route-inventory',lambda:{'files':[p.name for p in (ROOT/'engine/server').glob('*.py')],'httpWorkerEntryExists':any((ROOT/'engine/server'/name).exists() for name in ['app.py','worker.py','main.py'])})
sys.setprofile(None)
(OUT/'feature-probes.json').write_text(json.dumps({'scope':'smoke/adversarial observations only; no feature-wide verified states','results':results,'actualFunctionCalls':dict(sorted(hits.items()))},indent=2,default=str),encoding='utf-8')
