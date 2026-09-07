import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { createFirstPersonArm } from "./FirstPersonArm.ts";

function fixture(reduced=false) {
  const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera();
  const canvas={dataset:{},ownerDocument:{defaultView:{matchMedia:()=>({matches:reduced})}}} as unknown as HTMLCanvasElement;
  const model=new THREE.Group(), hand=new THREE.Mesh(new THREE.BoxGeometry(.1,.1,.1),new THREE.MeshBasicMaterial());
  hand.name="hand";model.add(hand);
  const animation=new THREE.AnimationClip("grab.R",1,[new THREE.VectorKeyframeTrack("hand.position",[0,1],[0,0,0,1,0,0])]);
  const asset={scene:model,animations:[animation]};return {scene,camera,canvas,asset,hand};
}
test("reach rig follows camera/body and real animation time, then hides on cancellation",async()=>{
  const f=fixture(),arm=createFirstPersonArm({...f,invalidate:()=>{},loadAsset:async()=>f.asset});await arm.ready;
  assert.equal(f.hand.material.transparent,true,"arm must render after transparent building surfaces");
  assert.equal(f.hand.material.depthTest,false);
  assert.equal(f.hand.material.depthWrite,false);
  f.camera.position.set(4,2,3);f.camera.rotation.y=.8;
  assert.equal(arm.tick({id:"door",label:"Door",open:false,busy:true,progress:.5,motion:"swing"}),true);
  const body=f.scene.getObjectByName("Walkthrough body")!;body.updateWorldMatrix(true,true);
  assert.ok(body.matrixWorld.equals(f.camera.matrixWorld));assert.equal(f.hand.position.x,.5);
  f.camera.position.x+=2;arm.tick({id:"door",label:"Door",open:false,busy:true,progress:.75,motion:"slide"});
  body.updateWorldMatrix(true,true);assert.equal(body.getWorldPosition(new THREE.Vector3()).x,6);
  assert.equal(arm.tick(null),false);assert.equal(body.visible,false);
  arm.dispose();assert.equal(f.scene.getObjectByName("Walkthrough body"),undefined);assert.equal(arm.tick({id:"x",label:"x",busy:true,open:false,progress:.4,motion:"swing"}),false);
});
test("reduced motion hides the body reach without changing door state; late asset is disposed",async()=>{
  const f=fixture(true),arm=createFirstPersonArm({...f,invalidate:()=>{},loadAsset:async()=>f.asset});await arm.ready;
  const state={id:"door",label:"Door",open:false,busy:true,progress:.5,motion:"swing" as const};
  assert.equal(arm.tick(state),false);assert.equal(state.progress,.5);arm.dispose();
  const late=fixture();let resolve!:(asset:typeof late.asset)=>void,disposed=0;
  late.hand.geometry.addEventListener("dispose",()=>disposed++);
  const gone=createFirstPersonArm({...late,invalidate:()=>{},loadAsset:()=>new Promise(done=>{resolve=done;})});gone.dispose();resolve(late.asset);await gone.ready;
  assert.equal(disposed,1);assert.equal(late.scene.children.length,0);
});
