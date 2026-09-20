import assert from "node:assert/strict";
import { test } from "node:test";
import { createTwoPointCalibrationCandidate, documentPointToCanvas, lockCalibration } from "./calibration.ts";
import { createDefaultJob, sourceAnnotationSchema, sourceAreaMeasurementSchema, type SourceAreaMeasurement } from "./domain.ts";
import { measureSourceArea } from "./sourceAreaMeasurement.ts";

type Point = { x: number; y: number };
const rectangle = (x: number, y: number, width: number, height: number): Point[] =>
  [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }];

function fixture(entityType: SourceAreaMeasurement["entityType"] = "room-area") {
  const job = createDefaultJob("2026-09-20T00:00:00.000Z");
  job.documents = [{ id: "area-source", name: "Area source.svg", kind: "svg", importedAt: job.createdAt,
    pageCount: 2, sha256: "a".repeat(64), source: "web" }];
  job.activeDocumentId = "area-source";
  const candidate = createTwoPointCalibrationCandidate({
    id: "area-scale", source: "manual", points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
    distance: { value: 10, unit: "m" }, transform: job.calibrations[0].transform, confidence: 1,
    provenance: { method: "two-point", evidence: "Source dimension 10 metres", documentId: "area-source" },
  });
  job.calibrations = [lockCalibration({ ...job.calibrations[0], coordinateSpace: "source-page-v1", candidates: [candidate] })];
  const annotation = sourceAnnotationSchema.parse({
    id: "area-1", kind: "area", label: "Measured source area", value: 999999, unit: "cached",
    sheet: 0, points: rectangle(0, 0, 100, 100), documentId: "area-source", sourceSha256: "a".repeat(64),
    coordinateSpace: "source-page-v1", measurement: { entityType, revision: 1, holes: [], roofSlope: entityType === "room-area" ? null : {
      pitchDegrees: 60, azimuthDegrees: 90, source: { documentId: "area-source", sourceSha256: "a".repeat(64), sheet: 0, reference: "Roof section A: 60 degree pitch" },
    } },
  });
  job.annotations = [annotation];
  return { job, annotation };
}

test("source area schema preserves unclassified legacy annotations and rejects undeclared metadata", () => {
  const { annotation } = fixture();
  const { measurement, ...legacy } = annotation;
  assert.equal(sourceAnnotationSchema.parse(legacy).measurement, undefined);
  assert.equal(sourceAreaMeasurementSchema.safeParse({ ...measurement, verified: true }).success, false);
  assert.equal(sourceAreaMeasurementSchema.safeParse({ ...measurement, revision: 0 }).success, false);
  assert.equal(sourceAreaMeasurementSchema.safeParse({ ...measurement, holes: [[{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1, stale: true }]] }).success, false);
  assert.equal(sourceAreaMeasurementSchema.safeParse({ ...measurement, roofSlope: fixture("roof-plane").annotation.measurement!.roofSlope }).success, false);
});

test("roof metadata schema rejects invalid slope, azimuth, source references and unexpected keys", () => {
  const basis = fixture("roof-plane").annotation.measurement!, slope = basis.roofSlope!;
  for (const pitchDegrees of [-1, 90, Infinity, NaN]) {
    assert.equal(sourceAreaMeasurementSchema.safeParse({ ...basis, roofSlope: { ...slope, pitchDegrees } }).success, false);
  }
  for (const azimuthDegrees of [-1, 360, Infinity, NaN]) {
    assert.equal(sourceAreaMeasurementSchema.safeParse({ ...basis, roofSlope: { ...slope, azimuthDegrees } }).success, false);
  }
  for (const source of [{ ...slope.source, reference: "  " }, { ...slope.source, sourceSha256: "bad" },
    { ...slope.source, sheet: -1 }, { ...slope.source, inferred: true }]) {
    assert.equal(sourceAreaMeasurementSchema.safeParse({ ...basis, roofSlope: { ...slope, source } }).success, false);
  }
  assert.equal(sourceAreaMeasurementSchema.safeParse({ ...basis, roofSlope: { ...slope, verified: true } }).success, false);
});

test("room measurement derives net calibrated polygon area and deducts every hole once, ignoring all cached values", () => {
  const { job, annotation } = fixture();
  annotation.measurement!.holes = [rectangle(10, 10, 20, 20), rectangle(60, 60, 10, 10)];
  const before = structuredClone(job), measured = measureSourceArea(job, annotation, true);
  assert.equal(measured.value, 95);
  assert.equal(measured.projectedAreaM2, measured.value);
  assert.equal(measured.unit, "m²");
  assert.equal(measured.reason, null);
  assert.match(measured.formula, /holes 500/);
  assert.deepEqual(job, before);
  annotation.value = 0;
  annotation.unit = "acres";
  assert.deepEqual(measureSourceArea(job, annotation, true), measured);
});

