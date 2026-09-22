import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readLibraryRecords } from "../projectRegistry.ts";
import { assessStorageQuota, TRANSIENT_RENDER_CACHE } from "./storageQuotaManager.ts";

describe("SC-17 storage quota and library isolation", () => {
  it("selects only the transient render cache when storage is above 80 percent of a measured quota", () => {
    const quota = 1000;
    const usage = 801;
    const assessment = assessStorageQuota({ usage, quota });
    assert.equal(assessment.measurable, true);
    if (!assessment.measurable) return;
    assert.ok(assessment.ratio > 0.8);
    assert.equal(assessment.ratio, usage / quota);
    assert.equal(assessment.promptArchive, true);
    assert.deepEqual(assessment.evict, [TRANSIENT_RENDER_CACHE]);
  });

  it("does not report a percentage when the quota cannot be measured", () => {
    for (const estimate of [null, undefined, {}, { usage: 10 }, { quota: 10 }, { usage: 10, quota: 0 }, { usage: Number.NaN, quota: 10 }]) {
      const assessment = assessStorageQuota(estimate);
      assert.equal(assessment.measurable, false);
      assert.equal(assessment.ratio, null);
      assert.equal(assessment.promptArchive, false);
      assert.deepEqual(assessment.evict, []);
    }
  });

  it("quarantines one corrupt library record and still loads its sibling", () => {
    const sibling = JSON.stringify({ id: "job-b", name: "Sibling", updatedAt: "2026-09-22T00:00:00.000Z", revision: 2 });
    const damaged = "{not-json";
    const result = readLibraryRecords([damaged, sibling]);
    assert.equal(result.quarantined.length, 1);
    assert.equal(result.quarantined[0].id, null);
    assert.equal(result.records.length, 1);
    assert.equal(result.records[0].id, "job-b");
    assert.equal(result.records[0].name, "Sibling");
  });
});
