import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assignQuantityItem, calculateQuantityForm, createEmptyQuantityBindingDraft, createEmptyQuantityForm, createQuantityBinding,
  describeQuantityBindingEvidence, evaluateQuantityFormBinding, quantityFormInput, quantityFormSchema, withQuantityPricing,
  type QuantityBindingDraft, type QuantityForm,
} from "./quantityForm.ts";
import {
  describeIndustryBinding, isVerifiedEvidenceClass, type IndustrySourceState,
} from "../sourceBinding.ts";
import { QS_ITEM_BINDING_SCHEMA } from "./qsItemBinding.ts";
import { createEmptyQsWorksheetState, qsWorksheetStateSchema } from "./qsWorksheetState.ts";
import { emptyPriceBookLibrary } from "../../pricing/priceBooks.ts";
import { parseIndustryDraftLibrary } from "../draftStorage.ts";
import { qsPricingSource } from "./qsPricingContext.ts";

function fixture(): QuantityForm {
  return {
    hierarchyId: "User hierarchy", hierarchyRevision: "A", calculated: false,
    nodes: [
      { key: "root-key", code: "Building", label: "Building works", parentKey: "" },
      { key: "wall-key", code: "Walls", label: "Wall finishes", parentKey: "root-key" },
    ],
    items: [
      { key: "a-key", reference: "a", quantity: "0.10", unit: "m2", evidence: "unverified", nodeKey: "wall-key" },
      { key: "b-key", reference: "b", quantity: "0.20", unit: "m2", evidence: "unverified", nodeKey: "" },
    ],
  };
}

test("empty controlled form contains no invented quantities or source references", () => {
  const empty = createEmptyQuantityForm();
  assert.deepEqual(quantityFormSchema.parse(JSON.parse(JSON.stringify(empty))), empty);
  assert.deepEqual(empty.nodes, []); assert.deepEqual(empty.items, []);
  assert.equal(empty.calculated, false);
  assert.throws(() => calculateQuantityForm(empty), /hierarchy name/);
});

test("manual form resolves hierarchy keys while keeping source null and exact decimal quantities", () => {
  const form = fixture(), before = structuredClone(form);
  const input = quantityFormInput(form), report = calculateQuantityForm(form);
  assert.deepEqual(form, before);
  assert.deepEqual(input.nodes, [
    { id: "Building", label: "Building works", parentId: null },
    { id: "Walls", label: "Wall finishes", parentId: "Building" },
  ]);
  assert.deepEqual(input.assignments, [{ itemId: "a", nodeId: "Walls" }]);
  assert.ok(input.items.every(item => item.source === null && item.evidence === "unverified"));
  assert.equal(report.totals[0].quantity, "0.3");
  assert.equal(report.classifiedTotals[0].quantity, "0.1");
  assert.equal(report.unclassifiedTotals[0].quantity, "0.2");
  assert.deepEqual(report.unclassifiedItemIds, ["b"]);
  assert.equal(report.verifiedQuoteEligible, false);
});

test("reassignment clears the calculated flag and conserves exact totals and source evidence", () => {
  const form = { ...fixture(), calculated: true }, before = structuredClone(form);
  const first = calculateQuantityForm(form);
  const changed = assignQuantityItem(form, "b-key", "wall-key");
  assert.equal(changed.calculated, false);
  assert.deepEqual(form, before);
  const next = calculateQuantityForm(changed);
  assert.deepEqual(next.totals, first.totals);
  assert.equal(next.classifiedTotals[0].quantity, "0.3");
  assert.deepEqual(next.unclassifiedItemIds, []);
  assert.deepEqual(next.unclassifiedTotals, []);
  assert.ok(next.rows.every(row => row.source === null && row.evidence === "unverified"));
  assert.equal(next.classificationComplete, true);
  assert.equal(next.verifiedQuoteEligible, false);
  const unassigned = calculateQuantityForm(assignQuantityItem(changed, "a-key", ""));
  assert.equal(unassigned.unclassifiedTotals[0].quantity, "0.1");
});