test("room area accepts concave simple boundaries, either winding and an explicit closing point", () => {
  const { job, annotation } = fixture();
  annotation.points = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 20 }, { x: 20, y: 20 }, { x: 20, y: 40 }, { x: 0, y: 40 }];
  const expected = 12;
  assert.equal(measureSourceArea(job, annotation, true).value, expected);
  annotation.points.reverse();
  annotation.points.push({ ...annotation.points[0] });
  assert.equal(measureSourceArea(job, annotation, true).value, expected);
});

test("source area applies the calibrated inverse affine page transform rather than viewport area", () => {
  const { job, annotation } = fixture();
  const transform = { a: 2, b: 1, c: 0.5, d: 3, e: 400, f: -75 };
  annotation.points = annotation.points.map(point => documentPointToCanvas(point, transform));
  annotation.measurement!.holes = [rectangle(20, 20, 10, 10).map(point => documentPointToCanvas(point, transform))];
  const calibration = job.calibrations[0];
  const candidate = createTwoPointCalibrationCandidate({
    id: "transformed", source: "manual", points: [documentPointToCanvas({ x: 0, y: 0 }, transform), documentPointToCanvas({ x: 100, y: 0 }, transform)],
    distance: { value: 10, unit: "m" }, transform, confidence: 1, provenance: calibration.candidates[0].provenance,
  });
  job.calibrations = [lockCalibration({ ...calibration, transform, candidates: [candidate], selectedCandidateId: null })];
  assert.equal(measureSourceArea(job, annotation, true).value, 99);
});

test("source area retains sub-display precision without rounding and is stable under large page offsets", () => {
  const { job, annotation } = fixture();
  annotation.points = rectangle(0, 0, 0.0001, 0.0001);
  const measured = measureSourceArea(job, annotation, true);
  assert.equal(measured.value, (0.0001 * 0.1) ** 2);
  assert.ok(measured.value! > 0 && measured.value! < 1e-9);
  annotation.points = rectangle(1e9, -1e9, 100, 100);
  assert.equal(measureSourceArea(job, annotation, true).value, 100);
});

for (const [name, points] of [
  ["self-crossing bow tie", [{ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }, { x: 100, y: 0 }]],
  ["nonzero-area crossing", [{ x: 0, y: 0 }, { x: 100, y: 80 }, { x: 0, y: 100 }, { x: 80, y: 0 }]],
  ["zero-length edge", [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 100 }]],
  ["collinear degenerate ring", [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }]],
  ["adjacent backtracking edge", [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]],
  ["non-finite coordinate", [{ x: 0, y: 0 }, { x: Infinity, y: 0 }, { x: 0, y: 100 }]],
] as const) {
  test(`source area rejects ${name}`, () => {
    const { job, annotation } = fixture();
    annotation.points = points.map(point => ({ ...point }));
    assert.equal(measureSourceArea(job, annotation, true).value, null);
  });
}

for (const [name, holes] of [
  ["outside hole", [rectangle(110, 10, 10, 10)]],
  ["hole crossing the boundary", [rectangle(90, 10, 20, 10)]],
  ["hole touching the boundary", [rectangle(0, 10, 10, 10)]],
  ["overlapping holes", [rectangle(10, 10, 30, 30), rectangle(20, 20, 30, 30)]],
  ["duplicate holes", [rectangle(10, 10, 30, 30), rectangle(10, 10, 30, 30)]],
  ["nested holes", [rectangle(10, 10, 40, 40), rectangle(20, 20, 10, 10)]],
  ["touching holes", [rectangle(10, 10, 10, 10), rectangle(20, 10, 10, 10)]],
  ["self-crossing hole", [[{ x: 10, y: 10 }, { x: 40, y: 40 }, { x: 10, y: 40 }, { x: 40, y: 10 }]]],
] as const) {
  test(`source area refuses a deduction for ${name}`, () => {
    const { job, annotation } = fixture();
    annotation.measurement!.holes = holes.map(hole => hole.map(point => ({ ...point })));
    assert.equal(measureSourceArea(job, annotation, true).value, null);
  });
}

