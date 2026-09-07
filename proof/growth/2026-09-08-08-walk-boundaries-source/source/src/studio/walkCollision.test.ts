import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import * as THREE from "three";
import { createWalkCollisionWorld } from "./walkCollision.ts";
const v = (x=0,y=0,z=0) => new THREE.Vector3(x,y,z);
const box = (x:number,y:number,z:number,sx:number,sy:number,sz:number) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz)); mesh.position.set(x,y,z); return mesh;
};
const floor = () => box(0,-.1,0,30,.2,30);
const world = (solids:THREE.Mesh[], supports:THREE.Mesh[] = [solids[0]]) => createWalkCollisionWorld({solids:()=>solids,supports:()=>supports});
test("thin walls stop large movement; tangential movement slides and corners stay solid",()=>{
  const f=floor(), wall=box(0,1.5,0,.02,3,20), end=box(-2,1.5,3,4,3,.02), w=world([f,wall,end]);
  const start=v(-2,0,0), displacement=v(50,0,0), result=w.move(start,displacement);
  assert.ok(result.blocked); assert.ok(result.position.x<=-.277); assert.ok(result.position.x>-.4);
  assert.deepEqual(start,v(-2,0,0)); assert.deepEqual(displacement,v(50,0,0));
  const slide=w.move(v(-1,0,0),v(2,0,2)); assert.ok(slide.position.z>1.9); assert.ok(slide.position.x<=-.277);
  const corner=w.move(v(-1,0,0),v(3,0,5)); assert.ok(corner.position.z<=2.723); assert.ok(corner.position.x<=-.277);
});
test("real opening width and transformed swinging door determine passage; transparent windows remain solid",()=>{
  const f=floor(), left=box(-2.2,1.5,0,3.6,3,.15), right=box(2.2,1.5,0,3.6,3,.15);
  const hinge=new THREE.Group(); hinge.position.x=-.4;
  const door=box(.4,1,0,.8,2,.05); hinge.add(door);
  const meshes=[f,left,right,door], w=world(meshes);
  assert.ok(w.move(v(0,0,1),v(0,0,-2)).position.z>.29);
  hinge.rotation.y=Math.PI/2;
  assert.ok(w.move(v(0,0,1),v(0,0,-2)).position.z<-.99,"rotating parent invalidates door cache");
  right.position.x=1.9; assert.ok(w.move(v(0,0,1),v(0,0,-2)).blocked,"opening narrower than capsule");
  right.position.x=2.2; meshes.pop();
  const window=box(0,1,0,.8,2,.01); window.material=new THREE.MeshBasicMaterial({transparent:true,opacity:0}); window.visible=false; meshes.push(window);
  assert.ok(w.move(v(0,0,1),v(0,0,-2)).position.z>.27);
});
test("head clearance, thick solid interiors and unsupported edges reject walking",()=>{
  const f=floor(), ceiling=box(0,1.75,0,4,.1,4), w=world([f,ceiling]);
  assert.equal(w.validStart(v()),false); ceiling.position.y=1.9; assert.equal(w.validStart(v()),true);
  const solid=box(0,2,0,5,4,5), enclosed=world([f,solid]); assert.equal(enclosed.validStart(v()),false); assert.ok(enclosed.move(v(),v(1)).blocked);
  const edge=world([box(0,-.1,0,2,.2,2)]); const result=edge.move(v(),v(2)); assert.ok(result.blocked); assert.ok(result.position.x<=.732);
});
function stairs(rise=.2) {
  const meshes=[box(0,-.1,1.5,3,.2,3)];
  for(let i=0;i<10;i++) meshes.push(box(0,(i+1)*rise/2,-i*.3-.15,3,(i+1)*rise,.3));
  meshes.push(box(0,10*rise/2,-4,3,10*rise,2));
  return meshes;
}
test("stair treads ascend and descend with floor following",()=>{
  const meshes=stairs(), w=world(meshes,meshes);
  const up=w.move(v(0,0,.7),v(0,0,-4.2)); assert.ok(up.position.z<-3.45,JSON.stringify(up)); assert.ok(Math.abs(up.position.y-2)<1e-5);
  const down=w.move(up.position,v(0,0,4.2)); assert.ok(down.position.z>.65,JSON.stringify(down)); assert.ok(Math.abs(down.position.y)<1e-5);
});
test("maximum .3m steps work while .31m ledges block in both directions",()=>{
  for(const rise of [.3,.31]) {
    const meshes=[box(0,-.1,1,3,.2,2),box(0,rise/2,-1,3,rise,2)], w=world(meshes,meshes);
    const up=w.move(v(0,0,.7),v(0,0,-1.4)), down=w.move(v(0,rise,-.7),v(0,0,1.4));
    if(rise===.3) {assert.ok(up.position.z<-.65,JSON.stringify(up)); assert.ok(down.position.z>.65,JSON.stringify(down));}
    else {assert.ok(up.blocked && up.position.z>0); assert.ok(down.blocked && down.position.z<0);}
  }
});
test("floor-backed narrow thresholds, grout and seams remain traversable in separate frames",()=>{
  for(const height of [.001,.003,.045,.3,.31]) {
    const f=floor(), detail=box(0,height/2,0,3,height,.012), w=world([f,detail],[f]);
    let point=v(0,0,.7);
    for(let i=0;i<70;i++) point=w.move(point,v(0,0,-.02)).position;
    if(height>.3) { assert.ok(point.z>0); continue; }
    assert.ok(point.z<-.69,`height ${height} stopped at ${point.z}`);
    for(let i=0;i<70;i++) point=w.move(point,v(0,0,.02)).position;
    assert.ok(point.z>.69,`return height ${height} stopped at ${point.z}`);
  }
});
test("a low solid strip cannot become an invented floor across an unsupported gap",()=>{
  const left=box(0,-.1,1.5,3,.2,2), right=box(0,-.1,-1.5,3,.2,2), bridge=box(0,.025,0,3,.05,1.2);
  const w=world([left,right,bridge],[left,right]);
  const result=w.move(v(0,0,1),v(0,0,-2)); assert.ok(result.blocked && result.position.z>.5);
});
test("malformed mesh fails closed repeatedly; changed attributes rebuild cached geometry",()=>{
  const f=floor(), wall=box(0,1.5,0,.1,3,4), w=world([f,wall]); assert.ok(w.move(v(-1),v(2)).blocked);
  wall.geometry.translate(10,0,0); assert.equal(w.move(v(-1),v(2)).blocked,false);
  wall.geometry.setIndex([0,1,999999]); assert.equal(w.validStart(v(-1)),false); assert.equal(w.validStart(v(-1)),false);
  assert.ok(w.move(v(-1),v(1)).blocked); assert.equal(w.validStart(v(NaN)),false);
});
const model=JSON.parse(fs.readFileSync(new URL("../../public/models/redburn/source-building.json",import.meta.url),"utf8"));
const sourceMeshes=model.objects.map((part:{id:string;positions:number[];indices:number[];category:string})=>{
  const geometry=new THREE.BufferGeometry(); geometry.setAttribute("position",new THREE.Float32BufferAttribute(part.positions,3)); geometry.setIndex(part.indices);
  const mesh=new THREE.Mesh(geometry); mesh.name=part.id; mesh.userData.category=part.category; return mesh;
}) as THREE.Mesh[];
test("actual Redburn selected starts remain walkable despite fine floor seams",()=>{
  const w=world(sourceMeshes,sourceMeshes.filter(m=>["room","slab","stair"].includes(m.userData.category)));
  for(const point of [v(-1.3925,.015,-1.37),v(0,3.135,0)]) {
    assert.equal(w.validStart(point),true,point.toArray().join(","));
    const moved=w.move(point,v(.15,0,0)); assert.ok(moved.position.distanceTo(point)>.1,JSON.stringify(moved));
  }
});
test("full Redburn stair surroundings retain physical blockers rather than inventing missing support",()=>{
  const w=world(sourceMeshes,sourceMeshes.filter(m=>["room","slab","stair"].includes(m.userData.category)));
  const start=v(-6.21,-.07,2.7);
  assert.equal(w.validStart(start),true);
  const up=w.move(start,v(0,0,-5.5));
  assert.ok(up.position.y>3,"real full model reaches upper stair tread");
  assert.ok(up.blocked && up.position.z>-2.405,"existing unsupported upper connection must remain blocked");
  const down=w.move(up.position,v(0,0,4.8)); assert.ok(down.position.z>2.6,JSON.stringify(down)); assert.ok(Math.abs(down.position.y+.07)<1e-5);
});
test("actual Redburn 18-tread mesh supports ascent and descent without modifying original geometry",()=>{
  const stair=sourceMeshes.find(m=>m.name==="external-stairs")!;
  const original=Array.from(stair.geometry.attributes.position.array);
  const bounds=new THREE.Box3().setFromObject(stair), x=(bounds.min.x+bounds.max.x)/2;
  const lower=box(x,-.17,bounds.max.z+1,1.16,.2,2), upper=box(x,bounds.max.y/2,bounds.min.z-1,1.16,bounds.max.y,2);
  const meshes=[stair,lower,upper], w=world(meshes,meshes);
  const start=v(x,-.07,bounds.max.z+.5), delta=v(0,0,bounds.min.z-bounds.max.z-1);
  const up=w.move(start,delta); assert.ok(up.position.z<bounds.min.z-.4,JSON.stringify(up)); assert.ok(Math.abs(up.position.y-bounds.max.y)<1e-4);
  const down=w.move(up.position,delta.clone().negate()); assert.ok(down.position.z>bounds.max.z+.4,JSON.stringify(down)); assert.ok(Math.abs(down.position.y+.07)<1e-4);
  let frame=start.clone();
  for(let i=0;i<120;i++) frame=w.move(frame,delta.clone().divideScalar(120)).position;
  assert.ok(frame.distanceTo(up.position)<1e-4,`frame-sized ascent ${JSON.stringify(frame)}`);
  for(let i=0;i<120;i++) frame=w.move(frame,delta.clone().divideScalar(-120)).position;
  assert.ok(frame.distanceTo(start)<1e-4,`frame-sized descent ${JSON.stringify(frame)}`);
  assert.deepEqual(Array.from(stair.geometry.attributes.position.array),original);
});
