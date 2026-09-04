import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDefaultJob } from "./domain.ts";
import { getQuoteReadiness } from "./quoteReadiness.ts";

describe("runtime quote readiness", () => {
  it("fails closed while hydration is incomplete", () => {
    const result = getQuoteReadiness(
      createDefaultJob("2026-09-04T00:00:00.000Z"),
      {
        document: { state: "loading", message: null },
        photos: {},
      },
      false,
    );
    assert.equal(result.ready, false);
    assert.ok(result.blockers.some((blocker) => blocker.code === "hydration"));
  });

  it("adds missing/corrupt original blockers beside pure domain blockers", () => {
    const job = createDefaultJob("2026-09-04T00:00:00.000Z");
    job.documents[0] = { ...job.documents[0], source: "web", sha256: "a".repeat(64) };
    job.photos.push({
      id: "photo-1",
      revision: 1,
      name: "north.png",
      mimeType: "image/png",
      sizeBytes: 40,
      sha256: "b".repeat(64),
      order: 0,
      addedAt: job.createdAt,
      updatedAt: job.createdAt,
      capturedAt: null,
      source: "web",
      caption: "",
      runIds: [],
      gateIds: [],
    });
    const result = getQuoteReadiness(job, {
      document: { state: "corrupt", message: "Plan hash mismatch." },
      photos: { "photo-1": { state: "missing", message: "Photo original missing." } },
    });
    assert.equal(result.ready, false);
    assert.ok(
      result.blockers.some(
        (blocker) =>
          blocker.code === "document-original" && blocker.message === "Plan hash mismatch.",
      ),
    );
    assert.ok(
      result.blockers.some(
        (blocker) => blocker.code === "photo-original" && blocker.entityId === "photo-1",
      ),
    );
  });
});
