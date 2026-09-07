import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import * as THREE from "three";
import { prepareSourceWalkDoors } from "./sourceWalkDoors.ts";
import type { SourceBuilding } from "./sourceBuilding.ts";

test("Redburn leaves retain glazing and moving mullions while door jambs remain fixed", () => {
  const model = JSON.parse(fs.readFileSync("public/models/redburn/source-building.json", "utf8")) as SourceBuilding;
  const scene = new THREE.Scene(), meshes = new Map<string, THREE.Mesh>();
  for (const part of model.objects) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(part.positions, 3));
    geometry.setIndex(part.indices);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    scene.add(mesh); meshes.set(part.id, mesh);
  }
  const originalTriangles = [...meshes.values()].reduce((n, mesh) => n + mesh.geometry.index!.count / 3, 0);
  const result = prepareSourceWalkDoors(model, meshes);
  assert.ok(result.doors.length > 5);
  assert.ok(result.doors.some(door => door.motion === "slide"));
  assert.ok(result.doors.some(door => door.motion === "swing"));
  assert.equal(result.doors.find(door => door.id === "garage-door")?.motion, "lift");
  assert.ok(result.extraMeshes.length > 5);
  const finalTriangles = [...meshes.values(), ...result.extraMeshes].reduce((n, mesh) => n + (mesh.geometry.index?.count ?? mesh.geometry.getAttribute("position").count) / 3, 0);
  assert.equal(finalTriangles, originalTriangles, "No source triangles are dropped or duplicated");
  for (const door of result.doors.filter(door => door.meshes.length > 1)) {
    const frame = meshes.get(door.id + "-frame")!;
    assert.ok(!door.meshes.includes(frame), "Fixed jambs must never move with the leaf");
    const before = frame.matrixWorld.clone();
    for (const leaf of door.meshes) leaf.position.x += 1;
    scene.updateMatrixWorld(true);
    assert.ok(frame.matrixWorld.equals(before));
  }
});
