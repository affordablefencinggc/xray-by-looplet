import type { Calibration, CalibrationPoint } from "./calibration.ts";
import { canvasPointToDocument, documentPointToCanvas, getCalibrationForSheet, measureCanvasDistanceM } from "./calibration.ts";
import type { FenceRun, GateRecord, ReviewDecision, RunSpecification } from "./domain.ts";

const GEOMETRY_EPSILON_M = 1e-9;
const TOPOLOGY_EPSILON_M = 1e-6;

export type EditableFenceRun = FenceRun & {
  revision: number;
  grossLengthM: number;
  gateDeductionM: number;
  netLengthM: number;
};

export type PlacedGate = GateRecord & {
  revision: number;
  segmentIndex: number | null;
  segmentT: number | null;
};

export type TraceState = { runs: EditableFenceRun[]; gates: PlacedGate[] };

export type TraceCommand =
  | { type: "move-vertex"; runId: string; expectedRevision: number; vertexIndex: number; point: CalibrationPoint }
  | { type: "insert-vertex"; runId: string; expectedRevision: number; segmentIndex: number; point: CalibrationPoint }
  | { type: "remove-vertex"; runId: string; expectedRevision: number; vertexIndex: number }
  | { type: "split-run"; runId: string; expectedRevision: number; vertexIndex: number; newRunIds: [string, string]; labels?: [string, string] }
  | { type: "merge-runs"; firstRunId: string; firstExpectedRevision: number; firstEndpoint: "start" | "end"; secondRunId: string; secondExpectedRevision: number; secondEndpoint: "start" | "end"; mergedRunId: string; label?: string }
  | { type: "place-gate"; gate: GateRecord; runId: string; expectedRevision: number | null }
  | { type: "remove-gate"; gateId: string };

export type TraceCommandResult = {
  command: TraceCommand;
  previous: TraceState;
  next: TraceState;
  affectedRunIds: string[];
  affectedGateIds: string[];
};

export type RunLengthSummary = {
  grossLengthM: number;
  gateDeductionM: number;
  netLengthM: number;
};

export type TraceTopologyIssue = { code: string; message: string; entityId?: string };

export function calculatePolylineDistanceM(points: readonly CalibrationPoint[], calibration: Calibration): number {
  assertLockedCalibration(calibration);
  assertMinimumGeometry(points, calibration);
  let total = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    total += measureCanvasDistanceM(points[index], points[index + 1], calibration, calibration.sheet);
  }
  return total;
}

export function calculateRunLengths(
  run: Pick<FenceRun, "id" | "sheet" | "points">,
  gates: readonly GateRecord[],
  calibration: Calibration,
): RunLengthSummary {
  if (run.sheet !== calibration.sheet) throw new Error(`Run ${run.id} is not on calibration sheet ${calibration.sheet}.`);
  const grossLengthM = calculatePolylineDistanceM(run.points, calibration);
  const intervals = gates
    .filter((gate) => gate.runId === run.id && gate.widthM !== null)
    .map((gate) => {
      if (gate.sheet !== run.sheet) throw new Error(`Gate ${gate.id} and run ${run.id} must share a sheet.`);
      const placement = projectPointToRun(gate.point, run.points, calibration);
      const halfWidth = gate.widthM! / 2;
      return [Math.max(0, placement.positionM - halfWidth), Math.min(grossLengthM, placement.positionM + halfWidth)] as const;
    })
    .filter(([start, end]) => end > start)
    .sort((left, right) => left[0] - right[0] || left[1] - right[1]);

  let gateDeductionM = 0;
  let coveredEnd = -1;
  for (const [start, end] of intervals) {
    if (start > coveredEnd) {
      gateDeductionM += end - start;
      coveredEnd = end;
    } else if (end > coveredEnd) {
      gateDeductionM += end - coveredEnd;
      coveredEnd = end;
    }
  }
  gateDeductionM = Math.min(grossLengthM, Math.max(0, gateDeductionM));
  return { grossLengthM, gateDeductionM, netLengthM: Math.max(0, grossLengthM - gateDeductionM) };
}

export function createEditableRun(run: FenceRun, calibration: Calibration, gates: readonly GateRecord[] = []): EditableFenceRun {
  const lengths = calculateRunLengths(run, gates, calibration);
  return {
    ...run,
    revision: run.revision ?? 1,
    ...lengths,
    lengthM: lengths.netLengthM,
  };
}

