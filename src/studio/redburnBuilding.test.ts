import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import * as THREE from "three";
import {
  BUILDING_CATALOG,
  parseSourceBuilding,
  sourceBytesMatch,
  buildingPartOnFloor,
} from "./sourceBuilding.ts";
const input = JSON.parse(
    fs.readFileSync(
      new URL("../../public/models/redburn/source-building.json", import.meta.url),
      "utf8",
    ),
  ),
  scene = parseSourceBuilding(input);
test("Carport enclosure has no open jambs or panel seams and the specified door clears its roof", () => {
  const ids = ["garage-door", "carport-door-returns", "carport-walls"];
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const mesh = (id: string) => {
    const part = scene.objects.find((part) => part.id === id)!;
    assert.ok(part, `${id} missing`);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(part.positions, 3));
    geometry.setIndex(part.indices);
    return new THREE.Mesh(geometry, material);
  };
  const enclosure = ids.map(mesh), roofs = ["carport-roof", "carport-gable-roof"].map(mesh);
  const slab = [mesh("carport-zone"), mesh("upper-outdoor")];
  try {
    for (const a of [1.3, 1.5, 1.68, 1.7, 4.2, 6.8, 6.82, 7, 7.2])
      for (const y of [3.13, 4.3, 5.8]) {
        const ray = new THREE.Raycaster(new THREE.Vector3(a - 5.655, y, -10.8), new THREE.Vector3(0, 0, 1), 0, 0.9);
        assert.ok(ray.intersectObjects(enclosure).length, `Open jamb or leaf at ${a}/${y}`);
      }
    for (let panel = 1; panel < 8; panel++) {
      const y = 3.02 + panel * 2.84 / 8 - 0.007;
      const ray = new THREE.Raycaster(new THREE.Vector3(4.2 - 5.655, y, -10.8), new THREE.Vector3(0, 0, 1), 0, 0.9);
      assert.ok(ray.intersectObject(enclosure[0]).length, `See-through panel rebate ${panel}`);
    }
    const door = scene.objects.find((part) => part.id === "garage-door")!;
    const heights = door.positions.filter((_, i) => i % 3 === 1);
    assert.ok(Math.abs(Math.min(...heights) - 3.02) < 0.00001);
    assert.ok(Math.abs(Math.max(...heights) - 5.86) < 0.00001, "Extra panel protrudes above the door head");
    for (const a of [1.7, 4.2, 6.8]) {
      const ray = new THREE.Raycaster(new THREE.Vector3(a - 5.655, 10, 3.325 - 13.6), new THREE.Vector3(0, -1, 0));
      const hits = ray.intersectObjects(roofs);
      assert.equal(hits.length, 1, "Missing/overlapping carport roof");
      assert.ok(hits[0].point.y > Math.max(...heights), "Door intersects roofing");
    }
    const floorRay = new THREE.Raycaster(new THREE.Vector3(4.2 - 5.655, 4, 3.325 - 9), new THREE.Vector3(0, -1, 0));
    assert.ok(Math.abs(floorRay.intersectObjects(slab)[0].point.y - 3.02) < 0.00001, "Upper slab fills the 100 mm carport recess");
  } finally {
    [...enclosure, ...roofs, ...slab].forEach((part) => part.geometry.dispose());
    material.dispose();
  }
});
test("Decorative gables have roof slopes meeting the facade and no duplicate host roof underneath", () => {
  const ids = ["main-roof", "terrace-gable-roof", "stair-gable-roof"];
  const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const meshes = ids.map((id) => {
    const part = scene.objects.find((o) => o.id === id);
    assert.ok(part, `${id} roof missing`);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(part.positions, 3));
    geometry.setIndex(part.indices);
    return new THREE.Mesh(geometry, mat);
  });
  try {
    for (const [id, axis, center, fixed, radius] of [
      ["terrace-gable", "a", 8.05, -0.22, 2.2],
      ["stair-gable", "b", 3.15, -0.27, 2.4],
    ] as const) {
      const base = 5.86 + (fixed + 0.48) * Math.tan(Math.PI / 8);
      for (const depth of [0.03, 0.4, 1])
        for (const offset of [-0.6, 0.45]) {
          const a = axis === "a" ? center + offset : fixed + depth;
          const b = axis === "a" ? fixed + depth : center + offset;
          const ray = new THREE.Raycaster(
            new THREE.Vector3(a - 5.655, 10, 3.325 - b),
            new THREE.Vector3(0, -1, 0),
          );
          const hits = ray.intersectObjects(meshes);
          assert.equal(
            hits.length,
            1,
            `${id}: missing roof or overlapping host sheet at ${depth}/${offset}`,
          );
          assert.ok(
            Math.abs(
              hits[0].point.y - (base + (radius - Math.abs(offset)) * Math.tan(Math.PI / 8)),
            ) < 0.00005,
          );
        }
      const face = scene.objects.find((o) => o.id === id)!;
      const roof = scene.objects.find((o) => o.id === id + "-roof")!;
      for (let i = 0; i < face.positions.length; i += 3) {
        const p = face.positions.slice(i, i + 3);
        assert.ok(
          roof.positions.some(
            (_, j) =>
              j % 3 === 0 &&
              Math.hypot(
                ...(p.map((v, k) => v - roof.positions[j + k]) as [number, number, number]),
              ) < 0.00005,
          ),
          `${id}: facade vertex does not meet roof`,
        );
      }
    }
  } finally {
    for (const m of meshes) m.geometry.dispose();
    mat.dispose();
  }
});
test("Redburn is bound to the supplied original, and modified source bytes are rejected", async () => {
  const bytes = new Uint8Array(
    fs.readFileSync(new URL("../../public/models/redburn/source.pdf", import.meta.url)),
  );
  assert.equal(scene.source.sha256, BUILDING_CATALOG.find((c) => c.id === "redburn")?.sha256);
  assert.equal(await sourceBytesMatch(scene, bytes, scene.source.sha256), true);
  bytes[200] ^= 1;
  assert.equal(await sourceBytesMatch(scene, bytes, scene.source.sha256), false);
  assert.equal(scene.sourceSheets.length, 13);
  assert.equal(scene.floorElevations!.upper - scene.floorElevations!.ground, 3.12);
  assert.ok(scene.assumptions.some((a) => a.includes("RL22.50") && a.includes("conflict")));
});
test("Source window centres are physical apertures in walls and cladding, with separate selectable glass", () => {
  for (const [prefix, centres, y] of [
    ["lower-terrace-wall", [0.93, 5.29, 9.1], 1.5],
    ["upper-terrace-wall", [2.81, 5.85, 9], 4.8],
  ] as const) {
    const walls = scene.objects.filter(
      (o) => o.id === prefix || o.id.startsWith(prefix + "-linea-"),
    );
    for (const a of centres) {
      const ray = new THREE.Raycaster(
        new THREE.Vector3(a - 5.655, y, 4),
        new THREE.Vector3(0, 0, -1),
        0,
        1.4,
      );
      for (const part of walls) {
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(part.positions, 3));
        g.setIndex(part.indices);
        const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
          mesh = new THREE.Mesh(g, mat);
        assert.equal(ray.intersectObject(mesh).length, 0, `${part.id}: aperture obstructed`);
        g.dispose();
        mat.dispose();
      }
    }
  }
  assert.equal(scene.objects.filter((o) => /^upper-terrace-wall-opening-\d$/.test(o.id)).length, 3);
});
test("Floor isolation and camera metadata cannot admit invalid camera bases", () => {
  for (const part of scene.objects.filter((o) => o.level === "upper" || o.level === "roof"))
    assert.equal(buildingPartOnFloor(part, "ground"), false);
  for (const change of [
    { cameraDirection: [0, 1, 0] },
    { cameraDirection: [0, -1, 1] },
    { planUp: [0, 1, 0] },
    { edgeOpacity: 2 },
  ]) {
    const bad = structuredClone(input);
    Object.assign(bad.presentation, change);
    assert.throws(() => parseSourceBuilding(bad));
  }
  const legacy = structuredClone(input);
  delete legacy.presentation;
  assert.doesNotThrow(() => parseSourceBuilding(legacy));
});
