import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createHash } from "node:crypto";
import { FENCING_JOB_STORAGE_KEY } from "./persistence.ts";
import {
  createDefaultJob,
  createGateSpecification,
  createReviewDecision,
  createRunSpecification,
  type FencingJob,
} from "./domain.ts";
import {
  addLegacyPhotoMetadataForMigration,
  resetStudioHydrationForTests,
  useStudio,
  verifyStoredPlanContent,
} from "./store.ts";
import {
  createTwoPointCalibrationCandidate,
  createUnverifiedCalibration,
  lockCalibration,
} from "./calibration.ts";

function jobWithEntities(): FencingJob {
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
    ...createGateSpecification(),
    id: "gate-1",
    revision: 1,
    sheet: 0,
    label: "Gate",
    point: { x: 5, y: 0 },
    runId: "run-1",
    segmentIndex: 0,
    segmentT: 0.5,
    photoIds: [],
    review: createReviewDecision(),
  });
  return job;
}

function resetStore() {
  const job = jobWithEntities();
  useStudio.setState({
    job,
    photoPreviewUrls: {},
    photoError: null,
    selectedRunId: null,
    selectedVertexIndex: null,
    selectedGateId: null,
    traceUndoStack: [],
    traceRedoStack: [],
    persistenceHydrated: false,
    hydrationStatus: "idle",
    assetReadiness: { document: { state: "idle", message: null }, photos: {} },
  });
}

