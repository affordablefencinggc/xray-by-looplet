import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createArchitecturalDimensioning } from "./architecturalDimensioning.ts";

test("ArchitecturalDimensioning computes dimensions, tags storeys and manages visibility", () => {
  const scene = new THREE.Scene();
  const bounds = new THREE.Box3(
    new THREE.Vector3(-10, 0, -5),
    new THREE.Vector3(10, 24, 15),
  );
  const storeys = [
    { label: "Ground Floor", elevation: 0 },
    { label: "Level 01", elevation: 3.2 },
    { label: "Level 02", elevation: 6.4 },
    { label: "Roof Parapet", elevation: 24.0 },
  ];

  let invalidated = 0;
  const invalidate = () => {
    invalidated++;
  };

  const dims = createArchitecturalDimensioning({
    scene,
    bounds,
    storeys,
    invalidate,
  });

  const data = dims.getData();
  assert.equal(data.widthMm, 20000);
  assert.equal(data.depthMm, 20000);
  assert.equal(data.heightMm, 24000);
  assert.equal(data.widthLabel, "20,000 mm");
  assert.equal(data.depthLabel, "20,000 mm");
  assert.equal(data.heightLabel, "24,000 mm");

  assert.equal(data.storeys.length, 4);
  assert.equal(data.storeys[0].label, "Ground Floor");
  assert.equal(data.storeys[1].heightMm, 3200);
  assert.equal(data.storeys[2].heightMm, 3200);

  // Visibility toggle
  assert.equal(dims.isVisible(), false);
  assert.equal(dims.group.visible, false);

  dims.setVisible(true);
  assert.equal(dims.isVisible(), true);
  assert.equal(dims.group.visible, true);
  assert.ok(invalidated > 0);

  const toggled = dims.toggle();
  assert.equal(toggled, false);
  assert.equal(dims.isVisible(), false);

  // Group has lines and sprites
  assert.ok(dims.group.children.length >= 4);

  // Dispose cleanly
  dims.dispose();
  assert.equal(scene.children.includes(dims.group), false);
});
