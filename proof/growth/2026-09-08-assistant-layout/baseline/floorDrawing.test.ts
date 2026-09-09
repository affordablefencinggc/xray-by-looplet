import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createFloorComponents, FLOOR_STAGES } from "./floorConstruction.ts";
import {
  createFloorDrawing,
  floorLanePose,
  floorStrokes,
  FLOOR_SCRIBBLE_SECONDS,
} from "./floorDrawing.ts";

test("one floor contains each requested trade and finite, uniquely named real components", () => {
  const floor = createFloorComponents();
  assert.equal(new Set(floor.parts.map((p) => p.id)).size, floor.parts.length);
  for (const stage of FLOOR_STAGES)
    assert.ok(
      floor.parts.some((p) => p.stage === stage.id),
      stage.id,
    );
  for (const part of floor.parts) {
    part.mesh.geometry.computeBoundingBox();
    assert.ok(Number.isFinite(part.mesh.geometry.boundingBox!.min.x));
  }
  assert.ok(floor.parts.length > 300);
  floor.dispose();
});
test("0.1 second bursts have independent timing and stop exactly at finite queue end", () => {
  assert.equal(FLOOR_SCRIBBLE_SECONDS, 0.1);
  assert.equal(
    new Set(Array.from({ length: 50 }, (_, i) => floorLanePose(0.72, i, 100).cycle)).size,
    50,
  );
  assert.ok(
    Array.from({ length: 50 }, (_, i) => floorLanePose(0.72, i, 100)).some((p) => p.contact),
  );
  assert.ok(
    Array.from({ length: 50 }, (_, i) => floorLanePose(0.72, i, 100)).some((p) => !p.contact),
  );
  for (let i = 0; i < 50; i++) {
    assert.equal(floorLanePose(100, i, 73).cursor, 73);
    assert.equal(floorLanePose(0, i, 73).cursor, 0);
  }
});
test("persistent ink endpoint equals the actual pencil nib and replay removes future strokes", () => {
  const path = Array.from({ length: 100 }, (_, i) => ({
    a: new THREE.Vector3(i, 0, 0),
    b: new THREE.Vector3(i, 0, 1),
    color: new THREE.Color("#9b7450"),
    part: 0,
  }));
  const draw = createFloorDrawing(path, false);
  draw.update(0.037);
  const pose = draw.poses()[0],
    line = draw.group.children[0] as THREE.LineSegments;
  const positions = line.geometry.getAttribute("position");
  const endpoint = new THREE.Vector3().fromBufferAttribute(
    positions,
    line.geometry.drawRange.count - 1,
  );
  assert.ok(endpoint.distanceTo(new THREE.Vector3(...pose.tip)) < 1e-6);
  assert.equal(pose.contact, true);
  assert.equal(draw.update(draw.duration).drawn, 100);
  draw.update(0);
  assert.equal(line.geometry.drawRange.count, 0);
  draw.update(0.037);
  assert.deepEqual(draw.poses()[0].tip, pose.tip);
  draw.dispose();
});
test("fifty coloured nibs use the same material colour as deposited surface hatching", () => {
  const floor = createFloorComponents(),
    parts = floor.parts.filter((p) => p.stage === "framing");
  const strokes = floorStrokes(parts, true),
    draw = createFloorDrawing(strokes, true);
  assert.equal(draw.count, 50);
  draw.update(0.057);
  for (const p of draw.poses())
    assert.ok(parts.some((part) => part.mesh.material.color.getHexString() === p.color));
  const result = draw.update(draw.duration);
  assert.equal(result.drawn, strokes.length);
  assert.equal(result.completed.size, parts.length);
  draw.dispose();
  floor.dispose();
});
