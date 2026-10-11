import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_DISCIPLINE_ID,
  DISCIPLINES,
  getDiscipline,
  listDisciplines,
} from "./disciplines.ts";

// Engine trade-pack ids registered in engine/python/xray/packs_*.py
const ENGINE_PACK_IDS = new Set(["residential", "structural", "survey", "electrical", "shed", "fencing"]);

describe("Discipline catalog", () => {
  it("should expose every discipline with the full catalog shape", () => {
    for (const d of listDisciplines()) {
      assert.equal(typeof d.id, "string", `id of ${d.label} must be a string`);
      assert.ok(d.id.length > 0, `id of ${d.label} must be non-empty`);
      assert.equal(typeof d.label, "string");
      assert.ok(d.label.length > 0);
      assert.equal(typeof d.audience, "string");
      assert.ok(d.audience.length > 0);
      assert.equal(typeof d.blurb, "string");
      assert.ok(d.blurb.length > 0);
      assert.ok(Array.isArray(d.quantityKinds), `quantityKinds of ${d.id} must be an array`);
      assert.ok(d.quantityKinds.length > 0, `quantityKinds of ${d.id} must be non-empty`);
    }
  });

  it("should have unique discipline ids", () => {
    const ids = DISCIPLINES.map((d) => d.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("should have unique non-null packIds that match the engine pack registry", () => {
    const packIds = DISCIPLINES.filter((d) => d.packId !== null).map((d) => d.packId as string);
    assert.equal(new Set(packIds).size, packIds.length);
    for (const p of packIds) {
      assert.ok(ENGINE_PACK_IDS.has(p), `packId ${p} must exist in engine/python/xray/packs_*.py`);
    }
  });

  it("should fall back to the default discipline for unknown ids", () => {
    assert.equal(getDiscipline("no-such-discipline"), getDiscipline(DEFAULT_DISCIPLINE_ID));
    assert.equal(getDiscipline(undefined).id, DEFAULT_DISCIPLINE_ID);
    assert.equal(getDiscipline(null).id, DEFAULT_DISCIPLINE_ID);
  });

  it("should default to auto-detect with no forced pack", () => {
    assert.equal(DEFAULT_DISCIPLINE_ID, "auto");
    const auto = getDiscipline(DEFAULT_DISCIPLINE_ID);
    assert.equal(auto.id, "auto");
    assert.equal(auto.packId, null);
  });

  it("should map each named discipline to its engine trade pack", () => {
    assert.equal(getDiscipline("architecture").packId, "residential");
    assert.equal(getDiscipline("structural").packId, "structural");
    assert.equal(getDiscipline("civil").packId, "survey");
    assert.equal(getDiscipline("electrical").packId, "electrical");
    assert.equal(getDiscipline("building").packId, "shed");
    assert.equal(getDiscipline("fencing").packId, "fencing");
  });
});