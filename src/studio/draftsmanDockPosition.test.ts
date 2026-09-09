import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DRAFTSMAN_DOCK_EDGE_MARGIN,
  DRAFTSMAN_DOCK_KEY_STEP,
  DRAFTSMAN_DOCK_STORAGE_KEY,
  clampDockX,
  dockRange,
  dragDockX,
  parseStoredDockX,
  presetDockX,
  readStoredDockX,
  resolveDockX,
  serializeDockX,
  stepDockX,
  writeStoredDockX,
  type DockStorage,
} from "./draftsmanDockPosition.ts";

const tablet = { containerWidth: 1024, dockWidth: 520 };
const desktopStage = { containerWidth: 620, dockWidth: 520 };

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  const storage: DockStorage = {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
  return { storage, map };
}

describe("draftsman dock position", () => {
  it("clamps at both edges of the container", () => {
    assert.deepEqual(dockRange(tablet), { min: 8, max: 1024 - 520 - 8 });
    assert.equal(clampDockX(-500, tablet), DRAFTSMAN_DOCK_EDGE_MARGIN);
    assert.equal(clampDockX(0, tablet), 8);
    assert.equal(clampDockX(8, tablet), 8);
    assert.equal(clampDockX(300, tablet), 300);
    assert.equal(clampDockX(496, tablet), 496);
    assert.equal(clampDockX(497, tablet), 496);
    assert.equal(clampDockX(5000, tablet), 496);
    assert.equal(clampDockX(123.6, tablet), 124, "rounds to whole pixels");
  });

  it("never lets a dock wider than its container escape the left margin", () => {
    const narrow = { containerWidth: 400, dockWidth: 520 };
    assert.deepEqual(dockRange(narrow), { min: 8, max: 8 });
    assert.equal(clampDockX(200, narrow), 8);
    assert.equal(clampDockX(-40, narrow), 8);
  });

  it("re-clamps a stored position when the container shrinks on resize", () => {
    const stored = 480;
    assert.equal(resolveDockX(stored, "bottom-left", tablet), 480);
    assert.equal(resolveDockX(stored, "bottom-left", desktopStage), 620 - 520 - 8);
    assert.equal(resolveDockX(stored, "bottom-left", { containerWidth: 1440, dockWidth: 520 }), 480);
  });

  it("treats non-finite candidates and margins defensively", () => {
    assert.equal(clampDockX(Number.NaN, tablet), 8);
    assert.equal(clampDockX(Number.POSITIVE_INFINITY, tablet), 8);
    assert.equal(clampDockX(100, { containerWidth: Number.NaN, dockWidth: 520 }), 8);
    assert.deepEqual(dockRange({ ...tablet, margin: -20 }), { min: 0, max: 504 });
    assert.deepEqual(dockRange({ ...tablet, margin: 20 }), { min: 20, max: 484 });
  });

  it("uses the legacy presets when nothing is stored", () => {
    assert.equal(presetDockX("bottom-left", tablet), 8);
    assert.equal(presetDockX("bottom-center", tablet), 252);
    assert.equal(resolveDockX(null, "bottom-left", tablet), 8);
    assert.equal(resolveDockX(null, "bottom-center", tablet), 252);
    assert.equal(presetDockX("bottom-center", { containerWidth: 400, dockWidth: 520 }), 8);
  });

  it("drags by the pointer delta and clamps at both ends", () => {
    assert.equal(dragDockX(8, 100, 400, tablet), 308);
    assert.equal(dragDockX(308, 400, 1000, tablet), 496, "+600 clamps to the right edge");
    assert.equal(dragDockX(496, 1000, 100, tablet), 8, "-900 clamps to the left edge");
    assert.equal(dragDockX(8, 100, 100 - 600, tablet), 8);
  });

  it("steps with the keyboard: arrows move 16px, Home/End jump, other keys are ignored", () => {
    assert.equal(DRAFTSMAN_DOCK_KEY_STEP, 16);
    assert.equal(stepDockX(100, "ArrowRight", tablet), 116);
    assert.equal(stepDockX(100, "ArrowLeft", tablet), 84);
    assert.equal(stepDockX(8, "ArrowLeft", tablet), 8, "cannot step past the left edge");
    assert.equal(stepDockX(490, "ArrowRight", tablet), 496, "cannot step past the right edge");
    assert.equal(stepDockX(300, "Home", tablet), 8);
    assert.equal(stepDockX(300, "End", tablet), 496);
    assert.equal(stepDockX(300, "ArrowUp", tablet), null);
    assert.equal(stepDockX(300, "Enter", tablet), null);
    assert.equal(stepDockX(300, "a", tablet), null);
    assert.equal(stepDockX(9999, "ArrowLeft", tablet), 480, "out-of-range start is clamped before stepping");
    assert.equal(stepDockX(100, "ArrowRight", tablet, 40), 140, "custom step");
  });

  it("round-trips through the v1 storage envelope", () => {
    assert.equal(DRAFTSMAN_DOCK_STORAGE_KEY, "xray:draftsman-dock:v1");
    assert.equal(serializeDockX(123.4), '{"v":1,"x":123}');
    assert.equal(parseStoredDockX(serializeDockX(321)), 321);
    assert.equal(parseStoredDockX("42"), 42, "bare numbers are accepted");
  });

  it("ignores invalid stored values", () => {
    for (const raw of [
      null,
      undefined,
      "",
      "   ",
      "abc",
      "NaN",
      "Infinity",
      "-Infinity",
      "{}",
      "[]",
      '{"x":"12"}',
      '{"x":null}',
      '{"x":"NaN"}',
      '{"y":12}',
      "{bad json",
      "true",
      '"12"',
      12 as unknown,
      { x: 12 } as unknown,
    ]) {
      assert.equal(parseStoredDockX(raw), null, `raw=${String(raw)}`);
    }
  });

  it("reads and writes localStorage-like stores and swallows failures", () => {
    const { storage, map } = memoryStorage();
    assert.equal(readStoredDockX(storage), null);
    assert.equal(writeStoredDockX(storage, 300), true);
    assert.equal(map.get(DRAFTSMAN_DOCK_STORAGE_KEY), '{"v":1,"x":300}');
    assert.equal(readStoredDockX(storage), 300);
    assert.equal(readStoredDockX(memoryStorage({ [DRAFTSMAN_DOCK_STORAGE_KEY]: "garbage" }).storage), null);
    assert.equal(readStoredDockX(null), null);
    assert.equal(readStoredDockX(undefined), null);
    assert.equal(writeStoredDockX(null, 10), false);
    assert.equal(writeStoredDockX(storage, Number.NaN), false);
    const throwing: DockStorage = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    assert.equal(readStoredDockX(throwing), null);
    assert.equal(writeStoredDockX(throwing, 10), false);
  });
});