test("editing classification codes preserves parent and item identity through stable form keys", () => {
  const form = fixture(); form.nodes[1].code = "Wall-package";
  const report = calculateQuantityForm(form);
  assert.equal(report.rows[0].nodeId, "Wall-package");
  assert.equal(report.nodes[1].parentId, "Building");
  assert.equal(report.nodes[0].rollup[0].quantity, "0.1");
});

test("form quantities never blend units or evidence and cannot promote manual inputs to measured", () => {
  const form = fixture();
  form.items.push({ key: "c-key", reference: "c", quantity: "10", unit: "lm", evidence: "sample", nodeKey: "wall-key" });
  form.items[1].evidence = "inferred";
  const report = calculateQuantityForm(form);
  assert.equal(report.totals.length, 3);
  assert.deepEqual(report.totals.map(row => [row.unit, row.evidence, row.quantity]), [["m2", "unverified", "0.1"], ["m2", "inferred", "0.2"], ["lm", "sample", "10"]]);
  assert.throws(() => quantityFormSchema.parse({ ...form, items: [{ ...form.items[0], evidence: "measured" }] }));
  assert.throws(() => quantityFormSchema.parse({ ...form, items: [{ ...form.items[0], source: { sha256: "a".repeat(64) } }] }));
});

test("invalid references, duplicate codes/items, cycles and invalid decimals fail without partial totals", () => {
  const mutations: Array<(form: QuantityForm) => void> = [
    form => { form.items[0].nodeKey = "missing"; },
    form => { form.nodes[0].parentKey = "missing"; },
    form => { form.nodes[0].parentKey = "wall-key"; },
    form => { form.nodes[1].code = "Building"; },
    form => { form.items[1].reference = "a"; },
    form => { form.items[1].key = "a-key"; },
    form => { form.items[0].quantity = "-1"; },
    form => { form.items[0].quantity = "1,5"; },
    form => { form.items[0].quantity = ""; },
    form => { form.items[0].unit = " "; },
  ];
  for (const change of mutations) { const form = fixture(); change(form); assert.throws(() => calculateQuantityForm(form)); }
  assert.throws(() => assignQuantityItem(fixture(), "missing", "wall-key"));
  assert.throws(() => assignQuantityItem(fixture(), "a-key", "missing"));
});

test("JSON draft roundtrip retains unassigned items and recomputes the same report", () => {
  const form = { ...fixture(), calculated: true };
  const restored = quantityFormSchema.parse(JSON.parse(JSON.stringify(form)));
  assert.deepEqual(calculateQuantityForm(restored), calculateQuantityForm(form));
  assert.equal(restored.items[1].nodeKey, "");
});

test("JSON draft roundtrip retains the exact immutable measured-entity binding", () => {
  const form = fixture();
  form.items[0].entityBinding = {
    format: QS_ITEM_BINDING_SCHEMA,
    itemId: "a",
    projectId: "project-1",
    entityId: "wall-run-7",
    entityType: "wall-run",
    measuredQuantity: "0.1",
    unit: "m2",
    entityGeometrySha256: "c".repeat(64),
    sourceSha256: "d".repeat(64),
    calibrationId: "cal:0:manual:0.01:candidate-1",
    boundAt: "2026-09-19T10:00:00.000Z",
    boundBy: "estimator-selection",
  };
  const restored = quantityFormSchema.parse(JSON.parse(JSON.stringify(form)));
  assert.deepEqual(restored.items[0].entityBinding, form.items[0].entityBinding);
  assert.throws(() => quantityFormSchema.parse({
    ...form,
    items: [{ ...form.items[0], entityBinding: { ...form.items[0].entityBinding, status: "verified" } }, form.items[1]],
  }), /Unrecognized key/);
});

// --- QS-03: binding classified rows to immutable measured evidence ---

const SHA = "a".repeat(64);
const OTHER_SHA = "b".repeat(64);
const BOUND_AT = "2026-09-16T02:00:00.000Z";
const sourceState = (overrides: Partial<IndustrySourceState> = {}): IndustrySourceState => ({
  projectId: "project-1", sourceRevision: { id: "rev-1", sha256: SHA }, calibrationId: "cal-1", ...overrides,
});
const bindingDraft = (overrides: Partial<QuantityBindingDraft> = {}): QuantityBindingDraft => ({
  pageIndexText: "2", evidenceClass: "traced", reference: "Sheet A-201 north plane", units: "m", ...overrides,
});
const boundForm = (
  form: QuantityForm,
  source: IndustrySourceState = sourceState(),
  draft: QuantityBindingDraft = bindingDraft(),
): QuantityForm => ({ ...form, binding: createQuantityBinding(source, draft, BOUND_AT), calculated: true });

