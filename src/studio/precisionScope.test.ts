import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  scopeFrame,
  scopePointer,
  throughScope,
  insideScope,
  scopeWheelZoom,
  routeScopeWheel,
  drawScopeReticle,
} from "./precisionScope.ts";
import { sourceViewport, canvasToSource, sourceToCanvas } from "./documentViewport.ts";
import { useStudio } from "./store.ts";
import { createDefaultJob } from "./domain.ts";
import { createUnverifiedCalibration } from "./calibration.ts";

describe("Precision scope interaction", () => {
  it("maps translated/scaled pointers through an edge-clamped lens before the source transform, independently of DPR", () => {
    const viewport = sourceViewport({ x: 12, y: 25, width: 1584, height: 1224 }, 900, 650, 1.7, {
      x: 37,
      y: -28,
    })!;
    for (const dpr of [1, 2])
      for (const focus of [
        { x: 15, y: 16 },
        { x: 890, y: 640 },
        { x: 450, y: 325 },
      ]) {
        const frame = scopeFrame(900, 650, focus, { enabled: true, diameter: 280, zoom: 8 }, dpr)!;
        const screen = { x: frame.left + 175, y: frame.top + 120 };
        const css = scopePointer(
          80 + screen.x * 1.5,
          110 + screen.y * 1.5,
          { left: 80, top: 110, width: 1350, height: 975 },
          900,
          650,
        )!;
        const source = canvasToSource(throughScope(css, frame), viewport);
        const expected = canvasToSource({ x: focus.x + 35 / 8, y: focus.y - 20 / 8 }, viewport);
        assert.ok(Math.abs(source.x - expected.x) < 1e-9);
        assert.ok(Math.abs(source.y - expected.y) < 1e-9);
        assert.deepEqual(sourceToCanvas(source, viewport), throughScope(css, frame));
      }
  });
  it("consumes wheel only in the circle, including at zoom limits, and never its rectangular corners", () => {
    const frame = scopeFrame(
      900,
      650,
      { x: 400, y: 300 },
      { enabled: true, diameter: 280, zoom: 4 },
      1,
    )!;
    let prevented = 0,
      stopped = 0,
      changes = 0;
    const event = {
      deltaY: -100,
      deltaMode: 0,
      preventDefault: () => prevented++,
      stopImmediatePropagation: () => stopped++,
    };
    assert.equal(insideScope({ x: frame.left + 2, y: frame.top + 2 }, frame), false);
    assert.equal(
      routeScopeWheel(event, { x: frame.left + 2, y: frame.top + 2 }, frame, 4, () => changes++),
      false,
    );
    assert.equal(
      routeScopeWheel(event, { x: 400, y: 300 }, null, 4, () => changes++),
      false,
    );
    assert.deepEqual([prevented, stopped, changes], [0, 0, 0]);
    assert.equal(
      routeScopeWheel(event, { x: 400, y: 300 }, frame, 8, (zoom) => {
        assert.equal(zoom, 8);
        changes++;
      }),
      true,
    );
    assert.deepEqual([prevented, stopped, changes], [1, 1, 1]);
    assert.equal(scopeWheelZoom(2, 1e7), 2);
    assert.equal(scopeWheelZoom(4, -16), scopeWheelZoom(4, -1, 1));
    assert.equal(scopeWheelZoom(4, -240), scopeWheelZoom(4, -1, 2));
    assert.equal(scopeWheelZoom(4, NaN), 4);
  });
  it("renders exactly three posts, with bottom but no top post", () => {
    const rotations: number[] = [];
    const ctx = new Proxy(
      { rotate: (angle: number) => rotations.push(angle) },
      {
        get(target, prop) {
          return prop in target ? target[prop as keyof typeof target] : () => {};
        },
        set() {
          return true;
        },
      },
    );
    drawScopeReticle(ctx as unknown as CanvasRenderingContext2D, 280, 4);
    assert.deepEqual(rotations, [0, Math.PI, -Math.PI / 2]);
  });
  it("commits inverse-mapped source points into real measured runs and sketches with the original locked scale", () => {
    const job = createDefaultJob("2026-09-05T00:00:00Z");
    job.documents[0] = { ...job.documents[0], id: "scope-source", source: "web", pageCount: 1 };
    job.activeDocumentId = "scope-source";
    job.calibrations = [{ ...createUnverifiedCalibration(0), coordinateSpace: "source-page-v1" }];
    useStudio.setState({
      job,
      sheet: 0,
      currentCalibration: job.calibrations[0],
      calibrationCapture: null,
      calibrationError: null,
      pending: [],
      markups: [],
      selectedRunId: null,
      tool: "none",
    });
    useStudio
      .getState()
      .ingestCalibrationCandidate({
        id: "scope-scale",
        source: "declared",
        metresPerUnit: 0.01,
        confidence: 0.95,
        provenance: {
          method: "test",
          evidence: "Explicit deterministic scale",
          documentId: "scope-source",
        },
      });
    useStudio.getState().lockCurrentCalibration();
    const viewport = sourceViewport({ x: 0, y: 0, width: 1584, height: 1224 }, 900, 650, 1.3, {
      x: 30,
      y: -12,
    })!;
    const frame = scopeFrame(
      900,
      650,
      { x: 420, y: 330 },
      { enabled: true, diameter: 280, zoom: 8 },
      2,
    )!;
    const points = [
      { x: frame.left + 120, y: frame.top + 115 },
      { x: frame.left + 185, y: frame.top + 150 },
    ].map((p) => canvasToSource(throughScope(p, frame), viewport));
    for (const tool of ["length", "sketch"] as const) {
      useStudio.getState().setTool(tool);
      points.forEach((p) => useStudio.getState().addPoint(p));
      useStudio.getState().commitPending();
      const saved =
        tool === "length"
          ? useStudio.getState().job.runs.at(-1)!
          : useStudio.getState().markups.at(-1)!;
      assert.deepEqual(saved.points, points);
      const value = "lengthM" in saved ? saved.lengthM : saved.value;
      assert.ok(
        Math.abs(value - Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y) * 0.01) <
          1e-9,
      );
    }
    useStudio.setState({
      job,
      currentCalibration: job.calibrations[0],
      pending: [],
      calibrationError: null,
    });
    useStudio.getState().addPoint(points[0]);
    assert.equal(useStudio.getState().pending.length, 0);
    assert.match(useStudio.getState().calibrationError!, /lock/i);
  });
});
