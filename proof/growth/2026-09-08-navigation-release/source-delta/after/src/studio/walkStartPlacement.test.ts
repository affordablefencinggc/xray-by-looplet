import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import * as THREE from "three";
import { parseSourceBuilding, type BuildingPart, type SourceBuilding } from "./sourceBuilding.ts";
import { assessWalkStart, listWalkFloors, recommendWalkStarts } from "./walkStartPlacement.ts";

const model = parseSourceBuilding(JSON.parse(fs.readFileSync(new URL("../../public/models/redburn/source-building.json", import.meta.url), "utf8")));
const original = JSON.stringify(model);
test("Redburn recommends real clear room starts on both floors with canonical camera heading", () => {
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const meshes = model.objects.filter(p => p.category !== "room").map(part => {
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.Float32BufferAttribute(part.positions, 3)); geometry.setIndex(part.indices);
    return new THREE.Mesh(geometry, material);
  });
  try {
    assert.deepEqual(listWalkFloors(model).map(f => f.id), ["ground", "upper"]);
    for (const [floor, room, height] of [["ground", "lounge", .015], ["upper", "bed1", 3.135]] as const) {
      const starts = recommendWalkStarts(model, floor); assert.ok(starts.length >= 2);
      assert.equal(starts[0].supportId, room); assert.equal(starts[0].elevation, height);
      assert.equal(new Set(starts.map(p => p.supportId)).size, starts.length);
      for (const start of starts) {
        assert.equal(start.level, floor); assert.equal(start.inferred, true); assert.ok(start.clearView >= 1.2);
        assert.ok(assessWalkStart(model, floor, start).ok);
        for (const offset of [-.32, 0, .32]) {
          const direction = new THREE.Vector3(-Math.sin(start.yaw + offset), 0, -Math.cos(start.yaw + offset));
          const ray = new THREE.Raycaster(new THREE.Vector3(start.x, start.elevation + 1.65, start.z), direction, .001, 1.19);
          assert.equal(ray.intersectObjects(meshes).length, 0, `${floor}/${start.label} starts facing a nearby solid`);
        }
      }
    }
    assert.equal(JSON.stringify(model), original, "Source model must not be changed by placement");
  } finally { meshes.forEach(m => m.geometry.dispose()); material.dispose(); }
});

function box(id: string, category: BuildingPart["category"], x: number, y: number, z: number, sx: number, sy: number, sz: number): BuildingPart {
  const geometry = new THREE.BoxGeometry(sx, sy, sz); geometry.translate(x, y, z);
  const value: BuildingPart = { ...model.objects[0], id, label: id, category, level: "ground",
    positions: [...geometry.attributes.position.array], indices: [...geometry.index!.array] };
  geometry.dispose(); return value;
}
function scene(objects: BuildingPart[]): SourceBuilding { return { ...model, objects, floorElevations: { ground: 0, upper: 3.12 } }; }
const slab = box("floor", "slab", 0, -.1, 0, 10, .2, 10);
test("manual placement refuses walls, low fixtures, thick solids, edges and invalid coordinates", () => {
  for (const obstacle of [box("wall", "wall", 0, 1.5, 0, .2, 3, 6), box("cabinet", "fixture", 0, .4, 0, 2, .8, 2), box("thick-solid", "column", 0, 2, 0, 4, 4, 4)]) {
    const value = scene([slab, obstacle]);
    assert.equal(assessWalkStart(value, "ground", { x: 0, z: 0 }).ok, false, obstacle.id);
    assert.equal(assessWalkStart(value, "ground", { x: 3.5, z: 3.5 }).ok, true);
  }
  const value = scene([slab]);
  for (const point of [{ x: 4.9, z: 0 }, { x: 0, z: 5.1 }, { x: NaN, z: 0 }, { x: 0, z: Infinity }]) assert.equal(assessWalkStart(value, "ground", point).ok, false);
});
test("floor support follows triangle footprints, not a rectangular bounding box", () => {
  const floor = { ...slab, positions: [0, 0, 0, 5, 0, 0, 0, 0, 5], indices: [0, 1, 2] };
  assert.equal(assessWalkStart(scene([floor]), "ground", { x: 4, z: 4 }).ok, false);
  assert.equal(assessWalkStart(scene([floor]), "ground", { x: 1, z: 1 }).ok, true);
});
test("unsupported levels, missing elevation and invalid geometry fail without invented ground", () => {
  assert.equal(assessWalkStart(model, "roof", { x: 0, z: 0 }).ok, false);
  assert.deepEqual(recommendWalkStarts({ ...model, floorElevations: undefined }, "ground"), []);
  assert.deepEqual(listWalkFloors({ ...model, floorElevations: undefined }), []);
  assert.equal(assessWalkStart(scene([{ ...slab, indices: [0, 1, 99999] }]), "ground", { x: 1, z: 1 }).ok, false);
  assert.equal(assessWalkStart(scene([box("roof-only", "roof", 0, 3, 0, 10, .2, 10)]), "ground", { x: 0, z: 0 }).ok, false);
});
test("actual supporting stepdown elevation is retained and cramped spaces refuse a blank-wall start", () => {
  const lower = box("stepdown", "room", 0, -.17, 0, 5, .2, 5);
  const result = assessWalkStart(scene([lower]), "ground", { x: 0, z: 0 });
  assert.ok(result.ok); if (result.ok) assert.ok(Math.abs(result.placement.elevation + .07) < 1e-6);
  const walls = [box("a", "wall", -1, 1.5, 0, .2, 3, 2), box("b", "wall", 1, 1.5, 0, .2, 3, 2), box("c", "wall", 0, 1.5, -1, 2, 3, .2), box("d", "wall", 0, 1.5, 1, 2, 3, .2)];
  assert.equal(assessWalkStart(scene([slab, ...walls]), "ground", { x: 0, z: 0 }).ok, false);
});
