import { calibrationSchema, canvasPointToDocument, measureCanvasDistanceM } from "./calibration.ts";
import { sourceAnnotationSchema, type FencingJob } from "./domain.ts";

type Point = { x: number; y: number };
type SourceAnnotation = NonNullable<FencingJob["annotations"]>[number];
export type SourceAreaQuantity = {
  value: number | null;
  projectedAreaM2: number | null;
  unit: "m²";
  formula: string;
  reason: string | null;
};

const equalPoint = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

function side(a: Point, b: Point, c: Point): number {
  const left = (b.x - a.x) * (c.y - a.y), right = (b.y - a.y) * (c.x - a.x);
  const tolerance = Number.EPSILON * 16 * Math.max(Math.abs(left), Math.abs(right));
  return Math.abs(left - right) <= tolerance ? 0 : Math.sign(left - right);
}

function onSegment(a: Point, b: Point, p: Point): boolean {
  return side(a, b, p) === 0 && p.x >= Math.min(a.x, b.x) && p.x <= Math.max(a.x, b.x)
    && p.y >= Math.min(a.y, b.y) && p.y <= Math.max(a.y, b.y);
}

function intersects(a: Point, b: Point, c: Point, d: Point): boolean {
  const ac = side(a, b, c), ad = side(a, b, d), ca = side(c, d, a), cb = side(c, d, b);
  return (ac * ad < 0 && ca * cb < 0) || onSegment(a, b, c) || onSegment(a, b, d)
    || onSegment(c, d, a) || onSegment(c, d, b);
}

/** Origin-relative triangulation avoids cancellation from large page offsets. */
function area(ring: readonly Point[], scale = 1): number {
  let twice = 0;
  for (let i = 1; i < ring.length - 1; i++) {
    // Convert each relative length before multiplying. This is dimensional
    // conversion, not rounding a finished area or a displayed quantity.
    const ax = (ring[i].x - ring[0].x) * scale, ay = (ring[i].y - ring[0].y) * scale;
    const bx = (ring[i + 1].x - ring[0].x) * scale, by = (ring[i + 1].y - ring[0].y) * scale;
    twice += ax * by - ay * bx;
  }
  return Math.abs(twice) / 2;
}

function simpleRing(ring: readonly Point[]): boolean {
  if (ring.length < 3 || !ring.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))) return false;
  const magnitude = area(ring);
  if (!Number.isFinite(magnitude) || magnitude <= 0) return false;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], next = ring[(i + 2) % ring.length];
    if (equalPoint(a, b)) return false;
    if (side(a, b, next) === 0 && (b.x - a.x) * (next.x - b.x) + (b.y - a.y) * (next.y - b.y) < 0) return false;
    for (let j = i + 1; j < ring.length; j++) {
      if (j === i + 1 || (i === 0 && j === ring.length - 1)) continue;
      if (intersects(a, b, ring[j], ring[(j + 1) % ring.length])) return false;
    }
  }
  return true;
}

function ringsIntersect(a: readonly Point[], b: readonly Point[]): boolean {
  return a.some((p, i) => b.some((q, j) => intersects(p, a[(i + 1) % a.length], q, b[(j + 1) % b.length])));
}

