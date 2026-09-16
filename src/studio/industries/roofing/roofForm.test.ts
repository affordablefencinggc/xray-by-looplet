import assert from "node:assert/strict";
import test from "node:test";
import { INDUSTRY_SOURCE_BINDING_SCHEMA, describeIndustryBinding, type IndustrySourceState } from "../sourceBinding.ts";
import {
  calculateRoofForm, createEmptyRoofBindingDraft, createEmptyRoofForm, createRoofBinding, describeRoofBindingEvidence,
  editRoofForm, evaluateRoofFormBinding, roofFormInput, roofFormSchema, type RoofBindingDraft,
} from "./roofForm.ts";

const qa = () => ({ calculated: false, planes: [{ id: "QA synthetic roof", grossPlanAreaM2: "80", pitchDegrees: "36.86989764584402",
  measurementReference: "QA supplied 10 by 8 horizontal plane", pitchReference: "QA supplied rise 3 / run 4",
  openings: [{ id: "QA synthetic opening", planAreaM2: "4", measurementReference: "QA supplied 2 by 2 horizontal opening" }],
}] });

test("empty draft persists empty strings without fabricating a zero area or flat pitch", () => {
  const empty = createEmptyRoofForm();
  assert.deepEqual(roofFormSchema.parse(JSON.parse(JSON.stringify(empty))), empty);
  assert.equal(empty.planes[0].pitchDegrees, "");
  assert.equal(empty.planes[0].measurementReference, "");
  assert.throws(() => calculateRoofForm(empty), /explicit non-negative decimal/);
  assert.throws(() => calculateRoofForm({ ...qa(), planes: [{ ...qa().planes[0], pitchDegrees: " " }] }), /explicit non-negative decimal/);
});

test("form converts explicit QA areas/pitch through actual helper to 100 gross, 5 opening, 95 net", () => {
  const form = qa();
  const before = structuredClone(form);
  const result = calculateRoofForm(form);
  assert.deepEqual(result.totals, { grossTrueAreaM2: 100, openingTrueAreaM2: 5, netTrueAreaM2: 95 });
  assert.equal(result.verifiedQuoteEligible, false);
  assert.equal(result.planes[0].measurementReference, form.planes[0].measurementReference);
  assert.deepEqual(form, before);
});

test("multiple planes develop with separate pitches and edits require explicit recalculation", () => {
  const form = qa();
  form.calculated = true;
  form.planes.push({ ...form.planes[0], id: "QA flat roof", grossPlanAreaM2: "20", pitchDegrees: "0", openings: [] });
  assert.equal(calculateRoofForm(form).totals.netTrueAreaM2, 115);
  const changed = editRoofForm(form.planes.map((plane, index) => index === 0 ? { ...plane, grossPlanAreaM2: "84" } : plane));
  assert.equal(changed.calculated, false);
  assert.equal(form.calculated, true);
  assert.equal(calculateRoofForm(changed).totals.netTrueAreaM2, 120);
});

test("form rejects coercion traps and retains existing domain validation", () => {
  for (const bad of ["", " ", "0x50", "80 m2", "1,000", "Infinity", "NaN", "-1"]) {
    assert.throws(() => roofFormInput({ ...qa(), planes: [{ ...qa().planes[0], grossPlanAreaM2: bad }] }));
  }
  assert.throws(() => calculateRoofForm({ ...qa(), planes: [] }));
  assert.throws(() => calculateRoofForm({ ...qa(), planes: [{ ...qa().planes[0], pitchDegrees: "90" }] }));
  assert.throws(() => calculateRoofForm({ ...qa(), planes: [{ ...qa().planes[0], pitchReference: "" }] }));
  assert.throws(() => calculateRoofForm({ ...qa(), planes: [qa().planes[0], qa().planes[0]] }), /Duplicate roof plane/);
  assert.throws(() => calculateRoofForm({ ...qa(), planes: [{ ...qa().planes[0], openings: [{ ...qa().planes[0].openings[0], planAreaM2: "81" }] }] }), /exceed gross/);
  assert.throws(() => roofFormSchema.parse({ ...qa(), verified: true }));
});

const SHA256 = "a".repeat(64);
const boundAt = "2026-09-16T02:00:00.000Z";
const source: IndustrySourceState = {
  projectId: "project-riverside",
  sourceRevision: { id: "rev-roof-plan-3", sha256: SHA256 },
  calibrationId: "cal-roof-plan-3",
};
const state = (overrides: Partial<IndustrySourceState> = {}): IndustrySourceState => ({ ...source, ...overrides });
const bound = (overrides: Partial<RoofBindingDraft> = {}): RoofBindingDraft =>
  ({ pageIndexText: "2", evidenceClass: "traced", reference: "Sheet A-201 north plane", ...overrides });

