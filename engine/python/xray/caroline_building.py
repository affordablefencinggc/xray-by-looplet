"""Curated Caroline source reconstruction, bound to the supplied 19-page PDF.

Geometry follows source plans, elevations and sections. This is a presentation
reconstruction, not an automatic architectural classifier or a quantity model.
"""
from __future__ import annotations
import argparse,hashlib,json,math
from pathlib import Path
from xray.source_building import triangulate,BuildingError
FT=.3048

class Builder:
 def __init__(self,trace):
  self.trace=trace;self.parts=[];self.scale=FT/trace['pointsPerFoot'];self.origin=trace['origin'];self.ids=set()
 def point(self,p,y):return [(p[0]-self.origin[0])*self.scale,y,(p[1]-self.origin[1])*self.scale]
 def refs(self,page,points,note='',state='traced'):
  xs=[p[0] for p in points];zs=[p[1] for p in points]
  return [{'page':page,'region':[max(0,min(xs)-3),max(0,min(zs)-3),min(1584,max(xs)+3),min(1224,max(zs)+3)],'trace':points,'evidenceState':state,'note':note}]
 def mesh(self,id,cat,label,verts,idx,mat,level,refs,state='traced'):
  if id in self.ids:raise BuildingError('Duplicate part '+id)
  self.ids.add(id);self.parts.append({'id':id,'category':cat,'label':label,'positions':[round(v,6) for p in verts for v in p],'indices':idx,'material':mat,'level':level,'sourceRefs':refs,'evidenceState':state})
 def beam(self,id,cat,label,a,b,width,low,high,mat,level,refs,state='inferred'):
  length=math.dist(a,b)
  if length<1e-8 or high<=low:raise BuildingError('Invalid member '+id)
  nx=-(b[1]-a[1])/length*width/self.scale/2;nz=(b[0]-a[0])/length*width/self.scale/2
  ps=[[a[0]+nx,a[1]+nz],[b[0]+nx,b[1]+nz],[b[0]-nx,b[1]-nz],[a[0]-nx,a[1]-nz]]
  inds=[0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7]
  self.mesh(id,cat,label,[self.point(p,y) for y in [low,high] for p in ps],inds,mat,level,refs,state)
 def slab(self,id,label,poly,low,high,mat='floor',level='ground',page=5,cat='slab',state='traced'):
  n=len(poly);indices=[];flat=triangulate(poly)
  for i in range(0,len(flat),3):indices.extend(flat[i:i+3][::-1]);indices.extend(j+n for j in flat[i:i+3])
  for i in range(n):j=(i+1)%n;indices.extend([i,j,j+n,i,j+n,i+n])
  self.mesh(id,cat,label,[self.point(p,y) for y in [low,high] for p in poly],indices,mat,level,self.refs(page,poly,'Source plan outline; material and thickness are presentation assumptions.',state),state)
 def rect(self,id,label,r,low,high,**kw):
  x,z,xx,zz=r;self.slab(id,label,[[x,z],[xx,z],[xx,zz],[x,zz]],low,high,**kw)
 def roof(self,id,label,poly,heights,page=4,sourcepoly=None,mat='roof'):
  # The roof drawing is on the right half of page4; its registration relative
  # to the floor plan is +722 page points in X, with the same Y coordinates.
  source_outline=[[p[0]+722,p[1]] for p in poly]
  refs=self.refs(4,source_outline,'Roof boundary registered from page 4. Its notes call roof dimensions rough. Horizontal trace and lower attachment heights are approximate.','inferred')
  refs+=self.refs(7,[[98,374],[250,492]],'Main ridge +23 ft and eave +17 ft 6 in are dimensioned here.','dimensioned')
  refs+=self.refs(7,[[330,406],[632,451]],'Main roof slope 7.5:12 is shown in this elevation.','dimensioned')
  refs+=self.refs(4,[[1149,858],[1200,945]],'Lower roof slope 3:12 is dimensioned in the roof plan.','dimensioned')
  self.mesh(id,'roof',label,[self.point(p,y) for p,y in zip(poly,heights)],triangulate(poly),mat,'roof',refs,'inferred')
 def wall(self,w):
  id=w['id'];a,b=w['a'],w['b'];level=w['level'];page=5 if level=='ground' else 6
  low=0 if level=='ground' else 9*FT;high=w['top'] if w['top'] is not None else (9*FT if level=='ground' else 17*FT+FT/12)
  mat='interior' if w['internal'] else 'wall';width=.095 if w['internal'] else .15
  refs=self.refs(page,[a,b],'Wall location traced from this floor plan; floor datums and ceiling heights from page 9. Wall assembly thickness is approximate.')
  def pos(t):return [a[j]+(b[j]-a[j])*t for j in range(2)]
  prev=0
  for oi,o in enumerate(w['openings']):
   ss,ee=o['start'],o['end'];kind=o['kind'];typ=o['type'];bottom=0;top=80/12*FT
   if not 0<=prev<=ss<ee<=1 or kind not in ['window','door','opening'] or typ not in [1,2,3,4,5]:raise BuildingError('Invalid opening interval/type: '+o['id'])
   if kind=='window':
    bottom=(18/12*FT if typ==1 else 2*FT if typ==2 else 3*FT);top=bottom+({1:72,2:60,3:42}[typ]/12*FT)
   elif kind=='door' and typ in [1,2]:top=84/12*FT
   sill,head=low+bottom,min(low+top,high-.04)
   if ss>prev:self.beam(id+f'-solid-{oi}','wall',w['label'],pos(prev),pos(ss),width,low,high,mat,level,refs,'traced')
   if sill>low:self.beam(id+f'-below-{oi}','wall',w['label'],pos(ss),pos(ee),width,low,sill,mat,level,refs,'traced')
   if head<high:self.beam(id+f'-above-{oi}','wall',w['label'],pos(ss),pos(ee),width,head,high,mat,level,refs,'traced')
   oa,ob=pos(ss),pos(ee);orf=self.refs(page,[oa,ob],'Opening traced. Type dimensions from the page 5/6 schedule; sash, casing and shutter detail from pages 7/8/12.','dimensioned')
   if kind!='opening':
    length=math.dist(oa,ob)*self.scale;f=.055/max(length,1e-8)*(ee-ss)
    for j,(u,v) in enumerate([(ss,ss+f),(ee-f,ee)]):self.beam(o['id']+'-jamb'+str(j),'trim',o['id']+' casing',pos(u),pos(v),width+.045,sill,head,'trim',level,orf)
    self.beam(o['id']+'-head','trim','Head casing',oa,ob,width+.05,head-.08,head,'trim',level,orf)
   if kind=='window':
    self.beam(o['id'],'window',o['id'].replace('-',' '),oa,ob,.026,sill+.04,head-.04,'glass',level,orf,'dimensioned')
    self.beam(o['id']+'-sill','trim','Window sill',oa,ob,width+.09,sill,sill+.04,'trim',level,orf)
    self.beam(o['id']+'-meeting-rail','trim','Double hung sash rail',oa,ob,.055,(sill+head)/2-.025,(sill+head)/2+.025,'trim',level,orf)
    middle=(ss+ee)/2;ff=.018/math.dist(a,b)/self.scale
    self.beam(o['id']+'-mullion','trim','Divided light mullion',pos(middle-ff),pos(middle+ff),.045,sill,head,'trim',level,orf)
    if not w['internal']:
     # Operable shutters shown open against the siding, never across the aperture.
     for j,(u,v) in enumerate([(ss-(ee-ss)/2-.012,ss-.012),(ee+.012,ee+(ee-ss)/2+.012)]):
      self.beam(o['id']+'-shutter'+str(j),'trim','Operable window shutter',pos(u),pos(v),width+.065,sill,head,'shutter',level,orf)
      for k in range(1,9):
       y=sill+(head-sill)*k/10
       self.beam(o['id']+f'-louver{j}-{k}','trim','Shutter louver',pos(u),pos(v),width+.075,y,y+.012,'shutter-edge',level,orf)
   elif kind=='door':
    if not w['internal']:
     self.beam(o['id'],'door',o['id'].replace('-',' '),oa,ob,.05,low,head,'door',level,orf,'dimensioned')
     if typ in [1,2]:
      self.beam(o['id']+'-glazed-lite','window','Glazed door light',pos(ss+(ee-ss)*.16),pos(ee-(ee-ss)*.16),.057,low+.95,head-.15,'glass',level,orf)
    else:
     dx=(ob[0]-oa[0])*.70;dz=(ob[1]-oa[1])*.70;end=[oa[0]+dx*.65-dz*.76,oa[1]+dx*.76+dz*.65]
     self.beam(o['id'],'door',o['id'].replace('-',' '),oa,end,.035,low,head,'door',level,orf)
   prev=ee
  if prev<1:self.beam(id+'-solid-last','wall',w['label'],pos(prev),b,width,low,high,mat,level,refs,'traced')
  # Clapboard reveal lines only along the solid wall bands, preserving all openings.
  if not w['internal']:
   n=0;y=low+.15
   while y<high:
    intervals=[(0,1)]
    for o in w['openings']:
     if o['kind']=='window':bot=low+({1:1.5,2:2,3:3}[o['type']])*FT;top=bot+{1:6,2:5,3:3.5}[o['type']]*FT
     else:bot=low;top=low+7*FT
     if bot-.02<y<top+.02:
      intervals=[piece for left,right in intervals for piece in [(left,min(right,o['start'])),(max(left,o['end']),right)] if piece[1]-piece[0]>1e-5]
    for left,right in intervals:self.beam(id+'-clapboard-'+str(n),'trim','Clapboard reveal',pos(left),pos(right),width+.012,y,y+.008,'siding-line',level,refs);n+=1
    y+=.1524

