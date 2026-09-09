import { z } from "zod";
import type { useStudio } from "../store.ts";
import { calibrationInputUnitSchema, convertDistanceToMetres, type Calibration, type CalibrationPoint } from "../calibration.ts";
import {
  constructionRunSpecificationSchema, createNewRunSpecification, getJobBlockers, missingGateSpecificationFields, missingRunSpecificationFields, runSpecificationSchema,
  type FenceRun, type FencingJob, type GateRecord, type RunSpecification,
} from "../domain.ts";
import { calculateRunLengths } from "../tracing.ts";

type StudioState = ReturnType<typeof useStudio.getState>;
/** The slice of the studio store these tools read and drive; browser wiring passes `useStudio.getState`. */
export type TakeoffState = Pick<StudioState,
  | "job" | "sheet" | "currentCalibration" | "calibrationCapture" | "calibrationError" | "traceError" | "photoError" | "tool" | "pending" | "selectedRunId"
  | "hydrationStatus" | "persistenceHydrated" | "persistenceRecoveryBlocked" | "persistenceError" | "lastSavedJobRevision"
  | "setSheet" | "startCalibrationCapture" | "cancelCalibrationCapture" | "addCalibrationPoint" | "upsertManualCalibrationCandidate" | "lockCurrentCalibration"
  | "setTool" | "addPoint" | "commitPending" | "clearPending" | "updateRunSpecification"
  | "approveRun" | "rejectRun" | "approveGate" | "rejectGate" | "removeRun">;
/** Every read is a fresh snapshot, exactly like `useStudio.getState()`; the sequences below never cache one across a store action. */
export type TakeoffPort = { getState(): TakeoffState };

const id = z.string().min(1).max(100);
const revision = z.number().int().positive();
const coordinate = z.number().finite().min(-1e7).max(1e7);
const point = z.object({ x: coordinate, y: coordinate }).strict();
const sheetIndex = z.number().int().nonnegative().max(9999);
const bound = { expectedJobId: id, expectedRevision: revision };
const actorName = z.string().trim().min(1).max(120);
export const SOURCE_COORDINATE_SPACE = "source-page-v1" as const;
export const SAMPLE_SOURCE_REFUSAL = "The active source is the bundled sample; sample sources cannot carry verified measurements. Import or select a source drawing first.";
export const BUSY_MEASURE_PANE_REFUSAL = "Finish or cancel the current trace or calibration in the Measure pane before the assistant changes takeoff evidence.";
/** Verbatim store string (addPoint/commitPending); checked up front so an uncalibrated page is not reported as a legacy-coordinate problem. */
export const LOCK_REQUIRED_MESSAGE = "Lock a verified calibration for this sheet before drawing metric measurements.";

export const ASSISTANT_METHOD_PREFIX = "Live assistant · ";
export const ASSISTANT_REVIEW_NOTE_PREFIX = "Recorded through the Live assistant for ";
export const LOCKED_CALIBRATION_REFUSAL = "This page already has a locked calibration. Pass replaceLocked: true only when the user explicitly asked to replace it; the previous scale is reported in the receipt.";
export const calibrateSheetSchema = z.object({
  ...bound, sheet: sheetIndex, points: z.tuple([point, point]),
  knownDistance: z.object({ value: z.number().finite().positive().max(1e6), unit: calibrationInputUnitSchema }).strict(),
  /** `method` is stored with the Live-assistant prefix so the record shows who authored it; `evidence` must be the user's own statement of where the distance comes from. */
  provenance: z.object({ method: z.string().trim().min(1).max(100), evidence: z.string().trim().min(1).max(1000), documentId: id.optional() }).strict(),
  lock: z.boolean(),
  /** Required to touch a page whose calibration is already locked. */
  replaceLocked: z.boolean().optional(),
}).strict();
/** Vertex annotations (corners, post overrides) are excluded: they index vertices the assistant cannot see. */
export const runSpecificationPatchSchema = z.object(runSpecificationSchema.shape).omit({ corners: true, postOverrides: true, construction: true }).partial()
  .extend({ construction: constructionRunSpecificationSchema.partial().optional() }).strict();