type Fixture = ReturnType<typeof fixture>;
for (const [name, mutate] of [
  ["sample source", ({ job }: Fixture) => { job.documents[0].source = "sample"; }],
  ["missing source hash", ({ job }: Fixture) => { job.documents[0].sha256 = null; }],
  ["foreign annotation document", ({ annotation }: Fixture) => { annotation.documentId = "other"; }],
  ["stale annotation source hash", ({ annotation }: Fixture) => { annotation.sourceSha256 = "b".repeat(64); }],
  ["legacy annotation coordinates", ({ annotation }: Fixture) => { annotation.coordinateSpace = "legacy-unverified"; }],
  ["wrong page", ({ annotation }: Fixture) => { annotation.sheet = 2; }],
  ["no page calibration", ({ annotation }: Fixture) => { annotation.sheet = 1; }],
  ["unlocked calibration", ({ job }: Fixture) => { job.calibrations[0].locked = false; }],
  ["legacy calibration coordinates", ({ job }: Fixture) => { job.calibrations[0].coordinateSpace = undefined; }],
  ["foreign candidate", ({ job }: Fixture) => { job.calibrations[0].candidates[0].provenance.documentId = "other"; }],
  ["inferred candidate", ({ job }: Fixture) => { job.calibrations[0].source = "inferred"; job.calibrations[0].candidates[0].source = "inferred"; }],
  ["changed scale", ({ job }: Fixture) => { job.calibrations[0].metresPerUnit = 0.2; }],
  ["changed calibration points", ({ job }: Fixture) => { job.calibrations[0].points = [{ x: 0, y: 0 }, { x: 20, y: 0 }]; }],
  ["changed affine transform", ({ job }: Fixture) => { job.calibrations[0].transform.a = 2; }],
  ["duplicate calibration", ({ job }: Fixture) => { job.calibrations.push(structuredClone(job.calibrations[0])); }],
  ["duplicate entity identity", ({ job, annotation }: Fixture) => { job.annotations!.push(structuredClone(annotation)); }],
  ["unclassified legacy area", ({ annotation }: Fixture) => { delete annotation.measurement; }],
  ["sketch promoted as area", ({ annotation }: Fixture) => { annotation.kind = "sketch"; }],
] as const) {
  test(`source area withholds authority for ${name}`, () => {
    const data = fixture(); mutate(data);
    assert.equal(measureSourceArea(data.job, data.annotation, true).value, null);
  });
}

test("source area requires verified original-byte readiness and never simplifies oversized boundaries", () => {
  const { job, annotation } = fixture();
  assert.equal(measureSourceArea(job, annotation, false).value, null);
  annotation.points = Array.from({ length: 4097 }, (_, i) => ({ x: Math.cos(i * 2 * Math.PI / 4097), y: Math.sin(i * 2 * Math.PI / 4097) }));
  assert.match(measureSourceArea(job, annotation, true).reason!, /4096-vertex/);
});

test("roof quantity distinguishes net projected area from true sloped area and accepts explicit zero pitch", () => {
  const { job, annotation } = fixture("roof-plane");
  annotation.measurement!.holes = [rectangle(10, 10, 20, 20)];
  const measured = measureSourceArea(job, annotation, true);
  assert.equal(measured.projectedAreaM2, 96);
  assert.equal(measured.value, measured.projectedAreaM2! / Math.cos(Math.PI / 3));
  assert.match(measured.formula, /cos\(60°\)/);
  annotation.measurement!.roofSlope!.pitchDegrees = 0;
  const flat = measureSourceArea(job, annotation, true);
  assert.equal(flat.value, flat.projectedAreaM2);
});

for (const [name, mutate] of [
  ["missing slope", ({ annotation }: Fixture) => { annotation.measurement!.roofSlope = null; }],
  ["foreign slope document", ({ annotation }: Fixture) => { annotation.measurement!.roofSlope!.source.documentId = "other"; }],
  ["stale slope revision hash", ({ annotation }: Fixture) => { annotation.measurement!.roofSlope!.source.sourceSha256 = "b".repeat(64); }],
  ["different slope sheet", ({ annotation }: Fixture) => { annotation.measurement!.roofSlope!.source.sheet = 1; }],
] as const) {
  test(`roof exposes projected area but withholds true area for ${name}`, () => {
    const data = fixture("roof-plane"); mutate(data);
    const measured = measureSourceArea(data.job, data.annotation, true);
    assert.equal(measured.value, null);
    assert.equal(measured.projectedAreaM2, 100);
    assert.ok(measured.reason);
  });
}

test("roof rejects invalid runtime slope metadata without falling back to the typed area value", () => {
  const { job, annotation } = fixture("roof-plane");
  annotation.measurement!.roofSlope!.pitchDegrees = 90;
  assert.equal(measureSourceArea(job, annotation, true).value, null);
});
