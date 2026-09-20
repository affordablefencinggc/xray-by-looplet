import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { createDefaultJob, fencingJobSchema } from "./domain.ts";
import { createTwoPointCalibrationCandidate, lockCalibration } from "./calibration.ts";
import { useStudio } from "./store.ts";

beforeEach(() => {
  const job = createDefaultJob("2026-09-20T00:00:00.000Z");
  job.documents = [{ id: "original", name: "Area.svg", kind: "svg", source: "web", sha256: "a".repeat(64), pageCount: 1, importedAt: job.createdAt }];
  job.activeDocumentId = "original";
  const base = job.calibrations[0];
  const candidate = createTwoPointCalibrationCandidate({ id: "dimension", source: "manual", points: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
    distance: { value: 10, unit: "m" }, transform: base.transform, confidence: 1, provenance: { method: "two-point", evidence: "10 metre drawing reference", documentId: "original" } });
  job.calibrations = [lockCalibration({ ...base, coordinateSpace: "source-page-v1", candidates: [candidate] })];
  job.annotations = [{ id: "room", kind: "area", label: "Room", value: 4, unit: "m²", sheet: 0, documentId: "original", sourceSha256: "a".repeat(64), coordinateSpace: "source-page-v1",
    points: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }], measurement: { entityType: "room-area", revision: 1, holes: [], roofSlope: null } }];
  useStudio.setState({ job, sheet: 0, currentCalibration: job.calibrations[0], tool: "none", pending: [], markups: job.annotations,
    selectedRunId: null, selectedAreaId: null, selectedVertexIndex: null, selectedGateId: null, traceError: null,
    persistenceHydrated: true, persistenceRecoveryBlocked: false, projectWriteStale: false,
    assetReadiness: { document: { state: "ready", message: null }, photos: {} },
    activePlanBinary: { documentId: "original", name: "Area.svg", kind: "svg", sha256: "a".repeat(64), mimeType: "image/svg+xml", sizeBytes: 0, bytes: new Uint8Array() },
  });
});
const change = { kind: "vertex" as const, ringIndex: 0, vertexIndex: 1, point: { x: 3, y: 0 } };

test("source-area store selection does not edit evidence and polygon release is revisioned", () => {
  const before = JSON.stringify(useStudio.getState().job);
  useStudio.getState().selectSourceArea("room");
  assert.equal(useStudio.getState().selectedAreaId, "room");
  assert.equal(JSON.stringify(useStudio.getState().job), before);
  assert.equal(useStudio.getState().updateSourceArea("room", 1, change), true);
  const state = useStudio.getState();
  assert.equal(state.job.annotations![0].measurement?.revision, 2);
  assert.equal(state.markups[0].value, 5);
  assert.deepEqual(fencingJobSchema.parse(JSON.parse(JSON.stringify(state.job))).annotations, state.job.annotations);
  useStudio.getState().selectRun(null);
  assert.equal(useStudio.getState().selectedAreaId, null);
});

for (const flag of ["persistenceRecoveryBlocked", "projectWriteStale"] as const) test(`source-area store refuses ${flag}`, () => {
  useStudio.setState({ [flag]: true });
  const before = JSON.stringify(useStudio.getState().job);
  assert.equal(useStudio.getState().updateSourceArea("room", 1, change), false);
  assert.equal(JSON.stringify(useStudio.getState().job), before);
});

test("source-area store refuses unavailable bytes and stale gestures without altering records", () => {
  const before = JSON.stringify(useStudio.getState().job);
  assert.equal(useStudio.getState().updateSourceArea("room", 0, change), false);
  useStudio.setState({ activePlanBinary: null });
  assert.equal(useStudio.getState().updateSourceArea("room", 1, change), false);
  assert.equal(JSON.stringify(useStudio.getState().job), before);
  assert.match(useStudio.getState().traceError ?? "", /original source bytes/);
});