/** Upgrades persisted v1 runs/gates into the fully measured editable trace state. */
export function migrateTraceState(
  runs: readonly FenceRun[],
  gates: readonly GateRecord[],
  calibrations: readonly Calibration[],
): TraceState {
  const placedGates: PlacedGate[] = gates.map((gate) => {
    if (!gate.runId) return { ...gate, revision: gate.revision ?? 1, segmentIndex: null, segmentT: null };
    const run = runs.find((entry) => entry.id === gate.runId);
    if (!run) throw new Error(`Gate ${gate.id} references missing run ${gate.runId}.`);
    return placeGateOnRun({ ...gate, revision: gate.revision ?? 1 }, run, requireCalibration(calibrations, run.sheet));
  });
  const editableRuns = runs.map((run) => createEditableRun(
    { ...run, revision: run.revision ?? 1 },
    requireCalibration(calibrations, run.sheet),
    placedGates,
  ));
  const state = { runs: editableRuns, gates: placedGates };
  const issues = validateTraceTopology(state, calibrations);
  if (issues.length > 0) throw new Error(issues.map((issue) => issue.message).join(" "));
  return state;
}

export function placeGateOnRun(gate: GateRecord, run: FenceRun, calibration: Calibration): PlacedGate {
  assertLockedCalibration(calibration);
  if (gate.sheet !== run.sheet || calibration.sheet !== run.sheet) {
    throw new Error(`Gate ${gate.id}, run ${run.id}, and calibration must share a sheet.`);
  }
  const placement = projectPointToRun(gate.point, run.points, calibration);
  return {
    ...gate,
    revision: gate.revision ?? 1,
    runId: run.id,
    point: placement.point,
    segmentIndex: placement.segmentIndex,
    segmentT: placement.segmentT,
  };
}

