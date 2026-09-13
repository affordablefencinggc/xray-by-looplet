import { create } from "zustand";
import { browserSingleton } from './browserSingleton.ts';
import { SHEETS, type SheetKind } from "./geometry.ts";
import {
  createDefaultJob,
  createGateSpecification,
  createId,
  createReviewDecision,
  createNewRunSpecification,
  type FencingJob,
  type GateRecord,
  type GateSpecification,
  type PhotoEvidence,
  type RunSpecification,
  type SiteDetails,
} from "./domain.ts";
import {
  captureDocumentWorkspace,
  restoreDocumentWorkspace,
  prepareDocumentSelection,
} from "./documentWorkspaces.ts";
import { FENCING_JOB_STORAGE_KEY, loadOrCreateBrowserProject, saveFencingJob, type JobPersistenceResult } from "./persistence.ts";
import type { ImportedPlan, PlanBinary, StoredPlanContent } from "./documentContract.ts";
// [SC-21 designed model] begin
import type { SourceBuilding } from "./sourceBuilding.ts";
// [SC-21 designed model] end
import { createBrowserPlanStore } from "./documents.ts";
import {
  calibrationSchema,
  createScaleCalibrationCandidate,
  createTwoPointCalibrationCandidate,
  createUnverifiedCalibration,
  getCalibrationForSheet,
  lockCalibration,
  reconcileCalibrationCandidates,
  unlockCalibration,
  type Calibration,
  type CalibrationCandidate,
  type CalibrationInputDistance,
  type CalibrationPoint,
  type ScaleCandidateInput,
} from "./calibration.ts";
import {
  applyTraceCommand,
  createEditableRun,
  migrateTraceState,
  type EditableFenceRun,
  type PlacedGate,
  type TraceCommand,
  type TraceState,
} from "./tracing.ts";
import {
  appendJobRevision,
  applyEvidenceCommand,
  type PhotoEvidencePatch,
} from "./evidenceCommands.ts";
import {
  createBrowserPhotoStore,
  importPhotoFile,
  photoContentObjectUrl,
  verifyPhotoContent,
} from "./evidence.ts";
import {
  EMPTY_RUNTIME_ASSET_READINESS,
  getQuoteReadiness,
  type QuoteReadiness,
  type RuntimeAssetReadiness,
} from "./quoteReadiness.ts";
import type { BomBuildRequest, BomRecipeSet } from "./bomContract.ts";
import {
  beginBomBuild as beginBomStateBuild,
  completeBomBuild as completeBomStateBuild,
  createBomState,
  failBomBuild as failBomStateBuild,
  reconcileBomBinding,
  type BomStateEnvelope,
  type BomStateTransition,
} from "./bomState.ts";
import { loadBomState, saveBomState } from "./bomPersistence.ts";
import {
  createSampleStructuralInventory,
  componentInventorySchema,
  type ComponentInventory,
  type ComponentDiscipline,
} from "./construction/inventory.ts";
import {
  loadComponentInventory,
  saveComponentInventory,
  type InventoryPersistenceLoadResult,
  type InventoryPersistenceWriteResult,
} from "./construction/inventoryPersistence.ts";


export type Pane =
  | "overview"
  | "sheets"
  | "measure"
  | "sketch"
  | "components"
  | "model"
  | "render"
  | "review"
  | "cost"
  | "proof";

export type Tool = "none" | "length" | "area" | "count" | "sketch";

export type Markup = {
  id: string;
  kind: "length" | "area" | "count" | "sketch";
  label: string;
  value: number;
  unit: string;
  sheet: number;
  points: { x: number; y: number }[];
};

export type Trade = { id: string; name: string; note: string };

export type CalibrationCapture = {
  sheet: number;
  points: CalibrationPoint[];
};

export type ManualCalibrationInput = {
  distance: CalibrationInputDistance;
  provenance: CalibrationCandidate["provenance"];
  candidateId?: string;
  confidence?: number;
  coordinateSpace?: Calibration["coordinateSpace"];
};

export const TRACE_HISTORY_LIMIT = 100;

export type StoreTraceCommand =
  | TraceCommand
  | { type: "create-run"; runId: string }
  | { type: "remove-run"; runId: string; expectedRevision: number };

export type TraceHistoryEntry = {
  command: StoreTraceCommand;
  previous: TraceState;
  next: TraceState;
};

export type GateDraft = Partial<Omit<GateSpecification, "widthM">> & {
  id?: string;
  runId: string;
  point: CalibrationPoint;
  widthM: number;
  label?: string;
};

export type MergeRunsInput = {
  firstRunId: string;
  firstEndpoint: "start" | "end";
  secondRunId: string;
  secondEndpoint: "start" | "end";
  mergedRunId?: string;
  label?: string;
};

export type LegacyPhotoMetadataInput = Pick<
  PhotoEvidence,
  "name" | "mimeType" | "sizeBytes" | "caption" | "runIds" | "gateIds"
> &
  Partial<Pick<PhotoEvidence, "id" | "addedAt" | "capturedAt" | "source">>;

export type HydrationStatus = "idle" | "loading" | "ready" | "error";

type StudioState = {
  job: FencingJob;
  bomState: BomStateEnvelope;
  bomPersistenceError: string | null;
  selectedRunId: string | null;
  selectedVertexIndex: number | null;
  selectedGateId: string | null;
  traceError: string | null;
  traceUndoStack: TraceHistoryEntry[];
  traceRedoStack: TraceHistoryEntry[];
  photoPreviewUrls: Record<string, string>;
  photoError: string | null;
  activePlanBinary: PlanBinary | null;
  documentError: string | null;
  persistenceError: string | null;
  persistenceHydrated: boolean;
  persistenceRecoveryBlocked: boolean;
  lastSavedJobRevision: number | null;
  /** Exact bytes this window last loaded or wrote to the main job record; the compare-and-swap expectation. */
  lastSavedJobRaw: string | null;
  /** True once storage holds a newer revision this window never loaded; writes stay refused until reload. */
  projectWriteStale: boolean;
  hydrationStatus: HydrationStatus;
  assetReadiness: RuntimeAssetReadiness;
  quoteReadiness: QuoteReadiness;
  pane: Pane;
  // [SC-21 designed model] begin
  /** Model mode: the designed scene the Model viewer shows instead of the catalog. Session-only; never persisted. */
  designedBuilding: SourceBuilding | null;
  setDesignedBuilding: (scene: SourceBuilding | null) => void;
  // [SC-21 designed model] end
  sheet: number;
  skin: "navy" | "paper";
  lifted: boolean;
  chromeHidden: boolean;
  showSrc: boolean;
  showBld: boolean;
  showRoof: boolean;
  showMan: boolean;
  pose: "standing" | "laid";
  cam: "plan" | "iso";
  height: number;
  az: number;
  el: number;
  dist: number;
  planName: string | null;
  takeoff: unknown | null;
  engineNote: string;
  scaleM: number;
  currentCalibration: Calibration;
  calibrationCapture: CalibrationCapture | null;
  calibrationError: string | null;
  tool: Tool;
  pending: { x: number; y: number }[];
  markups: Markup[];
  trades: Trade[];
  componentInventory: ComponentInventory;
  inventoryPersistenceError: string | null;
  inventoryRecoveryBlocked: boolean;
  selectedComponentId: string | null;
  componentFilterDiscipline: "all" | ComponentDiscipline;
  componentFilterCategory: "all" | string;
  componentSearchQuery: string;
  capsOpen: boolean;
  rightCollapsed: boolean;
  zoom2d: number;
  pan2d: { x: number; y: number };
  snappingEnabled: boolean;
  floors: number;
  explodeFloors: number;
  activeFloor: number | null;
  showSurfaces: boolean;
  projectPreset: "wtc" | "highrise" | "fencing" | "ruffles";
  wtcLayers: { perimeter: boolean; core: boolean; floors: boolean };
  renderMaterials: {
    roof: string;
    walls: string;
    windows: string;
    landscaping: string;
    lighting: string;
    style: string;
    direction: string;
  };
  capturedView: string | null;
  geometryLock: boolean;
  setProjectPreset: (preset: "wtc" | "highrise" | "fencing" | "ruffles") => void;
  toggleWtcLayer: (layer: "perimeter" | "core" | "floors") => void;
  setRenderMaterial: (key: string, val: string) => void;
  setCapturedView: (val: string | null) => void;
  toggleGeometryLock: () => void;
  setPane: (pane: Pane) => void;
  setSheet: (sheet: number) => void;
  toggle: (
    k:
      | "showSrc"
      | "showBld"
      | "showRoof"
      | "showMan"
      | "rightCollapsed"
      | "capsOpen"
      | "snappingEnabled"
      | "showSurfaces",
  ) => void;
  toggleSnapping: () => void;
  toggleSurfaces: () => void;
  setFloors: (floors: number) => void;
  setExplodeFloors: (val: number) => void;
  setActiveFloor: (floor: number | null) => void;
  setSkin: (skin: "navy" | "paper") => void;
  lift: () => void;
  hideChrome: () => void;
  stand: () => void;
  lay: () => void;
  setCam: (cam: "plan" | "iso") => void;
  fit: () => void;
  setOrbit: (az: number, el: number) => void;
  setDist: (dist: number) => void;
  setHeight: (h: number) => void;
  setScale: (m: number) => void;
  startCalibrationCapture: () => void;
  cancelCalibrationCapture: () => void;
  addCalibrationPoint: (point: CalibrationPoint) => void;
  upsertManualCalibrationCandidate: (input: ManualCalibrationInput) => void;
  ingestCalibrationCandidate: (input: ScaleCandidateInput) => void;
  resolveCalibrationCandidate: (candidateId: string) => void;
  lockCurrentCalibration: (candidateId?: string) => void;
  unlockCurrentCalibration: () => void;
  setTool: (t: Tool) => void;
  setZoom2d: (zoom: number) => void;
  setPan2d: (pan: { x: number; y: number }) => void;
  setPlanName: (name: string | null) => void;
  importPlan: (imported: ImportedPlan) => Promise<void>;
  selectDocument: (documentId: string) => Promise<void>;
  addPoint: (p: { x: number; y: number }) => void;
  commitPending: () => void;
  clearPending: () => void;
  removeMarkup: (id: string) => void;
  selectVertex: (runId: string, vertexIndex: number) => void;
  selectGate: (gateId: string) => void;
  executeTraceCommand: (command: TraceCommand) => void;
  moveRunVertex: (runId: string, vertexIndex: number, point: CalibrationPoint) => void;
  insertRunVertex: (runId: string, segmentIndex: number, point: CalibrationPoint) => void;
  removeRunVertex: (runId: string, vertexIndex: number) => void;
  splitRun: (runId: string, vertexIndex: number) => void;
  mergeRuns: (input: MergeRunsInput) => void;
  upsertGate: (input: GateDraft) => void;
  removeGate: (gateId: string) => void;
  removeRun: (runId: string, expectedRevision?: number) => void;
  undoTrace: () => void;
  redoTrace: () => void;
  addTrade: (name: string) => void;
  removeTrade: (id: string) => void;
  selectComponent: (id: string | null) => void;
  setComponentFilterDiscipline: (discipline: "all" | ComponentDiscipline) => void;
  setComponentFilterCategory: (category: "all" | string) => void;
  setComponentSearchQuery: (query: string) => void;
  resetSampleInventory: () => void;
  setComponentInventory: (inventory: ComponentInventory) => void;
  saveCurrentInventory: () => InventoryPersistenceWriteResult;
  loadCurrentInventory: () => InventoryPersistenceLoadResult;
  updateSite: (site: Partial<SiteDetails>) => void;
  updateJobName: (name: string) => void;
  updateRunSpecification: (
    runId: string,
    expectedRevision: number,
    patch: Partial<RunSpecification>,
  ) => void;
  updateGateSpecification: (
    gateId: string,
    expectedRevision: number,
    patch: Partial<GateSpecification>,
  ) => void;
  approveRun: (runId: string, expectedRevision: number, actor: string, note?: string) => void;
  rejectRun: (runId: string, expectedRevision: number, actor: string, note?: string) => void;
  approveGate: (gateId: string, expectedRevision: number, actor: string, note?: string) => void;
  rejectGate: (gateId: string, expectedRevision: number, actor: string, note?: string) => void;
  selectRun: (runId: string | null) => void;
  addPhotos: (files: File[]) => Promise<void>;
  updatePhotoEvidence: (
    photoId: string,
    expectedRevision: number,
    patch: PhotoEvidencePatch,
  ) => void;
  reorderPhoto: (photoId: string, toIndex: number, expectedRevision: number) => void;
  removePhoto: (photoId: string, expectedRevision: number) => Promise<void>;
  beginBomGeneration: (request: BomBuildRequest, startedAt?: string) => BomStateEnvelope;
  completeBomGeneration: (response: unknown, completedAt?: string) => BomStateTransition;
  failBomGeneration: (message: string, failedAt?: string) => BomStateTransition;
  reconcileBomRecipeSet: (recipeSet: BomRecipeSet, changedAt?: string) => BomStateEnvelope;
  hydratePersistence: () => Promise<void>;
  retryProjectLoad: () => Promise<void>;
  saveCurrentProject: () => JobPersistenceResult;
  /** Another window changed the stored main job record; returns true when this window became stale. */
  noteExternalProjectWrite: (newValue: string | null) => boolean;
};

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function dist2(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function polyArea(pts: { x: number; y: number }[]) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    s += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(s) / 2;
}

