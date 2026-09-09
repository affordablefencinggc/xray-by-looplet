import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calibrationSchema, createTwoPointCalibrationCandidate, createUnverifiedCalibration, getCalibrationForSheet, lockCalibration, reconcileCalibrationCandidates,
  type Calibration, type CalibrationCandidate,
} from "../calibration.ts";
import { createDefaultJob, createGateSpecification, createId, createNewRunSpecification, createReviewDecision, type FencingJob } from "../domain.ts";
import { appendJobRevision, applyEvidenceCommand, type EvidenceCommand, type RevisionDescriptor } from "../evidenceCommands.ts";
import { createEditableRun, migrateTraceState, placeGateOnRun, type TraceState } from "../tracing.ts";
import { useStudio } from "../store.ts";
import {
  BUSY_MEASURE_PANE_REFUSAL, LOCK_REQUIRED_MESSAGE, SAMPLE_SOURCE_REFUSAL, calibrateSheet, calibrateSheetSchema, removeTrace, removeTraceSchema, reviewTakeoffItem, reviewTakeoffItemSchema, traceRun, traceRunSchema,
  type TakeoffPort, type TakeoffState, LOCKED_CALIBRATION_REFUSAL } from "./takeoffTools.ts";

const NOW = "2026-09-09T00:00:00.000Z";
const provenance = { method: "Scale bar", evidence: "5 m scale bar on the title block" };
const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Imported two-page source exactly as importPlan leaves it: unverified per-page calibrations with NO coordinateSpace marker. */
function importedJob(pageCount = 2): FencingJob {
  const job = createDefaultJob(NOW);
  job.documents = [{ id: "plan-1", name: "Site plan.pdf", kind: "pdf", source: "web", importedAt: NOW, sha256: "a".repeat(64), pageCount }];
  job.activeDocumentId = "plan-1";
  job.calibrations = Array.from({ length: pageCount }, (_, sheet) => createUnverifiedCalibration(sheet));
  return job;
}