export const traceRunSchema = z.object({
  ...bound, sheet: sheetIndex, points: z.array(point).min(2).max(500), label: z.string().trim().min(1).max(120).optional(), specification: runSpecificationPatchSchema.optional(),
}).strict();
export const reviewTakeoffItemSchema = z.object({
  ...bound, kind: z.enum(["run", "gate"]), id, expectedItemRevision: revision, decision: z.enum(["approve", "reject"]), actor: actorName, note: z.string().trim().max(1000).optional(),
}).strict();
export const removeTraceSchema = z.object({ ...bound, runId: id, expectedItemRevision: revision }).strict();
export type CalibrateSheetInput = z.infer<typeof calibrateSheetSchema>;
export type TraceRunInput = z.infer<typeof traceRunSchema>;
export type ReviewTakeoffItemInput = z.infer<typeof reviewTakeoffItemSchema>;
export type RemoveTraceInput = z.infer<typeof removeTraceSchema>;

const nearlyEqual = (left: number, right: number) => Math.abs(left - right) <= Math.max(1, Math.abs(left), Math.abs(right)) * 1e-9;
const canonical = (value: unknown) => JSON.stringify(value, (_, entry) => entry && typeof entry === "object" && !Array.isArray(entry) ? Object.fromEntries(Object.entries(entry).sort(([a], [b]) => a.localeCompare(b))) : entry);
const samePoints = (left: readonly CalibrationPoint[], right: readonly CalibrationPoint[]) => left.length === right.length && left.every((p, i) => p.x === right[i].x && p.y === right[i].y);
const activeDocument = (job: FencingJob) => job.documents.find(document => document.id === job.activeDocumentId) ?? null;
const findCalibration = (job: FencingJob, sheet: number): Calibration | null => job.calibrations.find(entry => entry.sheet === sheet) ?? null;

function checkProject(state: TakeoffState, expectedJobId: string, expectedRevision?: number) {
  if (!state.persistenceHydrated || state.persistenceRecoveryBlocked || state.hydrationStatus !== "ready") throw Error("Wait for project recovery to finish before using project tools.");
  if (state.job.id !== expectedJobId) throw Error("The active project changed. Read project context again.");
  if (expectedRevision !== undefined && state.job.revision !== expectedRevision) throw Error("The project revision changed. Read project context again before saving.");
}

/** Refuses sample sources and pages outside the active drawing before any store action runs. */
function requireImportedPage(state: TakeoffState, sheet: number) {
  const document = activeDocument(state.job);
  if (!document || document.source === "sample") throw Error(SAMPLE_SOURCE_REFUSAL);
  const pageCount = document.pageCount ?? 1;
  if (sheet >= pageCount) throw Error(`Page ${sheet + 1} is not part of the active source (${pageCount} page${pageCount === 1 ? "" : "s"}).`);
  if (state.calibrationCapture !== null || state.pending.length > 0) throw Error(BUSY_MEASURE_PANE_REFUSAL);
  return document;
}

type ErrorChannels = Pick<TakeoffState, "calibrationError" | "traceError" | "photoError">;
const CHANNELS = ["calibrationError", "traceError", "photoError"] as const;
const snapshot = (state: TakeoffState): ErrorChannels => ({ calibrationError: state.calibrationError, traceError: state.traceError, photoError: state.photoError });
/** Store errors are sticky, so state deltas decide success; this only names the cause: a channel that changed during the step, else one still holding an error. */
function storeError(before: ErrorChannels, after: TakeoffState, fallback: string) {
  return CHANNELS.map(key => after[key]).find((text, index) => text !== null && text !== before[CHANNELS[index]]) ?? CHANNELS.map(key => after[key]).find(text => text !== null) ?? fallback;
}