function nowIso() {
  return new Date().toISOString();
}

function activeCalibration(job: FencingJob, sheet: number): Calibration {
  return getCalibrationForSheet(job.calibrations, sheet) ?? createUnverifiedCalibration(sheet);
}

function usesImportedSource(job: FencingJob): boolean {
  return Boolean(
    job.documents.find(
      (document) => document.id === job.activeDocumentId && document.source !== "sample",
    ),
  );
}
function hasLegacySourceEvidence(job: FencingJob, sheet: number): boolean {
  const calibration = activeCalibration(job, sheet);
  return (
    usesImportedSource(job) &&
    calibration.coordinateSpace !== "source-page-v1" &&
    (calibration.candidates.length > 0 || calibration.locked || calibrationHasGeometry(job, sheet))
  );
}
function assertSourceCoordinateAuthority(job: FencingJob, sheet: number) {
  if (usesImportedSource(job) && activeCalibration(job, sheet).coordinateSpace !== "source-page-v1")
    throw Error(
      "Legacy source coordinates are unverified. Preserve/export the evidence before a reviewed retrace.",
    );
}
function assertTraceChangeAuthority(job: FencingJob, next: TraceState) {
  // Commands/history can target another page. Validate every changed, inserted
  // or removed entity's actual page, including both sides of a reassociation.
  for (const kind of ["runs", "gates"] as const) {
    const before = job[kind],
      after = next[kind];
    for (const id of new Set([...before.map((e) => e.id), ...after.map((e) => e.id)])) {
      const old = before.find((e) => e.id === id),
        incoming = after.find((e) => e.id === id);
      if (old && incoming && sameDurableEntity(old, incoming)) continue;
      if (old) assertSourceCoordinateAuthority(job, old.sheet);
      if (incoming) assertSourceCoordinateAuthority(job, incoming.sheet);
    }
  }
}

function scaleForCalibration(calibration: Calibration): number {
  return calibration.locked ? calibration.metresPerUnit : 1;
}

function replaceCalibration(job: FencingJob, calibration: Calibration): FencingJob {
  return {
    ...job,
    updatedAt: nowIso(),
    calibrations: [
      ...job.calibrations.filter((entry) => entry.sheet !== calibration.sheet),
      calibration,
    ].sort((left, right) => left.sheet - right.sheet),
  };
}

function revisedCalibration(
  job: FencingJob,
  calibration: Calibration,
  summary: string,
): FencingJob {
  return appendJobRevision(replaceCalibration(job, calibration), {
    entityType: "job",
    entityId: job.id,
    action: "update",
    summary,
  });
}

function unlockedCalibrationWithCandidates(
  calibration: Calibration,
  candidates: CalibrationCandidate[],
  explicitCandidateId: string | null = null,
): Calibration {
  const reconciliation = reconcileCalibrationCandidates(candidates, explicitCandidateId);
  const selected = reconciliation.selectedCandidateId
    ? (candidates.find((candidate) => candidate.id === reconciliation.selectedCandidateId) ?? null)
    : null;
  return calibrationSchema.parse({
    ...calibration,
    locked: false,
    metresPerUnit: selected?.metresPerUnit ?? 1,
    source: selected?.source ?? "unverified",
    confidence: selected?.confidence ?? 0,
    knownDistanceM: selected?.knownDistanceM ?? null,
    points: selected?.points ?? null,
    inputDistance: selected?.inputDistance ?? null,
    candidates,
    selectedCandidateId: reconciliation.selectedCandidateId,
    conflict: reconciliation.conflict,
  });
}

function calibrationFailure(message: string): Pick<StudioState, "calibrationError" | "pending"> {
  return { calibrationError: message, pending: [] };
}

function traceStateFromJob(job: FencingJob): TraceState {
  return migrateTraceState(job.runs, job.gates, job.calibrations);
}

function markupsWithTrace(existing: readonly Markup[], trace: TraceState): Markup[] {
  const nonTrace = existing.filter((markup) => markup.kind !== "length" && markup.kind !== "count");
  return [
    ...nonTrace,
    ...trace.runs.map((run) => ({
      id: run.id,
      kind: "length" as const,
      label: run.label,
      value: run.netLengthM,
      unit: "m",
      sheet: run.sheet,
      points: run.points,
    })),
    ...trace.gates.map((gate) => ({
      id: gate.id,
      kind: "count" as const,
      label: gate.label,
      value: 1,
      unit: "ea",
      sheet: gate.sheet,
      points: [gate.point],
    })),
  ];
}

function jobWithTrace(job: FencingJob, trace: TraceState): FencingJob {
  const timestamp = nowIso();
  const runs = trace.runs.map((incoming) => {
    const current = job.runs.find((run) => run.id === incoming.id);
    if (!current) return { ...incoming, revision: incoming.revision ?? 1 };
    if (sameDurableEntity(current, incoming)) return current;
    return {
      ...incoming,
      revision: Math.max(incoming.revision ?? 1, (current.revision ?? 0) + 1),
      review: invalidateReviewForChange(current.review, "Geometry changed after review."),
    };
  });
  const gates = trace.gates.map((incoming) => {
    const current = job.gates.find((gate) => gate.id === incoming.id);
    if (!current) return { ...incoming, revision: incoming.revision ?? 1 };
    if (sameDurableEntity(current, incoming)) return current;
    return {
      ...incoming,
      revision: Math.max(incoming.revision ?? 1, (current.revision ?? 0) + 1),
      review: invalidateReviewForChange(current.review, "Geometry changed after review."),
    };
  });
  const photos = job.photos.map((photo) => {
    const runIds = runs.filter((run) => run.photoIds.includes(photo.id)).map((run) => run.id);
    const gateIds = gates.filter((gate) => gate.photoIds.includes(photo.id)).map((gate) => gate.id);
    if (sameIds(photo.runIds, runIds) && sameIds(photo.gateIds, gateIds)) return photo;
    return { ...photo, runIds, gateIds, revision: photo.revision + 1, updatedAt: timestamp };
  });
  return { ...job, updatedAt: timestamp, runs, gates, photos };
}

function sameDurableEntity(left: object, right: object): boolean {
  const strip = (value: object) => {
    const { revision: _revision, review: _review, ...durable } = value as Record<string, unknown>;
    return durable;
  };
  return JSON.stringify(strip(left)) === JSON.stringify(strip(right));
}

function invalidateReviewForChange<
  T extends { status: string; decidedAt: string | null; decidedBy: string; note: string },
>(review: T, note: string): T {
  if (review.status === "draft") return review;
  return { ...review, status: "needs-review", decidedAt: null, decidedBy: "", note };
}

function revisedTraceJob(
  job: FencingJob,
  trace: TraceState,
  descriptor: Parameters<typeof appendJobRevision>[1],
): FencingJob {
  return appendJobRevision(jobWithTrace(job, trace), descriptor);
}

