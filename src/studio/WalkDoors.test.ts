import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { createWalkDoors, type WalkDoorDefinition, type WalkDoorState } from "./WalkDoors.ts";
import { prepareSourceWalkDoors } from "./sourceWalkDoors.ts";

function fixture(options: { motion?: "swing" | "slide" | "lift"; reduced?: boolean; angle?: number; rotation?: number } = {}) {
  const scene = new THREE.Scene(), group = new THREE.Group(); scene.add(group);
  group.rotation.y = options.rotation ?? 0;
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.1, 0.06), new THREE.MeshBasicMaterial());
  leaf.position.y = 1.05; group.add(leaf); scene.updateMatrixWorld(true);
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 1.65, 1); camera.lookAt(0, 1.65, 0);
  const canvas = { dataset: {} } as unknown as HTMLCanvasElement;
  let time = 0, state: WalkDoorState | null = null, invalidations = 0;
  const solids: THREE.Object3D[] = [leaf];
  const definition: WalkDoorDefinition = { id: "door-1", label: "Study door", meshes: [leaf], motion: options.motion };
  if (options.angle !== undefined) { definition.swingAngle = options.angle; definition.hinge = new THREE.Vector3(-0.45, 0, 0).applyMatrix4(group.matrixWorld); }
  const originalPosition = leaf.geometry.getAttribute("position").array.slice(), originalMatrix = leaf.matrix.clone();
  const api = createWalkDoors({ doors: [definition], camera, canvas, solids: () => solids, now: () => time, reducedMotion: () => options.reduced ?? false,
    onChange: value => { state = value; }, invalidate: () => { invalidations++; } });
  return { api, leaf, camera, canvas, scene, group, solids, originalMatrix, originalPosition, state: () => state,
    time: (value: number) => { time = value; }, invalidations: () => invalidations };
}

test("door prompt requires near, facing and vertically matching approach; other solids block it", () => {
  const f = fixture(); f.api.tick(true); assert.equal(f.state()?.id, "door-1");
  f.camera.position.z = 2; f.api.tick(true); assert.equal(f.state(), null); f.api.interact(); assert.equal(f.api.busy, false);
  f.camera.position.z = 1; f.camera.lookAt(0, 1.65, 3); f.api.tick(true); assert.equal(f.state(), null);
  f.camera.position.y = 4; f.camera.lookAt(0, 4, 0); f.api.tick(true); assert.equal(f.state(), null);
  f.camera.position.y = 1.65; f.camera.lookAt(0, 1.65, 0);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 0.05), new THREE.MeshBasicMaterial({ side: THREE.FrontSide }));
  wall.position.set(0, 1.5, 0.5); wall.rotation.y = Math.PI; f.scene.add(wall); f.solids.push(wall);
  f.api.tick(true); assert.equal(f.state(), null); f.api.interact(); assert.equal(f.api.busy, false);
  wall.visible = false; f.api.tick(true); assert.equal(f.state()?.id, "door-1");
  f.api.dispose();
});

test("swing animates the actual leaf about its edge, away from viewer, without changing geometry", () => {
  const f = fixture(); f.api.tick(true); f.api.interact(); assert.equal(f.api.busy, true);
  f.time(310); assert.equal(f.api.tick(true), true); assert.equal(f.state()?.progress, 0.5);
  assert(f.leaf.getWorldPosition(new THREE.Vector3()).z < -0.2);
  f.time(620); f.api.tick(true); assert.equal(f.api.busy, false); assert.equal(f.state()?.open, true);
  const box = new THREE.Box3().setFromObject(f.leaf); assert(box.max.x - box.min.x < 0.07); assert(box.max.z - box.min.z > 0.89);
  assert.deepEqual(f.leaf.geometry.getAttribute("position").array, f.originalPosition);
  f.api.interact(); assert.equal(f.api.busy, true); f.time(1240); f.api.tick(true);
  assert.equal(f.state()?.open, false); assert(f.leaf.matrix.equals(f.originalMatrix)); f.api.dispose();
});

