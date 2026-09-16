import assert from "node:assert/strict";
import { test } from "node:test";
import {
  INDUSTRY_SOURCE_BINDING_SCHEMA,
  calibrationIdentity,
  createIndustrySourceBinding,
  describeIndustryBinding,
  evaluateIndustryBinding,
  industrySourceRecordsFrom,
  industrySourceStateFrom,
  isVerifiedEvidenceClass,
  requireCurrentIndustryBinding,
  type IndustrySourceBinding,
  type IndustrySourceState,
} from "./sourceBinding.ts";

const SHA = "a".repeat(64);
const OTHER_SHA = "b".repeat(64);

const bound = (overrides: Record<string, unknown> = {}) => ({
  schema: INDUSTRY_SOURCE_BINDING_SCHEMA,
  projectId: "project-riverside",
  sourceRevisionId: "rev-roof-plan-3",
  sha256: SHA,
  sourceName: "Roof plan",
  locator: { kind: "page", pageIndex: 2 },
  calibrationId: "cal-roof-plan-3",
  units: "m",
  evidenceClass: "traced",
  reference: "Sheet A-201 north plane",
  boundAt: "2026-09-16T02:00:00.000Z",
  ...overrides,
});

const state = (overrides: Partial<IndustrySourceState> = {}): IndustrySourceState => ({
  projectId: "project-riverside",
  sourceRevision: { id: "rev-roof-plan-3", sha256: SHA },
  calibrationId: "cal-roof-plan-3",
  ...overrides,
});

const parse = (overrides: Record<string, unknown> = {}): IndustrySourceBinding =>
  createIndustrySourceBinding(bound(overrides));

test("accepts a complete traced page binding", () => {
  const binding = parse();
  assert.equal(binding.schema, INDUSTRY_SOURCE_BINDING_SCHEMA);
  assert.equal(binding.locator.kind, "page");
  assert.equal(evaluateIndustryBinding(binding, state()).status, "current");
});

test("rejects fabricated, trimmed or wrongly shaped identity instead of defaulting", () => {
  const cases: Array<[string, Record<string, unknown>]> = [
    ["missing schema", { schema: undefined }],
    ["unknown schema", { schema: "xray.industry-source-binding/2" }],
    ["blank project", { projectId: "   " }],
    ["padded project id", { projectId: " project-riverside" }],
    ["padded source id", { sourceRevisionId: "rev-roof-plan-3 " }],
    ["blank reference", { reference: "   " }],
    ["short hash", { sha256: "a".repeat(63) }],
    ["uppercase hash", { sha256: "A".repeat(64) }],
    ["unknown unit", { units: "yd" }],
    ["unknown evidence class", { evidenceClass: "observed" }],
    ["timezone-free timestamp", { boundAt: "2026-09-16T02:00:00" }],
    ["date only", { boundAt: "2026-09-16" }],
    ["negative page", { locator: { kind: "page", pageIndex: -1 } }],
    ["fractional page", { locator: { kind: "page", pageIndex: 1.5 } }],
    ["extra key", { verified: true }],
  ];
  for (const [label, overrides] of cases) {
    assert.throws(() => parse(overrides), `Expected rejection: ${label}`);
  }
});

test("free user wording is trimmed and visible, not silently rejected", () => {
  const binding = parse({ reference: "  Sheet A-201 north plane  " });
  assert.equal(binding.reference, "Sheet A-201 north plane");
});

test("a document locator carries no calibration and a declared reference is never calibrated", () => {
  assert.throws(() =>
    parse({
      locator: { kind: "document", section: "spec" },
      calibrationId: "cal-roof-plan-3",
      evidenceClass: "declared",
    }),
  );
  assert.throws(() => parse({ evidenceClass: "declared" }));
  const declared = parse({
    locator: { kind: "document", section: "supplier-spec" },
    calibrationId: null,
    evidenceClass: "declared",
  });
  assert.equal(declared.calibrationId, null);
});

test("source-derived evidence cannot be bound without its calibration", () => {
  assert.throws(() => parse({ calibrationId: null }));
  assert.throws(() => parse({ calibrationId: null, evidenceClass: "dimensioned" }));
  assert.throws(() => parse({ calibrationId: null, evidenceClass: "inferred" }));
  assert.equal(parse({ calibrationId: null, evidenceClass: "declared", locator: { kind: "model", elementId: "roof-1" } }).calibrationId, null);
});

test("an unbound worksheet reports unbound rather than current", () => {
  assert.deepEqual(evaluateIndustryBinding(null, state()), { status: "unbound", reasons: [] });
  assert.match(describeIndustryBinding({ status: "unbound", reasons: [] }), /Not bound/);
});

