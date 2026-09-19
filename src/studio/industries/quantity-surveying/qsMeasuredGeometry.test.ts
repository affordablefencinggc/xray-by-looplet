import assert from "node:assert/strict";
import { test } from "node:test";
import { createDefaultJob, createRunSpecification } from "../../domain.ts";
import { createTwoPointCalibrationCandidate, lockCalibration } from "../../calibration.ts";
import { qsMeasuredGeometry } from "./qsMeasuredGeometry.ts";

function fixture() {
  const job = createDefaultJob("2026-09-19T00:00:00.000Z");
  job.documents = [{ id: "qs-source", name: "Controlled source.svg", kind: "svg", importedAt: job.createdAt,
    pageCount: 1, sha256: "a".repeat(64), source: "web" }];
  job.activeDocumentId = "qs-source";
  const candidate = createTwoPointCalibrationCandidate({
    id: "qs-scale", source: "manual", points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
    distance: { value: 10, unit: "m" }, transform: job.calibrations[0].transform, confidence: 1,
    provenance: { method: "two-point", evidence: "Controlled 10 metre reference", documentId: "qs-source" },
  });
  job.calibrations = [lockCalibration({ ...job.calibrations[0], coordinateSpace: "source-page-v1", candidates: [candidate] })];
  job.runs = [{
    id: "qs-wall", revision: 4, sheet: 0, label: "Measured wall", points: [{ x: 0, y: 0 }, { x: 50, y: 0 }],
    lengthM: 999, grossLengthM: 998, netLengthM: 997, photoIds: [],
    review: { status: "needs-review", decidedBy: "", decidedAt: null, note: "" },
    specification: { ...createRunSpecification(), constructionEnabled: true,
      construction: { assembly: "wall", trade: "General construction", quantity: "length", widthM: null, depthM: null, reference: "Controlled wall run" } },
  }];
  return job;
}

test("QS measured geometry derives gross length from calibrated points, never cached lengths", () => {
  const job = fixture(), before = structuredClone(job);
  const [entity] = qsMeasuredGeometry(job, 0, true);
  assert.equal(entity.measuredQuantity, "5");
  assert.equal(entity.unit, "m");
  assert.equal(entity.entityType, "wall-run");
  assert.equal(entity.entityId, job.runs[0].id);
  assert.equal(entity.sourceSha256, job.documents[0].sha256);
  assert.equal(entity.calibrationId, "cal:0:manual:0.1:qs-scale");
  assert.match(entity.label, /gross geometry/);
  assert.deepEqual(job, before, "deriving the live evidence does not change its source records");
});

test("QS measured geometry updates the quantity and unit for real section dimensions", () => {
  const job = fixture(), spec = job.runs[0].specification.construction!;
  spec.quantity = "area"; spec.widthM = 2;
  assert.equal(qsMeasuredGeometry(job, 0, true)[0].measuredQuantity, "10");
  assert.equal(qsMeasuredGeometry(job, 0, true)[0].unit, "m²");
  spec.quantity = "volume"; spec.depthM = 0.2; spec.assembly = "slab";
  const [slab] = qsMeasuredGeometry(job, 0, true);
  assert.equal(slab.measuredQuantity, "2");
  assert.equal(slab.unit, "m³");
  assert.equal(slab.entityType, "construction-run", "a slab strip is not labelled as a wall or room");
  spec.depthM = 0.3;
  assert.equal(qsMeasuredGeometry(job, 0, true)[0].measuredQuantity, "3");
  spec.quantity = "length"; spec.assembly = "conduit";
  assert.equal(qsMeasuredGeometry(job, 0, true)[0].entityType, "duct-run");
});

test("QS measured geometry retains small quantities without display rounding to zero", () => {
  const job = fixture(), spec = job.runs[0].specification.construction!;
  job.runs[0].points[1].x = 0.01;
  spec.quantity = "volume"; spec.widthM = 0.001; spec.depthM = 0.001;
  const [entity] = qsMeasuredGeometry(job, 0, true);
  assert.equal(Number(entity.measuredQuantity), 1e-9);
  assert.match(entity.measuredQuantity, /^0\.0+1$/);
  assert.doesNotMatch(entity.measuredQuantity, /e/i);
});

for (const [name, mutate] of [
  ["sample source", (job: ReturnType<typeof fixture>) => { job.documents[0].source = "sample"; }],
  ["missing source hash", (job: ReturnType<typeof fixture>) => { job.documents[0].sha256 = null; }],
  ["missing active source", (job: ReturnType<typeof fixture>) => { job.activeDocumentId = "absent"; }],
  ["foreign calibration candidate", (job: ReturnType<typeof fixture>) => { job.calibrations[0].candidates[0].provenance.documentId = "foreign-source"; }],
  ["legacy source coordinates", (job: ReturnType<typeof fixture>) => { job.calibrations[0].coordinateSpace = undefined; }],
  ["scale changed behind its candidate", (job: ReturnType<typeof fixture>) => { job.calibrations[0].metresPerUnit = 0.2; }],
  ["unlocked calibration", (job: ReturnType<typeof fixture>) => { job.calibrations[0].locked = false; }],
  ["missing section dimensions", (job: ReturnType<typeof fixture>) => { job.runs[0].specification.construction!.quantity = "area"; }],
] as const) {
  test(`QS measured geometry strips verification authority for ${name}`, () => {
    const job = fixture(); mutate(job);
    const [entity] = qsMeasuredGeometry(job, 0, true);
    assert.equal(entity.entityId, job.runs[0].id, "invalid geometry remains inspectable");
    assert.equal(entity.calibrationId, null);
    assert.equal(entity.sourceSha256, null);
    assert.match(entity.label, /unverified:/);
  });
}

test("QS measured geometry requires original-byte readiness and uses only the requested sheet", () => {
  const job = fixture();
  const [unready] = qsMeasuredGeometry(job, 0, false);
  assert.equal(unready.calibrationId, null);
  assert.equal(unready.sourceSha256, null);
  assert.match(unready.label, /Verify the original source drawing/);
  assert.deepEqual(qsMeasuredGeometry(job, 1, true), []);
});