/** Store-shaped fake: the same guards, error strings, revision bumps and error channels as store.ts, over the real calibration/tracing/evidence helpers. */
function fakePort(job: FencingJob, options: { autosave?: boolean } = {}) {
  const autosave = options.autosave ?? true;
  let state: TakeoffState;
  const get = () => state;
  const set = (patch: Partial<TakeoffState>) => { state = { ...state, ...patch, ...(patch.job && autosave ? { lastSavedJobRevision: patch.job.revision } : {}) }; };
  const calibrationFor = (j: FencingJob, sheet: number) => getCalibrationForSheet(j.calibrations, sheet) ?? createUnverifiedCalibration(sheet);
  const imported = (j: FencingJob) => j.documents.some(d => d.id === j.activeDocumentId && d.source !== "sample");
  const geometry = (j: FencingJob, sheet: number) => j.runs.some(r => r.sheet === sheet) || j.gates.some(g => g.sheet === sheet) || (j.annotations ?? []).some(a => a.sheet === sheet);
  const legacy = (j: FencingJob, sheet: number) => { const c = calibrationFor(j, sheet); return imported(j) && c.coordinateSpace !== "source-page-v1" && (c.candidates.length > 0 || c.locked || geometry(j, sheet)); };
  const assertAuthority = (j: FencingJob, sheet: number) => { if (imported(j) && calibrationFor(j, sheet).coordinateSpace !== "source-page-v1") throw Error("Legacy source coordinates are unverified. Preserve/export the evidence before a reviewed retrace."); };
  const assertCanChange = (j: FencingJob, sheet: number) => {
    if (legacy(j, sheet)) throw Error("Legacy source coordinates are preserved read-only. Export the current manifest in Proof before a reviewed retrace.");
    if (geometry(j, sheet)) throw Error("Remove measurements from this sheet before changing its locked calibration.");
  };
  const fail = (text: string) => set({ calibrationError: text, pending: [] });
  const revised = (j: FencingJob, calibration: Calibration, summary: string) =>
    appendJobRevision({ ...j, calibrations: [...j.calibrations.filter(c => c.sheet !== calibration.sheet), calibration].sort((a, b) => a.sheet - b.sheet) }, { entityType: "job", entityId: j.id, action: "update", summary });
  const unlockedWith = (calibration: Calibration, candidates: CalibrationCandidate[]) => {
    const r = reconcileCalibrationCandidates(candidates), s = r.selectedCandidateId ? candidates.find(c => c.id === r.selectedCandidateId) ?? null : null;
    return calibrationSchema.parse({ ...calibration, locked: false, metresPerUnit: s?.metresPerUnit ?? 1, source: s?.source ?? "unverified", confidence: s?.confidence ?? 0, knownDistanceM: s?.knownDistanceM ?? null,
      points: s?.points ?? null, inputDistance: s?.inputDistance ?? null, candidates, selectedCandidateId: r.selectedCandidateId, conflict: r.conflict });
  };
  const traced = (j: FencingJob, next: TraceState, descriptor: RevisionDescriptor) => appendJobRevision({ ...j, runs: next.runs, gates: next.gates }, descriptor);
  const review = (command: EvidenceCommand) => { try { set({ job: applyEvidenceCommand(get().job, command), traceError: null }); } catch (error) { set({ traceError: message(error) }); } };
  const metricTool = (tool: TakeoffState["tool"]) => tool === "length" || tool === "area" || tool === "sketch";
  state = {
    job, sheet: 0, currentCalibration: calibrationFor(job, 0), calibrationCapture: null, calibrationError: null, traceError: null, photoError: null, tool: "none", pending: [], selectedRunId: null,
    hydrationStatus: "ready", persistenceHydrated: true, persistenceRecoveryBlocked: false, persistenceError: null, lastSavedJobRevision: job.revision,
    setSheet: sheet => {
      const s = get(), doc = s.job.documents.find(d => d.id === s.job.activeDocumentId), safe = Math.max(0, Math.min((doc?.pageCount ?? 1) - 1, sheet));
      set({ job: { ...s.job, activeSheet: safe }, sheet: safe, currentCalibration: calibrationFor(s.job, safe), calibrationCapture: null, calibrationError: null, pending: [],
        selectedRunId: s.selectedRunId && s.job.runs.some(r => r.id === s.selectedRunId && r.sheet === safe) ? s.selectedRunId : null });
    },
    startCalibrationCapture: () => {
      const s = get();
      if (legacy(s.job, s.sheet)) { fail("Legacy source coordinates require reviewed recovery; export the current manifest in Proof."); return; }
      set({ calibrationCapture: { sheet: s.sheet, points: [] }, calibrationError: null, pending: [], tool: "none" });
    },
    cancelCalibrationCapture: () => set({ calibrationCapture: null, calibrationError: null }),
    addCalibrationPoint: p => {
      const s = get(), c = s.calibrationCapture;
      if (!c || c.sheet !== s.sheet) { fail("Start a two-point calibration on the current sheet first."); return; }
      if (c.points.length >= 2) { fail("Two calibration points are already captured. Enter the known distance or start again."); return; }
      set({ calibrationCapture: { ...c, points: [...c.points, p] }, calibrationError: null });
    },
    upsertManualCalibrationCandidate: input => {
      try {
        const s = get(), c = s.calibrationCapture;
        if (!c || c.sheet !== s.sheet || c.points.length !== 2) throw Error("Capture exactly two points on the current sheet before entering a known distance.");
        assertCanChange(s.job, s.sheet);
        const calibration = calibrationFor(s.job, s.sheet);
        if (imported(s.job) && input.coordinateSpace !== "source-page-v1") throw Error("Source calibration requires explicit source-page-v1 coordinates.");
        const candidateId = input.candidateId ?? `manual-sheet-${s.sheet}`;
        const candidate = createTwoPointCalibrationCandidate({ id: candidateId, source: "manual", points: [c.points[0], c.points[1]], distance: input.distance, transform: calibration.transform, confidence: input.confidence ?? 1, provenance: input.provenance });
        const next = unlockedWith({ ...calibration, coordinateSpace: input.coordinateSpace ?? calibration.coordinateSpace }, [...calibration.candidates.filter(e => e.id !== candidateId), candidate]);
        set({ job: revised(s.job, next, `Updated calibration candidate for sheet ${s.sheet + 1}.`), currentCalibration: next, calibrationCapture: null, calibrationError: null, pending: [] });
      } catch (error) { fail(message(error)); }
    },
    lockCurrentCalibration: candidateId => {
      try {
        const s = get();
        if (legacy(s.job, s.sheet)) throw Error("Legacy source calibration cannot authorize measurements; export before reviewed recovery.");
        const calibration = calibrationFor(s.job, s.sheet);
        if (calibration.locked && (candidateId === undefined || candidateId === calibration.selectedCandidateId)) { set({ calibrationError: null }); return; }
        if (geometry(s.job, s.sheet) && (!calibration.locked || (candidateId !== undefined && candidateId !== calibration.selectedCandidateId))) throw Error("Remove measurements from this sheet before changing its locked calibration.");
        const next = lockCalibration(calibration, candidateId ?? calibration.selectedCandidateId);
        set({ job: revised(s.job, next, `Locked calibration for sheet ${s.sheet + 1}.`), currentCalibration: next, calibrationCapture: null, calibrationError: null, pending: [] });
      } catch (error) { fail(message(error)); }
    },
    setTool: tool => set({ tool, pending: [] }),
    addPoint: p => {
      const s = get();
      if (s.calibrationCapture) { s.addCalibrationPoint(p); return; }
      try { assertAuthority(s.job, s.sheet); } catch (error) { fail(message(error)); return; }
      if (s.tool === "count") { set({ traceError: "Select a run before placing a gate." }); return; }
      if (metricTool(s.tool) && !calibrationFor(s.job, s.sheet).locked) { fail("Lock a verified calibration for this sheet before drawing metric measurements."); return; }
      set({ pending: [...s.pending, p] });
    },
    commitPending: () => {
      const s = get();
      try { assertAuthority(s.job, s.sheet); } catch (error) { fail(message(error)); return; }
      const calibration = calibrationFor(s.job, s.sheet);
      if (metricTool(s.tool) && !calibration.locked) { fail("Lock a verified calibration for this sheet before drawing metric measurements."); return; }
      if (s.tool !== "length" || s.pending.length < 2) return;
      try {
        const previous = migrateTraceState(s.job.runs, s.job.gates, s.job.calibrations), id = createId("run");
        const run = createEditableRun({ id, revision: 1, sheet: s.sheet, label: `Run ${String(s.job.runs.length + 1).padStart(2, "0")}`, points: s.pending, lengthM: 0, specification: createNewRunSpecification(s.job), photoIds: [], review: createReviewDecision() }, calibration, previous.gates);
        const next = { ...previous, runs: [...previous.runs, run] };
        set({ job: traced(s.job, next, { entityType: "run", entityId: id, action: "create", summary: `Created ${run.label}.` }), pending: [], selectedRunId: id, traceError: null });
      } catch (error) { set({ traceError: message(error), pending: [] }); }
    },
    clearPending: () => set({ pending: [] }),
    updateRunSpecification: (runId, expectedRevision, patch) => {
      try { set({ job: applyEvidenceCommand(get().job, { type: "update-run-specification", runId, expectedRevision, patch }), photoError: null }); } catch (error) { set({ photoError: message(error) }); }
    },
    approveRun: (runId, expectedRevision, actor, note) => review({ type: "review-run", runId, expectedRevision, decision: "approve", actor, note }),
    rejectRun: (runId, expectedRevision, actor, note) => review({ type: "review-run", runId, expectedRevision, decision: "reject", actor, note }),
    approveGate: (gateId, expectedRevision, actor, note) => review({ type: "review-gate", gateId, expectedRevision, decision: "approve", actor, note }),
    rejectGate: (gateId, expectedRevision, actor, note) => review({ type: "review-gate", gateId, expectedRevision, decision: "reject", actor, note }),
    removeRun: (runId, expectedRevision) => {
      try {
        const s = get(), previous = migrateTraceState(s.job.runs, s.job.gates, s.job.calibrations), run = previous.runs.find(e => e.id === runId);
        if (!run) throw Error(`Unknown fence run: ${runId}`);
        if (expectedRevision !== undefined && expectedRevision !== run.revision) throw Error(`Stale fence run revision for ${runId}: expected ${expectedRevision}, current ${run.revision}.`);
        assertAuthority(s.job, run.sheet);
        const next = { runs: previous.runs.filter(e => e.id !== runId), gates: previous.gates.filter(g => g.runId !== runId) };
        set({ job: traced(s.job, next, { entityType: "run", entityId: run.id, action: "delete", summary: `Removed ${run.label}.` }), traceError: null, selectedRunId: s.selectedRunId === runId ? null : s.selectedRunId });
      } catch (error) { set({ traceError: message(error) }); }
    },
  };
  const port: TakeoffPort = { getState: get };
  return { port, get, set };
}

