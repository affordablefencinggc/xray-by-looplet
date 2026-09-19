import test from "node:test";
import assert from "node:assert/strict";
import {
  calculatePitchSlopeFactor,
  calculateTruePitchArea,
  calculateTrueEdgeLength,
  calculateProjectedEdgeLength,
  calculate3DPolygonArea,
  calculateUnequalPitchValleyIntersection,
  unfold3DPolygonTo2D,
  classifyRoofEdge,
  calculateRoofTakeoff,
  generatePyramidHipRoof,
  generateStandardHipRoof,
  generateLShapedHipValleyRoof,
  type Point3D,
} from "./roofGeometry.ts";

const EPSILON = 1e-5;

function isClose(actual: number, expected: number, tolerance = EPSILON): boolean {
  return Math.abs(actual - expected) <= tolerance;
}

test("Fixture 1: Flat roof (0° pitch) — true area equals projected area exactly", () => {
  const factor = calculatePitchSlopeFactor(0);
  assert.equal(factor, 1.0);

  const projectedArea = 150.0;
  const trueArea = calculateTruePitchArea(projectedArea, 0);
  assert.equal(trueArea, 150.0);

  const flatFace: Point3D[] = [
    [0, 0, 3.0],
    [10, 0, 3.0],
    [10, 15, 3.0],
    [0, 15, 3.0],
  ];
  const { areaTrue, areaProjected, pitchDegrees } = calculate3DPolygonArea(flatFace);
  assert.equal(areaProjected, 150.0);
  assert.equal(areaTrue, 150.0);
  assert.ok(isClose(pitchDegrees, 0.0));
});

test("Fixture 2: Standard Australian residential pitch (22.5°) develops with 1.08239 multiplier", () => {
  const factor = calculatePitchSlopeFactor(22.5);
  const expectedFactor = 1 / Math.cos((22.5 * Math.PI) / 180);
  assert.ok(isClose(factor, expectedFactor));
  assert.ok(isClose(factor, 1.0823922));

  const projectedM2 = 80.0;
  const trueM2 = calculateTruePitchArea(projectedM2, 22.5);
  assert.ok(isClose(trueM2, 80.0 * 1.0823922));
});

test("Fixture 3: Steep 45° pitch develops with sqrt(2) = 1.41421356 multiplier", () => {
  const factor = calculatePitchSlopeFactor(45);
  assert.ok(isClose(factor, Math.SQRT2));

  const projectedM2 = 50.0;
  const trueM2 = calculateTruePitchArea(projectedM2, 45);
  assert.ok(isClose(trueM2, 50.0 * Math.SQRT2));

  // 3D face inclined at 45 degrees: eave at y=0, ridge at y=5, rise = 5
  const face45: Point3D[] = [
    [0, 0, 0],
    [10, 0, 0],
    [10, 5, 5],
    [0, 5, 5],
  ];
  const { areaTrue, areaProjected, pitchDegrees } = calculate3DPolygonArea(face45);
  assert.equal(areaProjected, 50.0);
  assert.ok(isClose(areaTrue, 50.0 * Math.SQRT2));
  assert.ok(isClose(pitchDegrees, 45.0));
});

test("Fixture 4: Steep 60° pitch develops with exact 2.0 multiplier", () => {
  const factor = calculatePitchSlopeFactor(60);
  assert.ok(isClose(factor, 2.0));

  const projectedM2 = 100.0;
  const trueM2 = calculateTruePitchArea(projectedM2, 60);
  assert.ok(isClose(trueM2, 200.0));
});

