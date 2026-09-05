import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import {
  createDefaultJob,
  createRunSpecification,
  createGateSpecification,
  createReviewDecision,
  fencingJobSchema,
  parseFencingJob,
  type FencingJob,
} from "./domain.ts";
import {
  createUnverifiedCalibration,
  createScaleCalibrationCandidate,
  lockCalibration,
} from "./calibration.ts";
import {
  captureDocumentWorkspace,
  prepareDocumentSelection,
  restoreDocumentWorkspace,
} from "./documentWorkspaces.ts";
import { loadFencingJob, saveFencingJob } from "./persistence.ts";
import { useStudio, verifyStoredPlanContent } from "./store.ts";
import type { StoredPlanContent } from "./documentContract.ts";

const date = "2026-09-05T00:00:00.000Z";
function source(id: string) {
  const bytes = new TextEncoder().encode(
    `<svg xmlns="http://www.w3.org/2000/svg"><path id="${id}" d="M0 0L100 100"/></svg>`,
  );
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const document = {
    id,
    name: `${id}.svg`,
    kind: "svg" as const,
    importedAt: date,
    pageCount: 3,
    sha256,
    source: "web" as const,
  };
  const content: StoredPlanContent = {
    documentId: id,
    name: document.name,
    kind: "svg",
    mimeType: "image/svg+xml",
    sizeBytes: bytes.length,
    sha256,
    bytes: Uint8Array.from(bytes).buffer,
  };
  return { document, content };
}
const a = source("plan-a"),
  b = source("plan-b");
function initial(): FencingJob {
  return {
    ...createDefaultJob(date),
    documents: [a.document, b.document],
    activeDocumentId: a.document.id,
    calibrations: [0, 1, 2].map((sheet) => createUnverifiedCalibration(sheet)),
    activeSheet: 2,
  };
}
function evidence(job: FencingJob, id: string): FencingJob {
  const doc = job.documents.find((item) => item.id === job.activeDocumentId)!;
  const calibration = lockCalibration({
    ...createUnverifiedCalibration(2),
    coordinateSpace: "source-page-v1",
    candidates: [
      createScaleCalibrationCandidate({
        id: `${id}-scale`,
        source: "declared",
        metresPerUnit: id === "a" ? 0.01 : 0.02,
        confidence: 0.95,
        provenance: { method: "test", evidence: "Explicit source scale", documentId: doc.id },
      }),
    ],
  });
  return fencingJobSchema.parse({
    ...job,
    status: "in-review",
    annotations: [
      {
        id: `${id}-sketch`,
        kind: "sketch",
        label: id,
        points: [
          { x: 100.25, y: 42.125 },
          { x: 135.75, y: 89.875 },
        ],
        value: 0.5,
        unit: "m",
        sheet: 2,
        documentId: doc.id,
        sourceSha256: doc.sha256,
        coordinateSpace: "source-page-v1",
      },
    ],
    runs: [
      {
        id: `${id}-run`,
        revision: 1,
        sheet: 2,
        label: id,
        points: [
          { x: 1, y: 2 },
          { x: 11, y: 2 },
        ],
        lengthM: 10,
        specification: createRunSpecification(),
        photoIds: [`${id}-photo`],
        review: createReviewDecision(),
      },
    ],
    calibrations: [createUnverifiedCalibration(0), createUnverifiedCalibration(1), calibration],
    gates: [
      {
        ...createGateSpecification(),
        id: `${id}-gate`,
        revision: 1,
        sheet: 2,
        label: "Gate",
        runId: `${id}-run`,
        segmentIndex: 0,
        segmentT: 0.5,
        point: { x: 6, y: 2 },
        photoIds: [`${id}-photo`],
        review: createReviewDecision(),
      },
    ],
    photos: [
      {
        id: `${id}-photo`,
        revision: 1,
        name: "Evidence.png",
        mimeType: "image/png",
        sizeBytes: 100,
        sha256: null,
        order: 0,
        addedAt: date,
        updatedAt: date,
        capturedAt: null,
        source: "web",
        caption: id,
        runIds: [`${id}-run`],
        gateIds: [`${id}-gate`],
      },
    ],
    bom: [
      {
        id: `${id}-line`,
        item: "Recorded item",
        quantity: 1,
        unit: "ea",
        formula: "Recorded evidence",
        confidenceTier: "single-source",
        evidenceIds: [`${id}-run`],
        rate: null,
        amount: null,
        reviewRequired: true,
      },
    ],
    quoteDraft: {
      id: `${id}-quote`,
      createdAt: date,
      status: "unpriced",
      lines: [],
      subtotal: null,
      tax: null,
      total: null,
      loopletReceipt: null,
    },
    revisionHistory: [
      {
        id: `${id}-revision`,
        occurredAt: date,
        sequence: 1,
        entityType: "job",
        entityId: job.id,
        action: "update",
        summary: `${id} evidence`,
      },
    ],
  });
}
class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}
function reload(job: FencingJob) {
  const storage = new MemoryStorage();
  assert.equal(saveFencingJob(job, storage).ok, true);
  const loaded = loadFencingJob(storage);
  assert.equal(loaded.error, null);
  return loaded.job!;
}

