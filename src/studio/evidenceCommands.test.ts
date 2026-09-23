import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createDefaultJob,
  createGateSpecification,
  createReviewDecision,
  createRunSpecification,
  fencingJobSchema,
  type FencingJob,
  type PhotoEvidence,
} from "./domain.ts";
import { applyEvidenceCommand, REVISION_HISTORY_LIMIT } from "./evidenceCommands.ts";
import {
  createTwoPointCalibrationCandidate,
  createUnverifiedCalibration,
  lockCalibration,
} from "./calibration.ts";

const NOW = "2026-09-04T01:02:03.000Z";

function populatedJob(): FencingJob {
  const job = createDefaultJob("2026-09-04T00:00:00.000Z");
  const calibration = createUnverifiedCalibration(0);
  job.calibrations = [
    lockCalibration({
      ...calibration,
      candidates: [
        createTwoPointCalibrationCandidate({
          id: "manual-0",
          source: "manual",
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
          ],
          distance: { value: 10, unit: "m" },
          transform: calibration.transform,
          confidence: 1,
          provenance: {
            method: "two-point",
            evidence: "Verified dimension",
            documentId: "doc-sample",
          },
        }),
      ],
    }),
  ];
  job.runs.push({
    id: "run-1",
    revision: 1,
    sheet: 0,
    label: "Boundary",
    points: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ],
    lengthM: 10,
    grossLengthM: 10,
    gateDeductionM: 0,
    netLengthM: 10,
    specification: createRunSpecification(),
    photoIds: [],
    review: createReviewDecision(),
  });
  job.gates.push({
    id: "gate-1",
    revision: 1,
    sheet: 0,
    label: "Driveway gate",
    point: { x: 5, y: 0 },
    runId: "run-1",
    segmentIndex: 0,
    segmentT: 0.5,
    photoIds: [],
    review: createReviewDecision(),
    ...createGateSpecification(),
  });
  return fencingJobSchema.parse(job);
}

function photo(
  id: string,
  order: number,
  links: { runIds?: string[]; gateIds?: string[] } = {},
): PhotoEvidence {
  return {
    id,
    revision: 1,
    name: `${id}.jpg`,
    mimeType: "image/jpeg",
    sizeBytes: 128,
    sha256: "a".repeat(64),
    order,
    addedAt: NOW,
    updatedAt: NOW,
    capturedAt: null,
    source: "web",
    caption: "",
    runIds: links.runIds ?? [],
    gateIds: links.gateIds ?? [],
  };
}