function traceRevisionDescriptor(
  job: FencingJob,
  command: TraceCommand,
): Parameters<typeof appendJobRevision>[1] {
  switch (command.type) {
    case "move-vertex":
    case "insert-vertex":
    case "remove-vertex":
      return {
        entityType: "run",
        entityId: command.runId,
        action: "update",
        summary: `Updated geometry for ${command.runId}.`,
      };
    case "split-run":
      return {
        entityType: "run",
        entityId: command.runId,
        action: "update",
        summary: `Split ${command.runId}.`,
      };
    case "merge-runs":
      return {
        entityType: "run",
        entityId: command.mergedRunId,
        action: "create",
        summary: `Merged runs into ${command.mergedRunId}.`,
      };
    case "place-gate":
      return {
        entityType: "gate",
        entityId: command.gate.id,
        action: command.expectedRevision === null ? "create" : "update",
        summary: `${command.expectedRevision === null ? "Placed" : "Updated"} ${command.gate.label}.`,
      };
    case "remove-gate":
      return {
        entityType: "gate",
        entityId: command.gateId,
        action: "delete",
        summary: `Removed gate ${command.gateId}.`,
      };
  }
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function repairedSelection(
  state: Pick<StudioState, "selectedRunId" | "selectedVertexIndex" | "selectedGateId">,
  trace: TraceState,
) {
  const run = state.selectedRunId
    ? trace.runs.find((entry) => entry.id === state.selectedRunId)
    : null;
  const selectedRunId = run?.id ?? null;
  const selectedVertexIndex =
    run && state.selectedVertexIndex !== null
      ? Math.min(state.selectedVertexIndex, run.points.length - 1)
      : null;
  const selectedGateId =
    state.selectedGateId && trace.gates.some((gate) => gate.id === state.selectedGateId)
      ? state.selectedGateId
      : null;
  return { selectedRunId, selectedVertexIndex, selectedGateId };
}

function boundedHistory(entries: TraceHistoryEntry[]): TraceHistoryEntry[] {
  return entries.slice(-TRACE_HISTORY_LIMIT);
}

function calibrationHasGeometry(job: FencingJob, sheet: number): boolean {
  return (
    job.runs.some((run) => run.sheet === sheet) ||
    job.gates.some((gate) => gate.sheet === sheet) ||
    (job.annotations ?? []).some((item) => item.sheet === sheet)
  );
}

function assertCalibrationCanChange(job: FencingJob, sheet: number) {
  if (hasLegacySourceEvidence(job, sheet))
    throw Error(
      "Legacy source coordinates are preserved read-only. Export the current manifest in Proof before a reviewed retrace.",
    );
  if (calibrationHasGeometry(job, sheet)) {
    throw new Error("Remove measurements from this sheet before changing its locked calibration.");
  }
}

function markupsFromJob(job: FencingJob): Markup[] {
  return [
    ...(job.annotations ?? []),
    ...job.runs.map((run) => ({
      id: run.id,
      kind: "length" as const,
      label: run.label,
      value: run.lengthM,
      unit: "m",
      sheet: run.sheet,
      points: run.points,
    })),
    ...job.gates.map((gate) => ({
      id: gate.id,
      kind: "count" as const,
      label: gate.label,
      value: 1,
      unit: "ea",
      sheet: gate.sheet,
      points: [gate.point],
    })),
  ];
}

function storedContent(binary: PlanBinary): StoredPlanContent {
  return { ...binary, bytes: Uint8Array.from(binary.bytes).buffer };
}

function planBinary(content: StoredPlanContent): PlanBinary {
  return { ...content, bytes: new Uint8Array(content.bytes.slice(0)) };
}

export async function verifyStoredPlanContent(
  content: StoredPlanContent | null,
  document: FencingJob["documents"][number],
): Promise<PlanBinary> {
  if (!content)
    throw new Error(
      `${document.name} metadata exists, but its saved plan bytes are missing. Import the plan again.`,
    );
  if (document.sha256 === null)
    throw new Error(`${document.name} has no canonical SHA-256 metadata.`);
  if (
    content.documentId !== document.id ||
    content.name !== document.name ||
    content.kind !== document.kind ||
    content.bytes.byteLength !== content.sizeBytes
  ) {
    throw new Error(`${document.name} saved bytes do not match the canonical document metadata.`);
  }
  const actualSha256 = await sha256(new Uint8Array(content.bytes));
  if (actualSha256 !== document.sha256 || actualSha256 !== content.sha256) {
    throw new Error(`${document.name} failed SHA-256 verification.`);
  }
  return planBinary(content);
}

async function sha256(bytes: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle)
    throw new Error("SHA-256 verification is unavailable in this browser.");
  const input = new Uint8Array(bytes.byteLength);
  input.set(bytes);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", input.buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function readiness(
  job: FencingJob,
  assets: RuntimeAssetReadiness,
  hydrated: boolean,
): QuoteReadiness {
  return getQuoteReadiness(job, assets, hydrated);
}

function jobForImportedPlan(job: FencingJob, imported: ImportedPlan, sheet = 0): FencingJob {
  const captured = captureDocumentWorkspace(job, sheet);
  const restored = restoreDocumentWorkspace(
    { ...captured, documents: [...captured.documents, imported.revision] },
    imported.revision,
  );
  return appendJobRevision(
    restored,
    {
      entityType: "job",
      entityId: job.id,
      action: "update",
      summary: `Imported plan ${imported.revision.name}.`,
    },
    nowIso(),
  );
}

function appendSourceMarkup(job: FencingJob, markup: Markup): FencingJob {
  const document = job.documents.find((item) => item.id === job.activeDocumentId);
  if (!document || (markup.kind !== "area" && markup.kind !== "sketch"))
    throw Error("A source document is required for this annotation.");
  const annotation = {
    ...markup,
    kind: markup.kind,
    documentId: document.id,
    sourceSha256: document.sha256 ?? null,
    coordinateSpace:
      activeCalibration(job, markup.sheet).coordinateSpace === "source-page-v1" && document.sha256
        ? ("source-page-v1" as const)
        : ("legacy-unverified" as const),
  };
  return appendJobRevision(
    { ...job, annotations: [...(job.annotations ?? []), annotation] },
    {
      entityType: "job",
      entityId: job.id,
      action: "update",
      summary: `Saved ${markup.label} on sheet ${markup.sheet + 1}.`,
    },
  );
}

/** Migration/test seam only. Production photo imports must use addPhotos with real bytes. */
export function addLegacyPhotoMetadataForMigration(
  job: FencingJob,
  photo: LegacyPhotoMetadataInput,
  timestamp = photo.addedAt ?? nowIso(),
): FencingJob {
  const record: PhotoEvidence = {
    id: photo.id ?? createId("photo"),
    revision: 1,
    name: photo.name,
    mimeType: photo.mimeType,
    sizeBytes: photo.sizeBytes,
    sha256: null,
    order: job.photos.length,
    addedAt: timestamp,
    updatedAt: timestamp,
    capturedAt: photo.capturedAt ?? null,
    source: photo.source ?? "web",
    caption: photo.caption,
    runIds: photo.runIds,
    gateIds: photo.gateIds,
  };
  return applyEvidenceCommand(job, { type: "add-photo", photo: record }, timestamp);
}

const initialJob = createDefaultJob();
let hydrationFlight: Promise<void> | null = null;
let documentSelectionVersion = 0;

