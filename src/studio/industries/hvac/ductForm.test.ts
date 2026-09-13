import assert from "node:assert/strict";
import test from "node:test";
import { calculateDuctForm, createEmptyDuctForm, createEmptyDuctSection, ductFormSchema, ductFormToSchedule } from "./ductForm.ts";
const field = (value: string) => ({ value, sourceReference: "User schedule A" });
const section = () => ({ ...createEmptyDuctSection(), id: "D1", lengthM: field("10"), widthM: field("0.5"), heightM: field(".3") });
test("empty draft has no invented measurements and cannot calculate", () => {
  assert.deepEqual(createEmptyDuctForm(), { sections: [] });
  assert.throws(() => calculateDuctForm(createEmptyDuctForm()), /Add a straight section/);
  assert.equal(createEmptyDuctSection().lengthM.value, "");
});
test("explicit rectangular inputs calculate 16 square metres and supplied 64 kg", () => {
  const input = { sections: [{ ...section(), includeSheetMass: true, sheetMassKgPerM2: field("4") }] };
  const original = JSON.stringify(input); const result = calculateDuctForm(input);
  assert.equal(result.developedAreaM2, 16); assert.equal(result.sheetMassKg, 64);
  assert.equal(result.verifiedQuoteEligible, false); assert.equal(result.status, "draft-unverified");
  assert.equal(result.sections[0].inputs.lengthM.sourceReference, "User schedule A");
  assert.equal(JSON.stringify(input), original);
});
test("round input ignores hidden rectangle values and optional unchecked mass", () => {
  const input = { sections: [{ ...section(), shape: "round" as const, diameterM: field(".4"), widthM: field("bad"), sheetMassKgPerM2: field("bad") }] };
  assert.equal(calculateDuctForm(input).developedAreaM2, Math.PI * .4 * 10);
  assert.equal(calculateDuctForm(input).sheetMassKg, null);
  assert.ok(!("widthM" in ductFormToSchedule(input).sections[0]));
});
test("mixed explicit sections do not invent missing mass totals", () => {
  const result = calculateDuctForm({ sections: [{ ...section(), includeSheetMass: true, sheetMassKgPerM2: field("4") }, { ...section(), id: "D2" }] });
  assert.equal(result.developedAreaM2, 32); assert.equal(result.sheetMassKg, null);
});
test("rejects empty, nondecimal, nonfinite, nonpositive and missing-reference operands", () => {
  for (const value of ["", " ", "0x10", "Infinity", "-2", "0", "1e400", "1e-400", "2m"]) assert.throws(() => calculateDuctForm({ sections: [{ ...section(), lengthM: field(value) }] }));
  assert.throws(() => calculateDuctForm({ sections: [{ ...section(), lengthM: { value: "2", sourceReference: " " } }] }), /source reference/);
  assert.throws(() => calculateDuctForm({ sections: [{ ...section(), includeSheetMass: true }] }), /sheet mass/);
});
test("duplicate names and unexpected persisted fields are rejected; drafts round trip", () => {
  assert.throws(() => calculateDuctForm({ sections: [section(), section()] }), /unique/);
  assert.equal(ductFormSchema.safeParse({ sections: [], verified: true }).success, false);
  const input = { sections: [section()] }; assert.deepEqual(ductFormSchema.parse(JSON.parse(JSON.stringify(input))), input);
});
