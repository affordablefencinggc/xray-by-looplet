import { test } from "node:test";
import assert from "node:assert/strict";
import { Vector3 } from "three";
import { inspectionPath, sampleInspectionPath, inspectionEase, INSPECTION_DURATION } from "./inspectionMotion.ts";
const from = new Vector3(0, 0, 0), forward = new Vector3(0, 0, -1), right = new Vector3(1, 0, 0), up = new Vector3(0, 1, 0);
test("Nearby inspection follows a curved image-plane path with no forward travel at any sample", () => {
  const path = inspectionPath(from, new Vector3(5, 2, -10), forward, right, up, 9);
  assert.equal(path.nearby, true);
  for(let i=0;i<=100;i++) assert.ok(Math.abs(sampleInspectionPath(path,i/100).dot(forward))<1e-10);
  assert.ok(sampleInspectionPath(path,.5).distanceTo(from.clone().lerp(path.to,.5))>.1);
  assert.ok(path.to.length()<=1.5);
});
test("Exactly 20 metres uses lateral motion, including a centred target", () => {
  const path = inspectionPath(from, new Vector3(0,0,-21), forward, right, up,20);
  assert.equal(path.nearby,true);assert.equal(path.to.z,0);assert.ok(path.to.x>0);
});
test("Far inspection retains a quarter approach with a rounded path", () => {
  const target = new Vector3(0,0,-100),path=inspectionPath(from,target,forward,right,up,95);
  assert.equal(path.nearby,false);assert.equal(path.to.z,-25);assert.ok(sampleInspectionPath(path,.5).y>0);
});
test("An approach starting just beyond 20 metres stays outside that boundary", () => {
  const path=inspectionPath(from,new Vector3(0,0,-25),forward,right,up,21);
  for(let i=0;i<=100;i++)assert.ok(sampleInspectionPath(path,i/100).length()<=1+1e-9);
});
test("Glide has a gradual start/stop and exact endpoints", () => {
  assert.equal(INSPECTION_DURATION,900);assert.ok(inspectionEase(.01)<.00002);assert.ok(1-inspectionEase(.99)<.00002);
  const path=inspectionPath(from,new Vector3(0,0,-100),forward,right,up,90);
  assert.ok(sampleInspectionPath(path,0).equals(from));assert.ok(sampleInspectionPath(path,1).distanceTo(path.to)<1e-10);
});
test("Nearby restriction follows the camera orientation rather than world Z",()=>{
  const f=new Vector3(1,1,-1).normalize(),r=new Vector3().crossVectors(f,up).normalize(),u=new Vector3().crossVectors(r,f).normalize();
  const path=inspectionPath(from,new Vector3(5,9,-2),f,r,u,8);
  for(let i=0;i<=30;i++)assert.ok(Math.abs(sampleInspectionPath(path,i/30).dot(f))<1e-10);
});