const bar = { points: [{ x: 100, y: 100 }, { x: 400, y: 500 }] as [{ x: number; y: number }, { x: number; y: number }], knownDistance: { value: 5, unit: "m" as const } };
const calibrateArgs = (state: TakeoffState, sheet: number, lock = true) => ({ expectedJobId: state.job.id, expectedRevision: state.job.revision, sheet, ...bar, provenance, lock });
const traceArgs = (state: TakeoffState, sheet: number, points = [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 400 }]) => ({ expectedJobId: state.job.id, expectedRevision: state.job.revision, sheet, points });
const clean = (state: TakeoffState) => state.calibrationCapture === null && state.pending.length === 0 && state.tool === "none";

/** A locked source-page calibration plus one gate on the run, built with the real tracing helpers. */
function withGate(job: FencingJob, runId: string): FencingJob {
  const run = job.runs.find(r => r.id === runId)!, calibration = job.calibrations.find(c => c.sheet === run.sheet)!;
  const gate = placeGateOnRun({ ...createGateSpecification(), id: "gate-1", revision: 1, sheet: run.sheet, label: "Gate 01", point: run.points[1], runId: run.id, widthM: 1, photoIds: [], review: createReviewDecision() }, run, calibration);
  const measured = createEditableRun({ ...run, revision: (run.revision ?? 1) + 1 }, calibration, [gate]);
  return { ...job, gates: [gate], runs: job.runs.map(r => r.id === runId ? measured : r) };
}