export function applyTraceCommand(
  state: TraceState,
  command: TraceCommand,
  calibrations: readonly Calibration[],
): TraceCommandResult {
  const previous = state;
  let next: TraceState;
  let affectedRunIds: string[] = [];
  let affectedGateIds: string[] = [];

  switch (command.type) {
    case "move-vertex":
    case "insert-vertex":
    case "remove-vertex": {
      const run = requireRun(state, command.runId, command.expectedRevision);
      const calibration = requireCalibration(calibrations, run.sheet);
      const points = [...run.points];
      if (command.type === "move-vertex") {
        assertVertexIndex(run, command.vertexIndex);
        points[command.vertexIndex] = command.point;
      } else if (command.type === "insert-vertex") {
        if (command.segmentIndex < 0 || command.segmentIndex >= points.length - 1) throw new Error("Insert segment is outside the run.");
        points.splice(command.segmentIndex + 1, 0, command.point);
      } else {
        assertVertexIndex(run, command.vertexIndex);
        if (points.length <= 2) throw new Error("A fence run must retain at least two vertices.");
        points.splice(command.vertexIndex, 1);
      }
      assertMinimumGeometry(points, calibration);
      const specification = command.type === "insert-vertex"
        ? repairSpecificationForInsert(run.specification, command.segmentIndex + 1)
        : command.type === "remove-vertex"
          ? repairSpecificationForRemove(run.specification, command.vertexIndex)
          : run.specification;
      const provisional = { ...run, points, specification, revision: run.revision + 1, review: invalidateReview(run.review) };
      const changedGates = reprojectAssociatedGates(state.gates, provisional, calibration);
      const changedRun = createEditableRun(provisional, calibration, changedGates);
      next = {
        runs: replaceById(state.runs, changedRun),
        gates: mergeGateUpdates(state.gates, changedGates),
      };
      affectedRunIds = [run.id];
      affectedGateIds = changedGates.map((gate) => gate.id);
      break;
    }
    case "split-run": {
      const run = requireRun(state, command.runId, command.expectedRevision);
      if (command.vertexIndex <= 0 || command.vertexIndex >= run.points.length - 1) throw new Error("A run can only split at an internal vertex.");
      if (command.newRunIds[0] === command.newRunIds[1]) throw new Error("Split run IDs must be distinct.");
      assertAvailableRunIds(state.runs.filter((entry) => entry.id !== run.id), command.newRunIds);
      const calibration = requireCalibration(calibrations, run.sheet);
      const leftBase: FenceRun = {
        ...run, id: command.newRunIds[0], revision: 1,
        label: command.labels?.[0] ?? `${run.label} A`, points: run.points.slice(0, command.vertexIndex + 1),
        specification: splitSpecification(run.specification, command.vertexIndex, "left"),
        review: invalidateReview(run.review),
      };
      const rightBase: FenceRun = {
        ...run, id: command.newRunIds[1], revision: 1,
        label: command.labels?.[1] ?? `${run.label} B`, points: run.points.slice(command.vertexIndex),
        specification: splitSpecification(run.specification, command.vertexIndex, "right"),
        review: invalidateReview(run.review),
      };
      const associated = state.gates.filter((gate) => gate.runId === run.id);
      const reassigned = associated.map((gate) => {
        const leftProjection = projectPointToRun(gate.point, leftBase.points, calibration);
        const rightProjection = projectPointToRun(gate.point, rightBase.points, calibration);
        const target = leftProjection.distanceM <= rightProjection.distanceM ? leftBase : rightBase;
        return { ...placeGateOnRun(gate, target, calibration), revision: gate.revision + 1 };
      });
      const left = createEditableRun(leftBase, calibration, reassigned);
      const right = createEditableRun(rightBase, calibration, reassigned);
      next = {
        runs: [...state.runs.filter((entry) => entry.id !== run.id), left, right],
        gates: mergeGateUpdates(state.gates, reassigned),
      };
      affectedRunIds = [run.id, left.id, right.id];
      affectedGateIds = reassigned.map((gate) => gate.id);
      break;
    }
    case "merge-runs": {
      if (command.firstRunId === command.secondRunId) throw new Error("A run cannot merge with itself.");
      const first = requireRun(state, command.firstRunId, command.firstExpectedRevision);
      const second = requireRun(state, command.secondRunId, command.secondExpectedRevision);
      if (first.sheet !== second.sheet) throw new Error("Merged runs must be on the same sheet.");
      if (JSON.stringify(specificationWithoutVertexAnnotations(first.specification))
        !== JSON.stringify(specificationWithoutVertexAnnotations(second.specification))) {
        throw new Error("Merged runs must have compatible specifications.");
      }
      assertAvailableRunIds(state.runs.filter((entry) => entry.id !== first.id && entry.id !== second.id), [command.mergedRunId]);
      const calibration = requireCalibration(calibrations, first.sheet);
      const firstPoints = command.firstEndpoint === "end" ? [...first.points] : [...first.points].reverse();
      const secondPoints = command.secondEndpoint === "start" ? [...second.points] : [...second.points].reverse();
      if (measureCanvasDistanceM(firstPoints.at(-1)!, secondPoints[0], calibration, first.sheet) > TOPOLOGY_EPSILON_M) {
        throw new Error("Selected run endpoints do not meet.");
      }
      const mergedBase: FenceRun = {
        ...first,
        id: command.mergedRunId,
        revision: Math.max(first.revision, second.revision) + 1,
        label: command.label ?? first.label,
        points: [...firstPoints, ...secondPoints.slice(1)],
        specification: mergeSpecifications(
          first.specification,
          first.points.length,
          command.firstEndpoint === "start",
          second.specification,
          second.points.length,
          command.secondEndpoint === "end",
        ),
        photoIds: [...new Set([...first.photoIds, ...second.photoIds])],
        review: invalidateReview(first.review),
      };
      const associated = state.gates
        .filter((gate) => gate.runId === first.id || gate.runId === second.id)
        .map((gate) => ({ ...placeGateOnRun(gate, mergedBase, calibration), revision: gate.revision + 1 }));
      const merged = createEditableRun(mergedBase, calibration, associated);
      next = {
        runs: [...state.runs.filter((entry) => entry.id !== first.id && entry.id !== second.id), merged],
        gates: mergeGateUpdates(state.gates, associated),
      };
      affectedRunIds = [first.id, second.id, merged.id];
      affectedGateIds = associated.map((gate) => gate.id);
      break;
    }
    case "place-gate": {
      const run = state.runs.find((entry) => entry.id === command.runId);
      if (!run) throw new Error(`Unknown fence run: ${command.runId}`);
      const calibration = requireCalibration(calibrations, run.sheet);
      const existing = state.gates.find((entry) => entry.id === command.gate.id);
      if (command.expectedRevision === null && existing) throw new Error(`Gate ID already exists: ${command.gate.id}`);
      if (command.expectedRevision !== null && !existing) throw new Error(`Unknown gate for update: ${command.gate.id}`);
      if (existing && command.expectedRevision !== existing.revision) {
        throw new Error(`Stale gate revision for ${existing.id}: expected ${command.expectedRevision}, current ${existing.revision}.`);
      }
      const placed = placeGateOnRun({ ...command.gate, revision: existing ? existing.revision + 1 : 1 }, run, calibration);
      const gates = existing ? replaceById(state.gates, placed) : [...state.gates, placed];
      const impactedRunIds = new Set([run.id, ...(existing?.runId && existing.runId !== run.id ? [existing.runId] : [])]);
      const runs = state.runs.map((entry) => {
        if (!impactedRunIds.has(entry.id)) return entry;
        const entryCalibration = requireCalibration(calibrations, entry.sheet);
        return createEditableRun({ ...entry, revision: entry.revision + 1, review: invalidateReview(entry.review) }, entryCalibration, gates);
      });
      next = { runs, gates };
      affectedRunIds = [...impactedRunIds];
      affectedGateIds = [placed.id];
      break;
    }
    case "remove-gate": {
      const gate = state.gates.find((entry) => entry.id === command.gateId);
      if (!gate) throw new Error(`Unknown gate: ${command.gateId}`);
      const gates = state.gates.filter((entry) => entry.id !== gate.id);
      if (!gate.runId) {
        next = { ...state, gates };
      } else {
        const run = state.runs.find((entry) => entry.id === gate.runId);
        if (!run) throw new Error(`Gate ${gate.id} references missing run ${gate.runId}.`);
        const calibration = requireCalibration(calibrations, run.sheet);
        const changedRun = createEditableRun({ ...run, revision: run.revision + 1, review: invalidateReview(run.review) }, calibration, gates);
        next = { runs: replaceById(state.runs, changedRun), gates };
        affectedRunIds = [run.id];
      }
      affectedGateIds = [gate.id];
      break;
    }
  }

  const issues = validateTraceTopology(next, calibrations);
  if (issues.length > 0) throw new Error(issues.map((issue) => issue.message).join(" "));
  return { command, previous, next, affectedRunIds, affectedGateIds };
}

