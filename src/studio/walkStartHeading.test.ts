import test from "node:test";
import assert from "node:assert/strict";
import { walkStartYaw } from "./walkStartHeading.ts";

test("aimed heading faces the clicked plan direction in the walkthrough camera", () => {
  const origin = { x: 12, z: -7 };
  for (const [dx, dz] of [[0, -1], [1, 0], [0, 1], [-1, 0], [2, -3]]) {
    const yaw = walkStartYaw(origin, { x: origin.x + dx, z: origin.z + dz });
    const length = Math.hypot(dx, dz);
    assert.ok(Math.abs(-Math.sin(yaw) - dx / length) < 1e-10);
    assert.ok(Math.abs(-Math.cos(yaw) - dz / length) < 1e-10);
  }
});

test("hovering on the marker or invalid coordinates retains its heading", () => {
  assert.equal(walkStartYaw({ x: 1, z: 2 }, { x: 1, z: 2 }, .75), .75);
  assert.equal(walkStartYaw({ x: 1, z: 2 }, { x: NaN, z: 2 }, .75), .75);
});
