import assert from "node:assert/strict";
import { test } from "node:test";
import { createDefaultJob, type SourceAreaMeasurement } from "./domain.ts";
import { createTwoPointCalibrationCandidate, lockCalibration } from "./calibration.ts";
import { changeSourceArea } from "./sourceAreaChanges.ts";
import { qsMeasuredGeometry } from "./industries/quantity-surveying/qsMeasuredGeometry.ts";

function fixture() {
  const job = createDefaultJob("2026-09-20T00:00:00.000Z");
  job.documents = [{ id: "area-source", name: "Room and roof.svg", kind: "svg", source: "web", sha256: "a".repeat(64), importedAt: job.createdAt, pageCount: 1 }];
  job.activeDocumentId = "area-source";
  const base = job.calibrations[0];
  const candidate = createTwoPointCalibrationCandidate({ id: "area-scale", source: "manual", points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
    distance: { value: 10, unit: "m" }, transform: base.transform, confidence: 1,
    provenance: { method: "two-point", evidence: "10 metre source dimension", documentId: "area-source" } });
  job.calibrations = [lockCalibration({ ...base, coordinateSpace: "source-page-v1", candidates: [candidate] })];
  job.runs = [];
  job.annotations = [{ id: "room", kind: "area", label: "Traced polygon", value: 999, unit: "m²", sheet: 0,
    points: [{ x: 10, y: 10 }, { x: 50, y: 10 }, { x: 50, y: 50 }, { x: 10, y: 50 }],
    documentId: "area-source", sourceSha256: "a".repeat(64), coordinateSpace: "source-page-v1" }];
  return job;
}
const room: SourceAreaMeasurement = { entityType: "room-area", revision: 1, holes: [], roofSlope: null };

test("source area classification is explicit, revisioned, immutable, and geometry-derived", () => {
  const original = fixture(), before = JSON.stringify(original);
  assert.deepEqual(qsMeasuredGeometry(original, 0, true), []);
  const next = changeSourceArea(original, "room", 0, { kind: "basis", label: "Measured room", measurement: room });
  assert.equal(JSON.stringify(original), before);
  assert.equal(next.annotations![0].measurement?.revision, 1);
  assert.ok(Math.abs(next.annotations![0].value - 16) < 1e-12);
  assert.equal(qsMeasuredGeometry(next, 0, true)[0].measuredQuantity, String(next.annotations![0].value));
  assert.equal(next.revision, original.revision + 1);
  assert.match(next.revisionHistory.at(-1)?.summary ?? "", /explicit review/);
});

test("source area vertex edit changes only its entity and leaves invalid geometry visibly unverified", () => {
  let job = changeSourceArea(fixture(), "room", 0, { kind: "basis", label: "Measured room", measurement: room });
  job.annotations!.push({ ...structuredClone(job.annotations![0]), id: "untouched" });
  const untouched = JSON.stringify(job.annotations![1]);
  job = changeSourceArea(job, "room", 1, { kind: "vertex", ringIndex: 0, vertexIndex: 1, point: { x: 60, y: 10 } });
  assert.ok(Math.abs(Number(qsMeasuredGeometry(job, 0, true)[0].measuredQuantity) - 18) < 1e-12);
  assert.equal(job.annotations![0].measurement?.revision, 2);
  assert.equal(JSON.stringify(job.annotations![1]), untouched);
  job = changeSourceArea(job, "room", 2, { kind: "vertex", ringIndex: 0, vertexIndex: 1, point: { x: 10, y: 50 } });
  assert.equal(job.annotations![0].measurement?.revision, 3);
  assert.equal(qsMeasuredGeometry(job, 0, true)[0].calibrationId, null);
});

test("source area changes refuse stale gestures, foreign source, unlocked scale and invalid vertices", () => {
  const job = changeSourceArea(fixture(), "room", 0, { kind: "basis", label: "Room", measurement: room });
  const move = { kind: "vertex" as const, ringIndex: 0, vertexIndex: 1, point: { x: 60, y: 10 } };
  assert.throws(() => changeSourceArea(job, "room", 0, move), /changed/);
  for (const mutate of [
    (value: typeof job) => { value.documents[0].sha256 = "b".repeat(64); },
    (value: typeof job) => { value.documents[0].source = "sample"; },
    (value: typeof job) => { value.calibrations[0].locked = false; },
  ]) {
    const other = structuredClone(job); mutate(other); const before = JSON.stringify(other);
    assert.throws(() => changeSourceArea(other, "room", 1, move));
    assert.equal(JSON.stringify(other), before);
  }
  assert.throws(() => changeSourceArea(job, "room", 1, { ...move, ringIndex: -1 }), /valid/);
  assert.throws(() => changeSourceArea(job, "room", 1, { ...move, vertexIndex: 999 }), /no longer exists/);
  assert.throws(() => changeSourceArea(job, "room", 1, { ...move, point: { x: NaN, y: 10 } }), /valid/);
});

test("roof basis remains unknown without explicit slope and source; later pitch changes are revisioned", () => {
  let job = changeSourceArea(fixture(), "room", 0, { kind: "basis", label: "Roof", measurement: { ...room, entityType: "roof-plane" } });
  assert.equal(qsMeasuredGeometry(job, 0, true)[0].calibrationId, null);
  const slope = { pitchDegrees: 60, azimuthDegrees: 0, source: { documentId: "area-source", sourceSha256: "a".repeat(64), sheet: 0, reference: "Section A: 60 degree roof rises up page" } };
  job = changeSourceArea(job, "room", 1, { kind: "basis", label: "Roof", measurement: { ...room, entityType: "roof-plane", roofSlope: slope } });
  const roof = qsMeasuredGeometry(job, 0, true)[0];
  assert.ok(Math.abs(Number(roof.measuredQuantity) - 32) < 1e-12);
  assert.notEqual(roof.calibrationId, null);
  assert.equal(job.annotations![0].measurement?.revision, 2);
  assert.equal(roof.areaGeometry?.basis.roofSlope?.source.reference, slope.source.reference);
});
