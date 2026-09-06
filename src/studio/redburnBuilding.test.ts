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
