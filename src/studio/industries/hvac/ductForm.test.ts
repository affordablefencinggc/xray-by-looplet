import assert from "node:assert/strict";
import test from "node:test";
import {
  INDUSTRY_BINDING_REASON_TEXT,
  INDUSTRY_SOURCE_BINDING_SCHEMA,
  createIndustrySourceBinding,
  describeIndustryBinding,
  isVerifiedEvidenceClass,
  type IndustryBindingReason,
  type IndustrySourceState,
} from "../sourceBinding.ts";
import { calculateDuctForm, createDuctSourceBinding, createEmptyDuctForm, createEmptyDuctSection, describeEvidenceClass, ductFormSchema, ductFormToSchedule, evaluateDuctFormBinding } from "./ductForm.ts";
const field = (value: string) => ({ value, sourceReference: "User schedule A" });
const section = () => ({ ...createEmptyDuctSection(), id: "D1", lengthM: field("10"), widthM: field("0.5"), heightM: field(".3") });
const SHA = "a".repeat(64);
const OTHER_SHA = "b".repeat(64);
const source = (overrides: Partial<IndustrySourceState> = {}): IndustrySourceState => ({
  projectId: "project-hvac",
  sourceRevision: { id: "rev-duct-1", sha256: SHA },
  calibrationId: "cal-duct-1",
  ...overrides,
});
const tracedBinding = (overrides: Record<string, unknown> = {}) => createIndustrySourceBinding({
  schema: INDUSTRY_SOURCE_BINDING_SCHEMA,
  projectId: "project-hvac",
  sourceRevisionId: "rev-duct-1",
  sha256: SHA,
  sourceName: "rev-duct-1",
  locator: { kind: "page", pageIndex: 2 },
  calibrationId: "cal-duct-1",
  units: "m",
  evidenceClass: "traced",
  reference: "Level 3 duct plan",
  boundAt: "2026-09-16T02:00:00.000Z",
  ...overrides,
});
test("empty draft has no invented measurements and cannot calculate", () => {
  assert.deepEqual(createEmptyDuctForm(), { sections: [], binding: null });
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

test("an unbound worksheet still calculates and is labelled unverified", () => {
  for (const form of [{ sections: [section()], binding: null }, { sections: [section()] }]) {
    const { evaluation, result } = evaluateDuctFormBinding(form, source());
    assert.equal(evaluation.status, "unbound");
    assert.match(describeIndustryBinding(evaluation), /Not bound/);
    assert.equal(result!.developedAreaM2, 16);
    assert.equal(result!.status, "draft-unverified");
    assert.equal(result!.verifiedQuoteEligible, false);
  }
});
test("incomplete supplied mass stays unknown through the evaluator", () => {
  const form = { sections: [{ ...section(), includeSheetMass: true, sheetMassKgPerM2: field("4") }, { ...section(), id: "D2" }], binding: null };
  const { result } = evaluateDuctFormBinding(form, source());
  assert.equal(result!.developedAreaM2, 32);
  assert.equal(result!.sheetMassKg, null);
});
test("a binding built from explicit inputs round-trips through the duct form schema", () => {
  const binding = createDuctSourceBinding({ pageIndex: "2", evidenceClass: "traced", reference: "Level 3 duct plan" }, source());
  assert.equal(binding.projectId, "project-hvac");
  assert.equal(binding.sourceRevisionId, "rev-duct-1");
  assert.equal(binding.sha256, SHA);
  assert.equal(binding.calibrationId, "cal-duct-1");
  assert.equal(binding.units, "m");
  assert.deepEqual(binding.locator, { kind: "page", pageIndex: 2 });
  assert.match(binding.boundAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  const form = { sections: [section()], binding };
  assert.deepEqual(ductFormSchema.parse(JSON.parse(JSON.stringify(form))), form);
  assert.equal(evaluateDuctFormBinding(form, source()).result!.developedAreaM2, 16);
});
test("an empty or non-numeric page index is refused rather than defaulting to 0", () => {
  for (const pageIndex of ["", " ", "0x10", "2.5", "-1", "two", "1e3"]) {
    assert.throws(() => createDuctSourceBinding({ pageIndex, evidenceClass: "declared", reference: "Plan" }, source()), /page number/, pageIndex);
  }
  assert.throws(() => createDuctSourceBinding({ pageIndex: "3", evidenceClass: "", reference: "Plan" }, source()), /evidence class/);
  assert.throws(() => createDuctSourceBinding({ pageIndex: "3", evidenceClass: "declared", reference: "Plan" }, source({ sourceRevision: null })), /source revision/);
  const chosenZero = createDuctSourceBinding({ pageIndex: "0", evidenceClass: "declared", reference: "Supplier sheet" }, source({ calibrationId: null }));
  assert.deepEqual(chosenZero.locator, { kind: "page", pageIndex: 0 });
});
test("a stale binding withholds the result and names every reason", () => {
  const form = { sections: [section()], binding: tracedBinding() };
  const cases: Array<[Partial<IndustrySourceState>, IndustryBindingReason]> = [
    [{ projectId: "project-other" }, "project-changed"],
    [{ sourceRevision: null }, "source-missing"],
    [{ sourceRevision: { id: "rev-duct-2", sha256: SHA } }, "source-replaced"],
    [{ sourceRevision: { id: "rev-duct-1", sha256: OTHER_SHA } }, "source-revised"],
    [{ calibrationId: "cal-duct-2" }, "calibration-changed"],
  ];
  for (const [override, reason] of cases) {
    const { evaluation, result } = evaluateDuctFormBinding(form, source(override));
    assert.equal(evaluation.status, "stale", reason);
    assert.deepEqual(evaluation.reasons, [reason]);
    assert.equal(result, null, `${reason} must withhold the number`);
    assert.ok(describeIndustryBinding(evaluation).includes(INDUSTRY_BINDING_REASON_TEXT[reason]));
  }
});
test("a declared binding is never described as source-verified", () => {
  const binding = tracedBinding({ evidenceClass: "declared", calibrationId: null, locator: { kind: "document", section: "supplier-quote" } });
  const form = { sections: [section()], binding };
  const { evaluation, result } = evaluateDuctFormBinding(form, source({ calibrationId: null }));
  assert.equal(evaluation.status, "current");
  assert.equal(isVerifiedEvidenceClass(binding.evidenceClass), false);
  assert.equal(result!.status, "draft-unverified");
  assert.equal(result!.verifiedQuoteEligible, false);
  assert.match(describeEvidenceClass("declared"), /not source-verified/);
  assert.doesNotMatch(describeEvidenceClass("declared"), /source-derived/);
  assert.match(describeEvidenceClass("traced"), /source-derived/);
  assert.doesNotMatch(describeEvidenceClass("traced"), /not source-verified/);
});
test("source-derived evidence cannot be bound without its calibration", () => {
  assert.throws(() => createDuctSourceBinding({ pageIndex: "2", evidenceClass: "traced", reference: "Plan" }, source({ calibrationId: null })), /calibration/);
  assert.throws(() => tracedBinding({ calibrationId: null }), /calibration/);
});
