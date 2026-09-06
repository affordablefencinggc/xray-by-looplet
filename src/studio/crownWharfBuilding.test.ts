import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { parseSourceBuilding, sourceBytesMatch, buildingPartOnFloor } from "./sourceBuilding.ts";

const raw = JSON.parse(await readFile(new URL("../../public/models/crown-wharf/source-building.json", import.meta.url), "utf8"));
const scene = parseSourceBuilding(raw);
test("Crown Wharf model binds the original 36-page PDF and documented elevation range", async () => {
  const bytes = new Uint8Array(await readFile(new URL("../../public/models/crown-wharf/source.pdf", import.meta.url)));
  assert.equal(await sourceBytesMatch(scene, bytes, scene.source.sha256), true);
  assert.equal(scene.source.pageCount, 36);
  assert.equal(scene.storeys?.length, 33);
  assert.equal(scene.storeys?.find(s => s.id === "L18")?.elevation, 62.025);
  assert.equal(scene.storeys?.find(s => s.id === "L30")?.elevation, 98.025);
  assert.equal(scene.storeys?.find(s => s.id === "RF")?.elevation, 104.6);
  assert.equal(scene.bounds.max[1], 108.69);
  assert.ok(scene.objects.every(p => p.evidenceState === "inferred"));
  assert.match(scene.assumptions.join(" "), /not.*quantities|not.*volume/i);
});
test("every storey can be isolated without losing its parts or leaking another floor", () => {
  const seen = new Set<string>();
  for (const floor of scene.storeys!) {
    const parts = scene.objects.filter(p => buildingPartOnFloor(p, floor.id));
    assert.ok(parts.length > 0, floor.id);
    for (const p of parts) {
      assert.equal(p.storey, floor.id);
      assert.equal(seen.has(p.id), false);
      seen.add(p.id);
    }
  }
  assert.equal(seen.size, scene.objects.length);
  assert.equal(scene.objects.filter(p => buildingPartOnFloor(p, "all")).length, scene.objects.length);
  assert.equal(scene.objects.some(p => buildingPartOnFloor(p, "missing-floor")), false);
  assert.equal(scene.objects.some(p => buildingPartOnFloor(p, "ground")), false);
});
test("invalid storey identity, order and membership fail before rendering", () => {
  for (const mutate of [
    (s: any) => { s.storeys[1].id = s.storeys[0].id; },
    (s: any) => { s.storeys[1].elevation = s.storeys[0].elevation; },
    (s: any) => { s.storeys[0].elevation = -100; },
    (s: any) => { s.objects[0].storey = "L99"; },
    (s: any) => { delete s.objects[0].storey; },
    (s: any) => { delete s.storeys; },
  ]) {
    const altered = structuredClone(raw); mutate(altered);
    assert.throws(() => parseSourceBuilding(altered), /[Ss]torey/);
  }
});
test("legacy two-floor scenes retain their ground and upper filters", async () => {
  const old = parseSourceBuilding(JSON.parse(await readFile(new URL("../../public/models/caroline/source-building.json", import.meta.url), "utf8")));
  for (const p of old.objects) {
    assert.equal(buildingPartOnFloor(p, "ground"), p.level !== "upper" && p.level !== "roof");
    assert.equal(buildingPartOnFloor(p, "upper"), p.level !== "ground");
  }
});