test("input schemas are strict and reject unknown keys, bad geometry, non-positive distances and blank actors", () => {
  const base = { expectedJobId: "job-1", expectedRevision: 1 };
  assert.equal(calibrateSheetSchema.safeParse({ ...base, sheet: 0, ...bar, provenance, lock: true }).success, true);
  assert.equal(calibrateSheetSchema.safeParse({ ...base, sheet: 0, ...bar, provenance, lock: true, extra: 1 }).success, false);
  assert.equal(calibrateSheetSchema.safeParse({ ...base, sheet: 0, points: [bar.points[0]], knownDistance: bar.knownDistance, provenance, lock: true }).success, false);
  assert.equal(calibrateSheetSchema.safeParse({ ...base, sheet: 0, ...bar, knownDistance: { value: 0, unit: "m" }, provenance, lock: true }).success, false);
  assert.equal(calibrateSheetSchema.safeParse({ ...base, sheet: 0, ...bar, knownDistance: { value: 5, unit: "yd" }, provenance, lock: true }).success, false);
  assert.equal(calibrateSheetSchema.safeParse({ ...base, sheet: 0, ...bar, provenance: { method: "", evidence: "x" }, lock: true }).success, false);
  assert.equal(traceRunSchema.safeParse({ ...base, sheet: 0, points: [{ x: 0, y: 0 }] }).success, false);
  assert.equal(traceRunSchema.safeParse({ ...base, sheet: 0, points: Array.from({ length: 501 }, (_, i) => ({ x: i, y: 0 })) }).success, false);
  assert.equal(traceRunSchema.safeParse({ ...base, sheet: 0, points: [{ x: 0, y: 0 }, { x: Number.NaN, y: 0 }] }).success, false);
  assert.equal(traceRunSchema.safeParse({ ...base, sheet: 0, points: [{ x: 0, y: 0 }, { x: 1, y: 0 }], specification: { corners: [] } }).success, false);
  assert.equal(traceRunSchema.safeParse({ ...base, sheet: 0, points: [{ x: 0, y: 0 }, { x: 1, y: 0 }], specification: { construction: { trade: "Fencing" }, notes: "n" } }).success, true);
  assert.equal(reviewTakeoffItemSchema.safeParse({ ...base, kind: "run", id: "run-1", expectedItemRevision: 1, decision: "approve", actor: "   " }).success, false);
  assert.equal(reviewTakeoffItemSchema.safeParse({ ...base, kind: "item", id: "run-1", expectedItemRevision: 1, decision: "approve", actor: "Dana" }).success, false);
  assert.equal(removeTraceSchema.safeParse({ ...base, runId: "run-1", expectedItemRevision: 0 }).success, false);
  assert.equal(removeTraceSchema.safeParse({ ...base, runId: "run-1", expectedItemRevision: 1 }).success, true);
});

test("calibrateSheet runs the two-point sequence, locks with source-page coordinates and reads the scale back", () => {
  const f = fakePort(importedJob());
  const receipt = calibrateSheet(f.port, calibrateArgs(f.get(), 1));
  const state = f.get(), calibration = state.job.calibrations.find(c => c.sheet === 1)!;
  assert.equal(receipt.sheet, 1); assert.equal(receipt.originalPage, 2); assert.equal(receipt.locked, true); assert.equal(receipt.source, "manual"); assert.equal(receipt.confidence, 1);
  assert.equal(receipt.candidateId, "manual-sheet-1"); assert.equal(receipt.selectedCandidateId, "manual-sheet-1"); assert.equal(receipt.coordinateSpace, "source-page-v1"); assert.equal(receipt.knownDistanceM, 5);
  assert.ok(Math.abs(receipt.metresPerUnit! - 0.01) < 1e-12); assert.equal(receipt.metresPerUnit, calibration.metresPerUnit);
  assert.deepEqual(receipt.projectRevision, { before: 1, after: 3 }); assert.equal(receipt.readbackVerified, true); assert.equal(receipt.saved, true);
  assert.equal(receipt.sourceKind, "web"); assert.equal(receipt.documentId, "plan-1"); assert.equal(receipt.sourceSha256, "a".repeat(64));
  assert.equal(calibration.locked, true); assert.equal(calibration.coordinateSpace, "source-page-v1"); assert.equal(calibration.candidates[0].provenance.documentId, "plan-1");
  assert.deepEqual(calibration.points, bar.points); assert.equal(state.sheet, 1); assert.ok(clean(state)); assert.equal(state.calibrationError, null);
  assert.ok(receipt.blockers.some(b => b.code === "runs")); assert.ok(!receipt.blockers.some(b => b.code === "document"));
  const unlocked = fakePort(importedJob());
  const draft = calibrateSheet(unlocked.port, calibrateArgs(unlocked.get(), 0, false));
  assert.equal(draft.locked, false); assert.equal(draft.source, "manual"); assert.deepEqual(draft.projectRevision, { before: 1, after: 2 }); assert.equal(draft.readbackVerified, true);
  assert.equal(unlocked.get().job.calibrations[0].locked, false); assert.equal(unlocked.get().job.calibrations[0].selectedCandidateId, "manual-sheet-0");
});

