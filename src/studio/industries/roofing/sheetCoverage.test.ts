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
  assert.match(r.limitations[0], /End laps between courses are included/);
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