test("an unbound worksheet still calculates and is labelled unverified", () => {
  const { evaluation, result, error } = evaluateRoofFormBinding({ ...qa(), calculated: true }, source);
  assert.equal(error, null);
  assert.equal(evaluation.status, "unbound");
  assert.equal(result?.status, "draft-calculation");
  assert.equal(result?.totals.netTrueAreaM2, 95);
  assert.equal(result?.verifiedQuoteEligible, false);
  assert.match(describeIndustryBinding(evaluation), /Not bound/);
  assert.match(describeRoofBindingEvidence(null), /Not bound/);
});

test("a binding built from explicit inputs round-trips through the persisted form schema", () => {
  assert.equal(createEmptyRoofForm().binding, null);
  const binding = createRoofBinding(source, bound({ reference: "  Sheet A-201 north plane  " }), boundAt);
  assert.equal(binding.schema, INDUSTRY_SOURCE_BINDING_SCHEMA);
  assert.equal(binding.boundAt, boundAt);
  assert.deepEqual(binding.locator, { kind: "page", pageIndex: 2 });
  assert.deepEqual(
    [binding.projectId, binding.sourceRevisionId, binding.sha256, binding.sourceName, binding.calibrationId, binding.units, binding.evidenceClass, binding.reference],
    ["project-riverside", "rev-roof-plan-3", SHA256, "rev-roof-plan-3", "cal-roof-plan-3", "m", "traced", "Sheet A-201 north plane"],
  );
  const form = { ...qa(), calculated: true, binding };
  const reopened = roofFormSchema.parse(JSON.parse(JSON.stringify(form)));
  assert.deepEqual(reopened, form);
  const { evaluation, result, error } = evaluateRoofFormBinding(reopened, source);
  assert.equal(error, null);
  assert.equal(evaluation.status, "current");
  assert.equal(result?.totals.netTrueAreaM2, 95);
});

test("a stale binding withholds the total and names each reason", () => {
  const form = { ...qa(), calculated: true, binding: createRoofBinding(source, bound(), boundAt) };
  const cases: Array<[string, Partial<IndustrySourceState>, RegExp]> = [
    ["source-revised", { sourceRevision: { id: "rev-roof-plan-3", sha256: "b".repeat(64) } }, /was edited/],
    ["source-replaced", { sourceRevision: { id: "rev-roof-plan-4", sha256: SHA256 } }, /different source revision/],
    ["source-missing", { sourceRevision: null }, /no longer in the project/],
    ["project-changed", { projectId: "project-other" }, /not the project/],
    ["calibration-changed", { calibrationId: "cal-roof-plan-4" }, /calibration changed/],
  ];
  for (const [reason, override, pattern] of cases) {
    const { evaluation, result, error } = evaluateRoofFormBinding(form, state(override));
    assert.equal(evaluation.status, "stale", reason);
    assert.deepEqual(evaluation.reasons, [reason]);
    assert.equal(result, null, `${reason}: a stale worksheet must not report a number`);
    assert.equal(error, null, reason);
    assert.match(describeIndustryBinding(evaluation), pattern, reason);
  }
});

test("a declared binding is never described as source-verified", () => {
  const declared = createRoofBinding(state({ calibrationId: null }), bound({ evidenceClass: "declared", reference: "Supplier quote rev C" }), boundAt);
  assert.equal(declared.calibrationId, null);
  const description = describeRoofBindingEvidence(declared);
  assert.match(description, /declared/);
  assert.match(description, /not verified against the source/);
  assert.doesNotMatch(description, /source-derived/i);
  assert.doesNotMatch(description, /source-verified/i);
  assert.match(describeRoofBindingEvidence(createRoofBinding(source, bound(), boundAt)), /^Source-derived traced evidence/);
  const { evaluation, result } = evaluateRoofFormBinding({ ...qa(), calculated: true, binding: declared }, state({ calibrationId: null }));
  assert.equal(evaluation.status, "current");
  assert.equal(result?.totals.netTrueAreaM2, 95);
  assert.equal(result?.verifiedQuoteEligible, false);
});

test("source-derived evidence without a calibration, and every blank field, is refused", () => {
  assert.throws(() => createRoofBinding(state({ calibrationId: null }), bound(), boundAt), /calibration/);
  assert.throws(() => createRoofBinding({ ...source, sourceRevision: null }, bound(), boundAt), /no current source revision/);
  assert.throws(() => createRoofBinding(source, bound({ evidenceClass: "" }), boundAt), /Evidence class/);
  assert.throws(() => createRoofBinding(source, bound({ reference: "  " }), boundAt), /Reference/);
});

test("a blank page index is refused instead of defaulting to page zero", () => {
  for (const pageIndexText of ["", " ", "-1", "1.5", "page 2", "0x1", "2 0"]) {
    assert.throws(() => createRoofBinding(source, bound({ pageIndexText }), boundAt), /Page index/);
  }
  assert.throws(() => createRoofBinding(source, createEmptyRoofBindingDraft(), boundAt), /Page index/);
  assert.deepEqual(createRoofBinding(source, bound({ pageIndexText: "0" }), boundAt).locator, { kind: "page", pageIndex: 0 });
});
