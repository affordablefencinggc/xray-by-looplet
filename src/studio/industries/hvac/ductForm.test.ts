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

test("legacy saved section remains valid with wrap off and no thickness defaults", () => {
  const legacy = section(); delete legacy.includeWrap; delete legacy.insulationThicknessM; delete legacy.longitudinalOverlapM;
  assert.equal(calculateDuctForm({ sections: [legacy] }).wrap, null);
  assert.equal(createEmptyDuctSection().insulationThicknessM?.value, "");
});
test("rectangular external wrap adds thickness and explicit lap without altering metal", () => {
  const input = { sections: [{ ...section(), includeSheetMass: true, sheetMassKgPerM2: field("4"), includeWrap: true, insulationThicknessM: field(".025"), longitudinalOverlapM: field(".05") }] };
  const before = JSON.stringify(input); const result = calculateDuctForm(input);
  assert.equal(result.developedAreaM2, 16); assert.equal(result.sheetMassKg, 64);
  assert.ok(Math.abs(result.wrap!.wrapAreaM2 - 18.5) < 1e-10);
  assert.equal(result.wrap!.sections[0].overlapAreaM2, .5);
  assert.equal(result.wrap!.sections[0].inputs.insulationThicknessM.sourceReference, "User schedule A");
  assert.equal(result.wrap!.verifiedQuoteEligible, false);
  assert.equal(JSON.stringify(input), before);
});
test("round external wrap accepts referenced zero lap and selects only enabled sections", () => {
  const result = calculateDuctForm({ sections: [{ ...section(), shape: "round", diameterM: field(".4"), includeWrap: true, insulationThicknessM: field(".05"), longitudinalOverlapM: field("0") }, { ...section(), id: "unwrapped" }] });
  assert.equal(result.wrap!.sections.length, 1);
  assert.equal(result.wrap!.wrapAreaM2, Math.PI * .5 * 10);
  assert.equal(result.sheetMassKg, null);
});
test("enabled wrap rejects missing thickness, implicit zero lap and missing references", () => {
  const good = { ...section(), includeWrap: true, insulationThicknessM: field(".025"), longitudinalOverlapM: field("0") };
  for (const value of ["", "0", "-1", "Infinity"]) assert.throws(() => calculateDuctForm({ sections: [{ ...good, insulationThicknessM: field(value) }] }));
  for (const value of ["", "-1", "Infinity"]) assert.throws(() => calculateDuctForm({ sections: [{ ...good, longitudinalOverlapM: field(value) }] }));
  assert.throws(() => calculateDuctForm({ sections: [{ ...good, longitudinalOverlapM: { value: "0", sourceReference: "" } }] }));
});