function selectSheet(port: TakeoffPort, sheet: number) {
  port.getState().setSheet(sheet);
  const after = port.getState();
  if (after.sheet !== sheet) throw Error(`The Measure pane could not open page ${sheet + 1}; it is showing page ${after.sheet + 1}.`);
  return after;
}

/** Leaves the Measure pane exactly as the UI expects between interactions; never touches the project record. */
function tidy(port: TakeoffPort) {
  const state = port.getState();
  if (state.calibrationCapture !== null) state.cancelCalibrationCapture();
  if (port.getState().pending.length > 0) port.getState().clearPending();
  if (port.getState().tool !== "none") port.getState().setTool("none");
}

function sourceIdentity(state: TakeoffState, sheet: number) {
  const document = activeDocument(state.job);
  return { projectId: state.job.id, sheet, originalPage: sheet + 1, sourceKind: document?.source ?? null, documentId: document?.id ?? null, sourceSha256: document?.sha256 ?? null };
}
const saved = (state: TakeoffState) => state.lastSavedJobRevision === state.job.revision && state.persistenceError === null;
const calibrationSummary = (calibration: Calibration | null) => calibration ? {
  locked: calibration.locked, source: calibration.source, confidence: calibration.confidence, coordinateSpace: calibration.coordinateSpace ?? "legacy-procedural-v0",
  metresPerUnit: calibration.metresPerUnit, knownDistanceM: calibration.knownDistanceM, selectedCandidateId: calibration.selectedCandidateId, candidates: calibration.candidates.length, conflict: calibration.conflict,
} : null;
const runSummary = (run: FenceRun) => ({
  runId: run.id, revision: run.revision, label: run.label, sheet: run.sheet, originalPage: run.sheet + 1, vertices: run.points.length, points: run.points,
  lengthM: run.lengthM, grossLengthM: run.grossLengthM ?? null, gateDeductionM: run.gateDeductionM ?? null, netLengthM: run.netLengthM ?? null,
  review: run.review.status, missingSpecification: missingRunSpecificationFields(run.specification), photos: run.photoIds.length,
});

