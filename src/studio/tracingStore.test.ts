import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createTwoPointCalibrationCandidate, createUnverifiedCalibration, lockCalibration } from "./calibration.ts";
import { createDefaultJob, type FencingJob } from "./domain.ts";
import { TRACE_HISTORY_LIMIT, useStudio } from "./store.ts";

function lockedCalibration() {
  const base = createUnverifiedCalibration(0);
  const candidate = createTwoPointCalibrationCandidate({
    id: "manual-0",
    source: "manual",
    points: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
    distance: { value: 10, unit: "m" },
    transform: base.transform,
    confidence: 1,
    provenance: { method: "two-point", evidence: "Verified site dimension", documentId: "doc-trace" },
  });
  // These points are intrinsic source-page units, with ten units calibrated to ten metres.
  return lockCalibration({ ...base, coordinateSpace: "source-page-v1", candidates: [candidate] });
}

function traceJob(): FencingJob {
  const job = createDefaultJob("2026-09-04T00:00:00.000Z");
  job.documents[0] = { ...job.documents[0], id: "doc-trace", source: "web" };
  job.activeDocumentId = "doc-trace";
  job.calibrations = [lockedCalibration()];
  return job;
}

function resetStore() {
  const job = traceJob();
  useStudio.setState({
    job,
    sheet: 0,
    currentCalibration: job.calibrations[0],
    scaleM: 1,
    tool: "none",
    pending: [],
    markups: [],
    selectedRunId: null,
    selectedVertexIndex: null,
    selectedGateId: null,
    traceError: null,
    traceUndoStack: [],
    traceRedoStack: [],
    calibrationCapture: null,
    calibrationError: null,
  });
}

function createPolyline() {
  useStudio.getState().setTool("length");
  useStudio.getState().addPoint({ x: 0, y: 0 });
  useStudio.getState().addPoint({ x: 3, y: 0 });
  useStudio.getState().addPoint({ x: 3, y: 4 });
  useStudio.getState().commitPending();
  return useStudio.getState().job.runs[0];
}

