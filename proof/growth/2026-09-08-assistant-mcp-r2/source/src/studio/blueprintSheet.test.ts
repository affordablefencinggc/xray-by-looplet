import { test } from "node:test";
import assert from "node:assert/strict";
import { createBlueprintSheet, type BlueprintSheetMetadata } from "./blueprintSheet.ts";

test("createBlueprintSheet procedurally draws blueprint borders, title block and exports PNG data", () => {
  let fillRectCalls = 0;
  let drawImageCalls = 0;
  let fillTextCalls = 0;

  const mockCtx = {
    createLinearGradient: () => ({ addColorStop: () => {} }),
    fillRect: () => { fillRectCalls++; },
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    strokeRect: () => {},
    arc: () => {},
    closePath: () => {},
    fill: () => {},
    fillText: () => { fillTextCalls++; },
    drawImage: () => { drawImageCalls++; },
    strokeStyle: "",
    fillStyle: "",
    lineWidth: 1,
    font: "",
    shadowColor: "",
    shadowBlur: 0,
    textAlign: "",
  };

  const mockCanvas = {
    width: 0,
    height: 0,
    getContext: (type: string) => (type === "2d" ? mockCtx : null),
    toDataURL: (mime: string) => `data:${mime};base64,mockBlueprintBytes`,
  } as unknown as HTMLCanvasElement;

  const mockDoc = {
    createElement: (tag: string) => {
      if (tag === "canvas") return mockCanvas;
      if (tag === "a") return { href: "", download: "", click: () => {} };
      return {};
    },
    body: {
      appendChild: () => {},
      removeChild: () => {},
    },
  };

  const sourceCanvas = {
    width: 800,
    height: 600,
    ownerDocument: mockDoc,
  } as unknown as HTMLCanvasElement;

  const metadata: BlueprintSheetMetadata = {
    projectTitle: "Crown Wharf 32-Level Tower",
    phaseLabel: "Phase 2: Ascending Wireframe Tracing",
    storeyLabel: "Level 18 (+63.2m)",
    elevationMetres: 63.2,
    meshCount: 1276,
    totalMeshes: 2180,
    speed: 1.0,
  };

  const result = createBlueprintSheet(sourceCanvas, metadata);

  assert.equal(result.canvas.width, 1920);
  assert.equal(result.canvas.height, 1200);
  assert.ok(result.dataUrl.startsWith("data:image/png;base64,"));
  assert.ok(fillRectCalls >= 2);
  assert.equal(drawImageCalls, 1);
  assert.ok(fillTextCalls >= 10);

  // Test download callback
  assert.doesNotThrow(() => result.download("crown-wharf-test.png"));
});
