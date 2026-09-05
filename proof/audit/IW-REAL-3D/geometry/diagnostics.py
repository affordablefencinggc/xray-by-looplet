import json,math,hashlib
from pathlib import Path
from PIL import Image,ImageDraw
root=Path(__file__).resolve().parents[4];out=Path(__file__).parent
s=json.loads((root/'public/models/ruffles/source-building.json').read_text());t=json.loads((root/'engine/fixtures/ruffles-source-trace.json').read_text())
im=Image.open(root/'proof/audit/IW-REAL-3D/source-review/page-13-points.png').convert('RGB');d=ImageDraw.Draw(im)
for w in t['walls']:
 a,b=w['a'],w['b'];d.line([tuple(a),tuple(b)],fill='#e33b32',width=2)
 for o in w['openings']:
  aa=[a[j]+(b[j]-a[j])*o['start'] for j in range(2)];bb=[a[j]+(b[j]-a[j])*o['end'] for j in range(2)];d.line([tuple(aa),tuple(bb)],fill='#00a775',width=4)
d.text((350,730),'RED=curated walls  GREEN=opening intervals',fill='#c11');im.save(out/'floor-trace-overlay.png')
im=Image.open(root/'proof/audit/IW-REAL-3D/source-review/page-16-points.png').convert('RGB');d=ImageDraw.Draw(im)
for face in t['roofFaces']:
 pts=[tuple(t['roofVertices'][k][:2]) for k in face['vertices']];d.line(pts+[pts[0]],fill='#c32919',width=2)
im.save(out/'roof-trace-overlay.png')
for roof in [True,False]:
 im=Image.new('RGB',(1800,1100),'#e9edea');d=ImageDraw.Draw(im);triangles=[]
 yaw=math.radians(-33);tilt=math.radians(57)
 def project(p):
  x,y,z=p;x-=15;z-=6;u=x*math.cos(yaw)+z*math.sin(yaw);v=-x*math.sin(yaw)+z*math.cos(yaw)
  return (900+u*37,630+(v*math.cos(tilt)-y*math.sin(tilt))*37,v*math.sin(tilt)+y*math.cos(tilt))
 for obj in s['objects']:
  if not roof and obj['category'] in ['roof','roof-trim','solar','skylight']:continue
  pts=[project(obj['positions'][i:i+3]) for i in range(0,len(obj['positions']),3)];color=s['materials'][obj['material']]['color']
  for i in range(0,len(obj['indices']),3):
   tri=[pts[k] for k in obj['indices'][i:i+3]];triangles.append((sum(p[2] for p in tri)/3,[(p[0],p[1]) for p in tri],color))
 for depth,points,col in sorted(triangles,key=lambda q:q[0]):d.polygon(points,fill=col)
 d.text((30,30),'GEOMETRY DIAGNOSTIC (software projection, not browser proof) / '+('roof on' if roof else 'roof removed'),fill='black');im.save(out/('diagnostic-roof-on.png' if roof else 'diagnostic-roof-off.png'))
print('overlays and diagnostic projection written')