test("an unbound worksheet still classifies and is labelled unverified", () => {
  const { evaluation, report } = evaluateQuantityFormBinding({ ...fixture(), calculated: true }, sourceState());
  assert.deepEqual(evaluation, { status: "unbound", reasons: [] });
  assert.ok(report);
  assert.equal(report.totals[0].quantity, "0.3");
  assert.equal(report.verifiedQuoteEligible, false);
  assert.equal(report.status, "draft-classification");
  assert.match(describeIndustryBinding(evaluation), /Not bound/);
  // an uncalculated worksheet has no report to present
  assert.equal(evaluateQuantityFormBinding(fixture(), sourceState()).report, null);
  assert.deepEqual(createEmptyQuantityBindingDraft(), { pageIndexText: "", evidenceClass: "", reference: "", units: "" });
});

test("binding succeeds from explicit inputs and round-trips through the quantity form schema", () => {
  const form = { ...fixture(), calculated: true };
  const bound = boundForm(form);
  const binding = bound.binding!;
  assert.equal(binding.schema, "xray.industry-source-binding/1");
  assert.equal(binding.projectId, "project-1");
  assert.equal(binding.sourceRevisionId, "rev-1");
  assert.equal(binding.sha256, SHA);
  assert.equal(binding.sourceName, "rev-1");
  assert.equal(binding.calibrationId, "cal-1");
  assert.equal(binding.units, "m");
  assert.equal(binding.evidenceClass, "traced");
  assert.equal(binding.reference, "Sheet A-201 north plane");
  assert.equal(binding.boundAt, BOUND_AT);
  assert.deepEqual(binding.locator, { kind: "page", pageIndex: 2 });
  assert.deepEqual(form.nodes, fixture().nodes, "binding must not mutate the original form");
  const restored = quantityFormSchema.parse(JSON.parse(JSON.stringify(bound)));
  assert.deepEqual(restored, bound);
  assert.deepEqual(restored.binding, binding);
  assert.equal(JSON.parse(JSON.stringify(bound)).binding.reference, "Sheet A-201 north plane");
});

test("binding identity comes from the live source and the unit is never invented", () => {
  assert.equal(createQuantityBinding(sourceState(), bindingDraft({ units: "ft" }), BOUND_AT).units, "ft");
  assert.throws(() => createQuantityBinding(sourceState(), bindingDraft({ units: "" }), BOUND_AT), /Units/);
  assert.throws(() => createQuantityBinding(sourceState({ sourceRevision: null }), bindingDraft(), BOUND_AT), /no current source revision/);
});

test("each change to the bound source withholds the report and names the reason", () => {
  const form = boundForm({ ...fixture(), calculated: true });
  const cases: Array<[string, Partial<IndustrySourceState>, RegExp]> = [
    ["source-revised", { sourceRevision: { id: "rev-1", sha256: OTHER_SHA } }, /was edited/],
    ["source-replaced", { sourceRevision: { id: "rev-2", sha256: SHA } }, /different source revision/],
    ["source-missing", { sourceRevision: null }, /no longer in the project/],
    ["project-changed", { projectId: "project-2" }, /not the project this was bound to/],
    ["calibration-changed", { calibrationId: "cal-2" }, /calibration changed/],
  ];
  for (const [label, change, pattern] of cases) {
    const { evaluation, report } = evaluateQuantityFormBinding(form, sourceState(change));
    assert.equal(evaluation.status, "stale", label);
    assert.equal(report, null, `${label} must withhold the report`);
    assert.match(describeIndustryBinding(evaluation), pattern, label);
  }
  const current = evaluateQuantityFormBinding(form, sourceState());
  assert.deepEqual(current.evaluation, { status: "current", reasons: [] });
  assert.ok(current.report);
});