def build_scene(source,trace_path):
 with source.open('rb') as stream:data=stream.read(30*1024*1024+1)
 if len(data)>30*1024*1024:raise BuildingError('Source exceeds 30 MiB')
 trace=json.loads(trace_path.read_text(encoding='utf-8-sig'));sha=hashlib.sha256(data).hexdigest()
 if sha!=trace['sourceSha256']:raise BuildingError('Caroline source SHA-256 mismatch')
 if trace['schema']!='xray.curated-caroline/v1':raise BuildingError('Unsupported Caroline trace')
 b=Builder(trace)
 b.rect('ground-main','Main floor: nominal 24 x 16 ft, traced outline',[233,548,665,835],-.254,0)
 b.rect('kitchen-floor','Kitchen addition',[486,368,665,548],-.254,0)
 b.rect('screen-floor','Screen porch slab',[378,368,486,548],-.41,-.3048,mat='stone')
 b.rect('side-floor','Side room floor',[133,566,233,706],-.254,0)
 b.rect('bath-floor','Downstairs bathroom floor',[665,675,767,813],-.254,0,mat='tile')
 # Conditioned crawlspace perimeter and annex piers shown on pages4/9/18.
 # Their below-floor depth is illustrative; the source requires site engineering.
 foundation=[[233,548],[486,548],[486,368],[665,368],[665,835],[233,835]]
 for i,(a,c) in enumerate(zip(foundation,foundation[1:]+foundation[:1])):
  b.beam('foundation-wall-'+str(i),'slab','Conditioned crawlspace perimeter',a,c,.23,-.64,-.254,'stone','ground',b.refs(4,[a,c],'Foundation perimeter shown in page4 left drawing. Below-floor depth is illustrative, not engineered.','inferred'))
 for i,p in enumerate([[140,575],[140,698],[140,809],[758,683],[758,814]]):
  b.rect('annex-pier-'+str(i),'Annex support pier',[p[0]-7,p[1]-7,p[0]+7,p[1]+7],-.64,-.254,mat='stone',page=4,cat='column',state='inferred')
 b.slab('veranda-deck','Wraparound front porch',[[133,706],[233,706],[233,835],[665,835],[665,813],[767,813],[767,938],[133,938]],-.24,-.025,mat='deck')
 # Upper slab has an actual stair aperture. Three rectangles tile around it.
 for id,r in [('west',[233,548,603,835]),('front',[603,640,665,835])]:b.rect('upper-floor-'+id,'Upper floor around stairwell',r,2.4892,2.7432,level='upper',page=6)
 for r in trace['rooms']:
  y=0 if r['level']=='ground' else 2.7432;b.rect('room-'+r['name'].lower().replace(' ','-').replace('/',''),'Room: '+r['name'],r['rect'],y+.001,y+.006,mat='tile' if 'bath' in r['name'].lower() else 'floor',level=r['level'],page=5 if r['level']=='ground' else 6,cat='room')
 for wall in trace['walls']:b.wall(wall)
 # Main gable planes use the source's exact 17ft6in eave,23ft ridge and7.5:12 slope.
 eave=17.5*FT;ridge=23*FT;mid=693;run=(ridge-eave)/.625/b.scale
 roofback=mid-run;rooffront=mid+run
 b.roof('main-roof-north','Main gable north pitch 7.5:12',[[224,roofback],[674,roofback],[674,mid],[224,mid]],[eave,eave,ridge,ridge])
 b.roof('main-roof-south','Main gable south pitch 7.5:12',[[224,mid],[674,mid],[674,rooffront],[224,rooffront]],[ridge,ridge,eave,eave])
 # Gable ends are source-elevation geometry and hide with the roof.
 for id,x in [('west',233),('east',665)]:
  roof_y=lambda z:ridge-abs(z-mid)*b.scale*.625
  verts=[b.point([x,548],17*FT+FT/12),b.point([x,835],17*FT+FT/12),b.point([x,835],roof_y(835)),b.point([x,mid],ridge),b.point([x,548],roof_y(548))]
  b.mesh('gable-'+id,'roof-trim','Main '+id+' gable',verts,[0,1,2,0,2,3,0,3,4],'wall','roof',b.refs(7 if id=='west' else 8,[[315,380],[635,493]],'Gable silhouette traced from elevation; attic vent included separately.','dimensioned'),'dimensioned')
  b.beam('attic-vent-'+id,'roof-trim','Gable attic vent',[x,684],[x,702],.165,5.65,6.10,'shutter','roof',b.refs(7 if id=='west' else 8,[[460,435],[490,478]] if id=='west' else [[400,435],[430,478]],'Attic vent shown in gable elevation.'))
 # Low porch roofs: three joined planar surfaces around the main block.
 attach=3.10;low=attach-117*b.scale*.25
 b.roof('porch-roof-west','West porch and side-room roof 3:12',[[116,548],[233,548],[233,835],[116,952]],[low,attach,attach,low],page=6,sourcepoly=[[117,548],[233,548],[233,835],[117,950]])
 b.roof('porch-roof-front','Front porch roof 3:12',[[116,952],[233,835],[665,835],[782,952]],[low,attach,attach,low],page=6,sourcepoly=[[117,950],[233,835],[665,835],[782,950]])
 b.roof('porch-roof-east','East porch and bathroom roof 3:12',[[665,548],[782,548],[782,952],[665,835]],[attach,low,low,attach],page=6)
 # Rear kitchen/screen-porch gable, clearly shown in roof plan and rear elevation.
 rear_eave=2.66;rear_ridge=rear_eave+155*b.scale*.25
 b.roof('rear-roof-west','Rear addition west roof 3:12',[[367,358],[522,358],[522,548],[367,548]],[rear_eave,rear_ridge,rear_ridge,rear_eave],page=6)
 b.roof('rear-roof-east','Rear addition east roof 3:12',[[522,358],[677,358],[677,548],[522,548]],[rear_ridge,rear_eave,rear_eave,rear_ridge],page=6)
 # The rear elevation/rendering show a closed sided gable over both the kitchen
 # and screen porch. This cap meets the two actual lower roof planes.
 rear_y=lambda x:rear_ridge-abs(x-522)*b.scale*.25
 vv=[b.point([378,368],2.60),b.point([665,368],2.60),
     b.point([665,368],rear_y(665)),b.point([522,368],rear_ridge),b.point([378,368],rear_y(378))]
 rf=b.refs(8,[[918,609],[1225,657]],'Closed rear addition gable shown above kitchen/screen porch in rear elevation; corroborated by page 17. Lower attachment height remains approximate.','inferred')
 rf+=b.refs(17,[[1200,503],[1490,622]],'Source rendering shows sided rear gable closure.','traced')
 b.mesh('rear-gable-closure','roof-trim','Rear kitchen and screen porch gable closure',vv,[0,1,2,0,2,3,0,3,4],'wall','roof',rf,'inferred')
 for i,y in enumerate([2.75,2.90,3.05,3.20]):
  run=(rear_ridge-y)/(.25*b.scale);left=max(378,522-run);right=min(665,522+run)
  b.beam('rear-gable-clapboard-'+str(i),'roof-trim','Rear gable clapboard reveal',[left,368],[right,368],.025,y-.006,y+.006,'siding-line','roof',rf)
 # Standing seam lines lie on each existing roof surface (no raised unrelated panels).
 for roof in list(b.parts):
  if roof['category']!='roof':continue
  p=[roof['positions'][i:i+3] for i in range(0,len(roof['positions']),3)]
  # Perimeter flashing strips follow the same actual 3D plane.
  for j,(a,c) in enumerate(zip(p,p[1:]+p[:1])):
   dx=c[0]-a[0];dz=c[2]-a[2];ll=math.hypot(dx,dz)
   if ll<1e-8:continue
   nx=-dz/ll*.025;nz=dx/ll*.025
   vv=[[a[0]+nx,a[1]+.015,a[2]+nz],[c[0]+nx,c[1]+.015,c[2]+nz],[c[0]-nx,c[1]+.015,c[2]-nz],[a[0]-nx,a[1]+.015,a[2]-nz]]
   b.mesh(roof['id']+'-flashing-'+str(j),'roof-trim','Roof edge flashing',vv,[0,2,1,0,3,2],'roof-edge','roof',roof['sourceRefs'],'inferred')
 # Wraparound porch turned posts, based on the 6-inch column detail.
 posts=[[133,934],[260,934],[386,934],[512,934],[639,934],[764,934],[133,811],[133,706]]
 for i,p in enumerate(posts):
  refs=b.refs(5,[p],'Post centre traced; 6-inch turned post profile from pages 7 and 10.')
  rings=[(-.025,.0762),(.12,.0762),(.55,.0762),(.62,.052),(.72,.039),(1.70,.039),(1.82,.065),(2.30,.065),(2.45,.0762)];vv=[];idx=[];n=12
  for y,r in rings:
   centre=b.point(p,y)
   vv.extend([[centre[0]+math.cos(j*2*math.pi/n)*r,y,centre[2]+math.sin(j*2*math.pi/n)*r] for j in range(n)])
  for k in range(len(rings)-1):
   for j in range(n):a=k*n+j;c=k*n+(j+1)%n;idx.extend([a,c,c+n,a,c+n,a+n])
  b.mesh('porch-post-'+str(i),'column','Turned porch post',vv,idx,'trim','ground',refs,'inferred')
  b.rect('post-pier-'+str(i),'Porch foundation pier',[p[0]-7,p[1]-7,p[0]+7,p[1]+7],-.62,-.24,mat='stone',cat='column')
 for i,(a,c) in enumerate([([133,934],[764,934]),([133,706],[133,934])]):b.beam('porch-beam-'+str(i),'trim','Porch supporting beam',a,c,.14,2.45,2.60,'trim','ground',b.refs(5,[a,c],'Porch beam over traced posts.'))
 # Screen porch mesh and framing, including its actual exterior door bay.
 for i,(a,c) in enumerate([([378,368],[486,368]),([378,368],[378,442]),([378,496],[378,548])]):
  rf=b.refs(5,[a,c],'Screen porch perimeter from plan; screen infill from pages 7 and 17.')
  b.beam('screen-'+str(i),'fence','Screen porch mesh',a,c,.012,-.18,2.60,'screen','ground',rf)
  for j,y in enumerate([-.20,.62,2.52]):b.beam('screen-rail-'+str(i)+'-'+str(j),'trim','Screen porch rail',a,c,.085,y,y+.075,'trim','ground',rf)
 for i,p in enumerate([[378,368],[486,368],[378,442],[378,496],[378,548]]):b.beam('screen-post-'+str(i),'column','Screen porch post',[p[0]-3,p[1]],[p[0]+3,p[1]],.10,-.3048,2.66,'trim','ground',b.refs(5,[p],'Screen porch framing shown in source.'))
 # Exterior steps: source calls for three risers at front and two at screen porch.
 # First block is a flush landing extension; three equal risers descend from
 # that landing to the illustrative ground datum. Blocks meet edge-to-edge.
 for i in range(3):
  b.rect('front-step-'+str(i),'Front porch landing and descending steps',[540,938+i*12,614,950+i*12],-.64,-.025-i*(.615/3),mat='stone',state='inferred')
  b.parts[-1]['sourceRefs'][0]['note']='Three front entry risers shown on page 5. Traced width and run; landing joins the porch at -0.025 m. Equal descending heights and ground support depth are inferred presentation dimensions.'
 for i in range(2):b.rect('screen-step-'+str(i),'Two screen porch entry risers',[368-i*12,442,380-i*12,496],-.61,-.3048-i*.1524,mat='stone')
 # Actual interior stair run and three winder treads; 14 risers total at9ft/14.
 rise=9*FT/14
 for i in range(11):
  z=721-i*11.3;b.rect('stair-tread-'+str(i),'Winder stair straight tread',[607,z-11.3,662,z],i*rise,(i+1)*rise,mat='stairs',cat='stair')
 corner=[607,596.7]
 winders=[[[607,596.7],[662,596.7],[662,550]],[[607,596.7],[662,550],[607,550]],[[607,596.7],[607,550],[578,550],[578,596.7]]]
 for i,poly in enumerate(winders):b.slab('stair-winder-'+str(i),'Winder stair corner tread',poly,(11+i)*rise,(12+i)*rise,mat='stairs',cat='stair')
 b.rect('raised-closet-platform','Raised closet over lower stairs',[607,641,660,695],2.7432,2.7432+.9144,mat='floor',level='upper',page=6,cat='fixture')
 # Handrail follows the lower stair wall; the top landing is left unobstructed.
 # Decorative profile and rail height are illustrative, not a code clearance claim.
 rail_a=b.point([603,721],.95);rail_c=b.point([603,596.7],11*rise+.95)
 vv=[]
 for p in [rail_a,rail_c]:vv.extend([[p[0]-.025,p[1]-.025,p[2]],[p[0]+.025,p[1]-.025,p[2]],[p[0]+.025,p[1]+.025,p[2]],[p[0]-.025,p[1]+.025,p[2]]])
 b.mesh('stair-handrail','trim','Stair wall handrail',vv,[0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7],'stairs','ground',b.refs(5,[[603,596.7],[603,721]],'Stair-side wall traced. Sloping handrail profile and height are inferred.'),'inferred')
 # Fixtures use actual plan rectangles. Furnishing choices are limited to shown cabinets/appliances.
 fixtures=[('kitchen-counter-back',[491,375,658,404],.91,'cabinet','ground'),('kitchen-counter-east',[635,404,658,499],.91,'cabinet','ground'),('kitchen-fridge',[624,507,660,542],1.80,'appliance','ground'),('stove',[532,377,570,410],.94,'appliance','ground'),('kitchen-sink',[627,447,654,480],.96,'fixture','ground'),('ground-shower',[718,683,756,723],.12,'fixture','ground'),('ground-wc',[681,686,704,720],.46,'fixture','ground'),('ground-basin',[713,784,756,806],.82,'fixture','ground'),('upper-bath-tub',[243,555,281,637],.55,'fixture','upper'),('upper-wc',[299,611,322,643],.46,'fixture','upper'),('upper-vanity',[334,616,368,645],.84,'cabinet','upper')]
 for id,r,h,mat,level in fixtures:
  y=0 if level=='ground' else 2.7432;b.rect('fixture-'+id,id.replace('-',' '),r,y+.01,y+h,mat=mat,level=level,page=5 if level=='ground' else 6,cat='fixture',state='inferred')
 mats={'wall':{'color':'#ece8dc','roughness':.86},'interior':{'color':'#f3efe5','roughness':.90},'trim':{'color':'#fcfaf3','roughness':.75},'siding-line':{'color':'#c6c5bc','roughness':.8},'roof':{'color':'#697b7b','roughness':.65,'metalness':.22},'roof-edge':{'color':'#b9c2bc','roughness':.6},'floor':{'color':'#cbb493','roughness':.85},'deck':{'color':'#bcb39a','roughness':.9},'tile':{'color':'#dedace','roughness':.75},'stairs':{'color':'#b69970','roughness':.8},'glass':{'color':'#89bdc8','opacity':.58,'roughness':.14},'shutter':{'color':'#405d54','roughness':.8},'shutter-edge':{'color':'#708276','roughness':.8},'door':{'color':'#dfdccd','roughness':.8},'stone':{'color':'#aaa69b','roughness':.95},'screen':{'color':'#667a70','opacity':.26,'roughness':.8},'cabinet':{'color':'#c2b28d','roughness':.8},'appliance':{'color':'#dededa','roughness':.5},'fixture':{'color':'#f7f6ef','roughness':.35}}
 allpos=[o['positions'] for o in b.parts];mn=[min(p[j] for p in allpos for j in range(i,len(p),3)) for i in range(3)];mx=[max(p[j] for p in allpos for j in range(i,len(p),3)) for i in range(3)]
 scene={'schema':'xray.source-building/v1','source':{'name':source.name,'sha256':sha,'pageCount':19,'title':"Caroline's Farmhouse",'author':'Jay Osborne / FreeFarmhouse','license':'CC BY-SA 4.0','licenseUrl':'https://creativecommons.org/licenses/by-sa/4.0/'},'units':'m','coordinateSystem':'+X drawing right; +Y up; +Z drawing down. Origin is page5(233,548), ground finished floor.','floorElevations':{'ground':0,'upper':2.7432},'bounds':{'min':mn,'max':mx},'materials':mats,'objects':b.parts,'sourceSheets':[{'page':n,'title':title,'role':role,'image':f'/models/caroline/source-page-{n}.png','width':1584,'height':1224} for n,title,role in [(4,'Foundation and roof plan','roof'),(5,'Downstairs plan','plan'),(6,'Upstairs plan','plan'),(7,'West and front elevations','elevation'),(8,'East and rear elevations','elevation'),(9,'Building sections','section'),(12,'Schedules and openings','detail'),(13,'Source design overview','rendering'),(14,'Source downstairs cutaway','rendering'),(15,'Source upstairs cutaway','rendering'),(16,'Source front perspective','rendering'),(17,'Source rear perspective','rendering'),(18,'Source section perspective','rendering')]],'assumptions':['Curated reconstruction of Caroline only, from the exact user-supplied PDF. This is not automatic PDF-to-BIM or verified construction geometry.','Author: Jay Osborne / FreeFarmhouse. Source license: Creative Commons Attribution-ShareAlike 4.0. This adapted model retains attribution and the same license.','Plans use 18 page points per foot (1/4 inch = 1 foot); main footprint is 24 x 16 feet. Coordinates are manually traced and rounded.','Plan trace endpoints have about one page-point tolerance (17 mm). The nominal 16-ft body depth traces as 287 points versus 288 points from its dimension; it is approximate, not an exact measured quantity.','Roof datum reconciliation: 7.5:12 pitch and the 5-ft 6-in ridge rise imply 17.6-ft total roof depth including overhang. This is 1.2 inches greater than the approximate 17-ft 6-in roof-plan label; section datums and stated pitch take precedence.','Second floor is +9 ft, main roof eave +17 ft 6 in, ridge +23 ft. Main roof pitch is 7.5:12 and lower roofs 3:12, taken from the source elevations and sections.','Materials, colours, shutter louver profiles, wall thickness, lower roof attachment elevation and foundation depth are approximate presentation choices.','Winder stair has the source 14 risers over 9 ft. Its tread polygons are curated from the plan; no clearance or building-code certification is implied.','The upper floor has a genuine stair opening and a raised closet platform over the lower stair flight, as shown in the source. Ground/upper controls expose both layouts.','Only the illustrated conditioned crawlspace/foundation option is represented. Alternate slab/basement details and other designs on page 19 are excluded.','The wraparound porch is unrailed as drawn; interior stair handrail detail is inferred. Only source-shown cabinets and fixtures are included.'],'summary':{'wallRuns':len(trace['walls']),'openings':sum(len(w['openings']) for w in trace['walls']),'roofFaces':sum(o['category']=='roof' for o in b.parts),'objects':len(b.parts),'floors':2,'visibleNamedRooms':8,'method':'source plan trace + dimensioned elevations + curated details','status':'source-bound-approximate'}}
 validate_scene(scene);return scene