/** Two-point manual calibration through the same store sequence as the Measure pane; every step is read back before the next one runs. */
export function calibrateSheet(port: TakeoffPort, input: unknown) {
  const args = calibrateSheetSchema.parse(input);
  const initial = port.getState();
  checkProject(initial, args.expectedJobId, args.expectedRevision);
  const document = requireImportedPage(initial, args.sheet);
  if (args.provenance.documentId !== undefined && args.provenance.documentId !== document.id) throw Error("Calibration provenance must reference the active source document.");
  const previous = findCalibration(initial.job, args.sheet);
  if (previous?.locked && !args.replaceLocked) throw Error(LOCKED_CALIBRATION_REFUSAL);
  const provenance = { method: `${ASSISTANT_METHOD_PREFIX}${args.provenance.method}`, evidence: args.provenance.evidence, documentId: document.id };
  const candidateId = `manual-sheet-${args.sheet}`;
  const revisionBefore = initial.job.revision;
  const notices: string[] = previous?.locked ? [`The previously locked calibration (${previous.metresPerUnit} m/unit, source ${previous.source}) was replaced at the user's request; measurements on this page should be re-checked.`] : [];
  try {
    const opened = selectSheet(port, args.sheet);
    opened.startCalibrationCapture();
    const capture = port.getState();
    if (capture.calibrationCapture?.sheet !== args.sheet || capture.calibrationCapture.points.length !== 0) throw Error(storeError(snapshot(opened), capture, "Calibration capture did not start."));
    for (const [index, vertex] of args.points.entries()) {
      const before = port.getState();
      before.addCalibrationPoint(vertex);
      const after = port.getState();
      if ((after.calibrationCapture?.points.length ?? 0) !== index + 1) throw Error(storeError(snapshot(before), after, `Calibration point ${index + 1} was not captured.`));
    }
    const beforeUpsert = port.getState();
    beforeUpsert.upsertManualCalibrationCandidate({ distance: args.knownDistance, provenance, candidateId, coordinateSpace: SOURCE_COORDINATE_SPACE });
    const upserted = port.getState();
    if (upserted.job.revision !== beforeUpsert.job.revision + 1 || upserted.calibrationError !== null) throw Error(storeError(snapshot(beforeUpsert), upserted, "The calibration candidate was not recorded."));
    if (args.lock) {
      upserted.lockCurrentCalibration();
      const locked = port.getState();
      if (locked.job.revision !== upserted.job.revision + 1 || !locked.currentCalibration.locked || locked.calibrationError !== null) {
        throw Error(`${storeError(snapshot(upserted), locked, "The calibration did not lock.")} The manual candidate "${candidateId}" is recorded unlocked at project revision ${locked.job.revision}.`);
      }
    }
  } finally {
    tidy(port);
  }
  const state = port.getState();
  const calibration = findCalibration(state.job, args.sheet);
  const candidate = calibration?.candidates.find(entry => entry.id === candidateId) ?? null;
  const expectedKnownM = convertDistanceToMetres(args.knownDistance.value, args.knownDistance.unit);
  const expectedMetresPerUnit = expectedKnownM / Math.hypot(args.points[1].x - args.points[0].x, args.points[1].y - args.points[0].y);
  const readbackVerified = Boolean(calibration && candidate && candidate.points && samePoints(candidate.points, args.points) && candidate.knownDistanceM !== null
    && nearlyEqual(candidate.knownDistanceM, expectedKnownM) && nearlyEqual(candidate.metresPerUnit, expectedMetresPerUnit) && candidate.provenance.documentId === document.id
    && calibration.coordinateSpace === SOURCE_COORDINATE_SPACE && calibration.locked === args.lock
    && (!args.lock || (calibration.selectedCandidateId === candidateId && calibration.source === "manual" && nearlyEqual(calibration.metresPerUnit, candidate.metresPerUnit)))
    && state.calibrationError === null && state.calibrationCapture === null && state.pending.length === 0);
  return {
    ...sourceIdentity(state, args.sheet), coordinateSpace: SOURCE_COORDINATE_SPACE,
    locked: calibration?.locked ?? false, metresPerUnit: calibration?.metresPerUnit ?? null, candidateId: candidate?.id ?? null, selectedCandidateId: calibration?.selectedCandidateId ?? null,
    source: calibration?.source ?? null, confidence: calibration?.confidence ?? null, knownDistanceM: candidate?.knownDistanceM ?? null, conflict: calibration?.conflict ?? null,
    calibration: calibrationSummary(calibration), previousCalibration: calibrationSummary(previous), authoredBy: "Live assistant (provenance method carries the prefix)",
    projectRevision: { before: revisionBefore, after: state.job.revision }, readbackVerified, saved: saved(state), blockers: getJobBlockers(state.job), notices,
    scope: "Points are source-page-v1 page units as shown in the Measure pane; the store does not check that they lie on the page. Scale is read back from the project record. Locking clears the Measure pane's trace undo/redo history, as it does in the UI.",
  };
}