test("calibrateSheet fails closed before touching the store: sample source, wrong project or revision, missing page, busy pane, foreign provenance", () => {
  const sample = fakePort(createDefaultJob(NOW));
  assert.throws(() => calibrateSheet(sample.port, calibrateArgs(sample.get(), 0)), { message: SAMPLE_SOURCE_REFUSAL });
  assert.equal(sample.get().job.revision, 1); assert.equal(sample.get().job.calibrations[0].candidates.length, 0);
  const f = fakePort(importedJob());
  assert.throws(() => calibrateSheet(f.port, { ...calibrateArgs(f.get(), 0), expectedJobId: "job-other" }), /The active project changed/);
  assert.throws(() => calibrateSheet(f.port, { ...calibrateArgs(f.get(), 0), expectedRevision: 7 }), /The project revision changed/);
  assert.throws(() => calibrateSheet(f.port, calibrateArgs(f.get(), 2)), /Page 3 is not part of the active source \(2 pages\)/);
  assert.throws(() => calibrateSheet(f.port, { ...calibrateArgs(f.get(), 0), provenance: { ...provenance, documentId: "plan-9" } }), /must reference the active source document/);
  f.set({ pending: [{ x: 1, y: 1 }] });
  assert.throws(() => calibrateSheet(f.port, calibrateArgs(f.get(), 0)), { message: BUSY_MEASURE_PANE_REFUSAL });
  f.set({ pending: [], calibrationCapture: { sheet: 0, points: [] } });
  assert.throws(() => calibrateSheet(f.port, calibrateArgs(f.get(), 0)), { message: BUSY_MEASURE_PANE_REFUSAL });
  f.set({ calibrationCapture: null, persistenceRecoveryBlocked: true });
  assert.throws(() => calibrateSheet(f.port, calibrateArgs(f.get(), 0)), /Wait for project recovery/);
  assert.equal(f.get().job.revision, 1); assert.equal(f.get().job.calibrations.every(c => c.candidates.length === 0), true);
});

test("calibrateSheet surfaces the store's own errors verbatim and leaves the Measure pane tidy", () => {
  const coincident = fakePort(importedJob());
  assert.throws(() => calibrateSheet(coincident.port, { ...calibrateArgs(coincident.get(), 0), points: [{ x: 5, y: 5 }, { x: 5, y: 5 }] }), { message: "Calibration points must be distinct in document space." });
  assert.ok(clean(coincident.get())); assert.equal(coincident.get().job.revision, 1); assert.equal(coincident.get().calibrationError, null);
  const legacyJob = importedJob();
  legacyJob.calibrations[0] = { ...legacyJob.calibrations[0], candidates: [createTwoPointCalibrationCandidate({ id: "old", source: "manual", points: bar.points, distance: bar.knownDistance, transform: legacyJob.calibrations[0].transform, confidence: 1, provenance: { ...provenance, documentId: "plan-1" } })], selectedCandidateId: "old", source: "manual", confidence: 1, metresPerUnit: 0.01 };
  const legacy = fakePort(legacyJob);
  assert.throws(() => calibrateSheet(legacy.port, calibrateArgs(legacy.get(), 0)), { message: "Legacy source coordinates require reviewed recovery; export the current manifest in Proof." });
  assert.equal(legacy.get().job.revision, 1); assert.ok(clean(legacy.get()));
  const measured = fakePort(importedJob());
  calibrateSheet(measured.port, calibrateArgs(measured.get(), 0));
  const run = traceRun(measured.port, traceArgs(measured.get(), 0));
  assert.throws(() => calibrateSheet(measured.port, { ...calibrateArgs(measured.get(), 0), knownDistance: { value: 10, unit: "m" } }), { message: LOCKED_CALIBRATION_REFUSAL });
  assert.throws(() => calibrateSheet(measured.port, { ...calibrateArgs(measured.get(), 0), knownDistance: { value: 10, unit: "m" }, replaceLocked: true }), { message: "Remove measurements from this sheet before changing its locked calibration." });
  assert.equal(measured.get().job.revision, run.projectRevision.after); assert.equal(measured.get().job.calibrations[0].knownDistanceM, 5); assert.ok(clean(measured.get()));
});

test("calibrateSheet records a conflicting manual candidate but refuses to lock over the conflict", () => {
  const job = importedJob();
  const declared = { id: "declared", source: "declared" as const, metresPerUnit: 0.02, confidence: 0.9, inputDistance: null, knownDistanceM: null, points: null, provenance: { ...provenance, documentId: "plan-1" } };
  job.calibrations[0] = calibrationSchema.parse({ ...job.calibrations[0], coordinateSpace: "source-page-v1", candidates: [declared], selectedCandidateId: "declared", source: "declared", confidence: 0.9, metresPerUnit: 0.02 });
  const f = fakePort(job);
  assert.throws(() => calibrateSheet(f.port, calibrateArgs(f.get(), 0)), { message: "Calibration candidates conflict; select one explicitly before locking. The manual candidate \"manual-sheet-0\" is recorded unlocked at project revision 2." });
  const calibration = f.get().job.calibrations[0];
  assert.equal(f.get().job.revision, 2); assert.equal(calibration.locked, false); assert.equal(calibration.candidates.length, 2); assert.deepEqual(calibration.conflict?.candidateIds, ["declared", "manual-sheet-0"]);
  // The store's error stays visible in the Measure pane exactly as it would after the same failure by hand.
  assert.ok(clean(f.get())); assert.equal(f.get().calibrationError, "Calibration candidates conflict; select one explicitly before locking.");
});

