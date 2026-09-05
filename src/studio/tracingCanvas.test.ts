import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { createDefaultJob } from "./domain.ts";
import { createUnverifiedCalibration } from "./calibration.ts";
import { useStudio } from "./store.ts";

const here = dirname(fileURLToPath(import.meta.url));
const cacheRoot = resolve("node_modules/.cache");
mkdirSync(cacheRoot, { recursive: true });
const compiledDir = mkdtempSync(join(cacheRoot, "tracing-canvas-test-"));
const compiledPath = join(compiledDir, "IsoCanvas.cjs");
const source = readFileSync(join(here, "IsoCanvas.tsx"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX,
    esModuleInterop: true,
  },
  fileName: "IsoCanvas.tsx",
}).outputText;
writeFileSync(compiledPath, compiled.replace(/require\("\.\/[^"\n]+"\)/g, "({})"));
const require = createRequire(import.meta.url);
const {
  canvasPointToDocumentPoint,
  documentPointToCanvasPoint,
  hitTestFenceRuns,
  hitTestRunVertices,
  resolveTracingCanvasPointerMode,
  vertexDragCommitPoint,
} = require(compiledPath) as typeof import("./IsoCanvas");

after(() => rmSync(compiledDir, { recursive: true, force: true }));

const viewport = {
  width: 1100,
  height: 720,
  zoom: 1.6,
  pan: { x: 34, y: -19 },
  kind: "plan" as const,
  floors: 1,
};

const runs = [
  {
    id: "run-a",
    points: [{ x: 1, y: 1 }, { x: 7, y: 1 }, { x: 7, y: 5 }],
  },
  {
    id: "run-b",
    points: [{ x: 12, y: 1 }, { x: 12, y: 6 }],
  },
];

describe("PlanCanvas run and vertex hit-testing", () => {
  it("selects the closest segment of a multi-segment run in screen pixels", () => {
    const onVerticalSegment = documentPointToCanvasPoint({ x: 7, y: 3 }, viewport);
    const hit = hitTestFenceRuns({ x: onVerticalSegment.x + 6, y: onVerticalSegment.y }, runs, viewport, 10);

    assert.ok(hit);
    assert.equal(hit.runId, "run-a");
    assert.equal(hit.segmentIndex, 1);
    assert.ok(hit.distancePx <= 10);
  });

  it("does not select paths beyond the screen-space tolerance", () => {
    const farFromRun = documentPointToCanvasPoint({ x: 3, y: 4 }, viewport);
    assert.equal(hitTestFenceRuns(farFromRun, runs, viewport, 8), null);
  });

  it("finds the nearest visible handle and keeps drag coordinates stable", () => {
    const vertexCanvasPoint = documentPointToCanvasPoint(runs[0].points[1], viewport);
    const hit = hitTestRunVertices(
      { x: vertexCanvasPoint.x + 3, y: vertexCanvasPoint.y - 2 },
      runs[0],
      viewport,
      8,
    );

    assert.deepEqual(hit && { runId: hit.runId, vertexIndex: hit.vertexIndex }, {
      runId: "run-a",
      vertexIndex: 1,
    });
    const draggedDocumentPoint = canvasPointToDocumentPoint(
      documentPointToCanvasPoint({ x: 8.25, y: 4.5 }, viewport),
      viewport,
    );
    assert.ok(Math.abs(draggedDocumentPoint.x - 8.25) < 1e-10);
    assert.ok(Math.abs(draggedDocumentPoint.y - 4.5) < 1e-10);
  });
});

describe("PlanCanvas editing interaction precedence", () => {
  const base = {
    calibrationCaptureActive: false,
    interactive: true,
    button: 0,
    shiftKey: false,
    toolActive: true,
    vertexHit: true,
    runHit: true,
    vertexEditingEnabled: true,
    runSelectionEnabled: true,
  };

  it("keeps calibration ahead of every editing action", () => {
    assert.equal(resolveTracingCanvasPointerMode({ ...base, calibrationCaptureActive: true }), "calibration");
  });

  it("reserves explicit middle/right/shift gestures for pan", () => {
    assert.equal(resolveTracingCanvasPointerMode({ ...base, button: 1 }), "pan");
    assert.equal(resolveTracingCanvasPointerMode({ ...base, button: 2 }), "pan");
    assert.equal(resolveTracingCanvasPointerMode({ ...base, shiftKey: true }), "pan");
  });

  it("places a gate on a hit run or vertex without stealing calibration or pan gestures", () => {
    const gate = { ...base, placementToolActive: true };
    assert.equal(resolveTracingCanvasPointerMode(gate), "trace");
    assert.equal(resolveTracingCanvasPointerMode({ ...gate, calibrationCaptureActive: true }), "calibration");
    assert.equal(resolveTracingCanvasPointerMode({ ...gate, button: 1 }), "pan");
    assert.equal(resolveTracingCanvasPointerMode({ ...gate, shiftKey: true }), "pan");
    assert.equal(resolveTracingCanvasPointerMode({ ...gate, interactive: false }), "pan");
  });

  it("keeps drawing ahead of existing geometry and moves only in explicit Move mode", () => {
    assert.equal(resolveTracingCanvasPointerMode(base), "trace");
    assert.equal(resolveTracingCanvasPointerMode({ ...base, editMode: "move" }), "trace");
    assert.equal(resolveTracingCanvasPointerMode({ ...base, toolActive: false, editMode: "move" }), "move-vertex");
    assert.equal(resolveTracingCanvasPointerMode({ ...base, toolActive: false, editMode: "select" }), "select-vertex");
    assert.equal(resolveTracingCanvasPointerMode({ ...base, toolActive: false, editMode: "insert" }), "select-vertex");
    assert.equal(resolveTracingCanvasPointerMode({ ...base, toolActive: false, vertexHit: false }), "select-run");
    assert.equal(resolveTracingCanvasPointerMode({ ...base, vertexHit: false, runHit: false }), "trace");
    assert.equal(resolveTracingCanvasPointerMode({
      ...base,
      vertexHit: false,
      runHit: false,
      toolActive: false,
    }), "pan");
  });

  it("starts an area on a selected run vertex without mutating that run; explicit Move still edits and undo restores it", () => {
    const job = createDefaultJob("2026-09-05T00:00:00.000Z");
    job.documents[0] = { ...job.documents[0], id: "source", source: "web", sha256: "a".repeat(64), pageCount: 1 };
    job.activeDocumentId = "source";
    job.calibrations = [{ ...createUnverifiedCalibration(0), coordinateSpace: "source-page-v1" }];
    useStudio.setState({ job, sheet: 0, currentCalibration: job.calibrations[0], pending: [], calibrationCapture: null, markups: [], selectedRunId: null, selectedVertexIndex: null, traceUndoStack: [], traceRedoStack: [], tool: "none" });
    useStudio.getState().ingestCalibrationCandidate({ id: "scale", source: "declared", metresPerUnit: .01, confidence: .95, provenance: { method: "test", evidence: "Known scale", documentId: "source" } });
    useStudio.getState().lockCurrentCalibration();
    useStudio.getState().setTool("length");
    [{ x: 100, y: 100 }, { x: 200, y: 100 }].forEach(point => useStudio.getState().addPoint(point));
    useStudio.getState().commitPending();
    const run = structuredClone(useStudio.getState().job.runs[0]);
    useStudio.getState().selectRun(run.id);
    useStudio.getState().setTool("area");
    assert.equal(resolveTracingCanvasPointerMode({ ...base, editMode: "move" }), "trace");
    [run.points[0], { x: 140, y: 150 }, { x: 100, y: 180 }].forEach(point => useStudio.getState().addPoint(point));
    useStudio.getState().commitPending();
    assert.deepEqual(useStudio.getState().job.runs[0], run);
    assert.deepEqual(useStudio.getState().job.annotations?.[0].points[0], run.points[0]);
    useStudio.getState().setTool("none");
    assert.equal(resolveTracingCanvasPointerMode({ ...base, toolActive: false, editMode: "select" }), "select-vertex");
    useStudio.getState().selectVertex(run.id, 0);
    assert.deepEqual(useStudio.getState().job.runs[0], run);
    assert.equal(resolveTracingCanvasPointerMode({ ...base, toolActive: false, editMode: "move" }), "move-vertex");
    let preview = { documentId: "source", sourceSha256: "a".repeat(64), sheet: 0, runId: run.id, runRevision: run.revision ?? 1, vertexIndex: 0, originalPoint: { ...run.points[0] }, point: { ...run.points[0] } };
    for (let step = 1; step <= 8; step++) preview = { ...preview, point: { x: 100 - 10 * step / 8, y: 100 + 10 * step / 8 } };
    assert.deepEqual(useStudio.getState().job.runs[0], run, "preview moves must not mutate durable geometry");
    const commit = vertexDragCommitPoint(preview, { documentId: "source", sourceSha256: "a".repeat(64), sheet: 0, run: useStudio.getState().job.runs[0], allowed: true });
    assert.ok(commit);
    useStudio.getState().moveRunVertex(run.id, 0, commit);
    assert.equal(useStudio.getState().job.runs[0].revision, (run.revision ?? 1) + 1);
    assert.deepEqual(useStudio.getState().job.runs[0].points[0], { x: 90, y: 110 });
    useStudio.getState().undoTrace();
    assert.deepEqual(useStudio.getState().job.runs[0].points, run.points);
    useStudio.getState().redoTrace();
    assert.deepEqual(useStudio.getState().job.runs[0].points[0], { x: 90, y: 110 });
    assert.equal(useStudio.getState().job.annotations?.length, 1);
  });

  it("cancels release for Escape/pointercancel, source/page changes, changed run revision, invalid or unchanged points", () => {
    const run = { id: "run", revision: 3, points: [{ x: 10, y: 20 }, { x: 30, y: 40 }] };
    const preview = { documentId: "source", sourceSha256: "a".repeat(64), sheet: 2, runId: "run", runRevision: 3, vertexIndex: 0, originalPoint: { x: 10, y: 20 }, point: { x: 11, y: 21 } };
    const current = { documentId: "source", sourceSha256: "a".repeat(64), sheet: 2, run, allowed: true };
    assert.deepEqual(vertexDragCommitPoint(preview, current), preview.point);
    assert.equal(vertexDragCommitPoint(null, current), null, "cancel clears preview before pointerup");
    assert.equal(vertexDragCommitPoint(preview, { ...current, allowed: false }), null);
    assert.equal(vertexDragCommitPoint(preview, { ...current, documentId: "other" }), null);
    assert.equal(vertexDragCommitPoint(preview, { ...current, sheet: 1 }), null);
    assert.equal(vertexDragCommitPoint(preview, { ...current, sourceSha256: "b".repeat(64) }), null);
    assert.equal(vertexDragCommitPoint(preview, { ...current, run: { ...run, revision: 4 } }), null);
    assert.equal(vertexDragCommitPoint(preview, { ...current, run: undefined }), null);
    assert.equal(vertexDragCommitPoint({ ...preview, point: { x: NaN, y: 21 } }, current), null);
    assert.equal(vertexDragCommitPoint({ ...preview, point: preview.originalPoint }, current), null);
    assert.deepEqual(run.points, [{ x: 10, y: 20 }, { x: 30, y: 40 }]);
  });
});