test("closed doorway and open swing area refuse closing without moving the leaf", () => {
  const f = fixture({ reduced: true }); f.api.tick(true); f.api.interact(); assert.equal(f.state()?.open, true);
  const opened = f.leaf.matrix.clone(); f.camera.position.set(0, 1.65, 0); f.camera.lookAt(0, 1.65, -1);
  f.api.tick(true); assert.match(f.state()?.blockedReason ?? "", /clear/); f.api.interact();
  assert(f.leaf.matrix.equals(opened)); assert.equal(f.state()?.open, true);
  f.camera.position.set(0, 1.65, 1); f.camera.lookAt(0, 1.65, 0); f.api.tick(true); f.api.interact();
  assert.equal(f.state()?.open, false); f.api.dispose();
});

test("explicit hinge swing refuses opening through a nearby body, but works about one metre away", () => {
  const f = fixture({ reduced: true, angle: -Math.PI / 2 });
  f.camera.position.set(-0.35, 1.65, 0.55); f.camera.lookAt(0, 1.65, 0); f.api.tick(true);
  assert.match(f.state()?.blockedReason ?? "", /Step back/); f.api.interact(); assert.equal(f.state()?.open, false);
  f.camera.position.set(0, 1.65, 1.2); f.camera.lookAt(0, 1.65, 0); f.api.tick(true);
  assert.equal(f.state()?.blockedReason, undefined); f.api.interact(); assert.equal(f.state()?.open, true); f.api.dispose();
});

test("slide and lift change the same collider-visible meshes; open garage control remains reachable", () => {
  for (const motion of ["slide", "lift"] as const) {
    const f = fixture({ motion, reduced: true }); f.api.tick(true); f.api.interact();
    assert.equal(f.api.busy, false); assert.equal(f.state()?.motion, motion); assert.equal(f.state()?.open, true);
    const world = f.leaf.getWorldPosition(new THREE.Vector3());
    if (motion === "slide") assert(Math.abs(world.x - 0.936) < 1e-6); else assert(Math.abs(world.y - 3.234) < 1e-6);
    f.api.tick(true); assert.equal(f.state()?.id, "door-1"); f.api.interact(); assert.equal(f.state()?.open, false);
    f.api.dispose();
  }
});

test("camera entering the sweep during animation stops motion at its current pose", () => {
  const f = fixture(); f.api.tick(true); f.api.interact(); f.time(620); f.api.tick(true);
  f.api.interact(); f.time(775); f.api.tick(true); const partial = f.leaf.matrix.clone();
  f.camera.position.set(0, 1.65, 0); f.camera.lookAt(0, 1.65, -1); f.time(930); f.api.tick(true);
  assert.equal(f.api.busy, false); assert(f.leaf.matrix.equals(partial)); assert.match(f.state()?.blockedReason ?? "", /clear/); f.api.dispose();
});

test("reset/exit/dispose restore original local transforms under a rotated parent", () => {
  const f = fixture({ reduced: true, rotation: Math.PI / 4, angle: Math.PI / 2 });
  f.api.tick(true); f.api.interact(); assert.equal(f.state()?.open, true); assert(!f.leaf.matrix.equals(f.originalMatrix));
  f.api.reset(); assert(f.leaf.matrix.equals(f.originalMatrix)); assert.equal(f.leaf.matrixAutoUpdate, true); assert.equal(f.state(), null);
  f.api.tick(true); f.api.interact(); f.api.tick(false); assert(f.leaf.matrix.equals(f.originalMatrix)); assert.equal(f.state(), null);
  f.leaf.position.y = 4; f.leaf.updateMatrix(); f.api.tick(false); assert.equal(f.leaf.position.y, 4); // Inactive view options remain untouched.
  f.api.dispose(); assert(f.leaf.matrix.equals(f.originalMatrix)); f.api.interact(); assert.equal(f.api.tick(true), false); f.api.dispose();
});

