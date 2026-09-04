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
const compiledDir = mkdtempSync(join(cacheRoot, "calibration-canvas-test-"));
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

// The functions under test are pure. Keep the component's app-local imports inert
// so this focused Node test does not need to bootstrap the Zustand application.
writeFileSync(compiledPath, compiled.replace(/require\("\.\/[^"\n]+"\)/g, "({})"));
const require = createRequire(import.meta.url);
const {
  canvasPointToDocumentPoint,
  documentPointToCanvasPoint,
  resolvePlanCanvasPointerMode,
} = require(compiledPath) as typeof import("./IsoCanvas");

after(() => rmSync(compiledDir, { recursive: true, force: true }));

const approximatelyEqual = (actual: number, expected: number) => {
  assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} should equal ${expected}`);
};

describe("PlanCanvas calibration coordinates", () => {
  it("round-trips plan document coordinates through zoomed and panned canvas space", () => {
    const viewport = {
      width: 1000,
      height: 700,
      zoom: 1.75,
      pan: { x: 38, y: -22 },
      kind: "plan" as const,
      floors: 2,
    };
    const documentPoint = { x: 4.25, y: 2.75 };

    const canvasPoint = documentPointToCanvasPoint(documentPoint, viewport);
    const roundTrip = canvasPointToDocumentPoint(canvasPoint, viewport);

    approximatelyEqual(roundTrip.x, documentPoint.x);
    approximatelyEqual(roundTrip.y, documentPoint.y);
  });

  it("preserves the elevation canvas's inverted vertical document axis", () => {
    const viewport = {
      width: 920,
      height: 610,
      zoom: 0.8,
      pan: { x: -15, y: 44 },
      kind: "elev" as const,
      floors: 3,
    };
    const lowerPoint = documentPointToCanvasPoint({ x: 6, y: 1 }, viewport);
    const upperPoint = documentPointToCanvasPoint({ x: 6, y: 7 }, viewport);

    assert.ok(upperPoint.y < lowerPoint.y);
    const roundTrip = canvasPointToDocumentPoint(upperPoint, viewport);
    approximatelyEqual(roundTrip.x, 6);
    approximatelyEqual(roundTrip.y, 7);
  });
});

describe("PlanCanvas calibration interaction precedence", () => {
  it("captures calibration before pan or trace gestures", () => {
    for (const input of [
      { interactive: false, button: 0, shiftKey: false, toolActive: false },
      { interactive: true, button: 2, shiftKey: false, toolActive: true },
      { interactive: true, button: 0, shiftKey: true, toolActive: true },
      { interactive: true, button: 0, shiftKey: false, toolActive: false },
    ]) {
      assert.equal(
        resolvePlanCanvasPointerMode({ ...input, calibrationCaptureActive: true }),
        "calibration",
      );
    }
  });

  it("keeps the existing pan and trace behavior when capture is inactive", () => {
    assert.equal(resolvePlanCanvasPointerMode({
      calibrationCaptureActive: false,
      interactive: true,
      button: 0,
      shiftKey: false,
      toolActive: true,
    }), "trace");
    assert.equal(resolvePlanCanvasPointerMode({
      calibrationCaptureActive: false,
      interactive: true,
      button: 1,
      shiftKey: false,
      toolActive: true,
    }), "pan");
    assert.equal(resolvePlanCanvasPointerMode({
      calibrationCaptureActive: false,
      interactive: true,
      button: 0,
      shiftKey: false,
      toolActive: false,
    }), "pan");
  });
});
