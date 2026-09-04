import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectHost } from "./engine.ts";

describe("truthful workbench host detection", () => {
  it("reports only an active Tauri bridge as desktop-capable", () => {
    assert.equal(detectHost({ __TAURI_INTERNALS__: { invoke: async () => ({}) } }), "tauri");
    assert.equal(detectHost(undefined), "web");
    assert.equal(detectHost({}), "web");
    assert.equal(detectHost({ __TAURI_INTERNALS__: null }), "web");
    assert.equal(detectHost({ __TAURI_INTERNALS__: {} }), "web");
    assert.equal(detectHost({ __TAURI_INTERNALS__: { invoke: true } }), "web");
    assert.equal(detectHost(Object.defineProperty({}, "__TAURI_INTERNALS__", { get() { throw new Error("not ready"); } })), "web");
  });

  it("BR-025 does not advertise the dormant legacy Electron runTakeoff bridge", () => {
    assert.equal(detectHost({ xray: { runTakeoff: async () => ({}) } }), "web");
  });
});