test("each edit or replacement of the source invalidates the binding", () => {
  assert.deepEqual(evaluateIndustryBinding(parse(), state({ sourceRevision: { id: "rev-roof-plan-3", sha256: OTHER_SHA } })), {
    status: "stale",
    reasons: ["source-revised"],
  });
  assert.deepEqual(evaluateIndustryBinding(parse(), state({ sourceRevision: { id: "rev-roof-plan-4", sha256: SHA } })), {
    status: "stale",
    reasons: ["source-replaced"],
  });
  assert.deepEqual(evaluateIndustryBinding(parse(), state({ sourceRevision: null })), {
    status: "stale",
    reasons: ["source-missing"],
  });
  assert.deepEqual(evaluateIndustryBinding(parse(), state({ calibrationId: "cal-roof-plan-4" })), {
    status: "stale",
    reasons: ["calibration-changed"],
  });
  assert.deepEqual(evaluateIndustryBinding(parse(), state({ projectId: "project-other" })), {
    status: "stale",
    reasons: ["project-changed"],
  });
});

test("multiple reasons are reported in a stable order without mutating the binding", () => {
  const binding = parse();
  const snapshot = structuredClone(binding);
  const evaluation = evaluateIndustryBinding(
    binding,
    { projectId: "project-other", sourceRevision: { id: "rev-roof-plan-9", sha256: OTHER_SHA }, calibrationId: "cal-9" },
  );
  assert.deepEqual(evaluation.reasons, [
    "project-changed",
    "source-replaced",
    "calibration-changed",
  ]);
  assert.deepEqual(binding, snapshot, "evaluation must not rewrite the stored binding");
  assert.deepEqual(evaluateIndustryBinding(binding, state()), { status: "current", reasons: [] });
});

test("a stale binding is refused with every reason named", () => {
  const binding = parse();
  assert.throws(
    () => requireCurrentIndustryBinding(binding, state({ sourceRevision: null, calibrationId: null })),
    (error: unknown) => {
      assert.ok(error instanceof RangeError);
      assert.match(error.message, /no longer in the project/);
      assert.match(error.message, /calibration changed/);
      return true;
    },
  );
  assert.equal(requireCurrentIndustryBinding(binding, state()), binding);
  assert.equal(requireCurrentIndustryBinding(null, state()), null);
});

test("only traced and dimensioned evidence counts as source-verified", () => {
  assert.equal(isVerifiedEvidenceClass("traced"), true);
  assert.equal(isVerifiedEvidenceClass("dimensioned"), true);
  assert.equal(isVerifiedEvidenceClass("inferred"), false);
  assert.equal(isVerifiedEvidenceClass("declared"), false);
});

test("a typed reference stays a typed reference even while its binding is current", () => {
  const declared = parse({
    evidenceClass: "declared",
    calibrationId: null,
    locator: { kind: "document", section: "supplier-quote" },
  });
  assert.equal(evaluateIndustryBinding(declared, { ...state(), calibrationId: null }).status, "current");
  assert.equal(isVerifiedEvidenceClass(declared.evidenceClass), false);
});

test("re-locking a sheet at a new scale changes the calibration identity", () => {
  const locked = { sheet: 2, locked: true, source: "manual", metresPerUnit: 0.0125, selectedCandidateId: "c-1" };
  assert.equal(calibrationIdentity({ ...locked, locked: false }), null);
  assert.notEqual(calibrationIdentity(locked), calibrationIdentity({ ...locked, metresPerUnit: 0.02 }));
  assert.notEqual(calibrationIdentity(locked), calibrationIdentity({ ...locked, selectedCandidateId: "c-2" }));
  assert.notEqual(calibrationIdentity(locked), calibrationIdentity({ ...locked, source: "declared" }));
  assert.equal(calibrationIdentity(locked), calibrationIdentity({ ...locked }));
});

test("a re-locked calibration invalidates a binding that named the previous one", () => {
  const binding = parse();
  const before = {
    projectId: "project-riverside",
    sources: [{ id: "rev-roof-plan-3", sha256: SHA }],
    calibrations: [{
      id: calibrationIdentity({ sheet: 2, locked: true, source: "manual", metresPerUnit: 0.0125, selectedCandidateId: "c-1" })!,
      sourceRevisionId: "rev-roof-plan-3",
    }],
  };
  assert.equal(evaluateIndustryBinding(binding, industrySourceStateFrom(before, "rev-roof-plan-3")).status, "stale");
});