test("traceRun draws through the Measure tool, identifies the run by id diff and reads its lengths back from the record", () => {
  const f = fakePort(importedJob());
  calibrateSheet(f.port, calibrateArgs(f.get(), 0));
  const receipt = traceRun(f.port, { ...traceArgs(f.get(), 0), label: "Boundary" });
  const state = f.get(), run = state.job.runs[0];
  assert.equal(state.job.runs.length, 1); assert.equal(receipt.runId, run.id); assert.equal(receipt.revision, 1); assert.equal(receipt.label, "Run 01"); assert.equal(receipt.requestedLabel, "Boundary");
  assert.ok(receipt.notices[0].includes("\"Boundary\" was not applied"));
  assert.equal(receipt.vertices, 3); assert.equal(receipt.review, "draft"); assert.equal(receipt.sheet, 0); assert.equal(receipt.originalPage, 1);
  assert.ok(Math.abs(receipt.lengthM! - 7) < 1e-9); assert.equal(receipt.lengthM, run.lengthM); assert.equal(receipt.grossLengthM, run.grossLengthM); assert.equal(receipt.gateDeductionM, 0);
  assert.deepEqual(receipt.projectRevision, { before: 3, after: 4 }); assert.equal(receipt.readbackVerified, true); assert.equal(receipt.saved, true); assert.equal(receipt.coordinateSpace, "source-page-v1");
  assert.ok(receipt.missingSpecification.includes("trade / work package")); assert.ok(receipt.blockers.some(b => b.code === "run-specification" && b.entityId === run.id));
  assert.ok(!receipt.blockers.some(b => b.code === "calibration")); assert.ok(clean(state)); assert.equal(state.selectedRunId, run.id);
  const specified = traceRun(f.port, { ...traceArgs(f.get(), 0, [{ x: 0, y: 500 }, { x: 600, y: 500 }]), specification: { construction: { trade: "Fencing", reference: "Sheet 1 boundary" }, notes: "Rear boundary" } });
  const second = f.get().job.runs.find(r => r.id === specified.runId)!;
  assert.equal(f.get().job.runs.length, 2); assert.equal(specified.revision, 2); assert.equal(second.specification.construction?.trade, "Fencing"); assert.equal(second.specification.construction?.assembly, "generic");
  assert.equal(second.specification.notes, "Rear boundary"); assert.deepEqual(specified.missingSpecification, []); assert.ok(Math.abs(specified.lengthM! - 6) < 1e-9);
  assert.deepEqual(specified.projectRevision, { before: 4, after: 6 }); assert.equal(specified.readbackVerified, true); assert.equal(specified.label, "Run 02");
  const unsaved = fakePort(importedJob(), { autosave: false });
  calibrateSheet(unsaved.port, calibrateArgs(unsaved.get(), 0));
  assert.equal(traceRun(unsaved.port, traceArgs(unsaved.get(), 0)).saved, false);
});

test("traceRun refuses samples, unlocked and legacy sheets, zero-length segments and invalid specifications without inventing a run", () => {
  const sample = fakePort(createDefaultJob(NOW));
  assert.throws(() => traceRun(sample.port, traceArgs(sample.get(), 0)), { message: SAMPLE_SOURCE_REFUSAL });
  const unlocked = fakePort(importedJob());
  assert.throws(() => traceRun(unlocked.port, traceArgs(unlocked.get(), 0)), { message: LOCK_REQUIRED_MESSAGE });
  assert.equal(unlocked.get().job.runs.length, 0); assert.equal(unlocked.get().job.revision, 1); assert.ok(clean(unlocked.get())); assert.equal(unlocked.get().sheet, 0);
  const draft = fakePort(importedJob());
  calibrateSheet(draft.port, calibrateArgs(draft.get(), 0, false));
  assert.throws(() => traceRun(draft.port, traceArgs(draft.get(), 0)), { message: LOCK_REQUIRED_MESSAGE });
  assert.equal(draft.get().job.runs.length, 0);
  const legacyJob = importedJob();
  legacyJob.calibrations[0] = lockCalibration({ ...legacyJob.calibrations[0], candidates: [createTwoPointCalibrationCandidate({ id: "old", source: "manual", points: bar.points, distance: bar.knownDistance, transform: legacyJob.calibrations[0].transform, confidence: 1, provenance: { ...provenance, documentId: "plan-1" } })] });
  const legacy = fakePort(legacyJob);
  assert.throws(() => traceRun(legacy.port, traceArgs(legacy.get(), 0)), { message: "Legacy source coordinates are unverified. Preserve/export the evidence before a reviewed retrace." });
  assert.equal(legacy.get().job.runs.length, 0); assert.ok(clean(legacy.get()));
  const f = fakePort(importedJob());
  calibrateSheet(f.port, calibrateArgs(f.get(), 0));
  const revision = f.get().job.revision;
  assert.throws(() => traceRun(f.port, traceArgs(f.get(), 0, [{ x: 0, y: 0 }, { x: 0, y: 0 }])), { message: "Fence run segment 0 has zero length." });
  assert.throws(() => traceRun(f.port, { ...traceArgs(f.get(), 0), specification: { heightM: 50 } }), /heightM|Too big|less than or equal/i);
  assert.throws(() => traceRun(f.port, { ...traceArgs(f.get(), 0), expectedRevision: revision + 1 }), /The project revision changed/);
  assert.throws(() => traceRun(f.port, traceArgs(f.get(), 1)), { message: LOCK_REQUIRED_MESSAGE });
  assert.throws(() => traceRun(f.port, traceArgs(f.get(), 5)), /Page 6 is not part of the active source/);
  f.set({ tool: "count" });
  assert.throws(() => traceRun(f.port, traceArgs(f.get(), 0, [{ x: 0, y: 0 }, { x: 0, y: 0 }])), { message: "Fence run segment 0 has zero length." });
  assert.equal(f.get().job.runs.length, 0); assert.equal(f.get().job.revision, revision); assert.ok(clean(f.get()));
  // Sticky store errors stay visible in the pane and must not fool the next trace's readback.
  assert.equal(f.get().traceError, "Fence run segment 0 has zero length.");
  const recovered = traceRun(f.port, traceArgs(f.get(), 0));
  assert.equal(recovered.readbackVerified, true); assert.equal(f.get().job.runs.length, 1); assert.equal(f.get().traceError, null);
});

