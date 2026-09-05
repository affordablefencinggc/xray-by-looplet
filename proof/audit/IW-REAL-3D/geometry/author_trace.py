"""Author curated points after visual PDF review; this is not an automatic extractor."""
import json,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[4]
source=root/'engine/fixtures/residential-ruffles-seeka.pdf'
t={'schema':'xray.curated-building-trace/v1','sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'pageSize':[1191,842],'calibration':{'page':13,'pointsPerMetre':28.57,'origin':[32,156],'evidence':'Approximate 6510mm garage overall dimension spans about186 page points; source says all dimensions approximate/TBC.'},'roofRegistration':{'page':16,'toFloorTranslation':[75,-112],'evidence':'Roof page15 overlaps page16 at translation[-266,-108]. Eaves registered against p13 exterior corners with approx450mm offset.'}}
t['footprint']=[[32,156],[566,156],[566,267],[803,267],[803,156],[956,156],[956,278],[940,278],[940,420],[684,420],[684,373],[559,373],[559,420],[538,420],[538,519],[218,519],[218,502],[32,502]]
# wall a,b in page13 points; opening bounds are fractions along wall, bottom/top metres
walls=[]
def wall(id,label,a,b,opens=[],thick=.23,kind='external'):
 walls.append({'id':id,'label':label,'a':a,'b':b,'openings':opens,'thickness':thick,'height':2.72,'kind':kind})
def op(id,start,end,bottom,top,kind='window'):return{'id':id,'start':start,'end':end,'bottom':bottom,'top':top,'kind':kind}
wall('north-media','Media north wall',[32,156],[218,156],[op('media-rear-door',.86,.99,0,2.1,'door')])
wall('north-existing','Existing dwelling rear wall',[218,156],[566,156])
wall('patio-west','Patio west return',[566,156],[566,267])
wall('patio-south','Patio inner wall',[566,267],[803,267],[op('patio-access',.31,.70,0,2.1,'door')])
wall('patio-east','Patio east return',[803,267],[803,156])
wall('north-east','East wing rear wall',[803,156],[956,156],[op('rear-wing-window',.30,.62,.9,2.1)])
wall('east-back','East wall beside enclosure',[956,156],[956,278],[op('enclosure-window',.27,.57,.95,2.1)])
wall('east-step','East wing step',[956,278],[940,278])
wall('east-front','East wing side wall',[940,278],[940,420])
wall('south-east','Front east wing',[940,420],[684,420])
wall('porch-east','Porch east return',[684,420],[684,373])
wall('porch-entry','Porch entrance wall',[684,373],[559,373],[op('entry-door',.35,.70,0,2.1,'door')])
wall('porch-west','Porch west return',[559,373],[559,420])
wall('front-step','Front step return',[559,420],[538,420])
wall('south-return','Front west return',[538,420],[538,519],[op('return-window',.25,.70,.9,2.1)])
wall('south-main','Front dwelling wall',[538,519],[218,519],[op('front-window-3',.045,.16,.4,2.15),op('front-window-2',.24,.355,.4,2.15),op('front-window-1',.44,.555,.4,2.15),op('bed-double-door',.72,.86,0,2.1,'door')])
wall('garage-step','Garage front step',[218,519],[218,502])
wall('garage-front','Garage panel lift door wall',[218,502],[32,502],[op('garage-lift',.06,.80,0,2.1,'garage-door')])
wall('west-garage','Garage side sliding doors',[32,502],[32,327],[op('garage-side-2',.07,.40,0,2.1,'door'),op('garage-side-1',.52,.85,0,2.1,'door')])
wall('west-media','Media side wall',[32,327],[32,156],[op('media-side-window',.66,.86,.85,2.1)])
# only partitions actually shown in p13
wall('media-divider','Media / garage partition',[32,327],[218,327],[op('media-cavity-slider',.77,.95,0,2.1,'door')],.09,'internal')
wall('media-return','Media internal return',[218,156],[218,263],[],.09,'internal')
wall('media-opening','Media doorway return',[218,263],[359,263],[op('media-internal-door',0,.17,0,2.1,'door')],.09,'internal')
wall('garage-east','Garage / storage divider',[218,327],[218,502],[],.09,'internal')
wall('bath-north','Bathroom north wall',[218,293],[313,293],[],.09,'internal')
wall('bath-west','Bathroom west wall',[218,293],[218,397],[],.09,'internal')
wall('wc-divider','WC partition',[218,340],[268,340],[op('wc-door',.62,1,0,2.04,'door')],.07,'internal')
wall('bath-east','Bathroom east wall',[313,293],[313,397],[op('bath-door',.20,.44,0,2.04,'door')],.09,'internal')
wall('bath-south','Bathroom / robe wall',[218,397],[313,397],[],.07,'internal')
wall('robe-south','Robe / bedroom wall',[218,414],[313,414],[],.07,'internal')
wall('linen-west','Linen compartment',[281,340],[281,397],[],.07,'internal')
wall('linen-divider','Linen / shower divider',[281,355],[313,355],[],.07,'internal')
wall('bedroom-east','Bedroom / dwelling partition',[341,293],[341,519],[op('bedroom-door',.51,.71,0,2.04,'door')],.09,'internal')
t['walls']=walls
# Roof graph copied from page16 and left extension from page15 shifted(-266,-108).
# Heights at graph junctions are inferred from labelled pitch/elevation; topology and XY are traced.
V={'A':[-56,255,2.72],'B':[515,255,2.72],'C':[891,255,2.72],'D':[891,562,2.72],'E':[620,562,2.72],'F':[620,610,2.72],'G':[490,610,2.72],'H':[490,662,2.72],'I':[127,662,2.72],'J':[127,645,2.72],'K':[-56,645,2.72], 'L':[-56,385,2.72],'M':[-230,385,2.72],'N':[-230,615,2.72],'O':[-56,615,2.72], 'r1':[138,450,5.55],'r2':[297,450,5.55],'q':[337,409,4.96],'q2':[362,409,4.96],'q3':[409,441,4.50],'q4':[462,496,3.69],'q5':[485,496,3.69], 's':[309,463,5.35],'s2':[309,565,4.13],'s3':[222,565,4.13],'s4':[399,565,4.13], 't1':[742,405,4.90],'t2':[701,441,4.37],'t3':[648,496,3.69],'t4':[620,496,3.69], 'p1':[536,441,4.48],'p2':[552,455,4.28],'p3':[568,441,4.48],'p4':[552,543,3.69], 'c1':[-115,500,4.39],'c2':[60,500,4.39]}
faces=[('main-north',['A','B','q2','q','r2','r1']),('main-west',['A','r1','K','L']),('main-south',['r1','r2','s','J','K']),('cross-west',['r2','q','s2','s3','I','J','s']),('cross-east',['q','E','H','s4','s2']),('cross-front-hip',['I','H','s4','s3']),('patio-west-hip',['B','q2','q3','q4','q5','p1']),('patio-south',['q3','p1','p2','p3','t2','t3','t4','q5','q4']),('rear-east-north',['B','C','t1','p3','p2','p1']),('east-hip',['C','D','t1']),('east-front',['D','E','t4','t3','t2','t1']),('porch-west',['p1','p2','p4','G','q5']),('porch-east',['p2','p3','t4','F','p4']),('porch-front',['G','F','p4']),('carport-west',['M','c1','N']),('carport-north',['M','L','r1','c2','c1']),('carport-south',['N','O','r1','c2','c1'])]
t['roofVertices']=V;t['roofFaces']=[{'id':a,'vertices':b} for a,b in faces]
t['rooms']=[{'label':'Media','region':[38,162,211,320]},{'label':'Garage','region':[39,334,212,495]},{'label':'WC','region':[222,297,265,337]},{'label':'Bath','region':[222,343,279,393]},{'label':'Linen','region':[285,343,309,355]},{'label':'Robe','region':[222,399,309,411]},{'label':'Bed 2','region':[224,416,336,513]},{'label':'Existing dwelling (layout undisclosed)','region':[347,275,533,511]}]
(root/'engine/fixtures/ruffles-source-trace.json').write_text(json.dumps(t,indent=2),encoding='utf8')
print('trace',len(walls),'walls',len(faces),'roof faces')
