import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

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

  it("chooses vertex drag, run selection, trace, then ordinary pan without overlap", () => {
    assert.equal(resolveTracingCanvasPointerMode(base), "move-vertex");
    assert.equal(resolveTracingCanvasPointerMode({ ...base, vertexHit: false }), "select-run");
    assert.equal(resolveTracingCanvasPointerMode({ ...base, vertexHit: false, runHit: false }), "trace");
    assert.equal(resolveTracingCanvasPointerMode({
      ...base,
      vertexHit: false,
      runHit: false,
      toolActive: false,
    }), "pan");
  });
});
