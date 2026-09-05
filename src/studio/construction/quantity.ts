import {
  constructionJobSchema,
  quantityResultSchema,
  QUANTITY_RESULT_SCHEMA,
  QUANTITY_RULESET,
  METRES_PER_UNIT,
} from "./contract.ts";
import type { ConstructionJob, Measurement, QuantityResult } from "./contract.ts";

type Point = { x: number; y: number };
function bounded(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER)
    throw new Error("Quantity is outside the finite supported range.");
  return value === 0 ? 0 : value;
}
function cross(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}
function onSegment(a: Point, b: Point, c: Point): boolean {
  return (
    cross(a, b, c) === 0 &&
    c.x >= Math.min(a.x, b.x) &&
    c.x <= Math.max(a.x, b.x) &&
    c.y >= Math.min(a.y, b.y) &&
    c.y <= Math.max(a.y, b.y)
  );
}
function intersects(a: Point, b: Point, c: Point, d: Point): boolean {
  const abC = cross(a, b, c),
    abD = cross(a, b, d),
    cdA = cross(c, d, a),
    cdB = cross(c, d, b);
  return (
    (Math.sign(abC) !== Math.sign(abD) &&
      Math.sign(cdA) !== Math.sign(cdB) &&
      abC !== 0 &&
      abD !== 0 &&
      cdA !== 0 &&
      cdB !== 0) ||
    onSegment(a, b, c) ||
    onSegment(a, b, d) ||
    onSegment(c, d, a) ||
    onSegment(c, d, b)
  );
}
function polygonArea(points: Point[]): number {
  // Contract uses an implicitly closed simple polygon, with distinct vertices and no holes.
  if (new Set(points.map((point) => JSON.stringify([point.x, point.y]))).size !== points.length)
    throw new Error("Polygon vertices must be distinct; do not repeat its closing vertex.");
  for (let i = 0; i < points.length; i++) {
    const previous = points[(i + points.length - 1) % points.length],
      current = points[i],
      next = points[(i + 1) % points.length];
    if (
      cross(previous, current, next) === 0 &&
      (current.x - previous.x) * (next.x - current.x) +
        (current.y - previous.y) * (next.y - current.y) <=
        0
    )
      throw new Error("Polygon edges overlap or reverse.");
    for (let j = i + 1; j < points.length; j++) {
      if (j === i + 1 || (i === 0 && j === points.length - 1)) continue;
      if (intersects(current, next, points[j], points[(j + 1) % points.length]))
        throw new Error("Self-intersecting polygon is not supported.");
    }
  }
  // Translate to the first vertex to reduce cancellation for large drawing offsets.
  let twiceArea = 0;
  for (let i = 1; i < points.length - 1; i++)
    twiceArea += cross(points[0], points[i], points[i + 1]);
  const area = bounded(Math.abs(twiceArea) / 2);
  if (area === 0) throw new Error("Polygon area must be positive.");
  return area;
}
function calculate(
  job: ConstructionJob,
  measurement: Measurement,
  resultId: string,
): QuantityResult {
  if (measurement.review.status !== "approved")
    throw new Error("Measurement must have revision-bound approval before quantity verification.");
  const evidenceIds = new Set(measurement.evidenceIds);
  measurement.deductions.forEach((entry) => entry.evidenceIds.forEach((id) => evidenceIds.add(id)));
  const calibrationId =
    measurement.kind === "length" || measurement.kind === "area"
      ? measurement.calibrationId
      : measurement.kind === "volume" && measurement.basis.method === "area-depth"
        ? measurement.basis.calibrationId
        : null;
  const calibrations = calibrationId
    ? [job.calibrations.find((entry) => entry.id === calibrationId)!]
    : [];
  calibrations.forEach((entry) => entry.evidenceIds.forEach((id) => evidenceIds.add(id)));
  const scale = calibrations[0]?.metresPerCoordinateUnit;
  let gross: number;
  let unit: QuantityResult["unit"];
  switch (measurement.kind) {
    case "count":
      measurement.items.forEach((entry) => entry.evidenceIds.forEach((id) => evidenceIds.add(id)));
      gross = measurement.items.length;
      unit = "ea";
      break;
    case "length":
      gross =
        measurement.points.slice(1).reduce((sum, point, index) => {
          const previous = measurement.points[index];
          const length = Math.hypot(point.x - previous.x, point.y - previous.y);
          if (length === 0) throw new Error("Length segments must be nonzero.");
          return sum + length;
        }, 0) * scale!;
      unit = "m";
      break;
    case "area":
      gross = polygonArea(measurement.points) * scale! ** 2;
      unit = "m2";
      break;
    case "volume": {
      const basis = measurement.basis;
      if (basis.method === "area-depth") {
        basis.depth.evidenceIds.forEach((id) => evidenceIds.add(id));
        gross =
          polygonArea(basis.points) *
          scale! ** 2 *
          basis.depth.value *
          METRES_PER_UNIT[basis.depth.unit];
      } else {
        basis.evidenceIds.forEach((id) => evidenceIds.add(id));
        gross = basis.value * { mm3: 1e-9, m3: 1, ft3: 0.028316846592 }[basis.unit];
      }
      unit = "m3";
      break;
    }
  }
  gross = bounded(gross);
  if (measurement.kind !== "count" && gross === 0)
    throw new Error("Positive geometry underflows the supported quantity range.");
  const deduction = bounded(measurement.deductions.reduce((sum, entry) => sum + entry.value, 0));
  if (deduction > gross) throw new Error("Deductions exceed gross quantity.");
  const evidence = job.evidence
    .filter((entry) => evidenceIds.has(entry.id))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const sourceIds = new Set([
    measurement.locator.sourceRevisionId,
    ...evidence.map((entry) => entry.locator.sourceRevisionId),
    ...calibrations.map((entry) => entry.locator.sourceRevisionId),
  ]);
  const sources = job.sources
    .filter((entry) => sourceIds.has(entry.id))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return quantityResultSchema.parse({
    schema: QUANTITY_RESULT_SCHEMA,
    ruleset: QUANTITY_RULESET,
    id: resultId,
    jobId: job.id,
    jobRevision: job.revision,
    workPackage: job.workPackages.find((entry) => entry.id === measurement.workPackageId)!,
    measurement,
    gross,
    deduction,
    net: bounded(gross - deduction),
    unit,
    sources,
    evidence,
    calibrations,
  });
}
/** Pure, input-validating calculation. No IDs, timestamps, rounding, waste, pack rules or rates are invented. */
export function calculateQuantity(
  input: unknown,
  measurementId: string,
  resultId: string,
): QuantityResult {
  const job = constructionJobSchema.parse(input);
  const measurement = job.measurements.find((entry) => entry.id === measurementId);
  if (!measurement) throw new Error(`Unknown measurement ${measurementId}.`);
  return calculate(job, measurement, resultId);
}
/** Validate untrusted results by recomputing their operands and complete evidence closure. */
export function parseQuantityResult(input: unknown): QuantityResult {
  const result = quantityResultSchema.parse(input);
  const time = "1970-01-01T00:00:00.000Z";
  const reconstructed = calculateQuantity(
    {
      schema: "xray.construction-job/v1",
      id: result.jobId,
      revision: result.jobRevision,
      name: "Quantity validation",
      createdAt: time,
      updatedAt: time,
      workPackages: [result.workPackage],
      sources: result.sources,
      evidence: result.evidence,
      calibrations: result.calibrations,
      measurements: [result.measurement],
      extensions: {},
    },
    result.measurement.id,
    result.id,
  );
  if (JSON.stringify(result) !== JSON.stringify(reconstructed))
    throw new Error("Quantity result differs from recomputed operands or provenance.");
  return result;
}

/** Store/export boundary: reject an internally consistent but stale or independently altered snapshot. */
export function validateQuantityAgainstJob(input: unknown, currentJob: unknown): QuantityResult {
  const result = parseQuantityResult(input);
  const current = calculateQuantity(currentJob, result.measurement.id, result.id);
  if (JSON.stringify(result) !== JSON.stringify(current))
    throw new Error("Quantity does not match the current job revision and provenance.");
  return result;
}