/** Draws one length trace with the Measure tool sequence; the new run is identified by id diff and its lengths are read back, never computed here. */
export function traceRun(port: TakeoffPort, input: unknown) {
  const args = traceRunSchema.parse(input);
  const initial = port.getState();
  checkProject(initial, args.expectedJobId, args.expectedRevision);
  requireImportedPage(initial, args.sheet);
  const sheetCalibration = findCalibration(initial.job, args.sheet);
  if (!sheetCalibration?.locked || sheetCalibration.source === "unverified") throw Error(LOCK_REQUIRED_MESSAGE);
  const specification = args.specification ? mergeSpecification(createNewRunSpecification(initial.job), args.specification) : null;
  const revisionBefore = initial.job.revision, notices: string[] = [];
  if (args.label !== undefined) notices.push(`Run labels are assigned by the store; "${args.label}" was not applied because no rename action exists.`);
  let runId: string;
  try {
    selectSheet(port, args.sheet);
    port.getState().setTool("length");
    for (const [index, vertex] of args.points.entries()) {
      const before = port.getState();
      before.addPoint(vertex);
      const after = port.getState();
      if (after.pending.length !== index + 1) throw Error(storeError(snapshot(before), after, `Vertex ${index + 1} was not accepted.`));
    }
    const before = port.getState();
    const knownIds = new Set(before.job.runs.map(run => run.id));
    before.commitPending();
    const after = port.getState();
    const created = after.job.runs.filter(run => !knownIds.has(run.id));
    if (after.job.revision !== before.job.revision + 1 || created.length !== 1 || after.selectedRunId !== created[0].id || after.traceError !== null) {
      throw Error(storeError(snapshot(before), after, "No run was created; the Measure tool did not accept the trace."));
    }
    runId = created[0].id;
    if (specification) {
      const run = created[0], runRevision = run.revision ?? 1;
      after.updateRunSpecification(run.id, runRevision, specification);
      const patched = port.getState();
      const updated = patched.job.runs.find(entry => entry.id === run.id);
      if (updated?.revision !== runRevision + 1 || patched.photoError !== null) {
        throw Error(`${storeError(snapshot(after), patched, "The specification was not applied.")} ${run.label} (${run.id}) was created at project revision ${patched.job.revision} without the requested specification.`);
      }
    }
  } finally {
    tidy(port);
  }
  const state = port.getState();
  const run = state.job.runs.find(entry => entry.id === runId) ?? null;
  const calibration = findCalibration(state.job, args.sheet);
  const readbackVerified = Boolean(run && calibration && run.sheet === args.sheet && samePoints(run.points, args.points) && lengthsMatch(run, state.job.gates, calibration)
    && (!specification || canonical(run.specification) === canonical(specification)) && state.traceError === null && state.calibrationError === null && state.pending.length === 0);
  return {
    ...sourceIdentity(state, args.sheet), coordinateSpace: calibration?.coordinateSpace ?? "legacy-procedural-v0", ...(run ? runSummary(run) : { runId, revision: null, label: null, vertices: 0, lengthM: null, review: null }),
    requestedLabel: args.label ?? null, calibration: calibrationSummary(calibration), projectRevision: { before: revisionBefore, after: state.job.revision },
    readbackVerified, saved: saved(state), blockers: getJobBlockers(state.job), notices,
    scope: "Lengths are read back from the project record after the store measured them with the sheet's locked calibration; they are evidence only when the calibration and source identity are verified. Nothing here is a quote.",
  };
}

/** Approve or reject one run or gate; the decision needs the item's own revision and does not check calibration or specification, so blockers are reported alongside. */
export function reviewTakeoffItem(port: TakeoffPort, input: unknown) {
  const args = reviewTakeoffItemSchema.parse(input);
  const initial = port.getState();
  checkProject(initial, args.expectedJobId, args.expectedRevision);
  const document = activeDocument(initial.job);
  if (!document || document.source === "sample") throw Error(SAMPLE_SOURCE_REFUSAL);
  const find = (job: FencingJob): FenceRun | GateRecord | null => (args.kind === "run" ? job.runs : job.gates).find(entry => entry.id === args.id) ?? null;
  const before = find(initial.job);
  const revisionBefore = initial.job.revision, statusBefore = before?.review.status ?? null;
  // The decision is attributed to the named human reviewer; the note records that it arrived through the assistant.
  const note = `${ASSISTANT_REVIEW_NOTE_PREFIX}${args.actor}.${args.note ? ` ${args.note}` : ""}`.slice(0, 1000);
  const action = args.kind === "run" ? (args.decision === "approve" ? initial.approveRun : initial.rejectRun) : (args.decision === "approve" ? initial.approveGate : initial.rejectGate);
  action(args.id, args.expectedItemRevision, args.actor, note);
  const state = port.getState();
  const item = find(state.job);
  const expectedStatus = args.decision === "approve" ? "approved" : "rejected";
  if (state.job.revision !== revisionBefore + 1 || !item || item.review.status !== expectedStatus || state.traceError !== null) throw Error(storeError(snapshot(initial), state, "The review decision was not recorded."));
  const readbackVerified = item.revision === args.expectedItemRevision + 1 && item.review.decidedBy === args.actor && item.review.decidedAt !== null && item.review.note === note;
  return {
    ...sourceIdentity(state, item.sheet), kind: args.kind, id: item.id, label: item.label, decision: args.decision,
    status: { before: statusBefore, after: item.review.status }, itemRevision: { before: args.expectedItemRevision, after: item.revision },
    decidedBy: item.review.decidedBy, decidedAt: item.review.decidedAt, note: item.review.note,
    lengthM: "lengthM" in item ? item.lengthM : null, missingSpecification: "specification" in item ? missingRunSpecificationFields(item.specification) : missingGateSpecificationFields(item),
    calibration: calibrationSummary(findCalibration(state.job, item.sheet)), projectRevision: { before: revisionBefore, after: state.job.revision },
    readbackVerified, saved: saved(state), blockers: getJobBlockers(state.job),
    scope: "A review decision records the named human reviewer and when; the note states it was recorded through the Live assistant. It does not verify the scale, the source or the specification, and it is never available on the bundled sample. Any geometry, specification or evidence change resets it to needs-review.",
  };
}