describe("source-bound document workspaces", () => {
  it("round-trips two source evidence packages and last pages through durable storage and JSON export/import", () => {
    const first = evidence(initial(), "a");
    first.componentRegistry = [{ id: "trade", name: "Windows", note: "Source schedule" }];
    const second = evidence(
      restoreDocumentWorkspace(captureDocumentWorkspace(first, 2), b.document),
      "b",
    );
    const back = restoreDocumentWorkspace(captureDocumentWorkspace(reload(second), 1), a.document);
    assert.deepEqual(back.runs, first.runs);
    assert.deepEqual(back.annotations, first.annotations);
    assert.deepEqual(back.calibrations, first.calibrations);
    assert.deepEqual(back.revisionHistory, first.revisionHistory);
    for (const key of ["gates", "photos", "bom", "quoteDraft"] as const)
      assert.deepEqual(back[key], first[key]);
    assert.equal(back.activeSheet, 2);
    assert.deepEqual(back.componentRegistry, first.componentRegistry);
    const again = restoreDocumentWorkspace(
      captureDocumentWorkspace(parseFencingJob(JSON.stringify(reload(back))), 2),
      b.document,
    );
    assert.deepEqual(again.runs, second.runs);
    assert.deepEqual(again.annotations, second.annotations);
    assert.equal(again.activeSheet, 1);
    assert.equal(again.status, "in-review");
    assert.equal(again.documentWorkspaces?.[b.document.id], undefined);
  });
  it("preserves old v2 data without adding guessed coordinates or inactive evidence", () => {
    const old = createDefaultJob(date);
    assert.deepEqual(parseFencingJob(JSON.stringify(old)), old);
    const empty = restoreDocumentWorkspace(captureDocumentWorkspace(initial(), 2), b.document);
    assert.deepEqual(empty.annotations, []);
    assert.deepEqual(empty.runs, []);
    assert.equal(empty.activeSheet, 0);
  });
  it("verifies exact target bytes before preparing a switch, rejecting missing/tampered sources without changing current evidence", async () => {
    const before = {
      job: evidence(initial(), "a"),
      sheet: 2,
      pending: [],
      calibrationCapture: null,
    };
    const original = structuredClone(before);
    for (const content of [
      null,
      { ...b.content, bytes: new Uint8Array(b.content.sizeBytes).buffer },
    ]) {
      await assert.rejects(
        prepareDocumentSelection(
          before,
          b.document.id,
          (document) => verifyStoredPlanContent(content, document),
          () => true,
        ),
        /missing|verification/,
      );
      assert.deepEqual(before, original);
    }
    const prepared = await prepareDocumentSelection(
      before,
      b.document.id,
      (document) => verifyStoredPlanContent(b.content, document),
      () => true,
    );
    assert.equal(prepared.binary.sha256, b.document.sha256);
    assert.equal(prepared.job.activeDocumentId, b.document.id);
    assert.deepEqual(before, original);
  });
  it("rejects unfinished capture before loading and stale asynchronous selections after loading", async () => {
    let loads = 0;
    const before = { job: initial(), sheet: 2, pending: [], calibrationCapture: null };
    const load = async () => {
      loads++;
      return b.content;
    };
    await assert.rejects(
      prepareDocumentSelection({ ...before, pending: [1] }, b.document.id, load, () => true),
      /Finish or cancel/,
    );
    await assert.rejects(
      prepareDocumentSelection(
        { ...before, calibrationCapture: {} },
        b.document.id,
        load,
        () => true,
      ),
      /Finish or cancel/,
    );
    assert.equal(loads, 0);
    await assert.rejects(
      prepareDocumentSelection(before, b.document.id, load, () => false),
      /workbench changed/,
    );
    assert.equal(loads, 1);
    assert.equal(before.job.activeDocumentId, a.document.id);
  });
  it("rejects source/page corruption in active annotations and archived workspaces", () => {
    const job = evidence(initial(), "a");
    assert.equal(fencingJobSchema.safeParse({ ...job, activeSheet: 3 }).success, false);
    assert.equal(
      fencingJobSchema.safeParse({
        ...job,
        annotations: [{ ...job.annotations![0], sourceSha256: null }],
      }).success,
      false,
    );
    const archived = restoreDocumentWorkspace(captureDocumentWorkspace(job, 2), b.document);
    archived.documentWorkspaces![a.document.id].sourceSha256 = "f".repeat(64);
    assert.equal(fencingJobSchema.safeParse(archived).success, false);
  });
  it("persists actual store sketch/area commits, deletion, components and page selection with exact source points", () => {
    const job = initial();
    job.calibrations = [0, 1, 2].map((sheet) => ({
      ...createUnverifiedCalibration(sheet),
      coordinateSpace: "source-page-v1" as const,
    }));
    useStudio.setState({
      job,
      sheet: 2,
      currentCalibration: job.calibrations[2],
      pending: [],
      calibrationCapture: null,
      markups: [],
      trades: [],
      selectedRunId: null,
      tool: "none",
    });
    useStudio
      .getState()
      .ingestCalibrationCandidate({
        id: "source-scale",
        source: "declared",
        metresPerUnit: 0.01,
        confidence: 0.95,
        provenance: { method: "test", evidence: "Explicit scale", documentId: a.document.id },
      });
    useStudio.getState().lockCurrentCalibration();
    const points = [
      { x: 110.125, y: 223.75 },
      { x: 163.5, y: 247.125 },
      { x: 154.75, y: 290.5 },
    ];
    for (const tool of ["sketch", "area"] as const) {
      useStudio.getState().setTool(tool);
      points.forEach((point) => useStudio.getState().addPoint(point));
      useStudio.getState().commitPending();
    }
    useStudio.getState().addTrade("Custom windows");
    useStudio.getState().setSheet(1);
    const saved = reload(useStudio.getState().job);
    assert.equal(saved.annotations?.length, 2);
    assert.deepEqual(saved.annotations![0].points, points);
    assert.equal(saved.annotations![1].unit, "m\u00b2");
    assert.equal(saved.activeSheet, 1);
    assert.equal(saved.componentRegistry![0].name, "Custom windows");
    for (const annotation of saved.annotations!) useStudio.getState().removeMarkup(annotation.id);
    assert.deepEqual(reload(useStudio.getState().job).annotations, []);
    assert.deepEqual(parseFencingJob(JSON.stringify(saved)).annotations, saved.annotations);
  });
});