export function validateTraceTopology(state: TraceState, calibrations: readonly Calibration[]): TraceTopologyIssue[] {
  const issues: TraceTopologyIssue[] = [];
  const duplicateRuns = duplicates(state.runs.map((run) => run.id));
  const duplicateGates = duplicates(state.gates.map((gate) => gate.id));
  for (const id of duplicateRuns) issues.push({ code: "duplicate-run", message: `Duplicate fence run ID: ${id}.`, entityId: id });
  for (const id of duplicateGates) issues.push({ code: "duplicate-gate", message: `Duplicate gate ID: ${id}.`, entityId: id });
  for (const run of state.runs) {
    const calibration = getCalibrationForSheet(calibrations, run.sheet);
    if (!calibration?.locked) {
      issues.push({ code: "calibration", message: `Run ${run.id} requires a locked calibration for sheet ${run.sheet}.`, entityId: run.id });
      continue;
    }
    try {
      assertMinimumGeometry(run.points, calibration);
      const lengths = calculateRunLengths(run, state.gates, calibration);
      if (!nearlyEqual(run.grossLengthM, lengths.grossLengthM)
        || !nearlyEqual(run.gateDeductionM, lengths.gateDeductionM)
        || !nearlyEqual(run.netLengthM, lengths.netLengthM)
        || !nearlyEqual(run.lengthM, lengths.netLengthM)) {
        issues.push({ code: "length", message: `Run ${run.id} has stale or inconsistent lengths.`, entityId: run.id });
      }
    } catch (error) {
      issues.push({ code: "geometry", message: error instanceof Error ? error.message : String(error), entityId: run.id });
    }
  }
  for (const gate of state.gates) {
    if (!gate.runId) continue;
    const run = state.runs.find((entry) => entry.id === gate.runId);
    if (!run) {
      issues.push({ code: "gate-run", message: `Gate ${gate.id} references missing run ${gate.runId}.`, entityId: gate.id });
      continue;
    }
    if (run.sheet !== gate.sheet) issues.push({ code: "gate-sheet", message: `Gate ${gate.id} and run ${run.id} must share a sheet.`, entityId: gate.id });
    if (gate.segmentIndex === null || gate.segmentT === null || gate.segmentIndex >= run.points.length - 1) {
      issues.push({ code: "gate-placement", message: `Gate ${gate.id} does not have a valid run placement.`, entityId: gate.id });
      continue;
    }
    const expected = interpolate(run.points[gate.segmentIndex], run.points[gate.segmentIndex + 1], gate.segmentT);
    const calibration = getCalibrationForSheet(calibrations, run.sheet);
    if (calibration?.locked && measureCanvasDistanceM(expected, gate.point, calibration, run.sheet) > TOPOLOGY_EPSILON_M) {
      issues.push({ code: "gate-placement", message: `Gate ${gate.id} is not on its declared segment.`, entityId: gate.id });
    }
  }
  return issues;
}