test("only a hashed document can anchor a binding, and only the active document's calibrations are offered", () => {
  const locked = { sheet: 2, locked: true, source: "manual", metresPerUnit: 0.0125, selectedCandidateId: "c-1" };
  const project = {
    projectId: "project-riverside",
    documents: [
      { id: "doc-plan", sha256: SHA },
      { id: "doc-photo", sha256: null },
    ],
    activeDocumentId: "doc-plan",
    activeSheet: 2,
    calibrations: [locked, { ...locked, sheet: 4, locked: false }],
  };
  const records = industrySourceRecordsFrom(project);
  assert.deepEqual(records.sources, [{ id: "doc-plan", sha256: SHA }]);
  assert.deepEqual(records.calibrations, [{ id: calibrationIdentity(locked)!, sourceRevisionId: "doc-plan" }]);
  assert.equal(records.currentSourceRevisionId, "doc-plan");

  const unhashed = industrySourceRecordsFrom({ ...project, activeDocumentId: "doc-photo" });
  assert.equal(unhashed.currentSourceRevisionId, null);
  assert.deepEqual(unhashed.calibrations, []);
  assert.equal(industrySourceStateFrom({ projectId: "project-riverside", ...unhashed }, null).sourceRevision, null);
});

test("project state is derived from the live record, not from a remembered copy", () => {
  const job = {
    projectId: "project-riverside",
    sources: [{ id: "rev-roof-plan-3", sha256: SHA }],
    calibrations: [{ id: "cal-roof-plan-3", sourceRevisionId: "rev-roof-plan-3" }],
  };
  assert.deepEqual(industrySourceStateFrom(job, "rev-roof-plan-3"), state());
  assert.deepEqual(industrySourceStateFrom(job, null), {
    projectId: "project-riverside",
    sourceRevision: null,
    calibrationId: null,
  });
  assert.deepEqual(industrySourceStateFrom({ ...job, sources: [] }, "rev-roof-plan-3"), {
    projectId: "project-riverside",
    sourceRevision: null,
    calibrationId: null,
  });
  assert.deepEqual(industrySourceStateFrom({ ...job, calibrations: [] }, "rev-roof-plan-3"), {
    projectId: "project-riverside",
    sourceRevision: { id: "rev-roof-plan-3", sha256: SHA },
    calibrationId: null,
  });
  assert.equal(evaluateIndustryBinding(parse(), industrySourceStateFrom(job, "rev-roof-plan-3")).status, "current");
  assert.equal(evaluateIndustryBinding(parse(), industrySourceStateFrom(job, "rev-roof-plan-9")).status, "stale");
});

test("the state carries the document's own label, bounded, and never invents one", () => {
  const named = {
    projectId: "project-riverside",
    documents: [
      { id: "doc-plan", name: "Ground floor plan rev C.pdf", sha256: SHA },
      { id: "doc-blank", name: "   ", sha256: SHA },
      { id: "doc-long", name: `  ${"x".repeat(400)}  `, sha256: SHA },
      { id: "doc-photo", name: "Site photo.jpg", sha256: null },
    ],
    activeDocumentId: "doc-plan",
    activeSheet: 0,
    calibrations: [{ sheet: 0, locked: true, source: "manual", metresPerUnit: 0.01, selectedCandidateId: null }],
  };
  const records = industrySourceRecordsFrom(named);
  assert.deepEqual(records.sources.map((source) => source.name), [
    "Ground floor plan rev C.pdf",
    "   ",
    "  " + "x".repeat(400) + "  ",
  ], "the raw record keeps the document's label untouched");

  const labelOf = (id: string) => industrySourceStateFrom({ projectId: "project-riverside", ...records }, id).sourceRevision?.name;
  assert.equal(labelOf("doc-plan"), "Ground floor plan rev C.pdf");
  assert.equal(labelOf("doc-blank"), "doc-blank", "a blank label falls back to the revision id");
  assert.equal(labelOf("doc-long"), "x".repeat(240), "an overlong label is bounded, not rejected by the contract");
  assert.deepEqual(industrySourceStateFrom({ projectId: "project-riverside", sources: [{ id: "rev-1", sha256: SHA }], calibrations: [] }, "rev-1"), {
    projectId: "project-riverside",
    sourceRevision: { id: "rev-1", sha256: SHA },
    calibrationId: null,
  });

  const bound = parse({
    sourceName: labelOf("doc-plan"),
    sourceRevisionId: "doc-plan",
    calibrationId: records.calibrations[0]!.id,
  });
  assert.equal(bound.sourceName, "Ground floor plan rev C.pdf");
  assert.equal(evaluateIndustryBinding(bound, industrySourceStateFrom({ projectId: "project-riverside", ...records }, "doc-plan")).status, "current");
});
