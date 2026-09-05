import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_APPEARANCE,
  VISUAL_PRESETS,
  loadAppearance,
  nextPreset,
  parseBuildingAppearance,
  presetAppearance,
  saveAppearance,
} from "./buildingAppearance.ts";
test("twelve presets include required palettes and cycle exactly once", () => {
  const ids = new Set<string>();
  let p = DEFAULT_APPEARANCE;
  for (let i = 0; i < 12; i++) {
    ids.add(p.preset);
    p = nextPreset(p.preset);
  }
  assert.equal(ids.size, 12);
  assert.equal(p.preset, DEFAULT_APPEARANCE.preset);
  assert.equal(presetAppearance("silver").wire, "#FFFFFF");
  assert.equal(presetAppearance("gold").background, "#090B0E");
  assert.equal(presetAppearance("paper").background, "#FFFFFF");
  for (const v of VISUAL_PRESETS) parseBuildingAppearance(presetAppearance(v.id));
});
test("rejects malformed persisted colours and out-of-range/nonfinite controls", () => {
  for (const patch of [
    { background: "url(https://bad.test)" },
    { wire: "#fff" },
    { opacity: 0 },
    { opacity: 2 },
    { lighting: NaN },
    { lighting: 100 },
    { shadows: "true" },
    { preset: "future" },
  ])
    assert.throws(() => parseBuildingAppearance({ ...DEFAULT_APPEARANCE, ...patch }));
});
test("preferences roundtrip, storage corruption falls back, save failure stays explicit", () => {
  let raw = "";
  const storage = {
    getItem: () => raw,
    setItem: (_: string, v: string) => {
      raw = v;
    },
  };
  const chosen = { ...presetAppearance("gold"), opacity: 0.5 };
  saveAppearance(storage, chosen);
  assert.deepEqual(loadAppearance(storage), chosen);
  raw = '{"background":"bad"}';
  assert.equal(loadAppearance(storage).preset, "chrome");
  assert.equal(
    loadAppearance({
      getItem: () => {
        throw Error("denied");
      },
    }).preset,
    "chrome",
  );
  assert.throws(
    () =>
      saveAppearance(
        {
          setItem: () => {
            throw Error("quota");
          },
        },
        chosen,
      ),
    /quota/,
  );
});