function requireCalibration(calibrations: readonly Calibration[], sheet: number): Calibration {
  const calibration = getCalibrationForSheet(calibrations, sheet);
  if (!calibration?.locked) throw new Error(`Sheet ${sheet} requires a locked calibration.`);
  return calibration;
}

function requireRun(state: TraceState, id: string, revision: number): EditableFenceRun {
  const run = state.runs.find((entry) => entry.id === id);
  if (!run) throw new Error(`Unknown fence run: ${id}`);
  if (run.revision !== revision) throw new Error(`Stale fence run revision for ${id}: expected ${revision}, current ${run.revision}.`);
  return run;
}

function assertLockedCalibration(calibration: Calibration) {
  if (!calibration.locked || calibration.source === "unverified") throw new Error(`Sheet ${calibration.sheet} requires a locked calibration.`);
}

function assertMinimumGeometry(points: readonly CalibrationPoint[], calibration: Calibration) {
  if (points.length < 2) throw new Error("A fence run requires at least two vertices.");
  for (let index = 0; index < points.length - 1; index += 1) {
    if (measureCanvasDistanceM(points[index], points[index + 1], calibration, calibration.sheet) <= GEOMETRY_EPSILON_M) {
      throw new Error(`Fence run segment ${index} has zero length.`);
    }
  }
}

function assertVertexIndex(run: FenceRun, index: number) {
  if (!Number.isInteger(index) || index < 0 || index >= run.points.length) throw new Error("Vertex index is outside the run.");
}

function assertAvailableRunIds(existing: readonly FenceRun[], ids: readonly string[]) {
  if (ids.some((id) => !id)) throw new Error("Fence run IDs cannot be empty.");
  const occupied = new Set(existing.map((run) => run.id));
  for (const id of ids) if (occupied.has(id)) throw new Error(`Fence run ID already exists: ${id}`);
}

function projectPointToRun(point: CalibrationPoint, points: readonly CalibrationPoint[], calibration: Calibration) {
  assertMinimumGeometry(points, calibration);
  const documentPoint = canvasPointToDocument(point, calibration.transform);
  let best: { point: CalibrationPoint; segmentIndex: number; segmentT: number; positionM: number; distanceM: number } | null = null;
  let cumulativeM = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = canvasPointToDocument(points[index], calibration.transform);
    const end = canvasPointToDocument(points[index + 1], calibration.transform);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const t = Math.max(0, Math.min(1, ((documentPoint.x - start.x) * dx + (documentPoint.y - start.y) * dy) / (dx * dx + dy * dy)));
    const projectedDocument = { x: start.x + t * dx, y: start.y + t * dy };
    const distanceM = Math.hypot(documentPoint.x - projectedDocument.x, documentPoint.y - projectedDocument.y) * calibration.metresPerUnit;
    const segmentLengthM = Math.hypot(dx, dy) * calibration.metresPerUnit;
    const candidate = {
      point: documentPointToCanvas(projectedDocument, calibration.transform),
      segmentIndex: index,
      segmentT: t,
      positionM: cumulativeM + segmentLengthM * t,
      distanceM,
    };
    if (!best || candidate.distanceM < best.distanceM - GEOMETRY_EPSILON_M
      || (nearlyEqual(candidate.distanceM, best.distanceM) && candidate.segmentIndex < best.segmentIndex)) best = candidate;
    cumulativeM += segmentLengthM;
  }
  return best!;
}

function reprojectAssociatedGates(gates: readonly PlacedGate[], run: FenceRun, calibration: Calibration): PlacedGate[] {
  return gates.filter((gate) => gate.runId === run.id).map((gate) => ({
    ...placeGateOnRun(gate, run, calibration),
    revision: gate.revision + 1,
  }));
}