test("a declared binding stays a supplied reference and never reports verified evidence", () => {
  const source = sourceState({ calibrationId: null });
  const binding = createQuantityBinding(source, bindingDraft({ evidenceClass: "declared" }), BOUND_AT);
  assert.equal(binding.evidenceClass, "declared");
  assert.equal(binding.calibrationId, null);
  assert.equal(isVerifiedEvidenceClass(binding.evidenceClass), false);
  assert.match(describeQuantityBindingEvidence(binding), /Supplied evidence \(declared\)/);
  assert.match(describeQuantityBindingEvidence(binding), /not verified against the source/);
  assert.doesNotMatch(describeQuantityBindingEvidence(binding), /Source-derived/);
  const { evaluation, report } = evaluateQuantityFormBinding({ ...fixture(), calculated: true, binding }, source);
  assert.deepEqual(evaluation, { status: "current", reasons: [] });
  assert.ok(report);
  assert.equal(report.verifiedQuoteEligible, false);
  assert.equal(report.status, "draft-classification");
});

test("source-derived evidence without its calibration is refused; a declared binding carries none", () => {
  const uncalibrated = sourceState({ calibrationId: null });
  for (const evidenceClass of ["traced", "dimensioned", "inferred"]) {
    assert.throws(() => createQuantityBinding(uncalibrated, bindingDraft({ evidenceClass }), BOUND_AT), /calibration/, evidenceClass);
  }
  assert.equal(createQuantityBinding(uncalibrated, bindingDraft({ evidenceClass: "declared" }), BOUND_AT).calibrationId, null);
  // a declared reference is not a calibrated measurement, even when the source has a calibration
  assert.throws(() => createQuantityBinding(sourceState(), bindingDraft({ evidenceClass: "declared" }), BOUND_AT), /calibrated measurement/);
});

test("blank user inputs are refused rather than defaulted to a plausible page or class", () => {
  for (const pageIndexText of ["", "   ", "0.5", "-1", "two", "1e2"]) {
    assert.throws(() => createQuantityBinding(sourceState(), bindingDraft({ pageIndexText }), BOUND_AT), /Page index/, pageIndexText);
  }
  assert.throws(() => createQuantityBinding(sourceState(), bindingDraft({ evidenceClass: "" }), BOUND_AT), /Evidence class/);
  assert.throws(() => createQuantityBinding(sourceState(), bindingDraft({ reference: "   " }), BOUND_AT), /Reference/);
  assert.throws(() => createQuantityBinding(sourceState(), bindingDraft({ units: " " }), BOUND_AT), /Units/);
  // page 0 is a real page the user can choose, not a silent default
  assert.deepEqual(createQuantityBinding(sourceState(), bindingDraft({ pageIndexText: "0" }), BOUND_AT).locator, { kind: "page", pageIndex: 0 });
});

test("binding never changes exact decimal totals or the unit and evidence separation", () => {
  const manual = { ...fixture(), calculated: true };
  manual.items.push({ key: "c-key", reference: "c", quantity: "10", unit: "lm", evidence: "sample", nodeKey: "wall-key" });
  manual.items[1].evidence = "inferred";
  const manualReport = evaluateQuantityFormBinding(manual, sourceState()).report!;
  const boundReport = evaluateQuantityFormBinding(boundForm(manual), sourceState()).report!;
  assert.deepEqual(boundReport.totals, manualReport.totals);
  assert.deepEqual(boundReport.totals.map(row => [row.unit, row.evidence, row.quantity]), [
    ["m2", "unverified", "0.1"], ["m2", "inferred", "0.2"], ["lm", "sample", "10"],
  ]);
  assert.deepEqual(boundReport.unclassifiedItemIds, ["b"]);
  assert.deepEqual(boundReport.rows.map(row => row.source), [null, null, null]);
  assert.equal(boundReport.verifiedQuoteEligible, false);
});

test("clearing a binding returns the worksheet to manual and unverified", () => {
  const cleared = { ...boundForm({ ...fixture(), calculated: true }), binding: null, calculated: false };
  assert.deepEqual(quantityFormSchema.parse(JSON.parse(JSON.stringify(cleared))), cleared);
  assert.equal(evaluateQuantityFormBinding({ ...cleared, calculated: true }, sourceState()).evaluation.status, "unbound");
  assert.equal(createEmptyQuantityForm().binding, null);
});