test("Fixture 5: Square hip roof — true 3D hip rafter length L = sqrt(Δx² + Δy² + Δz²)", () => {
  // 10m x 10m building, 25° pitch, apex at (5, 5, h)
  const span = 10.0;
  const pitch = 25.0;
  const rad = (pitch * Math.PI) / 180;
  const rise = 5.0 * Math.tan(rad);

  const corner: Point3D = [0, 0, 0];
  const apex: Point3D = [5, 5, rise];

  const dx = apex[0] - corner[0];
  const dy = apex[1] - corner[1];
  const dz = apex[2] - corner[2];

  const projectedLength = calculateProjectedEdgeLength(corner, apex);
  assert.ok(isClose(projectedLength, Math.hypot(5, 5)));

  const true3DLength = calculateTrueEdgeLength(corner, apex);
  const expected3D = Math.sqrt(dx * dx + dy * dy + dz * dz);
  assert.ok(isClose(true3DLength, expected3D));
  assert.ok(true3DLength > projectedLength);

  // Generate complete pyramid hip roof and inspect takeoff
  const faces = generatePyramidHipRoof(10, 25, 0);
  const takeoff = calculateRoofTakeoff(faces);

  assert.equal(takeoff.faces.length, 4);
  // Total true area must equal 4 * (1/2 * base * slopeLength)
  const slopeLength = 5.0 / Math.cos(rad);
  const faceArea = 0.5 * 10.0 * slopeLength;
  assert.ok(isClose(takeoff.trueSlopeAreaM2, 4 * faceArea));

  // Verify 4 hip edges
  const hipEdges = takeoff.edges.filter((e) => e.kind === "hip");
  assert.equal(hipEdges.length, 4);
  assert.ok(isClose(takeoff.hipLinealM, 4 * expected3D));
  assert.equal(takeoff.valleyLinealM, 0);
});

test("Fixture 6: Symmetrical intersecting valley (22.5° with 22.5°)", () => {
  const result = calculateUnequalPitchValleyIntersection(22.5, 22.5, 90, 2.0);

  // For equal pitches at 90 degrees, valley plan trajectory bisects the corner at 45°
  assert.ok(isClose(result.planIntersectionAngle1Deg, 45.0));
  assert.ok(isClose(result.planIntersectionAngle2Deg, 45.0));

  // Valley slope: tan(θv) = tan(22.5°) / sqrt(2)
  const expectedTanV = Math.tan((22.5 * Math.PI) / 180) / Math.SQRT2;
  const expectedPitchDeg = (Math.atan(expectedTanV) * 180) / Math.PI;
  assert.ok(isClose(result.valleyPitchDeg, expectedPitchDeg));

  // True valley length for 2m rise
  const expectedLength = 2.0 / Math.sin((expectedPitchDeg * Math.PI) / 180);
  assert.ok(isClose(result.trueValleyLengthM, expectedLength));
});

test("Fixture 7: Asymmetrical unequal pitch valley intersection (22.5° with 30°)", () => {
  // 22.5° roof meets 30° roof at a right angle return
  const result = calculateUnequalPitchValleyIntersection(22.5, 30.0, 90, 2.0);

  const tan22_5 = Math.tan((22.5 * Math.PI) / 180);
  const tan30 = Math.tan((30 * Math.PI) / 180);

  // tan(ψ1) = tan(22.5°) / tan(30°)
  const expectedTanPsi1 = tan22_5 / tan30;
  const expectedPsi1Deg = (Math.atan(expectedTanPsi1) * 180) / Math.PI;
  assert.ok(isClose(result.planIntersectionAngle1Deg, expectedPsi1Deg));
  assert.ok(isClose(result.planIntersectionAngle1Deg, 35.657, 0.01));

  // Complementary angle relative to the steeper plane
  assert.ok(isClose(result.planIntersectionAngle2Deg, 90 - 35.657, 0.01));

  // Valley true pitch
  const cot1 = 1 / tan22_5;
  const cot2 = 1 / tan30;
  const runPerRise = Math.sqrt(cot1 * cot1 + cot2 * cot2);
  const expectedValleyPitch = (Math.atan(1 / runPerRise) * 180) / Math.PI;
  assert.ok(isClose(result.valleyPitchDeg, expectedValleyPitch));
  assert.ok(isClose(result.valleyPitchDeg, 18.601, 0.01));

  // True valley length for rise = 2m
  const expectedLength = 2.0 * Math.sqrt(1 + runPerRise * runPerRise);
  assert.ok(isClose(result.trueValleyLengthM, expectedLength));
});

test("Fixture 8: Pitch angle bounds enforcement [0°, 90°)", () => {
  // Valid bounds
  assert.doesNotThrow(() => calculatePitchSlopeFactor(0));
  assert.doesNotThrow(() => calculatePitchSlopeFactor(45));
  assert.doesNotThrow(() => calculatePitchSlopeFactor(89.9));

  // Invalid: negative pitch
  assert.throws(() => calculatePitchSlopeFactor(-0.1), RangeError);
  assert.throws(() => calculatePitchSlopeFactor(-45), RangeError);

  // Invalid: 90° vertical and beyond
  assert.throws(() => calculatePitchSlopeFactor(90), RangeError);
  assert.throws(() => calculatePitchSlopeFactor(90.1), RangeError);
  assert.throws(() => calculatePitchSlopeFactor(180), RangeError);

  // Invalid: non-finite
  assert.throws(() => calculatePitchSlopeFactor(NaN), TypeError);
  assert.throws(() => calculatePitchSlopeFactor(Infinity), TypeError);

  // calculateTruePitchArea enforces non-negative area
  assert.throws(() => calculateTruePitchArea(-10, 25), RangeError);
});

