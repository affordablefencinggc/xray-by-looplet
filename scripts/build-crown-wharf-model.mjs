// Reproducible REVIEW geometry from the Arup A4 drawing appendix. Never a BOM input.
// Trace coordinates below use a 1888 x 1334 review image frame. Horizontal scale is
// anchored to the written A-K / 09-01 grid dimension chains, not the printed scale.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as THREE from 'three';

const root = path.resolve('public/models/crown-wharf');
const source = 'artifacts/research/high-rise-structural-2026-09-06/crown-wharf-a4-structural.pdf';
const sha256 = crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex');
if (sha256 !== '32a99e7680a94f7690bc1639913563f279a3452bcb9f0dd4e4ef63997ab2639a') throw Error('Source changed; review traces before rebuilding.');
fs.mkdirSync(root, {recursive:true});
fs.copyFileSync(source, path.join(root, 'source.pdf'));
const pages = [27,28,29,30,31,32,33,34,35,36];
const titles = ['Ground level','Level 01','Level 02','Level 03','Levels 04–07','Levels 08–11','Levels 12–17','Levels 18–30','Level 31','Roof and lift overruns'];
const sheets = pages.map((page,i)=>{
  const bytes = fs.readFileSync(`screenshots/high-rise-sources/crown-wharf-a4-structural-page-${page}.png`);
  fs.writeFileSync(path.join(root,`source-page-${page}.png`),bytes);
  return {page,title:titles[i],image:`/models/crown-wharf/source-page-${page}.png`,width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),role:page===27?'ground':page===36?'roof':'structural floor plan'};
});
const xChain = [1695,5559,3891,4434,1961,4434,3891,5559,1695];
const zChain = [1695,2813,4110,3537,3537,4110,2813,1695];
const width = xChain.reduce((a,b)=>a+b,0)/1000;
const depth = zChain.reduce((a,b)=>a+b,0)/1000;
const point = ([x,z]) => [(x-454)*width/743-width/2,(z-358)*depth/546-depth/2];
const rect = (x,z,w,d)=>[[x,z],[x+w,z],[x+w,z+d],[x,z+d]];
const typicalOutline = [[454,478],[666,358],[1197,358],[1197,750],[1089,904],[454,904]];
const roofOutline = [[512,510],[674,414],[1145,414],[1145,726],[1057,846],[540,846],[540,727],[590,727],[590,611],[512,611]];
const coreOutline = [[705,542],[1031,542],[1031,643],[947,643],[947,723],[616,723],[616,622],[705,622]];
const voids = [rect(714,547,20,58),rect(746,547,36,58),rect(796,547,35,58),rect(845,547,36,58),rect(895,547,17,58),rect(710,667,59,47),rect(801,667,77,47)];
const balconies = [
  rect(686,288,74,70),rect(846,304,103,54),rect(1035,288,124,70),
  rect(1197,359,72,123),rect(360,480,94,103),rect(360,803,94,180),
  rect(502,904,200,60),rect(705,904,185,78),[[995,904],[1089,904],[1132,843],[1204,894],[1204,978],[995,978]],
];
// Approximate centers and orientation visually reviewed on p34. Sizes are the
// p34 schedule. Lower-level reuse is explicitly inferred, not checked continuity.
const columns = [
  ['CC15',689,370,0],['CC21',870,371,0],['CC17',975,371,0],['CC21',1045,371,0],['CC13',1132,371,0],
  ['CC4',677,486,90],['CC4',582,443,30],['CC4',662,384,30],['CC8',784,430,90],['CC11',875,489,90],['CC4',1118,486,90],
  ['CC8',1180,480,90],['CC13',1180,604,90],['CC6',1180,699,90],['CC4',1180,744,90],['CC4',1128,811,35],
  ['CC4',466,567,90],['CC11',466,637,90],['CC11',466,697,90],['CC8',466,744,90],
  ['CC11',525,887,0],['CC21',637,884,90],['CC17',712,844,90],['CC21',802,884,90],['CC8',914,884,0],['CC21',989,884,90],
  ['CC6',995,737,0],['CC11',1047,629,90],['CC21',593,630,90],['CC19',593,710,0],
];
const sizes = {CC4:[.75,.45],CC6:[1.05,.45],CC8:[1.1,.5],CC11:[1.2,.3],CC13:[1.2,.45],CC15:[1.35,.25],CC17:[1.4,.4],CC19:[1.6,.35],CC21:[1.75,.35]};
const pageFor = n=>n===0?27:n===1?28:n===2?29:n===3?30:n<=7?31:n<=11?32:n<=17?33:n<=30?34:35;
const elevationFor = n=>n===0?5.325:n===1?10.725:n===31?101.225:14.025+(n-2)*3;
const storeys = Array.from({length:32},(_,n)=>({id:n===0?'G':`L${String(n).padStart(2,'0')}`,label:n===0?'Ground':n===31?'Level 31':`Level ${String(n).padStart(2,'0')}`,elevation:elevationFor(n)}));
storeys.push({id:'RF',label:'Roof and lift overruns',elevation:104.6});
const objects=[];
const notes={
  placement:'Plan position and outline manually approximated against written grid dimensions. Drawing states “Do not scale”; this trace is for visual review only.',
  continuity:'Typical p34 column positions and sizes are repeated indicatively below level 18. Lower-storey changes, transfers and beam connections are not reconstructed; do not use this model for column counts or concrete quantities.',
};
function ref(page,region=[440,280,1290,995],note=notes.placement,dimension) {
  const sheet=sheets.find(s=>s.page===page);
  return {page,region:region.map((v,i)=>Math.round(v*(i%2?sheet.height/1334:sheet.width/1888))),evidenceState:'inferred',note,...(dimension?{dimension}:{} )};
}
function add(geometry, {id,label,category,storey,material,refs,note}) {
  const raw=geometry.getAttribute('position').array;
  const positions=Array.from(raw,v=>Math.round(v*100000)/100000);
  const indices=geometry.index?Array.from(geometry.index.array):Array.from({length:raw.length/3},(_,i)=>i);
  objects.push({id,label,category,storey,level:storey==='G'?'ground':storey==='RF'?'roof':'upper',positions,indices,material,sourceRefs:refs,evidenceState:'inferred',note:note??notes.placement});
  geometry.dispose();
}
function plate(outline,holes,y,thickness,meta) {
  const shape=new THREE.Shape(outline.map(p=>new THREE.Vector2(...point(p))));
  for(const h of holes)shape.holes.push(new THREE.Path(h.map(p=>new THREE.Vector2(...point(p)))));
  const g=new THREE.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:false,steps:1,curveSegments:1});
  const p=g.getAttribute('position');
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getY(i),h=p.getZ(i);p.setXYZ(i,x,y-h,z);}
  // Mapping (x,z,depth) to (x,-depth,z) preserves orientation.
  add(g,meta);
}
function box(x,z,w,d,y,h,rotation,meta) {
  const [px,pz]=point([x,z]);const g=new THREE.BoxGeometry(w,h,d);
  g.rotateY(-rotation*Math.PI/180);g.translate(px,y+h/2,pz);add(g,meta);
}
function wall(a,b,y,h,thickness,meta) {
  const p=point(a),q=point(b),len=Math.hypot(q[0]-p[0],q[1]-p[1]);
  const g=new THREE.BoxGeometry(len,h,thickness);g.rotateY(-Math.atan2(q[1]-p[1],q[0]-p[0]));g.translate((p[0]+q[0])/2,y+h/2,(p[1]+q[1])/2);add(g,meta);
}
for(let n=0;n<32;n++) {
  const s=storeys[n],next=storeys[n+1],page=pageFor(n),y=s.elevation,h=next.elevation-y-.25;
  const levelRef=ref(page,n>=4&&n<=30?[1430,55,1615,235]:[440,180,1290,1165],`Storey datum +${y.toFixed(3)} m. ${n===0?'Ground contains different slab levels; +5.325 m used for simplified platform.':n===1?'Main slab SSL +10.725 m; local recesses and roof terrace steps simplified.':n===31?'Uses SSL +101.225 m as a reference only; p35 has multiple slab levels and TOC +101.325 m.':n>=4?'Main-slab level schedule on this sheet.':'Main slab SSL annotation on this sheet.'}`,{value:y,unit:'m',text:`${s.label}: +${y.toFixed(3)} m`});
  // Ground outline differs substantially from typical floors. Trace p27 is
  // translated into the common A/09 frame; its multiple levels are flattened.
  const groundOutline=[[450,428],[795,229],[1040,279],[1025,354],[1073,369],[1073,402],[999,402],[999,478],[1122,478],[1122,520],[1030,520],[1030,682],[1122,682],[1122,793],[1040,897],[1082,926],[1007,1044],[734,1044],[734,1160],[450,1160]].map(([x,z])=>[x+12,z-30]);
  const outline=n===0?groundOutline:typicalOutline;
  plate(outline,voids,y,n<=1?.3:.25,{id:`${s.id}-slab`,label:`${s.label} • simplified RC slab`,category:'slab',storey:s.id,material:n===31?'roof':'slab',refs:[ref(page),levelRef],note:'Gross simplified floor plate with indicative lift and stair voids. Local depressions, openings, transfer zones and variable thickness are omitted. Not a net concrete volume.'});
  if(n===1){
    const terraces=[[[454,414],[818,203],[1132,272],[1132,358],[666,358],[454,478]],[[502,904],[1089,904],[1012,1011],[620,1011]]];
    terraces.forEach((p,i)=>plate(p,[],10.525,.3,{id:`L01-terrace-${i}`,label:'Level 01 • approximate terrace',category:'slab',storey:s.id,material:'roof',refs:[ref(28)],note:'Terrace outline approximated from p28, SSL +10.525 m. Detailed offsets omitted.'}));
  }
  if(n>=2&&n<=30)balconies.forEach((p,i)=>plate(p,[],y-.075,.175,{id:`${s.id}-balcony-${i}`,label:`${s.label} • indicative balcony ${i+1}`,category:'slab',storey:s.id,material:'balcony',refs:[ref(page)],note:'Approximate balcony projection. Typical 175 mm slab and main-level minus 75 mm offset. Thermal breaks, reinforcement and edge upstands omitted.'}));
  columns.forEach(([type,x,z,rotation],i)=>{
    const [w,d]=sizes[type];
    box(x,z,w,d,y,h,rotation,{id:`${s.id}-column-${i}`,label:`${s.label} • indicative ${type} column`,category:'column',storey:s.id,material:'column',refs:[ref(34,[100,105,286,566],`${type}: ${w*1000} × ${d*1000} mm per p34 schedule; location approximated on p34.`,{value:w*1000,unit:'mm',text:`${type} ${w*1000} × ${d*1000} RC column`}),ref(34),levelRef],note:n<18?notes.continuity:n>30?'Typical columns provisionally continued into level 31; upper transfers and plinths are not reconstructed.':notes.placement});
  });
  coreOutline.forEach((p,i)=>wall(p,coreOutline[(i+1)%coreOutline.length],y,h,.25,{id:`${s.id}-core-${i}`,label:`${s.label} • approximate core wall`,category:'wall',storey:s.id,material:'core',refs:[ref(page,[610,530,1040,735]),levelRef],note:'Core outline simplified from the typical layout; W1 250 mm adopted at perimeter. Doorways, coupling beams and wall-thickness transitions omitted.'}));
  voids.slice(0,5).forEach((p,j)=>p.forEach((a,i)=>wall(a,p[(i+1)%p.length],y,h,.4,{id:`${s.id}-shaft-${j}-${i}`,label:`${s.label} • indicative lift-shaft wall`,category:'wall',storey:s.id,material:'shaft',refs:[ref(34,[700,535,925,620]),levelRef],note:'Indicative W3 400 mm lift enclosure. No lift equipment, openings or reinforcement quantities represented.'})));
}
plate(roofOutline,[],104.6,.25,{id:'RF-main',label:'Roof • RC slab at SSL +104.600 m',category:'roof',storey:'RF',material:'roof',refs:[ref(36,[510,410,1150,855],notes.placement,{value:104.6,unit:'m',text:'SSL +104.600 m; 250 mm thk RC slab'})]});
roofOutline.forEach((p,i)=>wall(p,roofOutline[(i+1)%roofOutline.length],104.6,1.45,.3,{id:`RF-parapet-${i}`,label:'Roof • indicative perimeter upstand',category:'roof-trim',storey:'RF',material:'core',refs:[ref(36)],note:'Simplified roof perimeter to TOU +106.050 m. Local UP2 / UP6 / UP12 variations and terminations are not represented.'}));
for(const [name,p,top] of [['north',rect(705,540,213,74),106.75],['south',rect(790,650,128,74),107.78]]){
  p.forEach((a,i)=>wall(a,p[(i+1)%p.length],104.6,top-104.6,.25,{id:`RF-overrun-${name}-${i}`,label:`Lift overrun ${name} • approximate wall`,category:'wall',storey:'RF',material:'shaft',refs:[ref(36)],note:'Approximate position from roof inset; lift overrun geometry requires architectural/detail coordination.'}));
  plate(p,[],top,.3,{id:`RF-cap-${name}`,label:`Lift overrun ${name} • slab +${top.toFixed(3)} m`,category:'roof',storey:'RF',material:'roof',refs:[ref(36,[700,1020,955,1270],`Lift overrun cap SSL +${top.toFixed(3)} m, 300 mm slab.`)]});
  const parapetTop=name==='south'?108.69:108.68;
  p.forEach((a,i)=>wall(a,p[(i+1)%p.length],top,parapetTop-top,.25,{id:`RF-cap-upstand-${name}-${i}`,label:`Lift overrun ${name} • indicative upstand`,category:'roof-trim',storey:'RF',material:'core',refs:[ref(36,[700,1020,955,1270])],note:'Uniform upstand simplification; source has stepped top-of-upstand levels.'}));
}
const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
for(const o of objects)for(let i=0;i<o.positions.length;i++){min[i%3]=Math.min(min[i%3],o.positions[i]);max[i%3]=Math.max(max[i%3],o.positions[i]);}
const assumptions=[
  'Crown Wharf Canning Town Block A4, reconstructed from the Arup structural appendix (PDF pages 27–36). This is not Altitude, a BIM import or an as-built model.',
  'Review visualization only. Written grid chains establish the plan scale; manually traced positions remain approximate. Source drawings say “Do not scale”. Do not derive construction dimensions or procurement quantities from these meshes.',
  'Ground +5.325 m, level 01 +10.725 m, levels 02–30 +14.025 through +98.025 m; typical spacing 3 m. Level 31 reference +101.225 m with stepped slab simplified. Main roof +104.600 m; lift caps +106.750 and +107.780 m; highest indicative upstand +108.690 m. These are drawing elevations, not building height above sea level inferred from images.',
  'Ground and level 01 terraces are simplified; lower ground, foundations, pile caps, beams, stairs, reinforcement, facade, glazing, fitout and MEP are omitted. Ground platform is flattened despite multiple documented levels.',
  notes.continuity,
  'Upper column centers and rotations are approximate. Core walls, shaft enclosures and balcony projections are simplified. Door openings and local slab steps are omitted; this geometry is not suitable for concrete volume calculations.',
  'Colors distinguish model categories; they are not specified finishes. Mesh totals are rendering parts, not unique physical components or stock quantities. No nuts, bolts, anchors, mass or storage volume is asserted.',
  'Drawing status S5 Suitable for Stage Approval. Revision tables include Construction Issue. Verify current coordinated drawings before engineering use.',
];
const scene={schema:'xray.source-building/v1',source:{name:path.basename(source),sha256,pageCount:36,title:'Crown Wharf Canning Town — Block A4 structural review model',author:'Source drawings: Arup for Barratt East London'},units:'m',coordinateSystem:'Y up, drawing elevation datum retained; X follows A4 A→K, Z follows 09→01. Written grid dimensions anchor an approximate plan trace.',bounds:{min,max},floorElevations:{ground:5.325,upper:10.725},storeys,materials:{slab:{color:'#dadfdc',roughness:.82},column:{color:'#577f89',roughness:.62},core:{color:'#b5a180',roughness:.75},shaft:{color:'#668e97',roughness:.7},balcony:{color:'#acc7ce',roughness:.72},roof:{color:'#809c91',roughness:.86}},objects,assumptions,sourceSheets:sheets,summary:{floors:32,wallRuns:objects.filter(o=>o.category==='wall').length,openings:0,roofFaces:objects.filter(o=>o.category==='roof').length,objects:objects.length,visibleNamedRooms:0,method:'Written floor elevations and grid dimensions; manually approximated structural geometry with source references.',status:'Approximate structural review model'}};
fs.writeFileSync(path.join(root,'source-building.json'),JSON.stringify(scene));
fs.writeFileSync(path.join(root,'README.md'),`# Crown Wharf A4 structural review model\n\nRegenerate: node scripts/build-crown-wharf-model.mjs\n\nSource: https://docs.planning.org.uk/20260225/208/TAEHTIJYHRL00/qkrdx8m88c4v5zqq.pdf\nSHA-256: ${sha256}\n\n${assumptions.map(a=>'- '+a).join('\n')}\n\n${objects.length} render meshes; 32 ground/numbered floor references plus roof. Original document ownership remains with its authors. Source provided for local project review, no redistribution licence asserted.\n`);
console.log(JSON.stringify({objects:objects.length,storeys:storeys.length,bounds:{min,max},grid:{width,depth},sha256}));