function strictlyInside(point: Point, ring: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    if (onSegment(a, b, point)) return false;
    if ((a.y > point.y) !== (b.y > point.y)
      && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Calibrated source geometry only. Annotation.value is a display cache, never
 * a measurement operand. A roof without current explicit slope evidence may
 * expose its projected area, but cannot establish a true-area QS binding. */
export function measureSourceArea(job: FencingJob, annotation: SourceAnnotation, sourceReady: boolean): SourceAreaQuantity {
  const unavailable = (reason: string, projectedAreaM2: number | null = null): SourceAreaQuantity =>
    ({ value: null, projectedAreaM2, unit: "m²", formula: "", reason });
  const parsed = sourceAnnotationSchema.safeParse(annotation);
  if (!parsed.success) return unavailable("The source area metadata or coordinates are invalid.");
  const current = parsed.data, measurement = current.measurement;
  if (current.kind !== "area" || !measurement) return unavailable("Explicitly classify this source area as a room area or roof plane.");
  const documents = job.documents.filter(entry => entry.id === job.activeDocumentId);
  const document = documents.length === 1 ? documents[0] : null;
  if (!sourceReady || !document?.sha256 || !/^[a-f0-9]{64}$/.test(document.sha256) || document.source === "sample") {
    return unavailable("Verify the original source drawing before calculating.");
  }
  if (current.coordinateSpace !== "source-page-v1" || current.documentId !== document.id || current.sourceSha256 !== document.sha256) {
    return unavailable("The area must reference the current source document revision in source-page coordinates.");
  }
  if (document.pageCount !== null && current.sheet >= document.pageCount) return unavailable("The area sheet is outside the source drawing.");
  if (job.runs.some(run => run.id === current.id) || (job.annotations ?? []).filter(entry => entry.id === current.id).length > 1) {
    return unavailable("The area identity is ambiguous in this workspace.");
  }
  const calibrations = job.calibrations.filter(entry => entry.sheet === current.sheet);
  const parsedCalibration = calibrationSchema.safeParse(calibrations.length === 1 ? calibrations[0] : null);
  if (!parsedCalibration.success) return unavailable("Lock one valid source-bound calibration for this area's sheet.");
  const calibration = parsedCalibration.data;
  const candidate = calibration.candidates.find(entry => entry.id === calibration.selectedCandidateId);
  if (!calibration.locked || calibration.coordinateSpace !== "source-page-v1" || !candidate
    || candidate.provenance.documentId !== document.id || candidate.source === "inferred"
    || candidate.confidence <= 0 || calibration.source !== candidate.source) {
    return unavailable("Lock a reviewed, non-inferred source-bound calibration for this area's sheet.");
  }
  if (candidate.metresPerUnit !== calibration.metresPerUnit || candidate.knownDistanceM !== calibration.knownDistanceM
    || JSON.stringify(candidate.points) !== JSON.stringify(calibration.points)
    || JSON.stringify(candidate.inputDistance) !== JSON.stringify(calibration.inputDistance)) {
    return unavailable("The scale no longer matches its reviewed candidate.");
  }
  if (candidate.points && candidate.knownDistanceM !== null) {
    const distance = measureCanvasDistanceM(candidate.points[0], candidate.points[1], calibration, current.sheet);
    if (!Number.isFinite(distance) || Math.abs(distance - candidate.knownDistanceM) > Number.EPSILON * 32 * Math.max(distance, candidate.knownDistanceM)) {
      return unavailable("The calibration transform no longer matches its reviewed distance.");
    }
  }
  // Quadratic topology validation is deliberately bounded; no truncated ring
  // or simplified approximation can become a verified quantity.
  const rings = [current.points, ...measurement.holes];
  if (rings.reduce((total, ring) => total + ring.length, 0) > 4096) return unavailable("This area exceeds the 4096-vertex topology review limit.");
  const transformed = rings.map(ring => {
    const open = ring.length > 1 && equalPoint(ring[0], ring[ring.length - 1]) ? ring.slice(0, -1) : ring;
    return open.map(point => canvasPointToDocument(point, calibration.transform));
  });
  if (!transformed.every(simpleRing)) return unavailable("Every boundary must be a positive, simple ring without crossings or repeated edges.");
  const [outer, ...holes] = transformed;
  for (let i = 0; i < holes.length; i++) {
    const hole = holes[i];
    if (!hole.every(point => strictlyInside(point, outer)) || ringsIntersect(hole, outer)) {
      return unavailable("Every hole must be strictly inside the outer boundary without touching or crossing it.");
    }
    for (let j = 0; j < i; j++) {
      if (ringsIntersect(hole, holes[j]) || strictlyInside(hole[0], holes[j]) || strictlyInside(holes[j][0], hole)) {
        return unavailable("Holes must not overlap, touch, or contain one another; deduct each opening once.");
      }
    }
  }
  const projectedAreaM2 = area(outer, calibration.metresPerUnit)
    - holes.reduce((sum, hole) => sum + area(hole, calibration.metresPerUnit), 0);
  if (!Number.isFinite(projectedAreaM2) || projectedAreaM2 <= 0) return unavailable("The net projected area must be positive and finite.");
  const projectedFormula = `(outer ${area(outer)} − holes ${holes.reduce((sum, hole) => sum + area(hole), 0)}) × ${calibration.metresPerUnit}²`;
  if (measurement.entityType === "room-area") return { value: projectedAreaM2, projectedAreaM2, unit: "m²", formula: projectedFormula, reason: null };
  const slope = measurement.roofSlope;
  if (!slope) return unavailable("Record an explicit source-linked roof pitch and azimuth before using true surface area.", projectedAreaM2);
  if (slope.source.documentId !== document.id || slope.source.sourceSha256 !== document.sha256 || slope.source.sheet !== current.sheet) {
    return unavailable("The roof slope evidence must reference this source document revision and sheet.", projectedAreaM2);
  }
  const value = projectedAreaM2 / Math.cos(slope.pitchDegrees * Math.PI / 180);
  if (!Number.isFinite(value) || value <= 0) return unavailable("The true roof surface area must be positive and finite.", projectedAreaM2);
  return { value, projectedAreaM2, unit: "m²", formula: `${projectedFormula} / cos(${slope.pitchDegrees}°)`, reason: null };
}