describe("studio specification and evidence commands", () => {
  beforeEach(resetStore);

  it("updates run and gate specifications with caller-provided revisions", () => {
    useStudio.getState().updateRunSpecification("run-1", 1, {
      system: "colorbond",
      profile: "Trimdek",
      heightM: 1.8,
    });
    assert.equal(useStudio.getState().job.runs[0].revision, 2);
    assert.equal(useStudio.getState().job.runs[0].specification.profile, "Trimdek");
    assert.equal(useStudio.getState().job.revision, 2);

    const before = useStudio.getState().job;
    useStudio.getState().updateRunSpecification("run-1", 1, { notes: "stale" });
    assert.equal(useStudio.getState().job, before);
    assert.match(useStudio.getState().photoError ?? "", /stale/i);

    useStudio.getState().updateGateSpecification("gate-1", 1, {
      widthM: 3.2,
      type: "double",
      postSize: "100x100",
    });
    assert.equal(useStudio.getState().job.gates[0].revision, 2);
    assert.equal(useStudio.getState().job.gates[0].widthM, 3.2);
    assert.ok(Math.abs(useStudio.getState().job.runs[0].netLengthM! - 6.8) < 1e-9);
    assert.equal(useStudio.getState().job.revisionHistory.at(-1)?.entityType, "gate");
  });

  it("adds, links, updates, reorders and removes metadata with contiguous order", async () => {
    useStudio.setState((state) => ({
      job: addLegacyPhotoMetadataForMigration(state.job, {
        id: "photo-a",
        name: "north.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 100,
        caption: "North boundary",
        runIds: ["run-1"],
        gateIds: [],
      }),
    }));
    useStudio.setState((state) => ({
      job: addLegacyPhotoMetadataForMigration(state.job, {
        id: "photo-b",
        name: "gate.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 120,
        caption: "",
        runIds: [],
        gateIds: ["gate-1"],
      }),
    }));
    let state = useStudio.getState();
    assert.deepEqual(
      state.job.photos.map((photo) => photo.order),
      [0, 1],
    );
    assert.deepEqual(state.job.runs[0].photoIds, ["photo-a"]);
    assert.deepEqual(state.job.gates[0].photoIds, ["photo-b"]);

    const photoA = state.job.photos[0];
    state.updatePhotoEvidence(photoA.id, photoA.revision, {
      caption: "Gate and north boundary",
      runIds: ["run-1"],
      gateIds: ["gate-1"],
    });
    state = useStudio.getState();
    assert.deepEqual(state.job.gates[0].photoIds.sort(), ["photo-a", "photo-b"]);
    assert.equal(state.job.photos[0].revision, 2);

    const photoB = state.job.photos.find((photo) => photo.id === "photo-b")!;
    state.reorderPhoto(photoB.id, 0, photoB.revision);
    state = useStudio.getState();
    assert.deepEqual(
      state.job.photos.map((photo) => [photo.id, photo.order]),
      [
        ["photo-b", 0],
        ["photo-a", 1],
      ],
    );

    const currentA = state.job.photos.find((photo) => photo.id === "photo-a")!;
    await state.removePhoto(currentA.id, currentA.revision);
    state = useStudio.getState();
    assert.deepEqual(
      state.job.photos.map((photo) => [photo.id, photo.order]),
      [["photo-b", 0]],
    );
    assert.deepEqual(state.job.runs[0].photoIds, []);
    assert.deepEqual(state.job.gates[0].photoIds, ["photo-b"]);
    assert.equal(state.photoError, null);
  });

  it("rejects a stale remove before touching binary storage", async () => {
    useStudio.setState((state) => ({
      job: addLegacyPhotoMetadataForMigration(state.job, {
        id: "photo-a",
        name: "north.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 100,
        caption: "",
        runIds: [],
        gateIds: [],
      }),
    }));
    const before = useStudio.getState().job;
    await useStudio.getState().removePhoto("photo-a", 99);
    assert.equal(useStudio.getState().job, before);
    assert.match(useStudio.getState().photoError ?? "", /stale/i);
  });

  it("fails an unavailable browser photo import atomically", async () => {
    if (globalThis.indexedDB || typeof File === "undefined") return;
    const bytes = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9,
    ]);
    const file = new File([bytes.buffer as ArrayBuffer], "site.jpg", { type: "image/jpeg" });
    const before = useStudio.getState().job;
    await assert.rejects(useStudio.getState().addPhotos([file]), /unavailable/i);
    assert.equal(useStudio.getState().job, before);
    assert.equal(useStudio.getState().job.photos.length, 0);
    assert.match(useStudio.getState().photoError ?? "", /unavailable/i);
  });

  it("records exactly one global revision event for site, name, calibration and trace commands", () => {
    const job = createDefaultJob("2026-09-04T00:00:00.000Z");
    useStudio.setState({ job, currentCalibration: job.calibrations[0], sheet: 0 });
    const assertOne = (before: number) => {
      const current = useStudio.getState().job;
      assert.equal(current.revision, before + 1);
      assert.equal(current.revisionHistory.at(-1)?.sequence, current.revision);
    };

    let before = useStudio.getState().job.revision;
    useStudio.getState().updateSite({ estimator: "Daniel" });
    assertOne(before);
    before = useStudio.getState().job.revision;
    useStudio.getState().updateJobName("Boundary quote");
    assertOne(before);

    useStudio.getState().startCalibrationCapture();
    useStudio.getState().addCalibrationPoint({ x: 0, y: 0 });
    useStudio.getState().addCalibrationPoint({ x: 10, y: 0 });
    before = useStudio.getState().job.revision;
    useStudio.getState().upsertManualCalibrationCandidate({
      distance: { value: 10, unit: "m" },
      provenance: {
        method: "two-point",
        evidence: "Known dimension",
        documentId: job.activeDocumentId,
      },
    });
    assertOne(before);
    before = useStudio.getState().job.revision;
    useStudio.getState().lockCurrentCalibration();
    assertOne(before);

    useStudio.getState().setTool("length");
    useStudio.getState().addPoint({ x: 0, y: 0 });
    useStudio.getState().addPoint({ x: 10, y: 0 });
    before = useStudio.getState().job.revision;
    useStudio.getState().commitPending();
    assertOne(before);
    assert.equal(useStudio.getState().job.runs[0].revision, 1);
  });

  it("exposes atomic store approval commands and invalidates approval on geometry changes", () => {
    useStudio.getState().approveRun("run-1", 1, "Daniel", "Checked");
    let run = useStudio.getState().job.runs[0];
    assert.equal(run.review.status, "approved");
    assert.equal(run.revision, 2);
    useStudio.getState().moveRunVertex("run-1", 1, { x: 9, y: 0 });
    run = useStudio.getState().job.runs[0];
    assert.equal(run.review.status, "needs-review");
    assert.equal(run.revision, 3);
    const before = useStudio.getState().job;
    useStudio.getState().rejectRun("run-1", 2, "Reviewer");
    assert.equal(useStudio.getState().job, before);
    assert.match(useStudio.getState().traceError ?? "", /stale/i);
  });

  it("hydrates as one idempotent flight and revokes stale preview URLs", async () => {
    resetStudioHydrationForTests();
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    const originalRevoke = URL.revokeObjectURL;
    let reads = 0;
    const stored = new Map<string, string>();
    const revoked: string[] = [];
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: {
          getItem: (key: string) => {
            reads += 1;
            return stored.get(key) ?? null;
          },
          // Successful storage must support the production save readback.
          // Silent write loss is covered by projectRecoveryStore.test.ts.
          setItem(key: string, value: string) { stored.set(key, value); },
          removeItem(key: string) { stored.delete(key); },
        },
      },
    });
    URL.revokeObjectURL = (url: string) => {
      revoked.push(url);
    };
    try {
      useStudio.setState({
        persistenceHydrated: false,
        hydrationStatus: "idle",
        photoPreviewUrls: { stale: "blob:stale" },
      });
      const first = useStudio.getState().hydratePersistence();
      const second = useStudio.getState().hydratePersistence();
      assert.equal(first, second);
      await first;
      assert.equal(useStudio.getState().hydrationStatus, "ready");
      assert.equal(useStudio.getState().persistenceRecoveryBlocked, false);
      assert.equal(useStudio.getState().persistenceError, null);
      assert.equal(JSON.parse(stored.get(FENCING_JOB_STORAGE_KEY)!).id, useStudio.getState().job.id);
      assert.deepEqual(revoked, ["blob:stale"]);
      const readsAfterFirst = reads;
      await useStudio.getState().hydratePersistence();
      assert.equal(reads, readsAfterFirst);
    } finally {
      URL.revokeObjectURL = originalRevoke;
      if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
      else Reflect.deleteProperty(globalThis, "window");
      resetStudioHydrationForTests();
    }
  });

  it("rehashes retrieved plan bytes against canonical document metadata", async () => {
    const bytes = new TextEncoder().encode("verified plan bytes");
    const hash = createHash("sha256").update(bytes).digest("hex");
    const document = {
      id: "document-1",
      name: "site.svg",
      kind: "svg" as const,
      importedAt: "2026-09-04T00:00:00.000Z",
      pageCount: 1,
      sha256: hash,
      source: "web" as const,
    };
    const content = {
      documentId: document.id,
      name: document.name,
      kind: document.kind,
      mimeType: "image/svg+xml",
      sizeBytes: bytes.byteLength,
      sha256: hash,
      bytes: bytes.buffer.slice(0),
    };
    assert.equal((await verifyStoredPlanContent(content, document)).sha256, hash);
    const corrupt = { ...content, bytes: content.bytes.slice(0) };
    new Uint8Array(corrupt.bytes)[0] ^= 0xff;
    await assert.rejects(verifyStoredPlanContent(corrupt, document), /SHA-256/i);
  });
});