test("reviewTakeoffItem approves or rejects runs and gates with the item revision and reports blockers alongside", () => {
  const f = fakePort(importedJob());
  calibrateSheet(f.port, calibrateArgs(f.get(), 0));
  const traced = traceRun(f.port, traceArgs(f.get(), 0));
  f.set({ job: withGate(f.get().job, traced.runId) });
  const run = f.get().job.runs[0], gate = f.get().job.gates[0];
  assert.equal(run.revision, 2); assert.ok(Math.abs(run.lengthM - 6) < 1e-9);
  const bind = () => ({ expectedJobId: f.get().job.id, expectedRevision: f.get().job.revision });
  assert.throws(() => reviewTakeoffItem(f.port, { ...bind(), kind: "run", id: run.id, expectedItemRevision: 1, decision: "approve", actor: "Dana Estimator" }), { message: `Stale fence run revision for ${run.id}: expected 1, current 2.` });
  assert.throws(() => reviewTakeoffItem(f.port, { ...bind(), kind: "run", id: "run-missing", expectedItemRevision: 1, decision: "approve", actor: "Dana Estimator" }), { message: "Unknown fence run: run-missing." });
  assert.throws(() => reviewTakeoffItem(f.port, { ...bind(), expectedJobId: "job-x", kind: "run", id: run.id, expectedItemRevision: 2, decision: "approve", actor: "Dana Estimator" }), /The active project changed/);
  assert.equal(f.get().job.runs[0].review.status, "draft");
  const approved = reviewTakeoffItem(f.port, { ...bind(), kind: "run", id: run.id, expectedItemRevision: 2, decision: "approve", actor: "Dana Estimator", note: "Checked against the survey" });
  assert.deepEqual(approved.status, { before: "draft", after: "approved" }); assert.deepEqual(approved.itemRevision, { before: 2, after: 3 }); assert.equal(approved.decidedBy, "Dana Estimator"); assert.equal(approved.note, "Recorded through the Live assistant for Dana Estimator. Checked against the survey");
  assert.equal(approved.readbackVerified, true); assert.equal(approved.saved, true); assert.equal(approved.label, "Run 01"); assert.ok(Math.abs(approved.lengthM! - 6) < 1e-9);
  assert.ok(!approved.blockers.some(b => b.code === "review" && b.entityId === run.id)); assert.ok(approved.blockers.some(b => b.code === "run-specification" && b.entityId === run.id));
  assert.ok(approved.blockers.some(b => b.code === "review" && b.entityId === gate.id)); assert.equal(f.get().job.runs[0].review.decidedAt !== null, true);
  const rejected = reviewTakeoffItem(f.port, { ...bind(), kind: "gate", id: gate.id, expectedItemRevision: 1, decision: "reject", actor: "Dana Estimator" });
  assert.deepEqual(rejected.status, { before: "draft", after: "rejected" }); assert.deepEqual(rejected.itemRevision, { before: 1, after: 2 }); assert.equal(rejected.kind, "gate"); assert.equal(rejected.note, "Recorded through the Live assistant for Dana Estimator.");
  assert.ok(rejected.missingSpecification.includes("type")); assert.equal(rejected.readbackVerified, true); assert.equal(f.get().job.gates[0].review.status, "rejected");
  assert.throws(() => reviewTakeoffItem(f.port, { ...bind(), kind: "gate", id: "gate-9", expectedItemRevision: 1, decision: "approve", actor: "Dana Estimator" }), { message: "Unknown gate: gate-9." });
});