def validate_scene(s):
 ids=set()
 for o in s['objects']:
  if o['id'] in ids:raise BuildingError('Duplicate id')
  ids.add(o['id']);p=o['positions'];idx=o['indices']
  if not p or len(p)%3 or not all(math.isfinite(v) for v in p):raise BuildingError('Invalid positions')
  if not idx or len(idx)%3 or not all(isinstance(v,int) and 0<=v<len(p)//3 for v in idx):raise BuildingError('Invalid indices')
  if o['level'] not in ['ground','upper','roof']:raise BuildingError('Invalid level')
  for r in o['sourceRefs']:
   if not 1<=r['page']<=18:raise BuildingError('Invalid source page or excluded design')
   if any(not 0<=x<=1584 or not 0<=z<=1224 for x,z in r['trace']):raise BuildingError('Source trace outside page')
   if r['evidenceState'] not in ['traced','dimensioned','inferred']:raise BuildingError('Missing evidence state')
 if s['source']['pageCount']!=19:raise BuildingError('Unexpected page count')

def main(argv=None):
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('source',type=Path);p.add_argument('--trace',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args(argv)
 s=build_scene(a.source,a.trace);a.out.parent.mkdir(parents=True,exist_ok=True);a.out.write_text(json.dumps(s,indent=2),encoding='utf8');print(json.dumps(s['summary']))
if __name__=='__main__':main()


