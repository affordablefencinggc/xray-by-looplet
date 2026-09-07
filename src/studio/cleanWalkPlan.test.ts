import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import * as THREE from "three";
import { buildCleanWalkPlan, sectionContours } from "./cleanWalkPlan.ts";
import { parseSourceBuilding, type BuildingPart } from "./sourceBuilding.ts";
import { recommendWalkStarts } from "./walkStartPlacement.ts";
const model=parseSourceBuilding(JSON.parse(fs.readFileSync(new URL("../../public/models/redburn/source-building.json",import.meta.url),"utf8")));
function composite(boxes:[number,number,number,number,number,number][]):BuildingPart {
  const positions:number[]=[],indices:number[]=[];
  for(const [x,y,z,sx,sy,sz] of boxes) {const g=new THREE.BoxGeometry(sx,sy,sz);g.translate(x,y,z);const offset=positions.length/3;positions.push(...g.attributes.position.array);indices.push(...[...g.index!.array].map(i=>i+offset));g.dispose();}
  return {...model.objects[0],id:"doorway-wall",category:"wall",level:"ground",positions,indices};
}
function inside(point:number[],loop:number[][]) {let result=false;for(let i=0,j=loop.length-1;i<loop.length;j=i++) {const a=loop[i],b=loop[j];if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])result=!result;}return result;}
test("wall sections preserve a real doorway void while its overhead lintel remains excluded",()=>{
  const part=composite([[-1.25,1.5,0,1.5,3,.2],[1.25,1.5,0,1.5,3,.2],[0,2.6,0,1, .8,.2]]), loops=sectionContours(part,1);
  assert.equal(loops.length,2);assert.equal(loops.some(l=>inside([0,0],l)),false);assert.equal(loops.some(l=>inside([-1,0],l)),true);
  assert.ok(loops.flat().every(p=>Math.abs(p[1])<=.10001));
  assert.equal(sectionContours(part,2.7).some(l=>inside([0,0],l)),true,"upper cut encounters the actual lintel");
});
test("clean plans retain true Redburn floor/start coordinates and stairs while omitting decorative triangles",()=>{
  const original=JSON.stringify(model);
  for(const floor of ["ground","upper"]) {
    const plan=buildCleanWalkPlan(model,floor), starts=recommendWalkStarts(model,floor);
    assert.ok(plan.shapes.some(s=>s.kind==="wall"));assert.ok(plan.shapes.some(s=>s.kind==="floor"));assert.ok(plan.labels.length>=3);
    const detailIds=new Set(model.objects.filter(p=>["fixture","roof","fence","solar"].includes(p.category)).map(p=>p.id));
    assert.ok(plan.shapes.every(s=>!detailIds.has(s.id)));
    for(const start of starts) {assert.ok(start.x>=plan.bounds[0]&&start.x<=plan.bounds[2]&&start.z>=plan.bounds[1]&&start.z<=plan.bounds[3]);assert.ok(plan.shapes.filter(s=>s.kind==="floor").some(s=>s.loops.some(l=>inside([start.x,start.z],l))),`actual start ${start.label} remains on drawn floor`);}
  }
  assert.equal(buildCleanWalkPlan(model,"ground").shapes.find(s=>s.id==="external-stairs")?.loops.length,18);
  assert.equal(JSON.stringify(model),original);
});
test("missing floors and invalid triangle coordinates do not create artificial plan geometry",()=>{
  assert.equal(buildCleanWalkPlan(model,"missing").shapes.length,0);
  const broken={...model.objects[0],positions:[NaN,0,0],indices:[0,1,2]};assert.deepEqual(sectionContours(broken,1),[]);
});
