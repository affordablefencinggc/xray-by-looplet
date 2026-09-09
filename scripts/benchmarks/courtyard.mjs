// AB-01 independent oracle: no imports from the product geometry implementation.
// Dimensions are synthetic benchmark requirements, never construction evidence.
export const footprint = [[0,0],[6000,0],[6000,12000],[18000,12000],[18000,0],[24000,0],[24000,18000],[0,18000]];
const close = (a,b,tolerance=1) => Math.abs(a-b)<=tolerance;
const pointEqual = (a,b) => close(a[0],b[0])&&close(a[1],b[1]);
const area = points => Math.abs(points.reduce((sum,a,i)=>{const b=points[(i+1)%points.length];return sum+a[0]*b[1]-b[0]*a[1];},0))/2;
const inside = (point,ring) => {
  let odd=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const a=ring[i],b=ring[j];
    if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])odd=!odd;
  }
  return odd;
};
const bounds = points => ({minX:Math.min(...points.map(p=>p[0])),maxX:Math.max(...points.map(p=>p[0])),minY:Math.min(...points.map(p=>p[1])),maxY:Math.max(...points.map(p=>p[1]))});
// Exact cell integration for this orthogonal benchmark. Also detects duplicate coverage.
function coverage(polygons,target=footprint) {
  const all=[target,...polygons];
  const xs=[...new Set(all.flatMap(p=>p.map(v=>v[0])))].sort((a,b)=>a-b);
  const ys=[...new Set(all.flatMap(p=>p.map(v=>v[1])))].sort((a,b)=>a-b);
  let covered=0,outside=0,overlap=0;const gaps=[];
  for(let i=1;i<xs.length;i++)for(let j=1;j<ys.length;j++) {
    const x=(xs[i]+xs[i-1])/2,y=(ys[j]+ys[j-1])/2,a=(xs[i]-xs[i-1])*(ys[j]-ys[j-1]);
    const n=polygons.filter(p=>inside([x,y],p)).length,inTarget=inside([x,y],target);
    if(n&&inTarget)covered+=a;if(n&&!inTarget)outside+=a;if(n>1)overlap+=a;
    if(!n&&inTarget)gaps.push({a,points:[[xs[i-1],ys[j-1]],[xs[i],ys[j]]]});
  }
  return {covered,outside,overlap,gaps,gapArea:gaps.reduce((s,g)=>s+g.a,0)};
}
export function inspectCourtyard(p, {stage=1,scene}={}) {
  const checks=[];
  const check=(id,pass,actual,expected)=>checks.push({id,pass:!!pass,actual,expected});
  const levels=[...(p.levels||[])].sort((a,b)=>a.elevation-b.elevation);
  check('units',p.units==='mm',p.units,'mm');
  check('levels',levels.length===2&&close(levels[0].elevation,0)&&close(levels[1].elevation,3600)&&levels.every(l=>close(l.height,3600)),levels.map(l=>[l.elevation,l.height]),[[0,3600],[3600,3600]]);
  const ids=[...(p.walls||[]),...(p.slabs||[]),...(p.openings||[]),...(p.roofs||[])].map(v=>v.id);
  check('unique-entity-ids',ids.length===new Set(ids).size,ids.length,'all unique');
  for(const [index,l] of levels.entries()) {
    const walls=(p.walls||[]).filter(w=>w.levelId===l.id);
    const matched=footprint.filter((a,i)=>walls.some(w=>(pointEqual(w.a,a)&&pointEqual(w.b,footprint[(i+1)%8]))||(pointEqual(w.b,a)&&pointEqual(w.a,footprint[(i+1)%8])))).length;
    check(`level-${index}-boundary`,walls.length===8&&matched===8,{walls:walls.length,matched},'8 exact U-shaped boundary segments');
    check(`level-${index}-wall-heights`,walls.length>0&&walls.every(w=>close(w.height,3600)),walls.map(w=>w.height),3600);
  }
  const elevation=s=>(levels.find(l=>l.id===s.levelId)?.elevation??NaN)+s.offset;
  const floorAt=z=>(p.slabs||[]).filter(s=>close(elevation(s),z)&&close(s.thickness,250));
  check('orthogonal-floors',p.slabs.every(s=>s.points.every((a,i)=>{const b=s.points[(i+1)%s.points.length];return close(a[0],b[0])||close(a[1],b[1]);})),p.slabs.length,'axis-aligned polygons for exact cell integration');
  const ground=coverage(floorAt(0).map(s=>s.points)),upper=coverage(floorAt(3600).map(s=>s.points));
  check('ground-floor-union',close(ground.covered,288e6)&&ground.outside===0&&ground.overlap===0,{areaM2:ground.covered/1e6,outsideM2:ground.outside/1e6,overlapM2:ground.overlap/1e6},'288 m2 without overlaps or courtyard coverage');
  const gapBounds=upper.gaps.length?bounds(upper.gaps.flatMap(g=>g.points)):null;
  check('upper-floor-union',close(upper.covered,279.36e6)&&upper.outside===0&&upper.overlap===0,{areaM2:upper.covered/1e6,outsideM2:upper.outside/1e6,overlapM2:upper.overlap/1e6},'279.36 m2 without overlaps or courtyard coverage');
  check('stairwell-void',gapBounds&&close(upper.gapArea,8.64e6)&&close(gapBounds.maxX-gapBounds.minX,1200)&&close(gapBounds.maxY-gapBounds.minY,7200)&&gapBounds.minX>0&&gapBounds.maxX<6000&&gapBounds.minY>0&&gapBounds.maxY<18000,{gapAreaM2:upper.gapArea/1e6,bounds:gapBounds},'1.2 x 7.2 m rectangle wholly inside west wing');
  const roofCoverage=coverage((p.roofs||[]).map(r=>r.points));
  check('roof-footprint',close(roofCoverage.covered,288e6)&&roofCoverage.outside===0&&roofCoverage.overlap===0,{areaM2:roofCoverage.covered/1e6,outsideM2:roofCoverage.outside/1e6},'288 m2 U-shaped roof; courtyard open');
  check('flat-roof',p.roofs?.length>0&&p.roofs.every(r=>r.edges.every(e=>e.pitch===0)&&r.eaves===0),p.roofs?.map(r=>({eaves:r.eaves,pitches:r.edges.map(e=>e.pitch)})),'zero pitch and eaves');
  check('roof-datum',p.roofs.length>0&&p.roofs.every(r=>close((levels.find(l=>l.id===r.levelId)?.elevation??NaN)+r.offset,7200)),p.roofs.map(r=>(levels.find(l=>l.id===r.levelId)?.elevation??NaN)+r.offset),'roof plane at 7200 mm');
  if(stage===2) {
    const doors=p.openings.filter(o=>o.kind==='door'),windows=p.openings.filter(o=>o.kind==='window');
    check('doors',doors.length===6&&doors.every(o=>close(o.width,1200)&&close(o.height,2400)),doors.map(o=>[o.width,o.height]),'6 doors, 1200 x 2400 mm');
    check('windows',windows.length===12&&windows.every(o=>close(o.width,1800)&&close(o.height,1500)&&close(o.sill,900)),windows.map(o=>[o.width,o.height,o.sill]),'12 windows, 1800 x 1500 mm, sill 900 mm');
    let validHosts=true,clashes=0;
    for(const o of p.openings) {
      const w=p.walls.find(w=>w.id===o.wallId);if(!w){validHosts=false;continue;}
      const length=Math.hypot(w.b[0]-w.a[0],w.b[1]-w.a[1]);
      if(o.offset-o.width/2<0||o.offset+o.width/2>length||o.sill+o.height>w.height)validHosts=false;
      for(const other of p.openings)if(other.id>o.id&&other.wallId===o.wallId&&Math.min(o.offset+o.width/2,other.offset+other.width/2)>Math.max(o.offset-o.width/2,other.offset-other.width/2)&&Math.min(o.sill+o.height,other.sill+other.height)>Math.max(o.sill,other.sill))clashes++;
    }
    check('opening-hosts',validHosts&&clashes===0,{validHosts,clashes},'all openings within hosts, no opening overlaps');
    const treads=p.slabs.filter(s=>close(area(s.points),.36e6)&&elevation(s)>0&&elevation(s)<3600).sort((a,b)=>elevation(a)-elevation(b));
    check('stair-treads',treads.length===23&&treads.every((s,i)=>close(elevation(s),(i+1)*150)&&close(s.thickness,50)),treads.map(s=>({top:elevation(s),thickness:s.thickness})),'23 treads, 150 mm rise, 50 mm thick');
    const treadBounds=treads.map(s=>bounds(s.points));
    check('stair-run',gapBounds&&treadBounds.length===23&&treadBounds.every((b,i)=>close(b.maxX-b.minX,1200)&&close(b.maxY-b.minY,300)&&b.minX>=gapBounds.minX&&b.maxX<=gapBounds.maxX&&b.minY>=gapBounds.minY&&b.maxY<=gapBounds.maxY&&(i===0||close(Math.abs(b.minY-treadBounds[i-1].minY),300))),treadBounds,'continuous 1200 mm wide, 300 mm deep treads inside stairwell');
    const last=treadBounds.at(-1);
    const direction=treadBounds.length>1?Math.sign(last.minY-treadBounds[0].minY):0;
    check('stair-landing',last&&gapBounds&&(direction>0?close(last.maxY,gapBounds.maxY):direction<0&&close(last.minY,gapBounds.minY)),last,'last tread meets the upper floor without a plan gap');
    const pond=p.slabs.filter(s=>close(area(s.points),18e6)&&close(elevation(s),-100));
    check('pond',pond.length===1&&close(bounds(pond[0].points).maxX-bounds(pond[0].points).minX,6000)&&close(bounds(pond[0].points).maxY-bounds(pond[0].points).minY,3000)&&pond[0].points.every(([x,y])=>x>=6000&&x<=18000&&y>=0&&y<=12000),pond.map(s=>({name:s.name,areaM2:area(s.points)/1e6})),'one 6 x 3 m pond inside courtyard, top -100 mm');
    const planters=p.slabs.filter(s=>close(area(s.points),4e6)&&close(elevation(s),600));
    check('planters',planters.length===2&&planters.every(s=>close(bounds(s.points).maxX-bounds(s.points).minX,4000)&&close(bounds(s.points).maxY-bounds(s.points).minY,1000)&&s.points.every(([x,y])=>x>=6000&&x<=18000&&y>=0&&y<=12000)),planters.map(s=>s.name),'two 4 x 1 m planters inside courtyard, top 600 mm');
    const site=p.slabs.filter(s=>close(area(s.points),832e6)&&close(elevation(s),-300));
    check('site',site.length===1&&JSON.stringify(bounds(site[0].points))===JSON.stringify({minX:-4000,maxX:28000,minY:-4000,maxY:22000}),site.map(s=>bounds(s.points)),'32 x 26 m site with 4 m margin, top -300 mm');
    const landscape=[...pond,...planters], overlaps=landscape.some((s,i)=>landscape.slice(i+1).some(t=>{const a=bounds(s.points),b=bounds(t.points);return Math.min(a.maxX,b.maxX)>Math.max(a.minX,b.minX)&&Math.min(a.maxY,b.maxY)>Math.max(a.minY,b.minY);}));
    check('landscape-separation',landscape.length===3&&!overlaps,{surfaces:landscape.length,overlaps},'pond and two planters do not overlap');
    if(scene) {
      const appearances=[...pond,...planters].map(s=>scene.objects.find(part=>part.id===`slab-${s.id}`)?.material);
      check('landscape-render-materials',appearances.length===3&&appearances.every(m=>m&&m!=='slab')&&new Set(appearances).size>=2,appearances,'water and planting have distinct rendered materials');
    }
  }
  return {benchmark:'AB-01',stage,projectId:p.id,revision:p.revision,passed:checks.filter(c=>c.pass).length,total:checks.length,checks,stairwell:gapBounds};
}
