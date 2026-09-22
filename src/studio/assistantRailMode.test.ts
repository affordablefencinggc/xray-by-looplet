import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ASSISTANT_RAIL_KEY,
  assistantRailAllowed,
  assistantRailBox,
  assistantRailVars,
  nextRailState,
  readAssistantRail,
  serializeAssistantRail,
} from "./assistantRailMode.ts";

describe("assistant rail persistence", () => {
  it("round-trips and ignores junk", () => {
    assert.equal(ASSISTANT_RAIL_KEY, "xray:assistant-rail:v3");
    assert.equal(readAssistantRail(serializeAssistantRail(true)), true);
    assert.equal(readAssistantRail(serializeAssistantRail(false)), false);
    assert.equal(readAssistantRail(null), true);
    assert.equal(readAssistantRail(""), true);
    assert.equal(readAssistantRail("{}"), true);
    assert.equal(readAssistantRail("true"), true);
  });
});

describe("assistantRailBox", () => {
  it("fills from the measured seam to the viewport edge on tablet and desktop", () => {
    assert.deepEqual(assistantRailBox({ left: 1480, top: 56, height: 1024 }, 1920, 1080), { left: 1480, top: 56, width: 440, height: 1024 });
    assert.deepEqual(assistantRailBox({ left: 704, top: 0, height: 768 }, 1024, 768), { left: 704, top: 0, width: 320, height: 768 });
  });
  it("keeps a usable minimum width and never overflows the viewport height", () => {
    assert.deepEqual(assistantRailBox({ left: 1900, top: 40, height: 5000 }, 1920, 1080), { left: 1600, top: 40, width: 320, height: 1040 });
  });
  it("is unavailable on narrow viewports or without a measured rail", () => {
    assert.equal(assistantRailBox({ left: 500, top: 0, height: 700 }, 900, 700), null);
    assert.equal(assistantRailBox(null, 1920, 1080), null);
    assert.equal(assistantRailAllowed(940), false);
    assert.equal(assistantRailAllowed(941), true);
  });
  it("publishes rounded pixel custom properties", () => {
    assert.deepEqual(assistantRailVars({ left: 1480.4, top: 56, width: 439.6, height: 1024 }), {
      "--assistant-rail-left": "1480px",
      "--assistant-rail-top": "56px",
      "--assistant-rail-width": "440px",
      "--assistant-rail-height": "1024px",
    });
    assert.deepEqual(assistantRailVars(null), {});
  });
});

describe("nextRailState", () => {
  it("entering rail mode expands a collapsed menu; leaving keeps the menu as it was", () => {
    assert.deepEqual(nextRailState({ rail: false, rightCollapsed: true }, "toggle-rail"), { rail: true, rightCollapsed: false });
    assert.deepEqual(nextRailState({ rail: true, rightCollapsed: false }, "toggle-rail"), { rail: false, rightCollapsed: false });
  });
  it("collapsing the menu preserves docking, and closing the chat keeps the column", () => {
    assert.deepEqual(nextRailState({ rail: true, rightCollapsed: false }, "collapse-right"), { rail: true, rightCollapsed: true });
    assert.deepEqual(nextRailState({ rail: true, rightCollapsed: false }, "assistant-closed"), { rail: true, rightCollapsed: false });
    assert.deepEqual(nextRailState({ rail: false, rightCollapsed: true }, "expand-right"), { rail: false, rightCollapsed: false });
    assert.deepEqual(nextRailState({ rail: true, rightCollapsed: false }, "expand-right"), { rail: true, rightCollapsed: false });
  });
});
