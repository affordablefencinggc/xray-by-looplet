import assert from "node:assert/strict";
import test from "node:test";
import { calculateSheetCoverage, createEmptySheetCoverage } from "./sheetCoverage.ts";
import { roofFormSchema, calculateRoofForm } from "./roofForm.ts";
import { execute, inputSchema } from "./sheetCoverageTool.ts";

const fixture = () => ({ developedWidthM: "7.62", developedRunM: "10", effectiveCoverM: "0.762", orderLengthM: "6", endLapM: "0.2", measurementReference: "QA rectangular developed surface", supplierReference: "QA explicit sheet and lap inputs", calculated: false });
test("explicit sheet courses account for end laps and preserve reference evidence", () => {
  const input = fixture(); const before = structuredClone(input);
  const r = calculateSheetCoverage(input);
  assert.deepEqual([r.columns, r.courses, r.sheets, r.orderedLinearM], [10, 2, 20, 120]);
  assert.deepEqual([r.coveredWidthM, r.coveredRunM, r.excessWidthM, r.excessRunM], [7.62, 11.8, 0, 1.8]);
  assert.equal(r.verifiedQuoteEligible, false); assert.equal(r.supplierReference, input.supplierReference);
  assert.deepEqual(input, before);
});
test("exact decimal ceilings neither invent sheets nor discard genuine tiny remainders", () => {
  const base = { ...fixture(), developedWidthM: "0.3", effectiveCoverM: "0.1", developedRunM: "11.8" };
  assert.equal(calculateSheetCoverage(base).sheets, 6);
  assert.equal(calculateSheetCoverage({ ...base, developedWidthM: "0.300000001" }).columns, 4);
  assert.equal(calculateSheetCoverage({ ...base, developedRunM: "11.800000001" }).courses, 3);
  assert.equal(calculateSheetCoverage({ ...base, developedRunM: "6", endLapM: "0" }).courses, 1);
});
test("returned explanation includes first-course coverage and exact source decimals", () => {
  const r = calculateSheetCoverage({ ...fixture(), developedRunM: "9.8", orderLengthM: "5", endLapM: "0.2" });
  assert.equal(r.courses, 2);
  assert.equal(r.calculation.courses, "1 + ceil((9.8 - 5) / (5 - 0.2)) = 2");
  assert.equal(Math.ceil(9.8 / (5 - 0.2)), 3); // Regression: model's former substituted formula over-orders.
  const tiny = calculateSheetCoverage({ ...fixture(), developedRunM: "9.800000001", orderLengthM: "5", endLapM: "0.2" });
  assert.equal(tiny.courses, 3);
  assert.equal(tiny.inputs.developedRunM, "9.800000001");
  assert.match(tiny.calculation.courses, /9\.800000001/);
  assert.match(r.limitations[0], /End lap .* IS included/);
});
test("receipt states the exact course boundary instead of leaving it to be extrapolated", () => {
  const at = (developedRunM: string) => calculateSheetCoverage({ ...fixture(), developedRunM, orderLengthM: "5", endLapM: "0.2" });
  // The three values ROOF-01 requires: 9.8 is exactly two courses; both larger runs need three.
  assert.equal(at("9.8").courses, 2);
  assert.equal(at("9.800000001").courses, 3);
  assert.equal(at("9.81").courses, 3);
  const r = at("9.8");
  // The boundary the earlier Developer review invented wrongly is now a returned fact.
  assert.equal(r.calculation.maxRunAtThisCourseCountM, 9.8);
  assert.equal(r.calculation.minRunForAnotherCourseM, 9.800000001);
  assert.match(r.calculation.courseBoundary, /up to and including exactly 9\.8 m/);
  assert.match(r.calculation.courseBoundary, /9\.800000001 m or more needs at least 3 courses/);
  assert.match(r.calculation.boundaryPrecision, /does not establish measurement accuracy or PDF coordinate precision/);
  // Further increases can require more than the immediately next course count.
  assert.equal(at("14.6").courses, 3);
  assert.equal(at("14.600000001").courses, 4);
  assert.equal(at("100").courses, 21);
  assert.match(r.calculation.coursesExpanded, /Course 1 covers a full ordered sheet length of 5 m/);
  assert.match(r.calculation.coursesExpanded, /4\.8 \/ 4\.8/);
  // The substituted formula the model previously used is named and refuted in the receipt itself.
  assert.match(r.calculation.wrongFormulaWarning, /would give 3 instead of the correct 2/);
  const three = at("9.81");
  assert.equal(three.calculation.maxRunAtThisCourseCountM, 14.6);
  assert.equal(three.calculation.minRunForAnotherCourseM, 14.600000001);
  // Side lap and end lap are separate sentences, so neither can be paraphrased into the other.
  assert.match(r.limitations[0], /transverse lap/);
  assert.match(r.limitations[0], /Do not describe end laps or transverse laps as excluded/);
  assert.match(r.limitations[1], /Side lap .* is NOT calculated here/);
  assert.doesNotMatch(r.limitations[0], /Side lap \(/);
  // A single-course run applies no end lap and reports no lower bound above zero.
  const one = at("5");
  assert.equal(one.courses, 1);
  assert.match(one.calculation.coursesExpanded, /fits inside one full ordered sheet/);
  assert.equal(one.calculation.maxRunAtThisCourseCountM, 5);
});
test("empty, impossible and excessive dimensions fail without implicit values", () => {
  assert.throws(() => calculateSheetCoverage(createEmptySheetCoverage()));
  for (const invalid of ["", "NaN", "Infinity", "1e3", "-1", "0", "10000.1", "0.1234567891"]) {
    assert.throws(() => calculateSheetCoverage({ ...fixture(), effectiveCoverM: invalid }));
  }
  for (const endLapM of ["", "6", "7", "-0.1"]) assert.throws(() => calculateSheetCoverage({ ...fixture(), endLapM }));
  assert.throws(() => calculateSheetCoverage({ ...fixture(), effectiveCoverM: "0.000000001" }), /1,000,000/);
  assert.throws(() => calculateSheetCoverage({ ...fixture(), supplierReference: " " }));
});
test("coverage excess conserves lap-adjusted run without inventing a cutting schedule", () => {
  for (const [run, courses, covered, excess] of [["5", 1, 5, 0], ["9.8", 2, 9.8, 0], ["9.81", 3, 14.6, 4.79]] as const) {
    const { calculated: _, ...input } = { ...fixture(), developedWidthM: "8", effectiveCoverM: "0.8", developedRunM: run, orderLengthM: "5", endLapM: "0.2" };
    const r = execute(input);
    assert.equal(r.courses, courses);
    assert.equal(r.coveredRunM, covered);
    assert.equal(r.excessRunM, excess);
    assert.equal(r.orderedLinearM, r.columns * courses * 5);
    assert.ok(Math.abs(r.orderedLinearM / r.columns - (courses - 1) * 0.2 - Number(run) - excess) < 1e-12);
    assert.equal(r.cuttingSchedule.status, "not-calculated");
    assert.equal(r.cuttingSchedule.perSheetWasteM, null);
    assert.equal(r.cuttingSchedule.reusableOffcuts, null);
    assert.match(r.calculation.excessRun, new RegExp(`${excess} m excess run`));
    assert.equal(r.verifiedQuoteEligible, false);
  }
});
test("legacy roof forms and empty independent coverage retain usable area calculations", () => {
  const old = { planes: [{ id: "QA", grossPlanAreaM2: "100", pitchDegrees: "0", measurementReference: "QA", pitchReference: "QA", openings: [] }], calculated: true };
  assert.deepEqual(roofFormSchema.parse(old), old);
  assert.equal(calculateRoofForm({ ...old, sheetCoverage: createEmptySheetCoverage() }).totals.netTrueAreaM2, 100);
  const { calculated: _, ...input } = fixture();
  assert.equal(execute(input).sheets, 20);
  assert.equal(execute(input).status, "draft-sheet-coverage");
  assert.throws(() => execute({ ...input, calculated: true }));
  assert.throws(() => execute({ ...input, unexpected: true }));
  assert.equal(inputSchema.additionalProperties, false);
});