describe("revision-safe evidence commands", () => {
  it("refuses a second approval of an already approved run or gate, but still allows rejecting it", () => {
    const approvedRun = applyEvidenceCommand(populatedJob(), { type: "review-run", runId: "run-1", expectedRevision: 1, decision: "approve", actor: "Reviewer" }, NOW);
    assert.throws(() => applyEvidenceCommand(approvedRun, { type: "review-run", runId: "run-1", expectedRevision: 2, decision: "approve", actor: "Reviewer" }, NOW), /already approved/);
    assert.equal(approvedRun.revisionHistory.filter(event => event.action === "approve").length, 1);
    const rejected = applyEvidenceCommand(approvedRun, { type: "review-run", runId: "run-1", expectedRevision: 2, decision: "reject", actor: "Reviewer", note: "Recheck" }, NOW);
    assert.equal(rejected.runs[0].review.status, "rejected");
    const gateId = populatedJob().gates[0]?.id;
    if (gateId) {
      const approvedGate = applyEvidenceCommand(populatedJob(), { type: "review-gate", gateId, expectedRevision: populatedJob().gates[0].revision ?? 1, decision: "approve", actor: "Reviewer" }, NOW);
      assert.throws(() => applyEvidenceCommand(approvedGate, { type: "review-gate", gateId, expectedRevision: approvedGate.gates[0].revision ?? 2, decision: "approve", actor: "Reviewer" }, NOW), /already approved/);
    }
  });
  it("approves/rejects atomically and rejects stale decisions", () => {
    const original = populatedJob();
    const approved = applyEvidenceCommand(
      original,
      {
        type: "review-run",
        runId: "run-1",
        expectedRevision: 1,
        decision: "approve",
        actor: " Daniel ",
        note: "Checked",
      },
      NOW,
    );
    assert.equal(approved.runs[0].revision, 2);
    assert.deepEqual(approved.runs[0].review, {
      status: "approved",
      decidedAt: NOW,
      decidedBy: "Daniel",
      note: "Checked",
    });
    assert.equal(approved.revision, original.revision + 1);
    assert.equal(approved.revisionHistory.at(-1)?.action, "approve");
    assert.throws(
      () =>
        applyEvidenceCommand(
          approved,
          {
            type: "review-run",
            runId: "run-1",
            expectedRevision: 1,
            decision: "reject",
            actor: "Reviewer",
          },
          NOW,
        ),
      /stale/i,
    );
    assert.throws(
      () =>
        applyEvidenceCommand(
          original,
          {
            type: "review-gate",
            gateId: "gate-1",
            expectedRevision: 1,
            decision: "approve",
            actor: "  ",
          },
          NOW,
        ),
      /actor/i,
    );
  });

  it("invalidates approvals when specifications or linked evidence changes", () => {
    let job = populatedJob();
    job.runs[0].review = {
      status: "approved",
      decidedAt: NOW,
      decidedBy: "Daniel",
      note: "Checked",
    };
    job.gates[0].review = {
      status: "approved",
      decidedAt: NOW,
      decidedBy: "Daniel",
      note: "Checked",
    };
    job = applyEvidenceCommand(
      job,
      { type: "add-photo", photo: photo("photo-1", 0, { runIds: ["run-1"], gateIds: ["gate-1"] }) },
      NOW,
    );
    assert.equal(job.runs[0].review.status, "needs-review");
    assert.equal(job.gates[0].review.status, "needs-review");
    job = applyEvidenceCommand(
      job,
      {
        type: "review-run",
        runId: "run-1",
        expectedRevision: job.runs[0].revision!,
        decision: "approve",
        actor: "Daniel",
      },
      NOW,
    );
    job = applyEvidenceCommand(
      job,
      {
        type: "update-photo",
        photoId: "photo-1",
        expectedRevision: 1,
        patch: { caption: "Changed" },
      },
      NOW,
    );
    assert.equal(job.runs[0].review.status, "needs-review");
  });
  it("updates run and gate specifications atomically with deterministic revision events", () => {
    const original = populatedJob();
    const runUpdated = applyEvidenceCommand(
      original,
      {
        type: "update-run-specification",
        runId: "run-1",
        expectedRevision: 1,
        patch: { system: "colorbond", profile: "Trimdek", heightM: 1.8 },
      },
      NOW,
    );
    assert.equal(original.runs[0].specification.system, "unselected");
    assert.equal(runUpdated.runs[0].revision, 2);
    assert.equal(runUpdated.revision, 2);
    assert.deepEqual(runUpdated.revisionHistory[0], {
      id: "revision-2-run-run-1-update",
      sequence: 2,
      occurredAt: NOW,
      entityType: "run",
      entityId: "run-1",
      action: "update",
      summary: "Updated specification for Boundary.",
    });
    assert.throws(
      () =>
        applyEvidenceCommand(
          runUpdated,
          {
            type: "update-run-specification",
            runId: "run-1",
            expectedRevision: 1,
            patch: { notes: "stale" },
          },
          NOW,
        ),
      /stale/i,
    );
    assert.equal(runUpdated.runs[0].specification.notes, "");

    const gateUpdated = applyEvidenceCommand(
      runUpdated,
      {
        type: "update-gate-specification",
        gateId: "gate-1",
        expectedRevision: 1,
        patch: { widthM: 3.6, type: "double", openingDirection: "inward", hingeSide: "double" },
      },
      NOW,
    );
    assert.equal(gateUpdated.gates[0].revision, 2);
    assert.equal(gateUpdated.gates[0].widthM, 3.6);
    assert.equal(gateUpdated.runs[0].revision, 3);
    assert.equal(gateUpdated.runs[0].grossLengthM, 10);
    assert.ok(Math.abs(gateUpdated.runs[0].gateDeductionM! - 3.6) < 1e-9);
    assert.ok(Math.abs(gateUpdated.runs[0].netLengthM! - 6.4) < 1e-9);
    assert.ok(Math.abs(gateUpdated.runs[0].lengthM - 6.4) < 1e-9);
    assert.equal(gateUpdated.revision, 3);
  });

  it("adds and updates bidirectional links while incrementing every mutated entity", () => {
    const original = populatedJob();
    const added = applyEvidenceCommand(
      original,
      {
        type: "add-photo",
        photo: photo("photo-1", 0, { runIds: ["run-1"], gateIds: ["gate-1"] }),
      },
      NOW,
    );
    assert.deepEqual(added.runs[0].photoIds, ["photo-1"]);
    assert.deepEqual(added.gates[0].photoIds, ["photo-1"]);
    assert.deepEqual(added.photos[0].runIds, ["run-1"]);
    assert.deepEqual(added.photos[0].gateIds, ["gate-1"]);
    assert.equal(added.runs[0].revision, 2);
    assert.equal(added.gates[0].revision, 2);
    assert.equal(added.photos[0].revision, 1);

    const updated = applyEvidenceCommand(
      added,
      {
        type: "update-photo",
        photoId: "photo-1",
        expectedRevision: 1,
        patch: { caption: "North boundary", runIds: [], gateIds: [] },
      },
      NOW,
    );
    assert.equal(updated.photos[0].revision, 2);
    assert.equal(updated.photos[0].caption, "North boundary");
    assert.deepEqual(updated.runs[0].photoIds, []);
    assert.deepEqual(updated.gates[0].photoIds, []);
    assert.equal(updated.runs[0].revision, 3);
    assert.equal(updated.gates[0].revision, 3);
    assert.equal(updated.revisionHistory.at(-1)?.action, "unlink");
    assert.equal(fencingJobSchema.safeParse(updated).success, true);

    assert.throws(
      () =>
        applyEvidenceCommand(
          updated,
          {
            type: "update-photo",
            photoId: "photo-1",
            expectedRevision: 1,
            patch: { caption: "stale" },
          },
          NOW,
        ),
      /stale/i,
    );
    assert.equal(updated.photos[0].caption, "North boundary");
  });

  it("keeps photo order contiguous through reorder and remove", () => {
    let job = populatedJob();
    job = applyEvidenceCommand(job, { type: "add-photo", photo: photo("photo-a", 0) }, NOW);
    job = applyEvidenceCommand(job, { type: "add-photo", photo: photo("photo-b", 1) }, NOW);
    job = applyEvidenceCommand(job, { type: "add-photo", photo: photo("photo-c", 2) }, NOW);

    const beforeB = job.photos.find((entry) => entry.id === "photo-b")!.revision;
    job = applyEvidenceCommand(
      job,
      {
        type: "reorder-photo",
        photoId: "photo-c",
        expectedRevision: 1,
        toIndex: 0,
      },
      NOW,
    );
    assert.deepEqual(
      job.photos.map((entry) => [entry.id, entry.order]),
      [
        ["photo-c", 0],
        ["photo-a", 1],
        ["photo-b", 2],
      ],
    );
    assert.ok(job.photos.find((entry) => entry.id === "photo-b")!.revision > beforeB);

    const photoA = job.photos.find((entry) => entry.id === "photo-a")!;
    job = applyEvidenceCommand(
      job,
      {
        type: "remove-photo",
        photoId: photoA.id,
        expectedRevision: photoA.revision,
      },
      NOW,
    );
    assert.deepEqual(
      job.photos.map((entry) => [entry.id, entry.order]),
      [
        ["photo-c", 0],
        ["photo-b", 1],
      ],
    );
    assert.equal(job.revisionHistory.at(-1)?.action, "delete");
    assert.equal(fencingJobSchema.safeParse(job).success, true);
  });

  it("rejects missing links and invalid patches without mutating the source", () => {
    const original = populatedJob();
    assert.throws(
      () =>
        applyEvidenceCommand(
          original,
          {
            type: "add-photo",
            photo: photo("photo-1", 0, { runIds: ["missing"] }),
          },
          NOW,
        ),
      /unknown fence run link/i,
    );
    assert.throws(() =>
      applyEvidenceCommand(
        original,
        {
          type: "update-gate-specification",
          gateId: "gate-1",
          expectedRevision: 1,
          patch: { widthM: -1 },
        },
        NOW,
      ),
    );
    assert.equal(original.revision, 1);
    assert.equal(original.photos.length, 0);
    assert.equal(original.gates[0].widthM, null);
  });

  it("caps revision history at 1000 events without reusing sequences", () => {
    const base = populatedJob();
    const history = Array.from({ length: REVISION_HISTORY_LIMIT }, (_, index) => ({
      id: `old-${index + 2}`,
      sequence: index + 2,
      occurredAt: NOW,
      entityType: "job" as const,
      entityId: base.id,
      action: "update" as const,
      summary: `Old event ${index + 2}`,
    }));
    const loaded = fencingJobSchema.parse({ ...base, revision: 1001, revisionHistory: history });
    const next = applyEvidenceCommand(
      loaded,
      {
        type: "update-run-specification",
        runId: "run-1",
        expectedRevision: 1,
        patch: { notes: "new" },
      },
      NOW,
    );
    assert.equal(next.revisionHistory.length, REVISION_HISTORY_LIMIT);
    assert.equal(next.revisionHistory[0].sequence, 3);
    assert.equal(next.revisionHistory.at(-1)?.sequence, 1002);
    assert.equal(next.revisionHistory.at(-1)?.id, "revision-1002-run-run-1-update");
  });
});
