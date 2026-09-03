import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeFaces, type FaceState } from "./faces.ts";
import { PAL } from "./geometry.ts";

describe("Solid Shaded Faces Engine", () => {
  const baseState: FaceState = {
    showSurfaces: true,
    showSrc: true,
    showBld: true,
    showRoof: true,
    skin: "navy",
    pose: "standing",
    floors: 1,
  };

  it("should return an empty list of faces if showSurfaces is disabled", () => {
    const state = { ...baseState, showSurfaces: false };
    const result = computeFaces(state);
    assert.deepEqual(result, []);
  });

  it("should return an empty list of faces if showSrc is disabled", () => {
    const state = { ...baseState, showSrc: false };
    const result = computeFaces(state);
    assert.deepEqual(result, []);
  });

  it("should return only roof faces when showBld is false but showRoof is true", () => {
    const state = { ...baseState, showBld: false, showRoof: true };
    const result = computeFaces(state);
    
    // Slabs and walls (building) should be omitted, only roof faces exist
    assert.ok(result.length > 0, "Should have roof faces");
    for (const face of result) {
      assert.equal(face.colour, PAL.roof);
    }
  });

  it("should return only building faces when showRoof is false but showBld is true", () => {
    const state = { ...baseState, showBld: true, showRoof: false, floors: 1 };
    const result = computeFaces(state);
    
    // Roof should be omitted, only building faces exist
    assert.ok(result.length > 0, "Should have building faces");
    for (const face of result) {
      assert.notEqual(face.colour, PAL.roof);
    }
  });

  it("should scale building floors correctly with storeys property", () => {
    // 1 floor has 1 slab + 4 walls = 5 faces
    const state1 = { ...baseState, showBld: true, showRoof: false, floors: 1 };
    const result1 = computeFaces(state1);
    assert.equal(result1.length, 5);

    // 3 floors has 3 slabs + 12 walls = 15 faces
    const state3 = { ...baseState, showBld: true, showRoof: false, floors: 3 };
    const result3 = computeFaces(state3);
    assert.equal(result3.length, 15);
  });

  it("should use the correct skin colors", () => {
    // Navy skin colors
    const stateNavy = { ...baseState, skin: "navy" as const, showBld: true, showRoof: false, floors: 1 };
    const resultNavy = computeFaces(stateNavy);
    assert.equal(resultNavy[0].colour, PAL.cyan);

    // Paper skin colors
    const statePaper = { ...baseState, skin: "paper" as const, showBld: true, showRoof: false, floors: 1 };
    const resultPaper = computeFaces(statePaper);
    assert.equal(resultPaper[0].colour, PAL.planInk);
  });

  it("should calculate correct vertical coordinates for 3D walls", () => {
    const state = { ...baseState, showBld: true, showRoof: false, floors: 1 };
    const result = computeFaces(state);
    
    // We have:
    // index 0: building slab
    // index 1: south wall
    // index 2: north wall
    // index 3: west wall
    // index 4: east wall
    
    const southWall = result[1];
    const northWall = result[2];
    const westWall = result[3];
    const eastWall = result[4];

    // Check that vertical bounds (Z coordinate) are [0..2.8]
    for (const p of southWall.triangles) {
      assert.ok(p[2] >= 0 && p[2] <= 2.8, `Z-coord of South wall point ${p} is out of bounds`);
    }
    for (const p of northWall.triangles) {
      assert.ok(p[2] >= 0 && p[2] <= 2.8, `Z-coord of North wall point ${p} is out of bounds`);
    }
    for (const p of westWall.triangles) {
      assert.ok(p[2] >= 0 && p[2] <= 2.8, `Z-coord of West wall point ${p} is out of bounds`);
    }
    for (const p of eastWall.triangles) {
      assert.ok(p[2] >= 0 && p[2] <= 2.8, `Z-coord of East wall point ${p} is out of bounds`);
    }
  });
});
