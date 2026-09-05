import json
from pathlib import Path
p=Path('engine/fixtures/ruffles-source-trace.json');t=json.loads(p.read_text());v=t['roofVertices'];v['W']=[490,562,2.72]
for f in t['roofFaces']:
 if f['id']=='cross-east':f['vertices']=['q','W','H','s4','s2','s','r2']
 if f['id']=='cross-west':f['vertices']=['r2','s','s2','s3','I','J']
 if f['id']=='carport-north':f['vertices']=['M','L','c2','c1']
 if f['id']=='carport-south':f['vertices']=['N','O','c2','c1']
 # Plane [axis0=x/1=z, direction, eaveCoord, eaveHeight]. Source pitch approximate22.5.
 planes={'main-north':[1,1,255,2.72],'main-west':[0,1,-56,2.72],'main-south':[1,-1,645,2.72], 'cross-west':[0,1,127,2.72],'cross-east':[0,-1,490,2.72],'cross-front-hip':[1,-1,662,2.72], 'patio-west-hip':[0,1,362,2.72],'patio-south':[1,-1,496,2.72], 'rear-east-north':[1,1,255,2.72],'east-hip':[0,-1,891,2.72],'east-front':[1,-1,562,2.72], 'porch-west':[0,1,490,2.72],'porch-east':[0,-1,620,2.72],'porch-front':[1,-1,610,2.72], 'carport-west':[0,1,-230,2.72],'carport-north':[1,1,385,2.72],'carport-south':[1,-1,615,2.72]}
 f['plane']=planes[f['id']]
# Patio access not shown as a door in source; do not invent it.
for w in t['walls']:
 if w['id']=='patio-south':w['openings']=[]
p.write_text(json.dumps(t,indent=2))