test("removeTrace removes the run and its located items only with the current item revision", () => {
  const f = fakePort(importedJob());
  calibrateSheet(f.port, calibrateArgs(f.get(), 0));
  const traced = traceRun(f.port, traceArgs(f.get(), 0));
  f.set({ job: withGate(f.get().job, traced.runId) });
  const bind = () => ({ expectedJobId: f.get().job.id, expectedRevision: f.get().job.revision });
  assert.throws(() => removeTrace(f.port, { ...bind(), runId: traced.runId, expectedItemRevision: 1 }), { message: `Stale fence run revision for ${traced.runId}: expected 1, current 2.` });
  assert.throws(() => removeTrace(f.port, { ...bind(), runId: "run-missing", expectedItemRevision: 1 }), { message: "Unknown fence run: run-missing" });
  assert.throws(() => removeTrace(f.port, { ...bind(), expectedRevision: 99, runId: traced.runId, expectedItemRevision: 2 }), /The project revision changed/);
  assert.equal(f.get().job.runs.length, 1); assert.equal(f.get().job.gates.length, 1);
  const before = f.get().job.revision;
  const receipt = removeTrace(f.port, { ...bind(), runId: traced.runId, expectedItemRevision: 2 });
  assert.equal(receipt.runId, traced.runId); assert.equal(receipt.label, "Run 01"); assert.deepEqual(receipt.removedItemIds, ["gate-1"]); assert.equal(receipt.removedRevision, 2);
  assert.equal(receipt.remainingRuns, 0); assert.equal(receipt.remainingItems, 0); assert.deepEqual(receipt.projectRevision, { before, after: before + 1 }); assert.equal(receipt.readbackVerified, true);
  assert.equal(f.get().job.runs.length, 0); assert.equal(f.get().job.gates.length, 0); assert.ok(receipt.blockers.some(b => b.code === "runs"));
});

test("the real studio store accepts the port and runs calibrate, trace, review and remove end to end", () => {
  const job = importedJob();
  useStudio.setState({ job, sheet: 0, currentCalibration: job.calibrations[0], scaleM: 1, tool: "none", pending: [], markups: [], selectedRunId: null, selectedVertexIndex: null, selectedGateId: null,
    traceError: null, photoError: null, calibrationCapture: null, calibrationError: null, traceUndoStack: [], traceRedoStack: [],
    persistenceHydrated: true, persistenceRecoveryBlocked: false, hydrationStatus: "ready", persistenceError: null, lastSavedJobRevision: null });
  const port: TakeoffPort = { getState: () => useStudio.getState() };
  const state = () => useStudio.getState();
  assert.throws(() => traceRun(port, traceArgs(state(), 1)), { message: LOCK_REQUIRED_MESSAGE });
  assert.equal(state().job.runs.length, 0); assert.ok(clean(state()));
  useStudio.getState().setTool("length"); useStudio.getState().addPoint({ x: 1, y: 1 });
  assert.equal(useStudio.getState().calibrationError, "Legacy source coordinates are unverified. Preserve/export the evidence before a reviewed retrace.");
  useStudio.setState({ tool: "none", pending: [], calibrationError: null });
  const calibrated = calibrateSheet(port, calibrateArgs(state(), 1));
  assert.equal(calibrated.locked, true); assert.equal(calibrated.readbackVerified, true); assert.equal(calibrated.saved, false); assert.equal(state().sheet, 1); assert.equal(state().scaleM, calibrated.metresPerUnit);
  assert.equal(state().job.calibrations[1].coordinateSpace, "source-page-v1"); assert.equal(state().job.calibrations[1].locked, true);
  const traced = traceRun(port, { ...traceArgs(state(), 1), specification: { construction: { trade: "Fencing", reference: "Rear boundary, sheet 2" } } });
  const run = state().job.runs.find(r => r.id === traced.runId)!;
  assert.ok(Math.abs(traced.lengthM! - 7) < 1e-9); assert.equal(traced.lengthM, run.lengthM); assert.equal(traced.revision, 2); assert.equal(traced.readbackVerified, true); assert.deepEqual(traced.missingSpecification, []);
  assert.equal(state().markups.some(m => m.id === run.id && m.value === run.lengthM), true); assert.equal(state().traceUndoStack.at(-1)?.command.type, "create-run"); assert.ok(clean(state()));
  assert.throws(() => calibrateSheet(port, calibrateArgs(state(), 1)), { message: LOCKED_CALIBRATION_REFUSAL });
  assert.throws(() => calibrateSheet(port, { ...calibrateArgs(state(), 1), replaceLocked: true }), { message: "Remove measurements from this sheet before changing its locked calibration." });
  const approved = reviewTakeoffItem(port, { expectedJobId: state().job.id, expectedRevision: state().job.revision, kind: "run", id: run.id, expectedItemRevision: run.revision, decision: "approve", actor: "Dana Estimator" });
  assert.equal(approved.status.after, "approved"); assert.equal(approved.readbackVerified, true); assert.equal(state().job.runs[0].review.decidedBy, "Dana Estimator");
  const removed = removeTrace(port, { expectedJobId: state().job.id, expectedRevision: state().job.revision, runId: run.id, expectedItemRevision: state().job.runs[0].revision });
  assert.equal(removed.readbackVerified, true); assert.equal(state().job.runs.length, 0); assert.equal(state().markups.some(m => m.id === run.id), false);
  assert.equal(state().job.revisionHistory.at(-1)?.summary, "Removed Run 01.");
});