const studioInstance = browserSingleton('xray.studio.store.v1', () => create<StudioState>((set, get) => ({
  job: initialJob,
  bomState: createBomState(initialJob.id),
  bomPersistenceError: null,
  selectedRunId: null,
  selectedVertexIndex: null,
  selectedGateId: null,
  traceError: null,
  traceUndoStack: [],
  traceRedoStack: [],
  photoPreviewUrls: {},
  photoError: null,
  activePlanBinary: null,
  documentError: null,
  persistenceError: null,
  persistenceHydrated: false,
  persistenceRecoveryBlocked: true,
  lastSavedJobRevision: null,
  lastSavedJobRaw: null,
  projectWriteStale: false,
  hydrationStatus: "idle",
  assetReadiness: EMPTY_RUNTIME_ASSET_READINESS,
  quoteReadiness: readiness(initialJob, EMPTY_RUNTIME_ASSET_READINESS, false),
  pane: "sheets",
  // [SC-21 designed model] begin
  designedBuilding: null,
  // [SC-21 designed model] end
  sheet: 0,
  skin: "paper",
  lifted: false,
  chromeHidden: false,
  showSrc: true,
  showBld: true,
  showRoof: true,
  showMan: true,
  pose: "standing",
  cam: "iso",
  height: 0,
  az: -0.7,
  el: 0.35,
  dist: 1,
  planName: "Ruffles.pdf",
  takeoff: null,
  engineNote: "demo filename — PDF engine runs in the Tauri shell",
  scaleM: 1,
  currentCalibration: initialJob.calibrations[0],
  calibrationCapture: null,
  calibrationError: null,
  tool: "none",
  pending: [],
  markups: [],
  trades: [],
  componentInventory: createSampleStructuralInventory(),
  inventoryPersistenceError: null,
  inventoryRecoveryBlocked: false,
  selectedComponentId: "conn-c1-01",
  componentFilterDiscipline: "all",
  componentFilterCategory: "all",
  componentSearchQuery: "",
  capsOpen: false,
  rightCollapsed: false,
  zoom2d: 1,
  pan2d: { x: 0, y: 0 },
  snappingEnabled: true,
  floors: 1,
  explodeFloors: 0,
  activeFloor: null,
  showSurfaces: true,
  projectPreset: "ruffles",
  wtcLayers: { perimeter: true, core: true, floors: true },
  renderMaterials: {
    roof: "Standing-seam metal - warm white",
    walls: "Light cream masonry and restrained natural ac",
    windows: "Charcoal aluminium frames - clear glazing",
    landscaping: "Subtropical Australian planting - retained site i",
    lighting: "Warm late-afternoon daylight - physically plau",
    style: "Photoreal architectural visualisation",
    direction: "Optional finish, weather or presentation direction",
  },
  capturedView: null,
  geometryLock: true,
  setProjectPreset: (preset) => {
    if (preset === "wtc") {
      set({
        projectPreset: preset,
        planName: "WTC.DXF",
        floors: 110,
        pane: "model",
        cam: "iso",
        az: -0.75,
        el: 0.28,
        dist: 1.4,
      });
    } else if (preset === "highrise") {
      set({
        projectPreset: preset,
        planName: "191217_752 HIGH_FOR CONSTRUCTION L...",
        floors: 40,
        pane: "model",
        cam: "iso",
        az: -0.65,
        el: 0.32,
      });
    } else if (preset === "fencing") {
      set({
        projectPreset: preset,
        planName: "fencing-boundary.dxf",
        floors: 1,
        pane: "cost",
      });
    } else {
      set({
        projectPreset: "ruffles",
        planName: "10558 REV C - 356 RUFFLES RD, WILLOW...",
        floors: 1,
        pane: "model",
        sheet: 16,
      });
    }
  },
  toggleWtcLayer: (layer) =>
    set({
      wtcLayers: {
        ...get().wtcLayers,
        [layer]: !get().wtcLayers[layer],
      },
    }),
  setRenderMaterial: (key, val) =>
    set({
      renderMaterials: {
        ...get().renderMaterials,
        [key]: val,
      },
    }),
  setCapturedView: (val) => set({ capturedView: val }),
  toggleGeometryLock: () => set({ geometryLock: !get().geometryLock }),
  toggleSnapping: () => set({ snappingEnabled: !get().snappingEnabled }),
  toggleSurfaces: () => set({ showSurfaces: !get().showSurfaces }),
  setFloors: (floors) => set({ floors: Math.max(1, Math.min(100, floors)) }),
  setExplodeFloors: (val) => set({ explodeFloors: Math.max(0, Math.min(3, val)) }),
  setActiveFloor: (floor) => set({ activeFloor: floor }),
  setPane: (pane) =>
    set({ pane, lifted: pane === "model" ? get().lifted : false, chromeHidden: false }),
  // [SC-21 designed model] begin
  setDesignedBuilding: (scene) => set({ designedBuilding: scene }),
  // [SC-21 designed model] end
  setSheet: (sheet) => {
    const state = get();
    const activeDocument = state.job.documents.find(
      (document) => document.id === state.job.activeDocumentId,
    );
    const pageCount = activeDocument?.pageCount ?? 1;
    const safeSheet = Math.max(0, Math.min(pageCount - 1, sheet));
    const calibration = activeCalibration(state.job, safeSheet);
    const job = { ...state.job, activeSheet: safeSheet };
    const selectedRun = state.selectedRunId
      ? job.runs.find((run) => run.id === state.selectedRunId && run.sheet === safeSheet)
      : null;
    const selectedGate = state.selectedGateId
      ? job.gates.find((gate) => gate.id === state.selectedGateId && gate.sheet === safeSheet)
      : null;
    const calibrationState = {
      job,
      currentCalibration: calibration,
      scaleM: scaleForCalibration(calibration),
      calibrationCapture: null,
      calibrationError: null,
      pending: [],
      selectedRunId: selectedRun?.id ?? selectedGate?.runId ?? null,
      selectedVertexIndex: selectedRun ? state.selectedVertexIndex : null,
      selectedGateId: selectedGate?.id ?? null,
    };
    if (activeDocument?.source !== "sample") {
      set({
        ...calibrationState,
        sheet: safeSheet,
        pose: "laid",
        cam: "plan",
        az: -Math.PI / 2,
        el: 1.38,
      });
      return;
    }
    const kind: SheetKind = SHEETS[safeSheet]?.kind ?? "plan";
    if (kind === "elev") {
      set({
        ...calibrationState,
        sheet: safeSheet,
        pose: "standing",
        cam: "iso",
        az: -0.7,
        el: 0.35,
      });
    } else {
      set({
        ...calibrationState,
        sheet: safeSheet,
        pose: "laid",
        cam: "plan",
        az: -Math.PI / 2,
        el: 1.38,
      });
    }
  },
  toggle: (k) => set({ [k]: !get()[k] } as Partial<StudioState>),
  setSkin: (skin) => set({ skin }),
  lift: () =>
    set((s) => {
      if (!s.lifted) return { lifted: true, chromeHidden: false };
      if (!s.chromeHidden) return { chromeHidden: true };
      return { lifted: false, chromeHidden: false };
    }),
  hideChrome: () => set({ chromeHidden: !get().chromeHidden }),
  stand: () => set({ pose: "standing", cam: "iso", az: -0.7, el: 0.35 }),
  lay: () => set({ pose: "laid", cam: "plan", az: -Math.PI / 2, el: 1.38 }),
  setCam: (cam) =>
    set(
      cam === "plan"
        ? { cam, az: -Math.PI / 2, el: 1.38, pose: "laid" }
        : { cam, az: -0.7, el: 0.35, pose: "standing" },
    ),
  fit: () =>
    set({
      dist: 1,
      az: get().cam === "plan" ? -Math.PI / 2 : -0.7,
      el: get().cam === "plan" ? 1.38 : 0.35,
      zoom2d: 1,
      pan2d: { x: 0, y: 0 },
    }),
  setOrbit: (az, el) => set({ az, el }),
  setDist: (dist) => set({ dist }),
  setHeight: (h) => set({ height: h }),
  setScale: () =>
    set(calibrationFailure("Use a verified calibration candidate and lock it before measuring.")),
  startCalibrationCapture: () => {
    const { sheet, job } = get();
    if (hasLegacySourceEvidence(job, sheet)) {
      set(
        calibrationFailure(
          "Legacy source coordinates require reviewed recovery; export the current manifest in Proof.",
        ),
      );
      return;
    }
    set({
      calibrationCapture: { sheet, points: [] },
      calibrationError: null,
      pending: [],
      tool: "none",
    });
  },
  cancelCalibrationCapture: () => set({ calibrationCapture: null, calibrationError: null }),
  addCalibrationPoint: (point) => {
    const state = get();
    const capture = state.calibrationCapture;
    if (!capture || capture.sheet !== state.sheet) {
      set(calibrationFailure("Start a two-point calibration on the current sheet first."));
      return;
    }
    if (capture.points.length >= 2) {
      set(
        calibrationFailure(
          "Two calibration points are already captured. Enter the known distance or start again.",
        ),
      );
      return;
    }
    set({
      calibrationCapture: { ...capture, points: [...capture.points, point] },
      calibrationError: null,
    });
  },
  upsertManualCalibrationCandidate: (input) => {
    try {
      const state = get();
      const capture = state.calibrationCapture;
      if (!capture || capture.sheet !== state.sheet || capture.points.length !== 2) {
        throw new Error(
          "Capture exactly two points on the current sheet before entering a known distance.",
        );
      }
      assertCalibrationCanChange(state.job, state.sheet);
      const calibration = activeCalibration(state.job, state.sheet);
      if (usesImportedSource(state.job) && input.coordinateSpace !== "source-page-v1")
        throw Error("Source calibration requires explicit source-page-v1 coordinates.");
      const candidateId = input.candidateId ?? `manual-sheet-${state.sheet}`;
      const candidate = createTwoPointCalibrationCandidate({
        id: candidateId,
        source: "manual",
        points: [capture.points[0], capture.points[1]],
        distance: input.distance,
        transform: calibration.transform,
        confidence: input.confidence ?? 1,
        provenance: input.provenance,
      });
      const candidates = [
        ...calibration.candidates.filter((entry) => entry.id !== candidateId),
        candidate,
      ];
      const next = unlockedCalibrationWithCandidates(
        { ...calibration, coordinateSpace: input.coordinateSpace ?? calibration.coordinateSpace },
        candidates,
      );
      set({
        job: revisedCalibration(
          state.job,
          next,
          `Updated calibration candidate for sheet ${state.sheet + 1}.`,
        ),
        currentCalibration: next,
        scaleM: 1,
        calibrationCapture: null,
        calibrationError: null,
        pending: [],
        traceUndoStack: [],
        traceRedoStack: [],
      });
    } catch (error) {
      set(calibrationFailure(error instanceof Error ? error.message : String(error)));
    }
  },
  ingestCalibrationCandidate: (input) => {
    try {
      const state = get();
      assertCalibrationCanChange(state.job, state.sheet);
      const calibration = activeCalibration(state.job, state.sheet);
      const candidate = createScaleCalibrationCandidate(input);
      const candidates = [
        ...calibration.candidates.filter((entry) => entry.id !== candidate.id),
        candidate,
      ];
      const next = unlockedCalibrationWithCandidates(calibration, candidates);
      set({
        job: revisedCalibration(
          state.job,
          next,
          `Ingested calibration candidate for sheet ${state.sheet + 1}.`,
        ),
        currentCalibration: next,
        scaleM: 1,
        calibrationError: null,
        pending: [],
        traceUndoStack: [],
        traceRedoStack: [],
      });
    } catch (error) {
      set(calibrationFailure(error instanceof Error ? error.message : String(error)));
    }
  },
  resolveCalibrationCandidate: (candidateId) => {
    try {
      const state = get();
      assertCalibrationCanChange(state.job, state.sheet);
      const calibration = activeCalibration(state.job, state.sheet);
      const next = unlockedCalibrationWithCandidates(
        calibration,
        calibration.candidates,
        candidateId,
      );
      set({
        job: revisedCalibration(
          state.job,
          next,
          `Resolved calibration for sheet ${state.sheet + 1}.`,
        ),
        currentCalibration: next,
        scaleM: 1,
        calibrationError: null,
        pending: [],
        traceUndoStack: [],
        traceRedoStack: [],
      });
    } catch (error) {
      set(calibrationFailure(error instanceof Error ? error.message : String(error)));
    }
  },
  lockCurrentCalibration: (candidateId) => {
    try {
      const state = get();
      if (hasLegacySourceEvidence(state.job, state.sheet))
        throw Error(
          "Legacy source calibration cannot authorize measurements; export before reviewed recovery.",
        );
      const calibration = activeCalibration(state.job, state.sheet);
      if (
        calibration.locked &&
        (candidateId === undefined || candidateId === calibration.selectedCandidateId)
      ) {
        set({ calibrationError: null, scaleM: calibration.metresPerUnit });
        return;
      }
      if (
        calibrationHasGeometry(state.job, state.sheet) &&
        (!calibration.locked ||
          (candidateId !== undefined && candidateId !== calibration.selectedCandidateId))
      ) {
        throw new Error(
          "Remove measurements from this sheet before changing its locked calibration.",
        );
      }
      const next = lockCalibration(calibration, candidateId ?? calibration.selectedCandidateId);
      set({
        job: revisedCalibration(
          state.job,
          next,
          `Locked calibration for sheet ${state.sheet + 1}.`,
        ),
        currentCalibration: next,
        scaleM: next.metresPerUnit,
        calibrationCapture: null,
        calibrationError: null,
        pending: [],
        traceUndoStack: [],
        traceRedoStack: [],
      });
    } catch (error) {
      set(calibrationFailure(error instanceof Error ? error.message : String(error)));
    }
  },
  unlockCurrentCalibration: () => {
    try {
      const state = get();
      assertCalibrationCanChange(state.job, state.sheet);
      const next = unlockCalibration(activeCalibration(state.job, state.sheet));
      set({
        job: revisedCalibration(
          state.job,
          next,
          `Unlocked calibration for sheet ${state.sheet + 1}.`,
        ),
        currentCalibration: next,
        scaleM: 1,
        calibrationError: null,
        pending: [],
        traceUndoStack: [],
        traceRedoStack: [],
      });
    } catch (error) {
      set(calibrationFailure(error instanceof Error ? error.message : String(error)));
    }
  },
  setTool: (t) => set({ tool: t, pending: [] }),
  setZoom2d: (zoom2d) => set({ zoom2d }),
  setPan2d: (pan2d) => set({ pan2d }),
  setPlanName: (name) => set({ planName: name }),
  selectDocument: async (documentId) => {
    const before = get();
    if (documentId === before.job.activeDocumentId && before.activePlanBinary) return;
    const version = ++documentSelectionVersion;
    const unchanged = () =>
      version === documentSelectionVersion &&
      get().job === before.job &&
      get().sheet === before.sheet &&
      get().pending === before.pending &&
      get().calibrationCapture === before.calibrationCapture;
    const prepared = await prepareDocumentSelection(
      before,
      documentId,
      async (document) =>
        verifyStoredPlanContent(await createBrowserPlanStore().get(document.id), document),
      unchanged,
    );
    const photoPreviewUrls: Record<string, string> = {};
    const photoReadiness: RuntimeAssetReadiness["photos"] = {};
    const messages: string[] = [];
    try {
      if (prepared.job.photos.length) {
        const contents = await createBrowserPhotoStore().list();
        const byId = new Map(contents.map((item) => [item.id, item]));
        for (const photo of prepared.job.photos) {
          const result = await verifyPhotoContent(byId.get(photo.id) ?? null, photo);
          if (result.status === "ready") {
            photoPreviewUrls[photo.id] = photoContentObjectUrl(result.content);
            photoReadiness[photo.id] = { state: "ready", message: null };
          } else {
            photoReadiness[photo.id] = { state: result.status, message: result.message };
            messages.push(result.message);
          }
        }
      }
      if (!unchanged())
        throw Error(
          "The workbench changed while this plan loaded. Your current work was preserved; select the plan again.",
        );
      const job = appendJobRevision(prepared.job, {
        entityType: "job",
        entityId: before.job.id,
        action: "update",
        summary: `Selected source ${prepared.binary.name}.`,
      });
      const sheet = job.activeSheet ?? 0,
        calibration = activeCalibration(job, sheet);
      set({
        job,
        activePlanBinary: prepared.binary,
        planName: prepared.binary.name,
        sheet,
        currentCalibration: calibration,
        scaleM: scaleForCalibration(calibration),
        markups: markupsFromJob(job),
        pending: [],
        calibrationCapture: null,
        selectedRunId: null,
        selectedVertexIndex: null,
        selectedGateId: null,
        traceUndoStack: [],
        traceRedoStack: [],
        tool: "none",
        zoom2d: 1,
        pan2d: { x: 0, y: 0 },
        takeoff: null,
        engineNote: "Restored original source and its saved evidence.",
        documentError: null,
        calibrationError: null,
        traceError: null,
        photoPreviewUrls,
        photoError: messages.join(" ") || null,
        assetReadiness: { document: { state: "ready", message: null }, photos: photoReadiness },
      });
      for (const url of Object.values(before.photoPreviewUrls)) URL.revokeObjectURL(url);
    } catch (error) {
      for (const url of Object.values(photoPreviewUrls)) URL.revokeObjectURL(url);
      throw error;
    }
  },
  importPlan: async (imported) => {
    try {
      const before = get();
      if (before.pending.length || before.calibrationCapture)
        throw Error(
          "Finish or cancel the current trace or calibration before opening another plan.",
        );
      if (before.job.documents.some((item) => item.id === imported.revision.id))
        throw Error("This source ID already exists. Select the saved plan instead.");
      const version = ++documentSelectionVersion;
      await createBrowserPlanStore().put(storedContent(imported.binary));
      if (
        version !== documentSelectionVersion ||
        get().job !== before.job ||
        get().pending !== before.pending ||
        get().calibrationCapture !== before.calibrationCapture
      )
        throw Error(
          "The workbench changed while the source was stored. Current evidence was preserved; open the plan again.",
        );
      set((state) => ({
        activePlanBinary: imported.binary,
        documentError: null,
        planName: imported.revision.name,
        takeoff: imported.takeoff,
        engineNote: imported.note,
        sheet: 0,
        scaleM: 1,
        currentCalibration: createUnverifiedCalibration(0),
        calibrationCapture: null,
        calibrationError: null,
        selectedRunId: null,
        selectedVertexIndex: null,
        selectedGateId: null,
        traceError: null,
        traceUndoStack: [],
        traceRedoStack: [],
        pending: [],
        markups: [],
        job: jobForImportedPlan(state.job, imported, state.sheet),
        assetReadiness: {
          document: { state: "ready", message: null },
          photos: {},
        },
        photoPreviewUrls: {},
        photoError: null,
      }));
      for (const url of Object.values(before.photoPreviewUrls)) URL.revokeObjectURL(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set({ documentError: message });
      throw error;
    }
  },
  addPoint: (p) => {
    if (get().calibrationCapture) {
      get().addCalibrationPoint(p);
      return;
    }
    const { tool, pending, sheet, job } = get();
    try {
      assertSourceCoordinateAuthority(job, sheet);
    } catch (error) {
      set(calibrationFailure((error as Error).message));
      return;
    }
    if (tool === "count") {
      const runId = get().selectedRunId;
      if (!runId) {
        set({ traceError: "Select a run before placing a gate." });
        return;
      }
      get().upsertGate({ runId, point: p, widthM: 1 });
      return;
    }
    const calibration = activeCalibration(job, sheet);
    if ((tool === "length" || tool === "area" || tool === "sketch") && !calibration.locked) {
      set(
        calibrationFailure(
          "Lock a verified calibration for this sheet before drawing metric measurements.",
        ),
      );
      return;
    }
    const next = [...pending, p];
    set({ pending: next });
  },
  commitPending: () => {
    const { tool, pending, sheet, markups, job } = get();
    try {
      assertSourceCoordinateAuthority(job, sheet);
    } catch (error) {
      set(calibrationFailure((error as Error).message));
      return;
    }
    const calibration = activeCalibration(job, sheet);
    if ((tool === "length" || tool === "area" || tool === "sketch") && !calibration.locked) {
      set(
        calibrationFailure(
          "Lock a verified calibration for this sheet before drawing metric measurements.",
        ),
      );
      return;
    }
    if (tool === "length" && pending.length >= 2) {
      try {
        const previous = traceStateFromJob(job);
        const id = createId("run");
        const runNumber = job.runs.length + 1;
        const run = createEditableRun(
          {
            id,
            revision: 1,
            sheet,
            label: `Run ${String(runNumber).padStart(2, "0")}`,
            points: pending,
            lengthM: 0,
            specification: createNewRunSpecification(job),
            photoIds: [],
            review: createReviewDecision(),
          },
          calibration,
          previous.gates,
        );
        const next = { ...previous, runs: [...previous.runs, run] };
        const history: TraceHistoryEntry = {
          command: { type: "create-run", runId: id },
          previous,
          next,
        };
        set((state) => ({
          job: revisedTraceJob(state.job, next, {
            entityType: "run",
            entityId: id,
            action: "create",
            summary: `Created ${run.label}.`,
          }),
          markups: markupsWithTrace(state.markups, next),
          pending: [],
          selectedRunId: id,
          selectedVertexIndex: null,
          selectedGateId: null,
          traceError: null,
          traceUndoStack: boundedHistory([...state.traceUndoStack, history]),
          traceRedoStack: [],
        }));
      } catch (error) {
        set({ traceError: error instanceof Error ? error.message : String(error), pending: [] });
      }
      return;
    }
    if (tool === "area" && pending.length >= 3) {
      const markup: Markup = {
        id: uid(),
        kind: "area",
        label: "Area",
        value: polyArea(pending) * calibration.metresPerUnit * calibration.metresPerUnit,
        unit: "m\u00b2",
        sheet,
        points: pending,
      };
      set({ pending: [], markups: [...markups, markup], job: appendSourceMarkup(job, markup) });
      return;
    }
    if (tool === "sketch" && pending.length >= 2) {
      const metres = pending
        .slice(1)
        .reduce((acc, pt, i) => acc + dist2(pending[i], pt) * calibration.metresPerUnit, 0);
      const markup: Markup = {
        id: uid(),
        kind: "sketch",
        label: "Manual trace",
        value: metres,
        unit: "m",
        sheet,
        points: pending,
      };
      set({ pending: [], markups: [...markups, markup], job: appendSourceMarkup(job, markup) });
    }
  },
  clearPending: () => set({ pending: [] }),
  selectVertex: (runId, vertexIndex) => {
    const run = get().job.runs.find((entry) => entry.id === runId);
    if (!run || vertexIndex < 0 || vertexIndex >= run.points.length) {
      set({ traceError: "The selected run vertex no longer exists." });
      return;
    }
    set({
      selectedRunId: runId,
      selectedVertexIndex: vertexIndex,
      selectedGateId: null,
      traceError: null,
    });
  },
  selectGate: (gateId) => {
    const gate = get().job.gates.find((entry) => entry.id === gateId);
    if (!gate) {
      set({ selectedGateId: null, traceError: "The selected gate no longer exists." });
      return;
    }
    set({
      selectedGateId: gateId,
      selectedRunId: gate.runId,
      selectedVertexIndex: null,
      traceError: null,
    });
  },
  executeTraceCommand: (command) => {
    try {
      const state = get();
      const previous = traceStateFromJob(state.job);
      const result = applyTraceCommand(previous, command, state.job.calibrations);
      assertTraceChangeAuthority(state.job, result.next);
      const history: TraceHistoryEntry = { command, previous: result.previous, next: result.next };
      set({
        job: revisedTraceJob(state.job, result.next, traceRevisionDescriptor(state.job, command)),
        markups: markupsWithTrace(state.markups, result.next),
        ...repairedSelection(state, result.next),
        traceError: null,
        traceUndoStack: boundedHistory([...state.traceUndoStack, history]),
        traceRedoStack: [],
      });
    } catch (error) {
      set({ traceError: error instanceof Error ? error.message : String(error) });
    }
  },
  moveRunVertex: (runId, vertexIndex, point) => {
    const run = get().job.runs.find((entry) => entry.id === runId);
    if (!run?.revision) {
      set({ traceError: `Unknown editable run: ${runId}` });
      return;
    }
    const before = get().traceUndoStack.at(-1);
    get().executeTraceCommand({
      type: "move-vertex",
      runId,
      expectedRevision: run.revision,
      vertexIndex,
      point,
    });
    if (get().traceError === null && get().traceUndoStack.at(-1) !== before)
      get().selectVertex(runId, vertexIndex);
  },
  insertRunVertex: (runId, segmentIndex, point) => {
    const run = get().job.runs.find((entry) => entry.id === runId);
    if (!run?.revision) {
      set({ traceError: `Unknown editable run: ${runId}` });
      return;
    }
    const before = get().traceUndoStack.at(-1);
    get().executeTraceCommand({
      type: "insert-vertex",
      runId,
      expectedRevision: run.revision,
      segmentIndex,
      point,
    });
    if (get().traceError === null && get().traceUndoStack.at(-1) !== before)
      get().selectVertex(runId, segmentIndex + 1);
  },
  removeRunVertex: (runId, vertexIndex) => {
    const run = get().job.runs.find((entry) => entry.id === runId);
    if (!run?.revision) {
      set({ traceError: `Unknown editable run: ${runId}` });
      return;
    }
    const before = get().traceUndoStack.at(-1);
    get().executeTraceCommand({
      type: "remove-vertex",
      runId,
      expectedRevision: run.revision,
      vertexIndex,
    });
    if (get().traceError === null && get().traceUndoStack.at(-1) !== before) {
      const changed = get().job.runs.find((entry) => entry.id === runId);
      if (changed) get().selectVertex(runId, Math.min(vertexIndex, changed.points.length - 1));
    }
  },
  splitRun: (runId, vertexIndex) => {
    const run = get().job.runs.find((entry) => entry.id === runId);
    if (!run?.revision) {
      set({ traceError: `Unknown editable run: ${runId}` });
      return;
    }
    const newRunIds: [string, string] = [createId("run"), createId("run")];
    const before = get().traceUndoStack.at(-1);
    get().executeTraceCommand({
      type: "split-run",
      runId,
      expectedRevision: run.revision,
      vertexIndex,
      newRunIds,
    });
    if (get().traceError === null && get().traceUndoStack.at(-1) !== before)
      get().selectRun(newRunIds[0]);
  },
  mergeRuns: (input) => {
    const first = get().job.runs.find((entry) => entry.id === input.firstRunId);
    const second = get().job.runs.find((entry) => entry.id === input.secondRunId);
    if (!first?.revision || !second?.revision) {
      set({ traceError: "Both editable runs are required before merging." });
      return;
    }
    const mergedRunId = input.mergedRunId ?? createId("run");
    const before = get().traceUndoStack.at(-1);
    get().executeTraceCommand({
      type: "merge-runs",
      firstRunId: first.id,
      firstExpectedRevision: first.revision,
      firstEndpoint: input.firstEndpoint,
      secondRunId: second.id,
      secondExpectedRevision: second.revision,
      secondEndpoint: input.secondEndpoint,
      mergedRunId,
      label: input.label,
    });
    if (get().traceError === null && get().traceUndoStack.at(-1) !== before)
      get().selectRun(mergedRunId);
  },
  upsertGate: (input) => {
    const state = get();
    const previous = (() => {
      try {
        return traceStateFromJob(state.job);
      } catch {
        return null;
      }
    })();
    const run = previous?.runs.find((entry) => entry.id === input.runId);
    if (!run) {
      set({ traceError: `Unknown editable run: ${input.runId}` });
      return;
    }
    if (!Number.isFinite(input.widthM) || input.widthM <= 0 || input.widthM > 30) {
      set({ traceError: "Gate width must be greater than zero and no more than 30 metres." });
      return;
    }
    const existing = input.id ? previous!.gates.find((entry) => entry.id === input.id) : undefined;
    const id = existing?.id ?? input.id ?? createId("gate");
    const gateNumber = state.job.gates.length + 1;
    const gate: GateRecord = {
      ...createGateSpecification(),
      ...existing,
      id,
      revision: existing?.revision,
      sheet: run.sheet,
      label: input.label ?? existing?.label ?? `Gate ${String(gateNumber).padStart(2, "0")}`,
      point: input.point,
      runId: run.id,
      widthM: input.widthM,
      heightM: input.heightM ?? existing?.heightM ?? null,
      type: input.type ?? existing?.type ?? "unselected",
      hardware: input.hardware ?? existing?.hardware ?? "",
      motorised: input.motorised ?? existing?.motorised ?? false,
      customType: input.customType ?? existing?.customType ?? "",
      openingDirection: input.openingDirection ?? existing?.openingDirection ?? "unselected",
      hingeSide: input.hingeSide ?? existing?.hingeSide ?? "unselected",
      latch: input.latch ?? existing?.latch ?? "",
      postSize: input.postSize ?? existing?.postSize ?? "",
      finish: input.finish ?? existing?.finish ?? "",
      clearanceM: input.clearanceM ?? existing?.clearanceM ?? null,
      notes: input.notes ?? existing?.notes ?? "",
      photoIds: existing?.photoIds ?? [],
      review: existing?.review ?? createReviewDecision(),
    };
    const before = state.traceUndoStack.at(-1);
    get().executeTraceCommand({
      type: "place-gate",
      gate,
      runId: run.id,
      expectedRevision: existing?.revision ?? null,
    });
    if (get().traceError === null && get().traceUndoStack.at(-1) !== before) get().selectGate(id);
  },
  removeGate: (gateId) => {
    const before = get().traceUndoStack.at(-1);
    get().executeTraceCommand({ type: "remove-gate", gateId });
    if (get().traceError === null && get().traceUndoStack.at(-1) !== before)
      set({ selectedGateId: null });
  },
  removeRun: (runId, expectedRevision) => {
    try {
      const state = get();
      const previous = traceStateFromJob(state.job);
      const run = previous.runs.find((entry) => entry.id === runId);
      if (!run) throw new Error(`Unknown fence run: ${runId}`);
      if (expectedRevision !== undefined && expectedRevision !== run.revision) {
        throw new Error(
          `Stale fence run revision for ${runId}: expected ${expectedRevision}, current ${run.revision}.`,
        );
      }
      const next = {
        runs: previous.runs.filter((entry) => entry.id !== runId),
        gates: previous.gates.filter((gate) => gate.runId !== runId),
      };
      assertTraceChangeAuthority(state.job, next);
      const history: TraceHistoryEntry = {
        command: { type: "remove-run", runId, expectedRevision: run.revision },
        previous,
        next,
      };
      set({
        job: revisedTraceJob(state.job, next, {
          entityType: "run",
          entityId: run.id,
          action: "delete",
          summary: `Removed ${run.label}.`,
        }),
        markups: markupsWithTrace(state.markups, next),
        ...repairedSelection(state, next),
        traceError: null,
        traceUndoStack: boundedHistory([...state.traceUndoStack, history]),
        traceRedoStack: [],
      });
    } catch (error) {
      set({ traceError: error instanceof Error ? error.message : String(error) });
    }
  },
  undoTrace: () => {
    const state = get();
    const entry = state.traceUndoStack.at(-1);
    if (!entry) return;
    try {
      assertTraceChangeAuthority(state.job, entry.previous);
    } catch (error) {
      set({ traceError: error instanceof Error ? error.message : String(error) });
      return;
    }
    set({
      job: revisedTraceJob(state.job, entry.previous, {
        entityType: "job",
        entityId: state.job.id,
        action: "update",
        summary: "Undid a trace change.",
      }),
      markups: markupsWithTrace(state.markups, entry.previous),
      ...repairedSelection(state, entry.previous),
      traceError: null,
      traceUndoStack: state.traceUndoStack.slice(0, -1),
      traceRedoStack: boundedHistory([...state.traceRedoStack, entry]),
    });
  },
  redoTrace: () => {
    const state = get();
    const entry = state.traceRedoStack.at(-1);
    if (!entry) return;
    try {
      assertTraceChangeAuthority(state.job, entry.next);
    } catch (error) {
      set({ traceError: error instanceof Error ? error.message : String(error) });
      return;
    }
    set({
      job: revisedTraceJob(state.job, entry.next, {
        entityType: "job",
        entityId: state.job.id,
        action: "update",
        summary: "Redid a trace change.",
      }),
      markups: markupsWithTrace(state.markups, entry.next),
      ...repairedSelection(state, entry.next),
      traceError: null,
      traceUndoStack: boundedHistory([...state.traceUndoStack, entry]),
      traceRedoStack: state.traceRedoStack.slice(0, -1),
    });
  },
  removeMarkup: (id) => {
    if (get().job.runs.some((run) => run.id === id)) {
      get().removeRun(id);
      return;
    }
    if (get().job.gates.some((gate) => gate.id === id)) {
      get().removeGate(id);
      return;
    }
    const state = get();
    const annotation = state.job.annotations?.find((item) => item.id === id);
    try {
      if (annotation) assertSourceCoordinateAuthority(state.job, annotation.sheet);
    } catch (error) {
      set({ traceError: error instanceof Error ? error.message : String(error) });
      return;
    }
    set({
      markups: state.markups.filter((markup) => markup.id !== id),
      job: annotation
        ? appendJobRevision(
            { ...state.job, annotations: state.job.annotations!.filter((item) => item.id !== id) },
            {
              entityType: "job",
              entityId: state.job.id,
              action: "update",
              summary: `Removed ${annotation.label}.`,
            },
          )
        : state.job,
    });
  },
  addTrade: (name) => {
    const n = name.trim().slice(0, 200);
    if (!n) return;
    const state = get(),
      trades = [...state.trades, { id: uid(), name: n, note: "Recorded from project evidence" }];
    set({
      trades,
      job: appendJobRevision(
        { ...state.job, componentRegistry: trades },
        {
          entityType: "job",
          entityId: state.job.id,
          action: "update",
          summary: `Added component ${n}.`,
        },
      ),
    });
  },
  removeTrade: (id) => {
    const state = get(),
      trades = state.trades.filter((item) => item.id !== id);
    set({
      trades,
      job: appendJobRevision(
        { ...state.job, componentRegistry: trades },
        {
          entityType: "job",
          entityId: state.job.id,
          action: "update",
          summary: "Removed component name.",
        },
      ),
    });
  },
  selectComponent: (id) => set({ selectedComponentId: id }),
  setComponentFilterDiscipline: (discipline) => set({ componentFilterDiscipline: discipline }),
  setComponentFilterCategory: (category) => set({ componentFilterCategory: category }),
  setComponentSearchQuery: (query) => set({ componentSearchQuery: query }),
  resetSampleInventory: () => {
    const sample = createSampleStructuralInventory();
    // Explicit replacement is a recovery action. Only a successful write can
    // release an unreadable-data lock; a failed reset must retain protection.
    const result = saveComponentInventory(get().job.id, sample);
    set({
      componentInventory: sample,
      selectedComponentId: "conn-c1-01",
      inventoryRecoveryBlocked: result.ok ? false : get().inventoryRecoveryBlocked,
      inventoryPersistenceError: result.ok ? null
        : `Component inventory could not be saved (${result.reason}${result.preservedPrevious ? "; previous snapshot preserved" : ""}).`,
    });
  },
  setComponentInventory: (inventory) => {
    const validated = componentInventorySchema.parse(inventory);
    // Editing in memory does not acknowledge a failed restore. The hydrated
    // autosave subscription uses the same guarded action as explicit Save.
    set({ componentInventory: validated });
  },
  saveCurrentInventory: () => {
    const state = get();
    if (state.inventoryRecoveryBlocked) {
      return { ok: false, reason: "recovery-required", preservedPrevious: true };
    }
    const result = saveComponentInventory(state.job.id, state.componentInventory);
    if (result.ok) {
      if (state.inventoryPersistenceError) set({ inventoryPersistenceError: null });
    } else {
      const error = `Component inventory could not be saved (${result.reason}${result.preservedPrevious ? "; previous snapshot preserved" : ""}).`;
      if (state.inventoryPersistenceError !== error) set({ inventoryPersistenceError: error });
    }
    return result;
  },
  loadCurrentInventory: () => {
    const state = get();
    const result = loadComponentInventory(state.job.id);
    if (result.ok) {
      set({ componentInventory: result.inventory, inventoryPersistenceError: null, inventoryRecoveryBlocked: false });
    } else if (result.reason !== "not-found") {
      set({
        inventoryRecoveryBlocked: true,
        inventoryPersistenceError: `Saved component inventory could not be restored (${result.reason}). Unreadable data preserved in storage; autosave blocked until recovery.`,
      });
    }
    return result;
  },
  updateSite: (site) =>
    set((state) => ({
      job: appendJobRevision(
        {
          ...state.job,
          site: { ...state.job.site, ...site },
        },
        {
          entityType: "job",
          entityId: state.job.id,
          action: "update",
          summary: "Updated site details.",
        },
      ),
    })),
  updateJobName: (name) => {
    if (!name.trim()) return;
    set((state) => ({
      job: appendJobRevision(
        { ...state.job, name: name.slice(0, 200) },
        {
          entityType: "job",
          entityId: state.job.id,
          action: "update",
          summary: "Updated job name.",
        },
      ),
    }));
  },
  updateRunSpecification: (runId, expectedRevision, patch) => {
    try {
      set((state) => ({
        job: applyEvidenceCommand(state.job, {
          type: "update-run-specification",
          runId,
          expectedRevision,
          patch,
        }),
        photoError: null,
      }));
    } catch (error) {
      set({ photoError: error instanceof Error ? error.message : String(error) });
    }
  },
  updateGateSpecification: (gateId, expectedRevision, patch) => {
    try {
      set((state) => ({
        job: applyEvidenceCommand(state.job, {
          type: "update-gate-specification",
          gateId,
          expectedRevision,
          patch,
        }),
        photoError: null,
      }));
    } catch (error) {
      set({ photoError: error instanceof Error ? error.message : String(error) });
    }
  },
  approveRun: (runId, expectedRevision, actor, note) => {
    try {
      set((state) => ({
        job: applyEvidenceCommand(state.job, {
          type: "review-run",
          runId,
          expectedRevision,
          decision: "approve",
          actor,
          note,
        }),
        traceError: null,
      }));
    } catch (error) {
      set({ traceError: error instanceof Error ? error.message : String(error) });
    }
  },
  rejectRun: (runId, expectedRevision, actor, note) => {
    try {
      set((state) => ({
        job: applyEvidenceCommand(state.job, {
          type: "review-run",
          runId,
          expectedRevision,
          decision: "reject",
          actor,
          note,
        }),
        traceError: null,
      }));
    } catch (error) {
      set({ traceError: error instanceof Error ? error.message : String(error) });
    }
  },
  approveGate: (gateId, expectedRevision, actor, note) => {
    try {
      set((state) => ({
        job: applyEvidenceCommand(state.job, {
          type: "review-gate",
          gateId,
          expectedRevision,
          decision: "approve",
          actor,
          note,
        }),
        traceError: null,
      }));
    } catch (error) {
      set({ traceError: error instanceof Error ? error.message : String(error) });
    }
  },
  rejectGate: (gateId, expectedRevision, actor, note) => {
    try {
      set((state) => ({
        job: applyEvidenceCommand(state.job, {
          type: "review-gate",
          gateId,
          expectedRevision,
          decision: "reject",
          actor,
          note,
        }),
        traceError: null,
      }));
    } catch (error) {
      set({ traceError: error instanceof Error ? error.message : String(error) });
    }
  },
  selectRun: (selectedRunId) =>
    set({ selectedRunId, selectedVertexIndex: null, selectedGateId: null, traceError: null }),
  addPhotos: async (files) => {
    if (files.length === 0) return;
    const timestamp = nowIso();
    const original = get();
    const photoStore = createBrowserPhotoStore();
    const savedIds: string[] = [];
    const previewUrls: Record<string, string> = {};
    try {
      const imported = await Promise.all(
        files.map((file, index) =>
          importPhotoFile(file, original.job.photos.length + index, timestamp, "web"),
        ),
      );
      for (const item of imported) {
        await photoStore.put(item.content);
        savedIds.push(item.record.id);
        previewUrls[item.record.id] = photoContentObjectUrl(item.content);
      }
      const latest = get();
      let job = latest.job;
      for (let index = 0; index < imported.length; index += 1) {
        job = applyEvidenceCommand(
          job,
          {
            type: "add-photo",
            photo: { ...imported[index].record, order: job.photos.length },
          },
          timestamp,
        );
      }
      set({
        job,
        photoPreviewUrls: { ...latest.photoPreviewUrls, ...previewUrls },
        photoError: null,
        assetReadiness: {
          ...latest.assetReadiness,
          photos: {
            ...latest.assetReadiness.photos,
            ...Object.fromEntries(
              imported.map((item) => [item.record.id, { state: "ready" as const, message: null }]),
            ),
          },
        },
      });
    } catch (error) {
      for (const url of Object.values(previewUrls)) URL.revokeObjectURL(url);
      await Promise.allSettled(savedIds.map((id) => photoStore.delete(id)));
      const message = error instanceof Error ? error.message : String(error);
      set({ photoError: message });
      throw error;
    }
  },
  updatePhotoEvidence: (photoId, expectedRevision, patch) => {
    try {
      set((state) => ({
        job: applyEvidenceCommand(state.job, {
          type: "update-photo",
          photoId,
          expectedRevision,
          patch,
        }),
        photoError: null,
      }));
    } catch (error) {
      set({ photoError: error instanceof Error ? error.message : String(error) });
    }
  },
  reorderPhoto: (photoId, toIndex, expectedRevision) => {
    try {
      set((state) => ({
        job: applyEvidenceCommand(state.job, {
          type: "reorder-photo",
          photoId,
          toIndex,
          expectedRevision,
        }),
        photoError: null,
      }));
    } catch (error) {
      set({ photoError: error instanceof Error ? error.message : String(error) });
    }
  },
  removePhoto: async (photoId, expectedRevision) => {
    const state = get();
    let next: FencingJob;
    try {
      next = applyEvidenceCommand(state.job, { type: "remove-photo", photoId, expectedRevision });
    } catch (error) {
      set({ photoError: error instanceof Error ? error.message : String(error) });
      return;
    }
    const photoStore = createBrowserPhotoStore();
    try {
      const photo = state.job.photos.find((entry) => entry.id === photoId)!;
      const content = photo.sha256 === null ? null : await photoStore.get(photoId);
      if (photo.sha256 !== null) await photoStore.delete(photoId);
      if (get().job.revision !== state.job.revision) {
        if (content) await photoStore.put(content);
        throw new Error("The job changed while the photo was being removed. Try again.");
      }
      const previewUrl = state.photoPreviewUrls[photoId];
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const photoPreviewUrls = { ...state.photoPreviewUrls };
      delete photoPreviewUrls[photoId];
      const photos = { ...state.assetReadiness.photos };
      delete photos[photoId];
      set({
        job: next,
        photoPreviewUrls,
        photoError: null,
        assetReadiness: { ...state.assetReadiness, photos },
      });
    } catch (error) {
      set({ photoError: error instanceof Error ? error.message : String(error) });
    }
  },
  beginBomGeneration: (request, startedAt = nowIso()) => {
    const current = get();
    const activeDocument = current.job.documents.find(
      (document) => document.id === current.job.activeDocumentId,
    );
    if (
      request.job.id !== current.job.id ||
      request.job.revision !== current.job.revision ||
      !activeDocument ||
      activeDocument.sha256 !== request.document.sha256
    ) {
      throw new Error(
        "A BOM build can start only for the active job revision and verified source document.",
      );
    }
    const next = beginBomStateBuild(current.bomState, request, startedAt);
    set({ bomState: next, bomPersistenceError: null });
    return next;
  },
  completeBomGeneration: (response, completedAt = nowIso()) => {
    const state = get();
    const pendingRequestId = state.bomState.pending?.requestId ?? "no-pending-request";
    const result = completeBomStateBuild(state.bomState, {
      expectedRequestId: pendingRequestId,
      expectedJobRevision: state.job.revision,
      completedAt,
      response,
    });
    if (result.state !== state.bomState) set({ bomState: result.state });
    return result;
  },
  failBomGeneration: (message, failedAt = nowIso()) => {
    const state = get();
    const pendingRequestId = state.bomState.pending?.requestId ?? "no-pending-request";
    const result = failBomStateBuild(state.bomState, {
      expectedRequestId: pendingRequestId,
      expectedJobRevision: state.job.revision,
      failedAt,
      message,
    });
    if (result.state !== state.bomState) set({ bomState: result.state });
    return result;
  },
  reconcileBomRecipeSet: (recipeSet, changedAt = nowIso()) => {
    const state = get();
    const reference = state.bomState.pending?.binding ?? state.bomState.snapshot?.binding;
    if (!reference) return state.bomState;
    const next = reconcileBomBinding(
      state.bomState,
      {
        ...reference,
        recipeSetId: recipeSet.id,
        recipeSetRevision: recipeSet.revision,
        recipeSetDigest: recipeSet.digest,
      },
      changedAt,
    );
    if (next !== state.bomState) set({ bomState: next });
    return next;
  },
  retryProjectLoad: async () => {
    if (!get().persistenceRecoveryBlocked || hydrationFlight) return;
    set({ persistenceHydrated: false });
    await get().hydratePersistence();
  },
  saveCurrentProject: () => {
    const state = get();
    if (!state.persistenceHydrated || state.persistenceRecoveryBlocked || state.hydrationStatus !== "ready")
      return { ok: false, error: "Saved project recovery must finish before saving. Existing records have been preserved." };
    // Compare-and-swap against the bytes this window last loaded or wrote (null for a slot it created).
    const result = saveFencingJob(state.job, undefined, { expectedRaw: state.lastSavedJobRaw });
    if (result.ok) {
      set({ persistenceError: null, lastSavedJobRevision: state.job.revision, lastSavedJobRaw: result.raw ?? null });
    } else if (result.stale) {
      // Stop autosave retries: the in-memory revision is kept for download, storage keeps the newer one.
      set({ persistenceError: result.error, projectWriteStale: true, persistenceRecoveryBlocked: true });
    } else {
      set({ persistenceError: result.error });
    }
    return result;
  },
  noteExternalProjectWrite: (newValue) => {
    const state = get();
    if (!state.persistenceHydrated || state.hydrationStatus !== "ready" || state.persistenceRecoveryBlocked) return false;
    if (newValue === state.lastSavedJobRaw) return false;
    set({
      projectWriteStale: true,
      persistenceRecoveryBlocked: true,
      persistenceError:
        "Another window saved a newer revision of this project. Saving from this window is paused so the newer revision is not overwritten. Reload the latest revision to continue, or download this window's unsaved revision first.",
    });
    return true;
  },
  hydratePersistence: () => {
    if (get().persistenceHydrated) return Promise.resolve();
    if (hydrationFlight) return hydrationFlight;
    set({ hydrationStatus: "loading", persistenceError: null, persistenceRecoveryBlocked: true, lastSavedJobRevision: null, lastSavedJobRaw: null });
    hydrationFlight = (async () => {
      await Promise.resolve();
      const staleUrls = get().photoPreviewUrls;
      for (const url of Object.values(staleUrls)) URL.revokeObjectURL(url);
      if (Object.keys(staleUrls).length > 0) set({ photoPreviewUrls: {} });
      const loaded = await loadOrCreateBrowserProject(get().job);
      if (!loaded.job) {
        const fallbackJobId = get().job.id;
        const persistedInventory = loadComponentInventory(fallbackJobId);
        let inventoryPersistenceError: string | null = null;
        if (persistedInventory.ok) {
          set({ componentInventory: persistedInventory.inventory });
        } else if (persistedInventory.reason !== "not-found") {
          inventoryPersistenceError = `Saved component inventory could not be restored (${persistedInventory.reason}). Unreadable data preserved in storage; autosave blocked until recovery.`;
        }
        set({
          inventoryPersistenceError,
          inventoryRecoveryBlocked: inventoryPersistenceError !== null,
          persistenceError: loaded.error,
          persistenceRecoveryBlocked: true,
          persistenceHydrated: true,
          hydrationStatus: loaded.error ? "error" : "ready",
          assetReadiness: EMPTY_RUNTIME_ASSET_READINESS,
          // A failed reload is a load problem, not a stale-writer condition: show the preservation notice.
          projectWriteStale: false,
        });
        return;
      }

      const job = loaded.job;
      const persistedBom = loadBomState(job.id);
      let bomState = persistedBom.ok ? persistedBom.state : createBomState(job.id);
      let bomPersistenceError =
        !persistedBom.ok && persistedBom.reason !== "not-found"
          ? `Saved BOM state could not be restored (${persistedBom.reason}).`
          : null;
      if (bomState.pending) {
        const interrupted = failBomStateBuild(bomState, {
          expectedRequestId: bomState.pending.requestId,
          expectedJobRevision: bomState.pending.expectedJobRevision,
          failedAt: nowIso(),
          message: "BOM generation was interrupted before reload.",
        });
        bomState = interrupted.state;
      }
      bomState = reconcileBomStateForJob(bomState, job);
      const restoredSheet = Math.max(
        0,
        Math.min(
          job.activeSheet ?? 0,
          (job.documents.find((item) => item.id === job.activeDocumentId)?.pageCount ?? 1) - 1,
        ),
      );
      const loadedCalibration = activeCalibration(job, restoredSheet);
      let traceError: string | null = null;
      try {
        traceStateFromJob(job);
      } catch (error) {
        traceError = error instanceof Error ? error.message : String(error);
      }

      const assetReadiness: RuntimeAssetReadiness = {
        document: { state: "idle", message: null },
        photos: Object.fromEntries(
          job.photos.map((photo) => [photo.id, { state: "loading" as const, message: null }]),
        ),
      };
      const persistedInventory = loadComponentInventory(job.id);
      let componentInventory: ComponentInventory;
      let inventoryPersistenceError: string | null = null;
      if (persistedInventory.ok) {
        componentInventory = persistedInventory.inventory;
      } else {
        componentInventory = createSampleStructuralInventory();
        if (persistedInventory.reason !== "not-found") {
          inventoryPersistenceError = `Saved component inventory could not be restored (${persistedInventory.reason}). Unreadable data preserved in storage; autosave blocked until recovery.`;
        }
      }

      set({
        job,
        bomState,
        bomPersistenceError,
        componentInventory,
        inventoryPersistenceError,
        inventoryRecoveryBlocked: inventoryPersistenceError !== null,
        markups: markupsFromJob(job),
        trades: job.componentRegistry ?? [],
        currentCalibration: loadedCalibration,
        scaleM: scaleForCalibration(loadedCalibration),
        sheet: restoredSheet,
        calibrationCapture: null,
        calibrationError: null,
        selectedRunId: null,
        selectedVertexIndex: null,
        selectedGateId: null,
        traceError,
        traceUndoStack: [],
        traceRedoStack: [],
        photoPreviewUrls: {},
        photoError: null,
        activePlanBinary: null,
        documentError: null,
        planName:
          job.documents.find((document) => document.id === job.activeDocumentId)?.name ?? null,
        persistenceError: null,
        assetReadiness,
      });

      const photoPreviewUrls: Record<string, string> = {};
      const photoMessages: string[] = [];
      if (job.photos.length > 0) {
        try {
          const contents = await createBrowserPhotoStore().list();
          const byId = new Map(contents.map((content) => [content.id, content]));
          for (const photo of job.photos) {
            const result = await verifyPhotoContent(byId.get(photo.id) ?? null, photo);
            if (result.status === "ready") {
              photoPreviewUrls[photo.id] = photoContentObjectUrl(result.content);
              assetReadiness.photos[photo.id] = { state: "ready", message: null };
            } else {
              assetReadiness.photos[photo.id] = { state: result.status, message: result.message };
              photoMessages.push(result.message);
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          photoMessages.push(message);
          for (const photo of job.photos) {
            if (assetReadiness.photos[photo.id]?.state === "loading") {
              assetReadiness.photos[photo.id] = { state: "unverified", message };
            }
          }
        }
      }

      let activePlanBinary: PlanBinary | null = null;
      let documentError: string | null = null;
      const activeDocument = job.documents.find((document) => document.id === job.activeDocumentId);
      if (!activeDocument || activeDocument.source === "sample") {
        assetReadiness.document = {
          state: "unverified",
          message: "Import a source document before final review.",
        };
      } else {
        try {
          activePlanBinary = await verifyStoredPlanContent(
            await createBrowserPlanStore().get(activeDocument.id),
            activeDocument,
          );
          assetReadiness.document = { state: "ready", message: null };
        } catch (error) {
          documentError = error instanceof Error ? error.message : String(error);
          assetReadiness.document = {
            state: /missing/i.test(documentError) ? "missing" : "corrupt",
            message: documentError,
          };
        }
      }

      set({
        photoPreviewUrls,
        photoError: photoMessages.length > 0 ? photoMessages.join(" ") : null,
        activePlanBinary,
        documentError,
        assetReadiness,
        persistenceHydrated: true,
        hydrationStatus: "ready",
        persistenceRecoveryBlocked: false,
        lastSavedJobRevision: job.revision,
        lastSavedJobRaw: loaded.raw,
        projectWriteStale: false,
      });
    })()
      .catch((error) => {
        set({
          persistenceError: error instanceof Error ? error.message : String(error),
          persistenceHydrated: true,
          hydrationStatus: "error",
          persistenceRecoveryBlocked: true,
          projectWriteStale: false,
        });
      })
      .finally(() => {
        hydrationFlight = null;
      });
    return hydrationFlight;
  },
})));
export const useStudio = studioInstance.value;

/** Test-only reset for the module-level hydration flight. */
export function resetStudioHydrationForTests() {
  hydrationFlight = null;
}

if (studioInstance.created) {
useStudio.subscribe((state, previous) => {
  if (
    state.job === previous.job &&
    state.assetReadiness === previous.assetReadiness &&
    state.persistenceHydrated === previous.persistenceHydrated
  )
    return;
  useStudio.setState({
    quoteReadiness: readiness(state.job, state.assetReadiness, state.persistenceHydrated),
  });
});

useStudio.subscribe((state, previous) => {
  if (state.job === previous.job) return;
  const next = reconcileBomStateForJob(state.bomState, state.job);
  if (next !== state.bomState) useStudio.setState({ bomState: next });
});

if (typeof window !== "undefined") {
  useStudio.subscribe((state, previous) => {
    if (state.job === previous.job || !state.persistenceHydrated || state.persistenceRecoveryBlocked) return;
    state.saveCurrentProject();
  });
  // Cross-window detection: 'storage' fires only in other windows, so same-window writes rely on the
  // compare-and-swap inside saveCurrentProject instead.
  if (typeof window.addEventListener === "function") {
    window.addEventListener("storage", (event: StorageEvent) => {
      if (event.key !== FENCING_JOB_STORAGE_KEY) return;
      if (event.storageArea && event.storageArea !== window.localStorage) return;
      useStudio.getState().noteExternalProjectWrite(event.newValue);
    });
  }
  useStudio.subscribe((state, previous) => {
    if (!state.persistenceHydrated || state.persistenceRecoveryBlocked) return;
    if (state.bomState === previous.bomState && previous.persistenceHydrated) return;
    const result = saveBomState(state.bomState);
    const error = result.ok
      ? null
      : `BOM state could not be saved (${result.reason}${result.preservedPrevious ? "; previous snapshot preserved" : ""}).`;
    if (state.bomPersistenceError !== error) useStudio.setState({ bomPersistenceError: error });
  });
  useStudio.subscribe((state, previous) => {
    if (!state.persistenceHydrated || state.persistenceRecoveryBlocked) return;
    if (state.inventoryRecoveryBlocked) return;
    if (state.componentInventory === previous.componentInventory && previous.persistenceHydrated) return;
    state.saveCurrentInventory();
  });
}

}

function reconcileBomStateForJob(state: BomStateEnvelope, job: FencingJob): BomStateEnvelope {
  if (state.jobId !== job.id) return createBomState(job.id);
  const reference = state.pending?.binding ?? state.snapshot?.binding;
  if (!reference) return state;
  const activeDocument = job.documents.find((document) => document.id === job.activeDocumentId);
  return reconcileBomBinding(
    state,
    {
      ...reference,
      jobRevision: job.revision,
      documentSha256: activeDocument?.sha256 ?? reference.documentSha256,
    },
    nowIso(),
  );
}
