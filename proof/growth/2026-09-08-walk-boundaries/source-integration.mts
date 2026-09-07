import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import * as THREE from "three";
import { prepareSourceWalkDoors } from "../../../src/studio/sourceWalkDoors.ts";
import { createWalkDoors } from "../../../src/studio/WalkDoors.ts";
import { createWalkCollisionWorld } from "../../../src/studio/walkCollision.ts";

const root=new URL("../../../",import.meta.url);
const paths=["public/models/redburn/source-building.json","src/studio/sourceWalkDoors.ts","src/studio/WalkDoors.ts","src/studio/walkCollision.ts","src/studio/SourceBuildingViewer.tsx"];
console.log("source hashes",Object.fromEntries(paths.map(p=>[p,createHash("sha256").update(fs.readFileSync(new URL(p,root))).digest("hex")])));
const bytes=fs.readFileSync(new URL(paths[0],root)), model=JSON.parse(bytes.toString());
const original=JSON.stringify(model), scene=new THREE.Scene(), map=new Map<string,THREE.Mesh>();
for(const part of model.objects) {
  const geometry=new THREE.BufferGeometry(); geometry.setAttribute("position",new THREE.Float32BufferAttribute(part.positions,3)); geometry.setIndex(part.indices);
  const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide})); mesh.userData.partId=part.id; scene.add(mesh); map.set(part.id,mesh);
}
const prepared=prepareSourceWalkDoors(model,map), solids=[...map.values(),...prepared.extraMeshes];
const supports=model.objects.filter((p:{category:string})=>["room","slab","stair"].includes(p.category)).map((p:{id:string})=>map.get(p.id)!);
const world=createWalkCollisionWorld({solids:()=>solids,supports:()=>supports});
const camera=new THREE.PerspectiveCamera(), canvas={dataset:{}} as unknown as HTMLCanvasElement;
camera.position.set(0,1.665,2.1); camera.lookAt(0,1.665,3.1);
let time=0, state:unknown;
const doors=createWalkDoors({doors:prepared.doors,camera,canvas,solids:()=>solids,now:()=>time,reducedMotion:()=>false,onChange:s=>{state=s},invalidate:()=>{}});
const start=new THREE.Vector3(0,.015,2.1);
assert.ok(world.validStart(start)); doors.tick(true); console.log("closed prompt",state);
assert.ok(canvas.dataset.walkDoor,"actual sliding door must be reachable");
const closed=world.move(start,new THREE.Vector3(0,0,2)); console.log("closed collision",closed);
assert.ok(closed.blocked && closed.position.z<3.1);
doors.interact(); time=620; doors.tick(true); console.log("opened prompt",state,canvas.dataset);
const opened=world.move(start,new THREE.Vector3(0,0,2)); console.log("opened passage",opened);
if(opened.position.z<4) {
  console.log("blocking solids",JSON.stringify(solids.filter(mesh=>{
    const single=createWalkCollisionWorld({solids:()=>[mesh],supports:()=>supports});
    return single.move(start,new THREE.Vector3(0,0,2)).position.z<4;
  }).map(mesh=>({id:mesh.userData.partId,bounds:new THREE.Box3().setFromObject(mesh),stopped:createWalkCollisionWorld({solids:()=>[mesh],supports:()=>supports}).move(start,new THREE.Vector3(0,0,2))}))));
}
assert.ok(opened.position.z>4,"opening must permit actual model passage");
assert.ok(Math.abs(opened.position.y+.07)<.005,"terrace support is 85mm lower than interior finish");
camera.position.copy(opened.position).add(new THREE.Vector3(0,1.65,0)); camera.lookAt(camera.position.clone().add(new THREE.Vector3(0,0,-1))); doors.tick(true);
console.log("terrace close prompt",state,canvas.dataset);
assert.equal(canvas.dataset.walkDoorOpen,"true");
const returned=world.move(opened.position,new THREE.Vector3(0,0,-2)); console.log("opened return passage",returned);
assert.ok(returned.position.distanceTo(start)<.005,"open threshold passes in both directions");
let frame=start.clone();
for(let i=0;i<100;i++) frame=world.move(frame,new THREE.Vector3(0,0,.02)).position;
assert.ok(frame.distanceTo(opened.position)<.005,"real source passage remains valid across movement frames");
for(let i=0;i<100;i++) frame=world.move(frame,new THREE.Vector3(0,0,-.02)).position;
assert.ok(frame.distanceTo(start)<.005,"real source return remains valid across movement frames");
doors.reset(); const reset=world.move(start,new THREE.Vector3(0,0,2)); assert.ok(reset.blocked && reset.position.z<3.1);
assert.equal(JSON.stringify(model),original,"view-only transforms preserve source model bytes");
const stairsStart=new THREE.Vector3(-6.2,-.07,2.6); assert.ok(world.validStart(stairsStart));
const upstairs=world.move(stairsStart,new THREE.Vector3(0,0,-5.5)); console.log("full model stair top",upstairs);
assert.ok(upstairs.position.y>3 && upstairs.blocked && upstairs.position.z>-2.405,"existing unsupported upper connection stays blocked");
const downstairs=world.move(upstairs.position,new THREE.Vector3(0,0,4.7)); console.log("full model stair return",downstairs);
assert.ok(downstairs.position.z>2.5 && Math.abs(downstairs.position.y+.07)<.005);
doors.dispose();
console.log("PASS actual source door passage/reset, terrace floor, 18-tread ascent/descent, upper gap, immutable model");
