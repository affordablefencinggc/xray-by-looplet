import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { parseSourceBuilding, sourceBytesMatch, fetchBuildingBytes } from "./sourceBuilding.ts";

const fixture = JSON.parse(
  await readFile(
    new URL("../../public/models/ruffles/source-building.json", import.meta.url),
    "utf8",
  ),
);
test("real source geometry validates and original PDF bytes match, not caller-supplied flags", async () => {
  const scene = parseSourceBuilding(fixture),
    bytes = new Uint8Array(
      await readFile(new URL("../../public/models/ruffles/source.pdf", import.meta.url)),
    );
  assert.equal(await sourceBytesMatch(scene, bytes, scene.source.sha256), true);
  const changed = bytes.slice();
  changed[200] ^= 1;
  assert.equal(await sourceBytesMatch(scene, changed, scene.source.sha256), false);
  assert.equal(await sourceBytesMatch(scene, bytes, "0".repeat(64)), false);
  assert.equal(await sourceBytesMatch(scene, new Uint8Array(), scene.source.sha256), false);
  assert.equal(
    await sourceBytesMatch(scene, new Uint8Array(100 * 1024 * 1024 + 1), scene.source.sha256),
    false,
  );
});
test("rejects invalid source geometry before any GPU allocation", () => {
  for (const mutate of [
    (s: any) => (s.objects = []),
    (s: any) => (s.schema = "future"),
    (s: any) => (s.objects[0].positions[0] = NaN),
    (s: any) => (s.objects[0].indices[0] = 999999),
    (s: any) => (s.objects[1].id = s.objects[0].id),
    (s: any) => (s.objects[0].sourceRefs[0].page = 999),
    (s: any) => (s.objects[0].sourceRefs[0].region = [-1, 0, 20, 20]),
    (s: any) => (s.sourceSheets[0].image = "https://example.com/source.png"),
    (s: any) => (s.objects[0].level = "undocumented"),
    (s: any) => (s.objects[0].material = "missing"),
  ]) {
    const altered = structuredClone(fixture);
    mutate(altered);
    assert.throws(() => parseSourceBuilding(altered));
  }
});
test("source stream size gate applies to declared length and actual streamed bytes", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      new Response(new Uint8Array(4), { headers: { "content-length": "100" } });
    await assert.rejects(fetchBuildingBytes("/test", 5), /size/);
    globalThis.fetch = async () => new Response(new Uint8Array(10));
    await assert.rejects(fetchBuildingBytes("/test", 5), /size/);
    globalThis.fetch = async () => new Response(new Uint8Array([1, 2, 3]));
    assert.deepEqual(await fetchBuildingBytes("/test", 5), new Uint8Array([1, 2, 3]));
  } finally {
    globalThis.fetch = original;
  }
});
