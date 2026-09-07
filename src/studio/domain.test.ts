import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  JOB_SCHEMA_VERSION,
  createDefaultJob,
  createGateSpecification,
  createReviewDecision,
  createRunSpecification,
  fencingJobSchema,
  getJobBlockers,
  parseFencingJob,
} from "./domain.ts";
import {
  createTwoPointCalibrationCandidate,
  createUnverifiedCalibration,
  lockCalibration,
} from "./calibration.ts";

describe("fencing job domain", () => {
  const completeRunSpecification = () => ({
    ...createRunSpecification(),
    system: "colorbond" as const,
    profile: "Good Neighbour",
    heightM: 1.8,
    bayWidthM: 2.4,
    ground: "soil" as const,
    slope: "level" as const,
    access: "clear" as const,
    sleepers: "none" as const,
  });

  it("round-trips the versioned default job", () => {
    const job = createDefaultJob("2026-09-04T00:00:00.000Z");
    const parsed = parseFencingJob(JSON.stringify(job));
    assert.equal(parsed.schemaVersion, JOB_SCHEMA_VERSION);
    assert.equal(parsed.revision, 1);
    assert.deepEqual(parsed.revisionHistory, []);
    assert.equal(parsed.trade, "general");
    assert.equal(parsed.name, "New project");
    assert.equal(parsed.site.address, "");
    assert.equal(parseFencingJob({ ...job, trade: "fencing" }).trade, "fencing");
    assert.equal(parsed.documents[0].source, "sample");
  });

  it("fails closed for unknown schema versions", () => {
    const job = { ...createDefaultJob(), schemaVersion: 99 };
    assert.equal(fencingJobSchema.safeParse(job).success, false);
  });

  it("requires v2 entity revisions and a resolvable active document", () => {
    const job = createDefaultJob("2026-09-04T00:00:00.000Z");
    job.runs.push({
      id: "run-no-revision",
      sheet: 0,
      label: "Unversioned",
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      lengthM: 1,
      specification: createRunSpecification(),
      photoIds: [],
      review: createReviewDecision(),
    });
    assert.equal(fencingJobSchema.safeParse(job).success, false);
    job.runs[0].revision = 1;
    job.activeDocumentId = "missing-document";
    assert.equal(fencingJobSchema.safeParse(job).success, false);
  });

  it("requires review attribution and exact gate placement", () => {
    const job = createDefaultJob("2026-09-04T00:00:00.000Z");
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
      specification: createRunSpecification(),
      photoIds: [],
      review: createReviewDecision(),
    });
    job.gates.push({
      ...createGateSpecification(),
      id: "gate-1",
      revision: 1,
      sheet: 0,
      label: "Gate",
      point: { x: 4, y: 1 },
      runId: "run-1",
      segmentIndex: 0,
      segmentT: 0.4,
      photoIds: [],
      review: createReviewDecision(),
    });
    assert.equal(fencingJobSchema.safeParse(job).success, false);
    job.gates[0].point = { x: 4, y: 0 };
    job.runs[0].review = { status: "approved", decidedAt: null, decidedBy: "", note: "" };
    assert.equal(fencingJobSchema.safeParse(job).success, false);
    job.runs[0].review = {
      status: "approved",
      decidedAt: job.createdAt,
      decidedBy: "Daniel",
      note: "Checked",
    };
    assert.equal(fencingJobSchema.safeParse(job).success, true);
  });

  it("rejects malformed geometry and negative quantities", () => {
    const job = createDefaultJob();
    job.runs.push({
      id: "run-1",
      sheet: 0,
      label: "Run 01",
      points: [{ x: 0, y: 0 }],
      lengthM: -1,
      specification: createRunSpecification(),
      photoIds: [],
      review: createReviewDecision(),
    });
    assert.equal(fencingJobSchema.safeParse(job).success, false);
  });

  it("rejects duplicate calibrations for the same sheet", () => {
    const job = createDefaultJob();
    job.calibrations.push({ ...job.calibrations[0] });
    assert.equal(fencingJobSchema.safeParse(job).success, false);
  });

  it("rejects duplicate trace IDs, broken gate associations and inconsistent enriched lengths", () => {
    const job = createDefaultJob();
    const baseRun = {
      id: "run-1",
      sheet: 0,
      label: "Run 01",
      points: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
      ],
      lengthM: 5,
      specification: createRunSpecification(),
      photoIds: [],
      review: createReviewDecision(),
    };
    job.runs.push(baseRun, { ...baseRun });
    assert.equal(fencingJobSchema.safeParse(job).success, false);

    job.runs = [{ ...baseRun, revision: 1, grossLengthM: 5, gateDeductionM: 1, netLengthM: 5 }];
    assert.equal(fencingJobSchema.safeParse(job).success, false);
  });

  it("reports explicit quote-readiness blockers", () => {
    const job = createDefaultJob();
    const initial = getJobBlockers(job);
    assert.deepEqual(
      initial.map((blocker) => blocker.code),
      ["document", "calibration", "runs"],
    );

    const manual = createTwoPointCalibrationCandidate({
      id: "manual-sheet-0",
      source: "manual",
      points: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
      ],
      distance: { value: 5, unit: "m" },
      transform: job.calibrations[0].transform,
      confidence: 1,
      provenance: {
        method: "two-point",
        evidence: "Known site boundary",
        documentId: job.activeDocumentId,
      },
    });
    job.calibrations[0] = lockCalibration({ ...job.calibrations[0], coordinateSpace: "source-page-v1", candidates: [manual] });
    job.documents[0] = { ...job.documents[0], source: "web" };
    job.runs.push({
      id: "run-1",
      sheet: 2,
      label: "Run 01",
      points: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
      ],
      lengthM: 5,
      specification: createRunSpecification(),
      photoIds: [],
      review: createReviewDecision(),
    });
    assert.deepEqual(
      getJobBlockers(job).map((blocker) => blocker.code),
      ["calibration", "run-specification", "review"],
    );

    job.runs[0].specification = completeRunSpecification();
    job.runs[0].review = {
      status: "approved",
      decidedAt: "2026-09-04T00:00:00.000Z",
      decidedBy: "Daniel",
      note: "Checked",
    };
    job.calibrations.push(
      lockCalibration({
        ...createUnverifiedCalibration(2), coordinateSpace: "source-page-v1",
        candidates: [{ ...manual, id: "manual-sheet-2" }],
      }),
    );
    assert.deepEqual(getJobBlockers(job), []);
  });

  it("migrates version 1 records into the complete evidence contract", () => {
    const now = "2026-09-04T00:00:00.000Z";
    const legacy = JSON.parse(JSON.stringify(createDefaultJob(now)));
    legacy.schemaVersion = 1;
    delete legacy.revision;
    delete legacy.revisionHistory;
    legacy.runs = [
      {
        id: "run-legacy",
        sheet: 0,
        label: "Run legacy",
        points: [
          { x: 0, y: 0 },
          { x: 5, y: 0 },
        ],
        lengthM: 5,
        specification: {
          system: "colorbond",
          customSystem: "",
          heightM: 1.8,
          bayWidthM: 2.4,
          ground: "soil",
          slope: "level",
          removalRequired: false,
          access: "clear",
          sleepers: "none",
          retainingCondition: "",
          notes: "",
        },
        photoIds: [],
        review: createReviewDecision(),
      },
    ];
    legacy.gates = [
      {
        id: "gate-legacy",
        sheet: 0,
        label: "Gate legacy",
        point: { x: 2.5, y: 0 },
        runId: "run-legacy",
        widthM: 1,
        heightM: null,
        type: "single",
        hardware: "",
        motorised: false,
        photoIds: [],
        review: createReviewDecision(),
      },
    ];
    legacy.photos = [
      {
        id: "photo-legacy",
        name: "legacy.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 10,
        addedAt: now,
        caption: "",
        runIds: [],
        gateIds: [],
      },
    ];

    const migrated = parseFencingJob(legacy);
    assert.equal(migrated.schemaVersion, 2);
    assert.equal(migrated.runs[0].specification.profile, "");
    assert.deepEqual(migrated.runs[0].specification.corners, []);
    assert.equal(migrated.gates[0].openingDirection, "unselected");
    assert.equal(migrated.photos[0].sha256, null);
    assert.equal(migrated.photos[0].revision, 1);
  });

  it("validates corner, post, photo-link and revision topology", () => {
    const now = "2026-09-04T00:00:00.000Z";
    const job = createDefaultJob(now);
    job.revision = 2;
    job.runs.push({
      id: "run-1",
      revision: 1,
      sheet: 0,
      label: "Run 01",
      points: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
      ],
      lengthM: 5,
      grossLengthM: 5,
      gateDeductionM: 0,
      netLengthM: 5,
      specification: {
        ...completeRunSpecification(),
        corners: [{ id: "corner-1", vertexIndex: 1, treatment: "boxed", notes: "" }],
        postOverrides: [
          {
            id: "post-1",
            vertexIndex: 1,
            postSize: "100 x 100",
            lengthM: 2.7,
            embedmentM: 0.9,
            notes: "",
          },
        ],
      },
      photoIds: ["photo-1"],
      review: createReviewDecision(),
    });
    job.photos.push({
      id: "photo-1",
      revision: 1,
      name: "corner.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 10,
      sha256: "a".repeat(64),
      order: 0,
      addedAt: now,
      updatedAt: now,
      capturedAt: null,
      source: "web",
      caption: "Boxed corner",
      runIds: ["run-1"],
      gateIds: [],
    });
    job.revisionHistory.push({
      id: "event-2",
      sequence: 2,
      occurredAt: now,
      entityType: "photo",
      entityId: "photo-1",
      action: "link",
      summary: "Linked corner photo",
    });
    assert.equal(fencingJobSchema.safeParse(job).success, true);

    job.runs[0].specification.corners[0].vertexIndex = 2;
    assert.equal(fencingJobSchema.safeParse(job).success, false);
    job.runs[0].specification.corners[0].vertexIndex = 1;
    job.photos[0].runIds = [];
    assert.equal(fencingJobSchema.safeParse(job).success, false);
    job.photos[0].runIds = ["run-1"];
    job.revisionHistory[0].sequence = 3;
    assert.equal(fencingJobSchema.safeParse(job).success, false);
    job.revisionHistory[0].sequence = 2;
    job.photos[0].order = 1;
    assert.equal(fencingJobSchema.safeParse(job).success, false);
  });

  it("reports complete gate and legacy-photo evidence blockers", () => {
    const job = createDefaultJob("2026-09-04T00:00:00.000Z");
    const gate = {
      id: "gate-1",
      revision: 1,
      sheet: 0,
      label: "Gate 01",
      point: { x: 1, y: 0 },
      runId: null,
      segmentIndex: null,
      segmentT: null,
      ...createGateSpecification(),
      photoIds: [],
      review: createReviewDecision(),
    };
    job.gates.push(gate);
    job.photos.push({
      id: "photo-1",
      revision: 1,
      name: "legacy.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 10,
      sha256: null,
      order: 0,
      addedAt: job.createdAt,
      updatedAt: job.createdAt,
      capturedAt: null,
      source: "web",
      caption: "",
      runIds: [],
      gateIds: [],
    });
    assert.deepEqual(
      getJobBlockers(job).map((blocker) => blocker.code),
      ["document", "calibration", "runs", "gate-specification", "review", "photo-evidence"],
    );
  });
});