test("Fixture 9: 2D Unfolding area conservation invariant (|A_2D - A_true| < 1e-6)", () => {
  // Test across multiple 3D spatial planar polygons at various orientations and pitches
  const testCases: Point3D[][] = [
    // Triangle at 30°
    [
      [0, 0, 0],
      [8, 0, 0],
      [4, 6, 6 * Math.tan((30 * Math.PI) / 180)],
    ],
    // Quad at 22.5°
    [
      [0, 0, 0],
      [12, 0, 0],
      [12, 5, 5 * Math.tan((22.5 * Math.PI) / 180)],
      [0, 5, 5 * Math.tan((22.5 * Math.PI) / 180)],
    ],
    // Arbitrary inclined planar quad (parallelogram)
    [
      [0, 0, 1],
      [8, 2, 2],
      [6, 10, 4],
      [-2, 8, 3],
    ],
  ];

  for (const vertices of testCases) {
    const { areaTrue } = calculate3DPolygonArea(vertices);
    const unfolded = unfold3DPolygonTo2D(vertices);

    assert.ok(
      Math.abs(unfolded.area2DM2 - areaTrue) < 1e-6,
      `Unfolded area ${unfolded.area2DM2} diverges from 3D true area ${areaTrue}`
    );

    // Verify edge lengths are preserved identically in 2D
    const n = vertices.length;
    for (let i = 0; i < n; i++) {
      const p3A = vertices[i];
      const p3B = vertices[(i + 1) % n];
      const p2A = unfolded.vertices2D[i];
      const p2B = unfolded.vertices2D[(i + 1) % n];

      const len3D = calculateTrueEdgeLength(p3A, p3B);
      const len2D = Math.hypot(p2B[0] - p2A[0], p2B[1] - p2A[1]);

      assert.ok(
        isClose(len3D, len2D, 1e-6),
        `Edge ${i} length in 2D (${len2D}) does not match 3D (${len3D})`
      );
    }
  }
});

test("Fixture 10: Complete Standard Hip Roof takeoff lineal aggregation", () => {
  // 14m x 8m hip roof, 22.5° pitch, 0.45m eaves overhang
  const faces = generateStandardHipRoof(14, 8, 22.5, 0.45);
  const takeoff = calculateRoofTakeoff(faces);

  // All 4 faces present
  assert.equal(takeoff.faces.length, 4);

  // True slope area strictly exceeds projected horizontal area
  assert.ok(takeoff.trueSlopeAreaM2 > takeoff.projectedAreaM2);
  const expectedRatio = calculatePitchSlopeFactor(22.5);
  assert.ok(isClose(takeoff.trueSlopeAreaM2 / takeoff.projectedAreaM2, expectedRatio, 0.01));

  // Edges: 4 hips, 1 central ridge, 4 eaves edges
  const hips = takeoff.edges.filter((e) => e.kind === "hip");
  const ridges = takeoff.edges.filter((e) => e.kind === "ridge");
  const eaves = takeoff.edges.filter((e) => e.kind === "eave");

  assert.equal(hips.length, 4);
  assert.equal(ridges.length, 1);
  assert.equal(eaves.length, 4);

  // Ridge length is (length - span) = 14 - 8 = 6.0m
  assert.ok(isClose(takeoff.ridgeLinealM, 6.0));

  // Total eaves perimeter = 2 * (14 + 0.9) + 2 * (8 + 0.9) = 2 * 14.9 + 2 * 8.9 = 29.8 + 17.8 = 47.6m
  assert.ok(isClose(takeoff.eavesLinealM, 47.6));

  // Hip length: 4 hips of equal length
  assert.ok(takeoff.hipLinealM > 0);
  const singleHip = takeoff.hipLinealM / 4;
  assert.ok(singleHip > 4.0 * Math.SQRT2); // Must exceed 2D plan projection
});