function repairSpecificationForInsert(specification: RunSpecification, insertedVertexIndex: number): RunSpecification {
  const shift = <T extends { vertexIndex: number }>(entry: T): T => ({
    ...entry,
    vertexIndex: entry.vertexIndex >= insertedVertexIndex ? entry.vertexIndex + 1 : entry.vertexIndex,
  });
  return {
    ...specification,
    corners: specification.corners.map(shift),
    postOverrides: specification.postOverrides.map(shift),
  };
}

function repairSpecificationForRemove(specification: RunSpecification, removedVertexIndex: number): RunSpecification {
  const repair = <T extends { vertexIndex: number }>(entries: readonly T[]): T[] => entries
    .filter((entry) => entry.vertexIndex !== removedVertexIndex)
    .map((entry) => ({
      ...entry,
      vertexIndex: entry.vertexIndex > removedVertexIndex ? entry.vertexIndex - 1 : entry.vertexIndex,
    }));
  return {
    ...specification,
    corners: repair(specification.corners),
    postOverrides: repair(specification.postOverrides),
  };
}

function splitSpecification(
  specification: RunSpecification,
  splitVertexIndex: number,
  side: "left" | "right",
): RunSpecification {
  const partition = <T extends { vertexIndex: number }>(entries: readonly T[]): T[] => entries
    .filter((entry) => side === "left" ? entry.vertexIndex <= splitVertexIndex : entry.vertexIndex >= splitVertexIndex)
    .map((entry) => ({
      ...entry,
      vertexIndex: side === "right" ? entry.vertexIndex - splitVertexIndex : entry.vertexIndex,
    }));
  return {
    ...specification,
    corners: partition(specification.corners),
    postOverrides: partition(specification.postOverrides),
  };
}

function specificationWithoutVertexAnnotations(specification: RunSpecification) {
  const { corners: _corners, postOverrides: _postOverrides, ...rest } = specification;
  return rest;
}

function mergeSpecifications(
  first: RunSpecification,
  firstPointCount: number,
  reverseFirst: boolean,
  second: RunSpecification,
  secondPointCount: number,
  reverseSecond: boolean,
): RunSpecification {
  const orient = <T extends { id: string; vertexIndex: number }>(
    entries: readonly T[],
    pointCount: number,
    reverse: boolean,
    offset: number,
  ): T[] => entries.map((entry) => ({
    ...entry,
    vertexIndex: (reverse ? pointCount - 1 - entry.vertexIndex : entry.vertexIndex) + offset,
  }));
  const combine = <T extends { id: string; vertexIndex: number }>(firstEntries: T[], secondEntries: T[]): T[] => {
    const ids = new Set(firstEntries.map((entry) => entry.id));
    const vertices = new Set(firstEntries.map((entry) => entry.vertexIndex));
    return [
      ...firstEntries,
      ...secondEntries.filter((entry) => !ids.has(entry.id) && !vertices.has(entry.vertexIndex)),
    ];
  };
  const offset = firstPointCount - 1;
  return {
    ...first,
    corners: combine(
      orient(first.corners, firstPointCount, reverseFirst, 0),
      orient(second.corners, secondPointCount, reverseSecond, offset),
    ),
    postOverrides: combine(
      orient(first.postOverrides, firstPointCount, reverseFirst, 0),
      orient(second.postOverrides, secondPointCount, reverseSecond, offset),
    ),
  };
}

function invalidateReview(review: ReviewDecision): ReviewDecision {
  return review.status === "draft" ? review : { status: "needs-review", decidedAt: null, decidedBy: "", note: "Geometry changed after review." };
}

function interpolate(first: CalibrationPoint, second: CalibrationPoint, t: number): CalibrationPoint {
  return { x: first.x + (second.x - first.x) * t, y: first.y + (second.y - first.y) * t };
}

function replaceById<T extends { id: string }>(items: readonly T[], replacement: T): T[] {
  return items.map((item) => item.id === replacement.id ? replacement : item);
}

function mergeGateUpdates(existing: readonly PlacedGate[], updates: readonly PlacedGate[]): PlacedGate[] {
  const byId = new Map(updates.map((gate) => [gate.id, gate]));
  return existing.map((gate) => byId.get(gate.id) ?? gate);
}

function duplicates(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const id of ids) (seen.has(id) ? repeated : seen).add(id);
  return [...repeated].sort();
}

function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= Math.max(1, Math.abs(left), Math.abs(right)) * 1e-9;
}