test("evidence classes are described as supplied or source-derived, never promoted", () => {
  assert.match(describeQuantityBindingEvidence(null), /Not bound/);
  assert.match(describeQuantityBindingEvidence(undefined), /Not bound/);
  const traced = createQuantityBinding(sourceState(), bindingDraft({ evidenceClass: "traced" }), BOUND_AT);
  assert.match(describeQuantityBindingEvidence(traced), /Source-derived traced evidence/);
  assert.match(describeQuantityBindingEvidence(traced), /not eligible for verified quotes/);
  assert.equal(isVerifiedEvidenceClass("declared"), false);
  assert.equal(isVerifiedEvidenceClass("inferred"), false);
  assert.equal(isVerifiedEvidenceClass("dimensioned"), true);
});

test("SC10 legacy quantity forms remain unchanged and new forms declare pricing separately", () => {
  const legacy = fixture(); assert.equal('pricing' in legacy, false);
  assert.deepEqual(quantityFormSchema.parse(legacy), legacy);
  assert.equal(createEmptyQuantityForm().pricing, null);
  const priced = { ...legacy, pricing: createEmptyQsWorksheetState('project-1') };
  assert.deepEqual(quantityFormSchema.parse(JSON.parse(JSON.stringify(priced))), priced);
  assert.deepEqual(quantityFormInput(priced), quantityFormInput(legacy), 'commercial state must not enter quantity classification');
});
test("SC10 pricing edits preserve classification completion and reject the wrong project", () => {
  const form = { ...fixture(), calculated: true }, pricing = createEmptyQsWorksheetState('project-1');
  const next = withQuantityPricing(form, pricing, 'project-1', null);
  assert.equal(next.calculated, true); assert.deepEqual(next.items, form.items);
  assert.throws(() => withQuantityPricing(form, pricing, 'other-project', null), /another project/);
  assert.equal('pricing' in form, false, 'the previous form was not mutated');
});
test("SC10 corrupt saved pricing snapshots fail strict form parsing", () => {
  const pricing = createEmptyQsWorksheetState('project-1');
  assert.equal(qsWorksheetStateSchema.safeParse({ ...pricing, snapshots: [{ format: 'xray.qs-cost-snapshot/v1', input: {} }] }).success, false);
  assert.equal(quantityFormSchema.safeParse({ ...fixture(), pricing: { ...pricing, currency: 'invented' } }).success, false);
});
test("SC10 draft size preflight preserves existing inputs and unrelated drafts on failure", () => {
  const shell = { format: 'xray.industry-drafts/1', projectId: 'project-1', revision: 1,
    drafts: { roofing: { revision: 1, form: { preserved: '' } } } };
  const emptyLength = JSON.stringify(shell).length;
  shell.drafts.roofing.form.preserved = 'x'.repeat(2_000_000 - emptyLength - 200);
  const original = JSON.stringify(shell); assert.equal(original.length, 1_999_800);
  parseIndustryDraftLibrary(original, 'project-1');
  const form = fixture(), before = JSON.stringify(form);
  assert.throws(() => withQuantityPricing(form, createEmptyQsWorksheetState('project-1'), 'project-1', original), /exceed the supported size/);
  assert.equal(JSON.stringify(form), before);
  assert.equal(parseIndustryDraftLibrary(original, 'project-1').drafts['quantity-surveying'], undefined);
});
test("SC10 pricing source never reuses another project or a corrupt session recovery value", () => {
  const value = emptyPriceBookLibrary('project-1');
  assert.deepEqual(qsPricingSource('project-1', null, false), { projectId: 'project-1', library: null, loading: true, error: null, sourceReady: false });
  const wrong = qsPricingSource('other-project', { value, raw: null, blocked: false, error: null }, true);
  assert.equal(wrong.library, null); assert.equal(wrong.loading, true);
  const corrupt = qsPricingSource('project-1', { value, raw: 'corrupt bytes', blocked: true, error: 'Supplier data needs recovery.' }, true);
  assert.equal(corrupt.library, null); assert.equal(corrupt.loading, false); assert.equal(corrupt.error, 'Supplier data needs recovery.');
  assert.equal(qsPricingSource('project-1', { value, raw: null, blocked: false, error: null }, true).library, value);
});