/** Removes one run and, as the store does, every gate placed on it; the removal is verified by re-reading the record. */
export function removeTrace(port: TakeoffPort, input: unknown) {
  const args = removeTraceSchema.parse(input);
  const initial = port.getState();
  checkProject(initial, args.expectedJobId, args.expectedRevision);
  const run = initial.job.runs.find(entry => entry.id === args.runId) ?? null;
  const linkedGateIds = initial.job.gates.filter(gate => gate.runId === args.runId).map(gate => gate.id);
  const revisionBefore = initial.job.revision;
  initial.removeRun(args.runId, args.expectedItemRevision);
  const state = port.getState();
  const remaining = state.job.runs.some(entry => entry.id === args.runId);
  if (state.job.revision !== revisionBefore + 1 || remaining || !run || state.traceError !== null) throw Error(storeError(snapshot(initial), state, "The run was not removed."));
  const readbackVerified = !remaining && linkedGateIds.every(gateId => !state.job.gates.some(gate => gate.id === gateId)) && state.traceError === null;
  return {
    ...sourceIdentity(state, run.sheet), runId: run.id, label: run.label, removedRevision: run.revision, removedLengthM: run.lengthM, removedItemIds: linkedGateIds,
    remainingRuns: state.job.runs.length, remainingItems: state.job.gates.length, projectRevision: { before: revisionBefore, after: state.job.revision },
    readbackVerified, saved: saved(state), blockers: getJobBlockers(state.job),
    scope: "The trace and its located items are removed from the project record; the source drawing, calibration and photos are untouched. Undo remains available in the Measure pane.",
  };
}

function mergeSpecification(base: RunSpecification, patch: z.infer<typeof runSpecificationPatchSchema>): RunSpecification {
  const { construction, ...rest } = patch;
  const merged = { ...base, ...rest, ...(construction ? { constructionEnabled: rest.constructionEnabled ?? true, construction: { ...(base.construction ?? { assembly: "generic" as const, trade: "", quantity: "length" as const, widthM: null, depthM: null, reference: "" }), ...construction } } : {}) };
  return runSpecificationSchema.parse(merged);
}

function lengthsMatch(run: FenceRun, gates: readonly GateRecord[], calibration: Calibration) {
  try {
    const lengths = calculateRunLengths(run, gates, calibration);
    return nearlyEqual(run.lengthM, lengths.netLengthM) && nearlyEqual(run.netLengthM ?? Number.NaN, lengths.netLengthM)
      && nearlyEqual(run.grossLengthM ?? Number.NaN, lengths.grossLengthM) && nearlyEqual(run.gateDeductionM ?? Number.NaN, lengths.gateDeductionM);
  } catch {
    return false;
  }
}