test("duplicate leaf ownership is rejected before ambiguous interaction", () => {
  const f = fixture();
  assert.throws(() => createWalkDoors({ doors: [{ id: "a", label: "A", meshes: [f.leaf] }, { id: "b", label: "B", meshes: [f.leaf] }], camera: f.camera, canvas: f.canvas, onChange() {}, invalidate() {} }), /two door/);
  f.api.dispose();
});

test("actual Redburn bifold retains close access near the original portal and reports open state when looking away", () => {
  const model = JSON.parse(readFileSync(new URL("../../public/models/redburn/source-building.json", import.meta.url), "utf8"));
  const scene = new THREE.Scene(), meshes = new Map<string, THREE.Mesh>();
  for (const part of model.objects) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(part.positions, 3)); geometry.setIndex(part.indices);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    scene.add(mesh); meshes.set(part.id, mesh);
  }
  const prepared = prepareSourceWalkDoors(model, meshes), camera = new THREE.PerspectiveCamera();
  const canvas = { dataset: {} } as unknown as HTMLCanvasElement;
  let state: WalkDoorState | null = null, time = 0;
  const api = createWalkDoors({ doors: prepared.doors, camera, canvas, solids: () => [...meshes.values(), ...prepared.extraMeshes], now: () => time,
    onChange: value => { state = value; }, invalidate() {} });
  const readState = () => state;
  // At the actual collision-stop position the closed glass is clear, but an
  // offset mullion would cross the body during sliding. Five centimetres back is safe.
  camera.position.set(-0.04036, 1.665, 3.04828); camera.lookAt(-0.04036, 1.665, 4.04828);
  api.tick(true); assert.match(readState()?.blockedReason ?? "", /Step back/);
  camera.position.z -= 0.05; api.tick(true); assert.equal(readState()?.blockedReason, undefined);
  api.tick(true); api.interact(); time = 620; api.tick(true);
  assert.equal(readState()?.open, true);
  camera.position.set(-0.04036, 1.665, 3.04828); camera.lookAt(-0.04036, 1.665, 4.04828); api.tick(true);
  assert.equal(readState()?.id, "lower-terrace-wall-opening-1");
  assert.equal(readState()?.open, true); assert.match(readState()?.blockedReason ?? "", /clear/);
  camera.lookAt(-0.04036, 1.665, 2.04828); api.tick(true);
  assert.equal(readState(), null);
  assert.equal(JSON.parse(canvas.dataset.walkDoors!).find((door: { id: string }) => door.id === "lower-terrace-wall-opening-1").progress, 1);
  camera.position.set(0, 1.58, 4.1); camera.lookAt(0, 1.58, 3.1); api.tick(true);
  assert.equal(readState()?.open, true); assert.equal(readState()?.blockedReason, undefined);
  api.interact(); time = 1240; api.tick(true); assert.equal(readState()?.open, false);
  api.dispose();
  for (const mesh of [...meshes.values(), ...prepared.extraMeshes]) { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); }
});

test("empty space in merged leaf geometry does not become a solid swept box", () => {
  const positions: number[] = [];
  for (const x of [-0.45, 0.45]) {
    const bar = new THREE.BoxGeometry(0.06, 2.1, 0.06).toNonIndexed(); bar.translate(x, 1.05, 0);
    positions.push(...bar.getAttribute("position").array); bar.dispose();
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()), camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 1.65, 0.2); camera.lookAt(0, 1.65, 0);
  let state: WalkDoorState | null = null;
  const readState = () => state;
  const api = createWalkDoors({ doors: [{ id: "bars", label: "Lift assembly", meshes: [mesh], motion: "lift" }], camera,
    canvas: { dataset: {} } as unknown as HTMLCanvasElement, reducedMotion: () => true, onChange: value => { state = value; }, invalidate() {} });
  api.tick(true); assert.equal(readState()?.blockedReason, undefined); api.interact(); assert.equal(readState()?.open, true);
  api.dispose(); geometry.dispose(); (mesh.material as THREE.Material).dispose();
});
