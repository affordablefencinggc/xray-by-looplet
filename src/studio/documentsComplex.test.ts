import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { inspectPlanBytes } from "./documents.ts";
import { parseSourceBuilding, sourceBytesMatch } from "./sourceBuilding.ts";

for (const [name, pages] of [
  ["caroline", 19],
  ["ruffles", 24],
] as const)
  test(`actual ${name} complex PDF retains its original bytes and exact page identity`, async () => {
    const scene = parseSourceBuilding(
      JSON.parse(
        await readFile(
          new URL(`../../public/models/${name}/source-building.json`, import.meta.url),
          "utf8",
        ),
      ),
    );
    const original = new Uint8Array(
      await readFile(new URL(`../../public/models/${name}/source.pdf`, import.meta.url)),
    );
    const result = await inspectPlanBytes({
      name: scene.source.name,
      bytes: original,
      source: "web",
      takeoff: null,
    });
    assert.equal(result.revision.pageCount, pages);
    assert.deepEqual(result.binary.bytes, original);
    assert.equal(result.binary.sha256, scene.source.sha256);
    assert.equal(await sourceBytesMatch(scene, result.binary.bytes, result.binary.sha256), true);
    assert.equal(result.takeoff, null);
    if (name === "caroline") {
      assert.equal(scene.floorElevations?.upper, 2.7432);
      assert.ok(scene.objects.some((p) => p.category === "stair"));
      assert.equal(scene.source.author, "Jay Osborne / FreeFarmhouse");
    }
  });
