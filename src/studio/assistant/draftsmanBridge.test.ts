import { test } from "node:test";
import assert from "node:assert/strict";
import {
  registerDraftsmanController,
  hasDraftsmanController,
  requestDraftsmanTool,
  draftsmanControlSchema,
  type DraftsmanController,
} from "./draftsmanBridge.ts";
import type { DraftsmanStatus } from "../MagicPencilDraftsman.ts";

const mockStatus: DraftsmanStatus = {
  mode: "drawing",
  phase: "ascending_wireframe",
  progress: 0.35,
  activeElevation: 42.5,
  activeStoreyLabel: "L12 · Elevation 42.5m",
  activeCategory: "Core Walls & Slabs",
  visibleMeshCount: 850,
  totalMeshCount: 2180,
  speed: 1.5,
  durationSeconds: 22,
  cinematicOrbit: false,
  storeys: [],
  sectionCut: "none",
  dimensionsVisible: false,
  pencilScale: 1.0,
  pencilColor: "#1877F2",
  dockPosition: "bottom-left",
};

test("draftsmanControlSchema strictly validates actions and required parameters", () => {
  // Valid actions
  assert.doesNotThrow(() => draftsmanControlSchema.parse({ action: "play" }));
  assert.doesNotThrow(() => draftsmanControlSchema.parse({ action: "pause" }));
  assert.doesNotThrow(() => draftsmanControlSchema.parse({ action: "replay" }));
  assert.doesNotThrow(() => draftsmanControlSchema.parse({ action: "finish" }));
  assert.doesNotThrow(() => draftsmanControlSchema.parse({ action: "exit" }));
  assert.doesNotThrow(() => draftsmanControlSchema.parse({ action: "status" }));
  assert.doesNotThrow(() => draftsmanControlSchema.parse({ action: "seek", progress: 0.5 }));
  assert.doesNotThrow(() => draftsmanControlSchema.parse({ action: "set_speed", speed: 2 }));
  assert.doesNotThrow(() => draftsmanControlSchema.parse({ action: "tour" }));
  assert.doesNotThrow(() => draftsmanControlSchema.parse({ action: "jump_storey", storey: "L12" }));
  assert.doesNotThrow(() => draftsmanControlSchema.parse({ action: "jump_storey", storey: 3 }));
  assert.doesNotThrow(() => draftsmanControlSchema.parse({ action: "blueprint", filename: "sheet.png" }));
  assert.doesNotThrow(() => draftsmanControlSchema.parse({ action: "section_cut", mode: "plan" }));
  assert.doesNotThrow(() => draftsmanControlSchema.parse({ action: "dimensions", visible: true }));
  assert.doesNotThrow(() => draftsmanControlSchema.parse({ action: "plan_book", download: true }));

  // Invalid actions or missing arguments
  assert.throws(() => draftsmanControlSchema.parse({ action: "invalid" }));
  assert.throws(() => draftsmanControlSchema.parse({ action: "seek" })); // missing progress
  assert.throws(() => draftsmanControlSchema.parse({ action: "seek", progress: 1.5 })); // > 1.0
  assert.throws(() => draftsmanControlSchema.parse({ action: "set_speed" })); // missing speed
  assert.throws(() => draftsmanControlSchema.parse({ action: "set_speed", speed: -1 })); // non-positive
  assert.throws(() => draftsmanControlSchema.parse({ action: "jump_storey" })); // missing storey
});

test("requestDraftsmanTool fails honestly when controller is unmounted", async () => {
  assert.equal(hasDraftsmanController(), false);
  await assert.rejects(
    () => requestDraftsmanTool("play"),
    /3D model viewer is not currently active/
  );
});

test("registerDraftsmanController safely routes commands and returns status snapshot", async () => {
  let lastAction = "";
  let lastProgress: number | undefined;
  let active = false;

  const controller: DraftsmanController = {
    control: (input) => {
      lastAction = input.action;
      lastProgress = input.progress;
      if (input.action === "play") active = true;
      if (input.action === "exit") active = false;
      return mockStatus;
    },
    getStatus: () => mockStatus,
    isActive: () => active,
    getModelInfo: () => ({
      id: "crown-wharf",
      title: "Crown Wharf 32-Level Tower",
      meshCount: 2180,
    }),
  };

  const unregister = registerDraftsmanController(controller);
  assert.equal(hasDraftsmanController(), true);

  // Execute play command
  const playResult = (await requestDraftsmanTool("play")) as {
    model: { id: string; title: string };
    active: boolean;
    status: DraftsmanStatus;
  };
  assert.equal(lastAction, "play");
  assert.equal(playResult.model.id, "crown-wharf");
  assert.equal(playResult.active, true);
  assert.equal(playResult.status.phase, "ascending_wireframe");
  assert.equal(playResult.status.progress, 0.35);


  // Execute seek command
  await requestDraftsmanTool("seek", { progress: 0.85 });
  assert.equal(lastAction, "seek");
  assert.equal(lastProgress, 0.85);

  // Unregister
  unregister();
  assert.equal(hasDraftsmanController(), false);
  await assert.rejects(() => requestDraftsmanTool("play"), /3D model viewer is not currently active/);
});
