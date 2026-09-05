"""Source-bound, curated Ruffles building reconstruction.

This deliberately does not classify arbitrary PDF drawing paths as walls. It
requires the reviewed trace for the exact source SHA-256. All geometry is a
presentation reconstruction; no takeoff quantities are produced.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
from pathlib import Path

SCHEMA = 'xray.source-building/v1'

class BuildingError(ValueError):
    pass

def triangulate(points):
    """Ear clipping for a simple planar source outline in drawing XY."""
    area = sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(points,points[1:]+points[:1]))
    order = list(range(len(points)))
    if area < 0: order.reverse()
    result=[]
    def cross(a,b,c): return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
    while len(order)>3:
        found=False
        for k,b in enumerate(order):
            a=order[k-1];c=order[(k+1)%len(order)]
            if cross(points[a],points[b],points[c])<=1e-7:continue
            def inside(p):return all(cross(points[x],points[y],p)>=-1e-7 for x,y in [(a,b),(b,c),(c,a)])
            if any(inside(points[j]) for j in order if j not in (a,b,c)):continue
            result.extend([a,c,b]);order.pop(k);found=True;break
        if not found:
            # Reject unclear/self-intersecting topology instead of silently fanning.
            raise BuildingError('Non-simple source polygon cannot be triangulated')
    result.extend([order[0],order[2],order[1]])
    return result


def build_scene(source: Path, trace_file: Path):
    with source.open('rb') as stream:
        captured=stream.read(30*1024*1024+1)
    if len(captured)>30*1024*1024:raise BuildingError('Source exceeds bounded input size')
    trace=json.loads(trace_file.read_text(encoding='utf-8-sig'))
    sha=hashlib.sha256(captured).hexdigest()
    if sha!=trace['sourceSha256']:raise BuildingError('Curated trace source SHA-256 mismatch')
    if trace.get('schema')!='xray.curated-building-trace/v1':raise BuildingError('Unsupported trace schema')
    scale=trace['calibration']['pointsPerMetre'];ox,oz=trace['calibration']['origin']
    objects=[]
    mats={'wall':{'color':'#e4ddcc','roughness':.88},'interior':{'color':'#f2eade','roughness':.9},'roof':{'color':'#8b9695','roughness':.75,'metalness':.14},'roof-edge':{'color':'#d7d8cc','roughness':.7},'floor':{'color':'#c8c4b7','roughness':.9},'tile':{'color':'#ddd3ba','roughness':.85},'glass':{'color':'#65a5b0','opacity':.58,'roughness':.2,'metalness':.15},'frame':{'color':'#ecece0','roughness':.6},'door':{'color':'#b7b8af','roughness':.8},'stone':{'color':'#a9a594','roughness':.95},'solar':{'color':'#213c56','roughness':.22,'metalness':.4},'fixture':{'color':'#f1eeeb','roughness':.4},'cabinet':{'color':'#b6aa90','roughness':.8},'steel':{'color':'#515e5a','roughness':.55,'metalness':.4},'fence':{'color':'#81948c','opacity':.28,'roughness':.7}}
    def xyz(p,y):return [(p[0]-ox)/scale,y,(p[1]-oz)/scale]
    def ref(page,points,state='traced',note='',dimension=None):
        xs=[p[0] for p in points];zs=[p[1] for p in points]
        r={'page':page,'region':[max(0,min(xs)-3),max(0,min(zs)-3),min(1191,max(xs)+3),min(842,max(zs)+3)],'trace':points,'evidenceState':state,'note':note}
        if dimension:r['dimension']=dimension
        return r
    def mesh(id,category,label,vertices,indices,material,refs,state='traced',note=''):
        objects.append({'id':id,'category':category,'label':label,'positions':[round(v,5) for p in vertices for v in p],'indices':indices,'material':material,'sourceRefs':refs,'evidenceState':state,'note':note})
    boxidx=[0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7]
    def beam(id,category,label,a,b,width,bottom,top,mat,refs,state='traced'):
        length=math.dist(a,b)
        if length<1e-7 or top<=bottom or width<=0:raise BuildingError('Invalid beam dimensions')
        nx=-(b[1]-a[1])/length*width*scale/2;nz=(b[0]-a[0])/length*width*scale/2
        ps=[[a[0]+nx,a[1]+nz],[b[0]+nx,b[1]+nz],[b[0]-nx,b[1]-nz],[a[0]-nx,a[1]-nz]]
        mesh(id,category,label,[xyz(p,y) for y in [bottom,top] for p in ps],boxidx,mat,refs,state)
    def slab(id,label,poly,bottom,top,mat='floor',page=13,category='slab',source_translation=(0,0)):
        inds=triangulate(poly);n=len(poly);idx=[]
        for i in range(0,len(inds),3):idx.extend(inds[i:i+3][::-1]);idx.extend([q+n for q in inds[i:i+3]])
        for i in range(n):j=(i+1)%n;idx.extend([i,j,j+n,i,j+n,i+n])
        source_poly=[[p[0]+source_translation[0],p[1]+source_translation[1]] for p in poly]
        mesh(id,category,label,[xyz(p,y) for y in [bottom,top] for p in poly],idx,mat,[ref(page,source_poly,note='Outline traced; slab thickness is presentation inference.')],'inferred')
    slab('main-slab','House footprint',trace['footprint'],-.18,0)
    for r in trace['rooms']:
        x1,z1,x2,z2=r['region'];slab('room-'+r['label'].split()[0].lower(),r['label'],[[x1,z1],[x2,z1],[x2,z2],[x1,z2]],.001,.015,'tile' if r['label'] in ['Bath','WC'] else 'floor',category='room')
    slab('carport-slab','Carport - 6000 x 6500 source bay',[[-139,288],[27,288],[27,474],[-139,474]],-.16,0,page=11,source_translation=(303,-108))
    slab('patio-slab','Patio',[[568,158],[800,158],[800,264],[568,264]],-.16,-.02,'tile')
    slab('porch-slab','Porch and front path',[[540,423],[559,423],[559,375],[683,375],[683,477],[658,477],[658,606],[218,606],[218,582],[589,582],[589,478],[540,478]],-.18,-.01,'tile')
    slab('cat-slab','Cat enclosure slab',[[959,156],[1043,156],[1043,279],[959,279]],-.15,-.02)
    for i in range(3):slab('front-stair-'+str(i),'Three front steps',[[218,568+i*8.5],[589,568+i*8.5],[589,576.5+i*8.5],[218,576.5+i*8.5]],-.505,-.1683*(2-i),'tile')
    opening_count=0
    for w in trace['walls']:
        a,b=w['a'],w['b'];h=w['height'];mat='interior' if w['kind']=='internal' else 'wall'
        refs=[ref(13,[a,b],note=w['label']+'; horizontal extent traced.'),ref(17,[[58,230],[88,310]],'dimensioned','Elevation ceiling height.',{'value':2.72,'unit':'m','text':'2720'})]
        def pos(t):return [a[j]+(b[j]-a[j])*t for j in range(2)]
        cursor=0
        for j,o in enumerate(sorted(w['openings'],key=lambda q:q['start'])):
            start,end=o['start'],o['end']
            if not 0<=cursor<=start<end<=1 or not 0<=o['bottom']<o['top']<=h:raise BuildingError('Invalid opening')
            if start>cursor:beam(w['id']+f'-solid-{j}','wall',w['label'],pos(cursor),pos(start),w['thickness'],0,h,mat,refs)
            if o['bottom']>0:beam(w['id']+f'-sillwall-{j}','wall',w['label'],pos(start),pos(end),w['thickness'],0,o['bottom'],mat,refs)
            if o['top']<h:beam(w['id']+f'-headwall-{j}','wall',w['label'],pos(start),pos(end),w['thickness'],o['top'],h,mat,refs)
            oa,ob=pos(start),pos(end);orefs=[ref(13,[oa,ob],note='Opening horizontal location traced; sill/head presentation height inferred from elevations. Internal door leaves shown in partly open position.')]
            kind=o['kind'];height=o['top']-o['bottom'];ln=math.dist(oa,ob);framefrac=.055*scale/ln
            for k,(s,e) in enumerate([(start,start+(end-start)*framefrac),(end-(end-start)*framefrac,end)]):beam(o['id']+'-jamb'+str(k),'trim',o['id']+' jamb',pos(s),pos(e),w['thickness']+.025,o['bottom'],o['top'],'frame',orefs,'inferred')
            beam(o['id']+'-head','trim',o['id']+' lintel',oa,ob,w['thickness']+.025,o['top']-.055,o['top'],'frame',orefs,'inferred')
            if kind=='window':
                beam(o['id'],'window',o['id'].replace('-',' '),oa,ob,.035,o['bottom']+.055,o['top']-.055,'glass',orefs,'inferred')
                beam(o['id']+'-sill','trim','Window sill',oa,ob,w['thickness']+.05,o['bottom'],o['bottom']+.06,'frame',orefs,'inferred')
                mid=(start+end)/2;d=.025*scale/math.dist(a,b)
                beam(o['id']+'-mullion','trim','Window mullion',pos(mid-d),pos(mid+d),.065,o['bottom'],o['top'],'frame',orefs,'inferred')
                beam(o['id']+'-transom','trim','Window transom',oa,ob,.065,o['bottom']+height*.48,o['bottom']+height*.48+.045,'frame',orefs,'inferred')
            elif kind=='garage-door':
                beam(o['id'],'door','Garage panel lift',oa,ob,.075,0,o['top'],'door',orefs,'inferred')
                for k in range(1,6):beam(o['id']+'-panel'+str(k),'trim','Garage door panel seam',oa,ob,.082,k*o['top']/6,k*o['top']/6+.014,'frame',orefs,'inferred')
            else:
                # A partly open leaf makes the opening itself visible; no wall triangles cross it.
                dx=(ob[0]-oa[0])*.64;dz=(ob[1]-oa[1])*.64
                leafend=[oa[0]+dx*.65-dz*.76,oa[1]+dx*.76+dz*.65]
                beam(o['id'],'door',o['id'].replace('-',' '),oa,leafend,.045,0,o['top']-.02,'door',orefs,'inferred')
            cursor=end;opening_count+=1
        if cursor<1:beam(w['id']+'-solid-last','wall',w['label'],pos(cursor),b,w['thickness'],0,h,mat,refs)
    # Continuous intersecting roof masses. Source drawing provides the plan and
    # approximate pitch, but no surveyed ridge elevations. Their junctions are
    # explicitly inferred, rather than turning conflicting traces into warped faces.
    rt=trace['roofRegistration']['toFloorTranslation']
    masses=[('main',[-56,255,515,645]),('east',[362,255,891,562]),
            ('front-cross',[127,409,490,662]),('porch',[485,441,620,610]),
            ('carport',[-230,385,138,615])]
    k=math.tan(math.radians(22.5))/scale
    def roof_height(x,z):
        found=[]
        for name,(left,top,right,bottom) in masses:
            if left-1e-7<=x<=right+1e-7 and top-1e-7<=z<=bottom+1e-7:
                values=[(x-left,'west'),(right-x,'east'),(z-top,'north'),(bottom-z,'south')]
                distance,side=min(values)
                found.append((2.72+max(0,distance)*k,name+'-'+side))
        return max(found) if found else (2.72,'edge')
    planes={}
    for name,(left,top,right,bottom) in masses:
        planes.update({name+'-west':(1,0,-left),name+'-east':(-1,0,right),
                       name+'-north':(0,1,-top),name+'-south':(0,-1,bottom)})
    def breaks(axis):
        return sorted({r[i] for _,r in masses for i in ([0,2] if axis==0 else [1,3])})
    def clip(poly,line,sign):
        result=[];a,b,c=line
        for p,q in zip(poly,poly[1:]+poly[:1]):
            dp=(a*p[0]+b*p[1]+c)*sign;dq=(a*q[0]+b*q[1]+c)*sign
            if dp>=-1e-8:result.append(p)
            if (dp>1e-8 and dq<-1e-8) or (dp<-1e-8 and dq>1e-8):
                f=dp/(dp-dq);result.append([p[j]+(q[j]-p[j])*f for j in range(2)])
        return result
    xs,zs=breaks(0),breaks(1);groups={}
    for x0,x1 in zip(xs,xs[1:]):
        for z0,z1 in zip(zs,zs[1:]):
            if not any(l<=(x0+x1)/2<=r and t<=(z0+z1)/2<=b for _,(l,t,r,b) in masses):continue
            raw=[[x0,z0],[x1,z0],[x1,z1],[x0,z1]]
            active=[name for name,(l,t,r,b) in masses if l<=(x0+x1)/2<=r and t<=(z0+z1)/2<=b]
            candidates=[v for name,v in planes.items() if any(name.startswith(n+'-') for n in active)]
            lines=set()
            for i,p in enumerate(candidates):
                for q in candidates[i+1:]:
                    line=tuple(p[j]-q[j] for j in range(3))
                    if line[:2]==(0,0):continue
                    values=[line[0]*x+line[1]*z+line[2] for x,z in raw]
                    if min(values)<-1e-7 and max(values)>1e-7:lines.add(line)
            polygons=[raw]
            for line in sorted(lines):
                refined=[]
                for poly in polygons:
                    vals=[line[0]*x+line[1]*z+line[2] for x,z in poly]
                    if min(vals)<-1e-7 and max(vals)>1e-7:
                        refined.extend([clip(poly,line,1),clip(poly,line,-1)])
                    else:refined.append(poly)
                polygons=refined
            for poly in polygons:
                cx=sum(p[0] for p in poly)/len(poly);cz=sum(p[1] for p in poly)/len(poly)
                _,key=roof_height(cx,cz);a,b,c=planes[key]
                g=groups.setdefault(key,{'v':[],'i':[],'points':[]});base=len(g['v'])
                g['v'].extend(xyz([x+rt[0],z+rt[1]],2.72+(a*x+b*z+c)*k) for x,z in poly)
                for j in range(1,len(poly)-1):
                    cross=(poly[j][0]-poly[0][0])*(poly[j+1][1]-poly[0][1])-(poly[j+1][0]-poly[0][0])*(poly[j][1]-poly[0][1])
                    if abs(cross)>1e-7:g['i'].extend([base,base+j+1,base+j])
                g['points'].extend(poly)
    for key,g in groups.items():
        # Bounded source regions point back to the actual page, including the west
        # extension which appears on page15 rather than negative page16 coordinates.
        ps=g['points'];page=15 if min(v[0] for v in ps)<0 else 16
        sourcepts=[[x+266,z+108] for x,z in ps] if page==15 else ps
        left=min(p[0] for p in sourcepts);top=min(p[1] for p in sourcepts)
        right=max(p[0] for p in sourcepts);bottom=max(p[1] for p in sourcepts)
        refs=[ref(page,[[left,top],[right,bottom]],'inferred',
                  'Source-bound roof mass extent; exact planar hip intersections inferred from approximate 22.5-degree pitch. Mass junctions are inferred, not surveyed.'),
              ref(18,[[80,28],[535,220]],'dimensioned','Approximate 22.5-degree pitch and 2.72 m ceiling.')]
        mesh('roof-'+key,'roof',key.replace('-',' ')+' roof plane',g['v'],g['i'],'roof',refs,'inferred')
    def slope_panel(id,label,raw,page,translation,yfunc,mat='roof',category='roof'):
        verts=[xyz([p[0]+translation[0],p[1]+translation[1]],yfunc(p)) for p in raw]
        if category in ('solar','skylight'):
            # Fit the module to the highest actual roof triangle under its centre.
            cx=sum(v[0] for v in verts)/len(verts);cz=sum(v[2] for v in verts)/len(verts)
            candidates=[]
            for ob in objects:
                if ob['category']!='roof':continue
                for j in range(0,len(ob['indices']),3):
                    q=[ob['positions'][i*3:i*3+3] for i in ob['indices'][j:j+3]]
                    a,b,c=q;det=(b[0]-a[0])*(c[2]-a[2])-(c[0]-a[0])*(b[2]-a[2])
                    if abs(det)<1e-8:continue
                    u=((cx-a[0])*(c[2]-a[2])-(c[0]-a[0])*(cz-a[2]))/det
                    v=((b[0]-a[0])*(cz-a[2])-(cx-a[0])*(b[2]-a[2]))/det
                    if u>=-1e-6 and v>=-1e-6 and u+v<=1+1e-6:
                        dx=((b[1]-a[1])*(c[2]-a[2])-(c[1]-a[1])*(b[2]-a[2]))/det
                        dz=((b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]))/det
                        offset=a[1]-dx*a[0]-dz*a[2]
                        candidates.append((dx*cx+dz*cz+offset,dx,dz,offset))
            if not candidates:raise BuildingError('Roof detail lacks underlying source roof: '+id)
            _,dx,dz,offset=max(candidates)
            verts=[[v[0],dx*v[0]+dz*v[2]+offset+.07,v[2]] for v in verts]
        mesh(id,category,label,verts,triangulate(raw),mat,[ref(page,raw,note='Source panel boundary traced; vertical placement approximated from elevation and stated pitch.')],'inferred')
    slope_panel('patio-flyover','Patio 6.9 degree flyover',[[475,255],[634,255],[634,409],[475,409]],16,rt,lambda p:3.23+(409-p[1])/scale*math.tan(math.radians(6.9)))
    slope_panel('cat-flyover','Cat enclosure 6.9 degree flyover',[[867,255],[998,255],[998,371],[867,371]],16,rt,lambda p:2.56+(998-p[0])/scale*math.tan(math.radians(6.9)))
    # Porch piers and carport posts shown in plan; 460mm piers raised to 2.2 m per markup.
    for i,(p,w,h) in enumerate([([580,466],.46,2.2),([663,466],.46,2.2),([-139,474],.46,2.2),([-139,288],.09,2.72),([686,156],.09,3.6),([1039,156],.09,2.56),([1039,278],.09,2.56)]):
        pp=[p[0]-w*scale/2,p[1]];qq=[p[0]+w*scale/2,p[1]]
        refs=[ref(11,[[160,180],[337,370]],note='Carport posts shown.') if p[0]<0 else ref(13,[p],note='Post location shown; marked porch piers 460 mm wide and 2.2 m high.')]
        beam('post-'+str(i),'column','Stone pier' if w==.46 else 'Roof support post',pp,qq,w,0,h,'stone' if w==.46 else 'steel',refs,'inferred')
        if w==.46:
            support_top=roof_height(p[0]-rt[0],p[1]-rt[1])[0]
            beam('post-extension-'+str(i),'column','Pier upper roof support',
                 [p[0]-.045*scale,p[1]],[p[0]+.045*scale,p[1]],.09,h,support_top,
                 'frame',refs,'inferred')
    for i,(a,b) in enumerate([([960,156],[1043,156]),([1043,156],[1043,279]),([1043,279],[960,279])]):
        refs=[ref(13,[a,b],note='Cat enclosure chain wire. Mesh cell size is schematic.')]
        beam('fence-'+str(i),'fence','Cat enclosure chain wire',a,b,.012,0,2.5,'fence',refs,'inferred')
        for k in range(1,8):
            p=[a[j]+(b[j]-a[j])*k/8 for j in range(2)]
            beam('fence-rod-'+str(i)+'-'+str(k),'fence','Wire fence upright',[p[0]-.08,p[1]],[p[0]+.08,p[1]],.009,0,2.5,'steel',refs,'inferred')
    # Actual drawn bath/cabinets/robe outlines, intentionally no invented furniture in undisclosed rooms.
    for id,label,rect,h,mat in [('tub','Bath tub',[223,343,246,391],.52,'fixture'),('vanity','Bathroom vanity',[255,344,278,388],.80,'cabinet'),('wc','WC pan',[229,301,240,323],.43,'fixture'),('basin','WC basin',[263,299,307,309],.85,'fixture'),('linen','Linen cabinet',[284,340,311,355],2.1,'cabinet'),('robe','Bedroom robe',[222,400,310,412],2.1,'cabinet'),('garage-storage','Garage storage',[202,334,215,496],2.1,'cabinet'),('fridge','Refrigerator recess',[203,298,216,323],1.85,'fixture')]:
        x1,z1,x2,z2=rect;slab('fixture-'+id,label,[[x1,z1],[x2,z1],[x2,z2],[x1,z2]],.02,h,mat,category='fixture')
    # Solar module positions follow the three explicit arrays on roof plans.
    arrays=[(15,[(-136,514),(-115,514),(-93,514),(-158,553),(-136,553),(-115,553)]),(16,[(323,475),(351,475),(379,524),(407,524),(323,524),(351,524)]),(16,[(788,404),(813,404),(788,440),(813,440),(813,349),(813,376)])]
    for g,(page,panels) in enumerate(arrays):
        for j,(x,z) in enumerate(panels):
            # first array coordinates already in common page16 frame
            raw=[[x,z],[x+21,z],[x+21,z+32],[x,z+32]]
            if g==0:y=lambda p:4.39-(p[1]-500)/scale*.4142+.08
            elif g==1:y=lambda p:5.20-(p[0]-309)/scale*.4142+.08
            else:y=lambda p:4.90-(p[0]-742)/scale*.4142+.08
            source_raw=[[p[0]+266,p[1]+108] for p in raw] if page==15 else raw
            trans=[rt[0]-266,rt[1]-108] if page==15 else rt
            func=(lambda p,base=y:base([p[0]-266,p[1]-108])) if page==15 else y
            slope_panel(f'solar-{g}-{j}','Source solar module',source_raw,page,trans,func,'solar','solar')
    for id,rect in [('north',[196,421,229,439]),('south',[190,478,202,504])]:
        x1,z1,x2,z2=rect
        slope_panel('skylight-'+id,'New Velux skylight',[[x1,z1],[x2,z1],[x2,z2],[x1,z2]],16,rt,lambda p:5.55-abs(p[1]-450)/scale*.4142+.07,'glass','skylight')
    positions=[o['positions'] for o in objects]
    mn=[min(p[k] for p in positions for k in range(d,len(p),3)) for d in range(3)]
    mx=[max(p[k] for p in positions for k in range(d,len(p),3)) for d in range(3)]
    scene={'schema':SCHEMA,'source':{'name':source.name,'sha256':sha,'pageCount':24},'units':'m','coordinateSystem':'+X drawing right; +Y up; +Z drawing down; origin p13(32,156)','bounds':{'min':mn,'max':mx},'materials':mats,'objects':objects,'assumptions':['Curated source reconstruction; not automated PDF-to-BIM, construction geometry or verified takeoff.','The supplied drawing is PRELIMINARY PLANS ONLY NOT FOR CONSTRUCTION; all dimensions are approximate and TBC by builder onsite.','Horizontal positions manually traced in displayed page points and calibrated approximately from p13 garage 6510 mm dimension.','Ceiling height 2.720 m is dimensioned. Roof topology traced from p15/p16; roof junction heights inferred from approximate 22.5-degree pitch and elevations. Continuous source-bound hip mass intersections are inferred; intersections clipped exactly to their competing roof planes.','Flyover pitches 6.9 degrees and elevation references 3.230 m / 2.560 m come from p18/p19; registration and edge thickness are approximate.','Openings follow visible plan and elevation locations. Undimensioned sill/head heights, frames, partly open leaves and fixture heights are inferred for presentation.','Source shows only Media/Garage/WC/Bath/Linen/Robe/Bed 2 partitions. The existing dwelling remainder is intentionally unpartitioned, exactly as disclosed by this renovation plan.','Existing rear openings require onsite confirmation. No unseen bedroom layout, structural framing, roof trusses, terrain or additional buildings are invented.'],'sourceSheets':[{'page':n,'title':title,'image':f'/models/ruffles/source-page-{n}.png','width':1191,'height':842,'role':role} for n,title,role in [(11,'Ground plan: carport and rooms','plan'),(13,'Ground plan: full dwelling','plan'),(15,'Roof plan: west','roof'),(16,'Roof plan: east','roof'),(17,'Front elevations','elevation'),(18,'Side elevations','elevation'),(19,'Rear elevation','elevation')]],'summary':{'wallRuns':len(trace['walls']),'openings':opening_count,'roofFaces':sum(o['category']=='roof' for o in objects),'objects':len(objects),'visibleNamedRooms':7,'method':'curated source trace + dimension-bound reconstruction','status':'preliminary-approximate'}}
    validate_scene(scene)
    return scene


def validate_scene(scene):
    if scene.get('schema')!=SCHEMA or scene.get('units')!='m':raise BuildingError('Invalid scene contract')
    ids=set()
    for o in scene['objects']:
        if o['id'] in ids:raise BuildingError('Duplicate object id')
        ids.add(o['id']);p=o['positions'];idx=o['indices']
        if not p or len(p)%3 or not all(isinstance(x,(int,float)) and math.isfinite(x) for x in p):raise BuildingError('Invalid mesh positions')
        if not idx or len(idx)%3 or not all(isinstance(x,int) and 0<=x<len(p)//3 for x in idx):raise BuildingError('Invalid mesh indices')
        if not o['sourceRefs'] or o['material'] not in scene['materials']:raise BuildingError('Missing source/material')
        for r in o['sourceRefs']:
            if not 1<=r['page']<=scene['source']['pageCount']:raise BuildingError('Invalid source page')
            l,t,rr,b=r['region']
            if not 0<=l<=rr<=1191 or not 0<=t<=b<=842:raise BuildingError('Invalid source region')
            if any(not 0<=p[0]<=1191 or not 0<=p[1]<=842 for p in r.get('trace',[])):raise BuildingError('Trace lies outside original source page')
    if len(ids)<100:raise BuildingError('Incomplete source reconstruction')


def main(argv=None):
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('source',type=Path);p.add_argument('--trace',type=Path,required=True);p.add_argument('--out',type=Path,required=True)
    a=p.parse_args(argv);scene=build_scene(a.source,a.trace);a.out.parent.mkdir(parents=True,exist_ok=True);a.out.write_text(json.dumps(scene,indent=2),encoding='utf8');print(json.dumps(scene['summary']))

if __name__=='__main__':main()


