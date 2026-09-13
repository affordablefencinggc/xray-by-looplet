import assert from "node:assert/strict";
import test from "node:test";
import { calculateDraftRoofArea, type RoofAreaInput } from "./roofArea.ts";

const fixture = (): RoofAreaInput => ({ planes: [{
  id: "plane-a", grossPlanAreaM2: 80, measurementReference: "Synthetic 10 m × 8 m horizontal plane",
  pitchDegrees: Math.atan(3 / 4) * 180 / Math.PI, pitchReference: "Synthetic 3:4 rise/run triangle",
  openings: [{ id: "skylight", planAreaM2: 4, measurementReference: "Synthetic 2 m × 2 m horizontal opening" }],
}] });
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);

test("3:4:5 slope develops 80 m² to 100 m², with an opening deducted once", () => {
  const result = calculateDraftRoofArea(fixture());
  near(result.totals.grossTrueAreaM2, 100);
  near(result.totals.openingTrueAreaM2, 5);
  near(result.totals.netTrueAreaM2, 95);
  near(result.planes[0].slopeFactor, 1.25);
});

test("different pitches develop separately before totals; flat and 45 degree analytic cases", () => {
  const input = fixture();
  input.planes[0].pitchDegrees = 0;
  input.planes.push({ ...input.planes[0], id: "plane-b", pitchDegrees: 45, openings: [] });
  const result = calculateDraftRoofArea(input);
  near(result.planes[0].netTrueAreaM2, 76);
  near(result.planes[1].netTrueAreaM2, 80 * Math.SQRT2);
  near(result.totals.netTrueAreaM2, 76 + 80 * Math.SQRT2);
});

test("empty openings and fully deducted plane have defined results", () => {
  const input = fixture();
  input.planes[0].openings = [];
  near(calculateDraftRoofArea(input).totals.netTrueAreaM2, 100);
  input.planes[0].openings = [{ id: "whole", planAreaM2: 80, measurementReference: "Synthetic whole-plane opening" }];
  assert.equal(calculateDraftRoofArea(input).totals.netTrueAreaM2, 0);
});

test("retains explicit references without mutating input or promoting draft evidence", () => {
  const input = fixture();
  const before = structuredClone(input);
  const result = calculateDraftRoofArea(input);
  assert.deepEqual(input, before);
  assert.equal(result.status, "draft-calculation");
  assert.equal(result.verifiedQuoteEligible, false);
  assert.equal(result.planes[0].pitchReference, before.planes[0].pitchReference);
  result.planes[0].openings[0].measurementReference = "changed output";
  assert.deepEqual(input, before);
});

test("rejects missing, non-finite, negative and vertical pitch inputs without defaults", () => {
  for (const pitchDegrees of [undefined, NaN, Infinity, -1, 90, 100]) {
    const input = fixture();
    assert.throws(() => calculateDraftRoofArea({ planes: [{ ...input.planes[0], pitchDegrees }] }));
  }
  for (const grossPlanAreaM2 of [0, -1, NaN, Infinity]) {
    assert.throws(() => calculateDraftRoofArea({ planes: [{ ...fixture().planes[0], grossPlanAreaM2 }] }));
  }
  assert.throws(() => calculateDraftRoofArea({ planes: [] }));
  assert.throws(() => calculateDraftRoofArea({ planes: [{ ...fixture().planes[0], pitchReference: " " }] }));
  assert.throws(() => calculateDraftRoofArea({ ...fixture(), verified: true }));
});

test("rejects duplicate identities and over-deduction instead of double counting", () => {
  const input = fixture();
  assert.throws(() => calculateDraftRoofArea({ planes: [input.planes[0], input.planes[0]] }), /Duplicate roof plane/);
  input.planes[0].openings.push({ ...input.planes[0].openings[0] });
  assert.throws(() => calculateDraftRoofArea(input), /Duplicate opening/);
  input.planes[0].openings = [{ ...input.planes[0].openings[0], planAreaM2: 81 }];
  assert.throws(() => calculateDraftRoofArea(input), /exceed gross/);
  input.planes[0].openings[0].planAreaM2 = -1;
  assert.throws(() => calculateDraftRoofArea(input));
});

test("rejects both per-plane and combined numeric overflow", () => {
  const input = fixture();
  input.planes[0].grossPlanAreaM2 = Number.MAX_VALUE;
  input.planes[0].pitchDegrees = 60;
  assert.throws(() => calculateDraftRoofArea(input), /finite numeric range/);
  input.planes[0].pitchDegrees = 0;
  input.planes.push({ ...input.planes[0], id: "plane-b" });
  assert.throws(() => calculateDraftRoofArea(input), /totals exceed/);
});