describe("studio editable tracing store", () => {
  beforeEach(resetStore);

  for (const operation of ["move", "remove", "undo", "redo"] as const) {
    it(`preserves legacy target-page geometry during cross-page ${operation}`, () => {
      const run = createPolyline();
      if (operation === "undo" || operation === "redo") {
        useStudio.getState().moveRunVertex(run.id, 2, { x: 3, y: 5 });
        if (operation === "redo") useStudio.getState().undoTrace();
      }
      const job = structuredClone(useStudio.getState().job);
      delete job.calibrations[0].coordinateSpace;
      job.documents[0].pageCount = 2;
      const current = { ...lockedCalibration(), sheet: 1 };
      job.calibrations.push(current);
      useStudio.setState({ job, sheet: 1, currentCalibration: current });
      const before = JSON.stringify(job);
      if (operation === "move") useStudio.getState().moveRunVertex(run.id, 1, { x: 4, y: 0 });
      if (operation === "remove") useStudio.getState().removeRun(run.id);
      if (operation === "undo") useStudio.getState().undoTrace();
      if (operation === "redo") useStudio.getState().redoTrace();
      assert.equal(JSON.stringify(useStudio.getState().job), before, "the target legacy sheet must remain byte-identical");
      assert.match(useStudio.getState().traceError ?? "", /legacy|source.page/i);
    });
  }
  it("permits a current-source target while preserving unrelated legacy page evidence", () => {
    const old = createPolyline();
    const job = structuredClone(useStudio.getState().job);
    delete job.calibrations[0].coordinateSpace;
    job.documents[0].pageCount = 2;
    const current = { ...lockedCalibration(), sheet: 1 };
    job.calibrations.push(current);
    job.runs.push({ ...structuredClone(old), id: "current-page-run", sheet: 1 });
    useStudio.setState({job, sheet: 0, currentCalibration:job.calibrations[0]});
    const preserved = JSON.stringify(job.runs[0]);
    useStudio.getState().moveRunVertex("current-page-run", 2, { x: 3, y: 6 });
    assert.equal(useStudio.getState().traceError, null);
    assert.equal(useStudio.getState().job.runs[1].lengthM, 9);
    assert.equal(JSON.stringify(useStudio.getState().job.runs[0]), preserved);
  });

  it("commits a multi-segment run only on explicit completion", () => {
    useStudio.getState().setTool("length");
    useStudio.getState().addPoint({ x: 0, y: 0 });
    useStudio.getState().addPoint({ x: 3, y: 0 });
    assert.equal(useStudio.getState().job.runs.length, 0, "two points remain pending until Enter or double-click");
    useStudio.getState().addPoint({ x: 3, y: 4 });
    assert.equal(useStudio.getState().pending.length, 3);

    useStudio.getState().commitPending();
    const run = useStudio.getState().job.runs[0];
    assert.equal(run.points.length, 3);
    assert.equal(run.grossLengthM, 7);
    assert.equal(run.netLengthM, 7);
    assert.equal(run.lengthM, 7);
    assert.equal(run.revision, 1);
    assert.equal(useStudio.getState().markups[0].value, 7);
    assert.equal(useStudio.getState().selectedRunId, run.id);
    assert.equal(useStudio.getState().traceUndoStack.at(-1)?.command.type, "create-run");
  });

  it("moves, inserts and removes selected vertices through revision-safe commands", () => {
    const run = createPolyline();
    useStudio.getState().moveRunVertex(run.id, 2, { x: 3, y: 5 });
    assert.equal(useStudio.getState().job.runs[0].revision, 2);
    assert.equal(useStudio.getState().job.runs[0].grossLengthM, 8);
    assert.equal(useStudio.getState().selectedVertexIndex, 2);

    useStudio.getState().insertRunVertex(run.id, 0, { x: 1, y: 0 });
    assert.equal(useStudio.getState().job.runs[0].points.length, 4);
    assert.equal(useStudio.getState().job.runs[0].revision, 3);
    assert.equal(useStudio.getState().selectedVertexIndex, 1);

    useStudio.getState().removeRunVertex(run.id, 1);
    assert.equal(useStudio.getState().job.runs[0].points.length, 3);
    assert.equal(useStudio.getState().job.runs[0].revision, 4);
    assert.equal(useStudio.getState().markups[0].points.length, 3);

    const historyBefore = useStudio.getState().traceUndoStack.length;
    useStudio.getState().executeTraceCommand({
      type: "move-vertex", runId: run.id, expectedRevision: 1, vertexIndex: 1, point: { x: 2, y: 0 },
    });
    assert.match(useStudio.getState().traceError ?? "", /stale/i);
    assert.equal(useStudio.getState().traceUndoStack.length, historyBefore);
    assert.equal(useStudio.getState().job.runs[0].revision, 4);
  });

  it("projects gate edits, deducts width, and restores them with undo and redo", () => {
    const run = createPolyline();
    useStudio.getState().upsertGate({ runId: run.id, point: { x: 4, y: 2 }, widthM: 2 });
    const gate = useStudio.getState().job.gates[0];
    assert.deepEqual(gate.point, { x: 3, y: 2 });
    assert.equal(gate.segmentIndex, 1);
    assert.equal(gate.segmentT, 0.5);
    assert.equal(gate.widthM, 2);
    assert.equal(useStudio.getState().job.runs[0].grossLengthM, 7);
    assert.equal(useStudio.getState().job.runs[0].gateDeductionM, 2);
    assert.equal(useStudio.getState().job.runs[0].netLengthM, 5);
    assert.equal(useStudio.getState().markups.find((markup) => markup.id === run.id)?.value, 5);
    assert.equal(useStudio.getState().selectedGateId, gate.id);

    useStudio.getState().undoTrace();
    assert.equal(useStudio.getState().job.gates.length, 0);
    assert.equal(useStudio.getState().job.runs[0].netLengthM, 7);
    assert.equal(useStudio.getState().selectedGateId, null);
    useStudio.getState().redoTrace();
    assert.equal(useStudio.getState().job.gates[0].id, gate.id);
    assert.equal(useStudio.getState().job.runs[0].netLengthM, 5);

    useStudio.getState().upsertGate({ id: gate.id, runId: run.id, point: { x: 3, y: 3 }, widthM: 1 });
    assert.equal(useStudio.getState().job.gates[0].revision, 2);
    assert.equal(useStudio.getState().job.runs[0].netLengthM, 6);
    useStudio.getState().removeGate(gate.id);
    assert.equal(useStudio.getState().job.gates.length, 0);
    assert.equal(useStudio.getState().job.runs[0].netLengthM, 7);
  });

  it("splits and merges explicit endpoints while repairing selection", () => {
    const original = createPolyline();
    useStudio.getState().splitRun(original.id, 1);
    const splitIds = useStudio.getState().job.runs.map((run) => run.id);
    assert.equal(splitIds.length, 2);
    assert.ok(!splitIds.includes(original.id));
    assert.equal(useStudio.getState().selectedRunId, splitIds[0]);

    useStudio.getState().mergeRuns({
      firstRunId: splitIds[0],
      firstEndpoint: "end",
      secondRunId: splitIds[1],
      secondEndpoint: "start",
      mergedRunId: "run-merged",
      label: "Merged boundary",
    });
    assert.equal(useStudio.getState().job.runs.length, 1);
    assert.equal(useStudio.getState().job.runs[0].id, "run-merged");
    assert.equal(useStudio.getState().job.runs[0].points.length, 3);
    assert.equal(useStudio.getState().selectedRunId, "run-merged");

    useStudio.getState().undoTrace();
    assert.equal(useStudio.getState().job.runs.length, 2);
    assert.equal(useStudio.getState().selectedRunId, null, "removed merged selection is repaired");
    useStudio.getState().redoTrace();
    assert.equal(useStudio.getState().job.runs[0].id, "run-merged");
  });

  it("removes a run and its gates atomically, then restores both", () => {
    const run = createPolyline();
    useStudio.getState().upsertGate({ runId: run.id, point: { x: 2, y: 1 }, widthM: 1.2 });
    const revision = useStudio.getState().job.runs[0].revision!;
    useStudio.getState().removeRun(run.id, revision);
    assert.equal(useStudio.getState().job.runs.length, 0);
    assert.equal(useStudio.getState().job.gates.length, 0);
    assert.equal(useStudio.getState().selectedRunId, null);
    assert.equal(useStudio.getState().selectedGateId, null);

    useStudio.getState().undoTrace();
    assert.equal(useStudio.getState().job.runs.length, 1);
    assert.equal(useStudio.getState().job.gates.length, 1);
    assert.equal(useStudio.getState().job.runs[0].netLengthM, 5.8);
  });

  it("bounds command history, clears redo on a branch, and blocks stale calibration", () => {
    const run = createPolyline();
    for (let index = 0; index < TRACE_HISTORY_LIMIT + 5; index += 1) {
      const x = index % 2 === 0 ? 3.5 : 3;
      useStudio.getState().moveRunVertex(run.id, 1, { x, y: 0 });
    }
    assert.equal(useStudio.getState().traceUndoStack.length, TRACE_HISTORY_LIMIT);

    useStudio.getState().undoTrace();
    assert.equal(useStudio.getState().traceRedoStack.length, 1);
    useStudio.getState().moveRunVertex(run.id, 1, { x: 4, y: 0 });
    assert.equal(useStudio.getState().traceRedoStack.length, 0);

    useStudio.getState().unlockCurrentCalibration();
    assert.equal(useStudio.getState().currentCalibration.locked, true);
    assert.match(useStudio.getState().calibrationError ?? "", /remove measurements/i);
    assert.equal(useStudio.getState().job.runs[0].grossLengthM, useStudio.getState().markups[0].value);
  });
});
