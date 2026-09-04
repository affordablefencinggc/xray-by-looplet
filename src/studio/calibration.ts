import { z } from "zod";

const finiteNumber = z.number().finite();

export const calibrationPointSchema = z.object({
  x: finiteNumber,
  y: finiteNumber,
});

/** Affine document-to-canvas transform: x'=ax+cy+e, y'=bx+dy+f. */
export const documentToCanvasTransformSchema = z.object({
  a: finiteNumber,
  b: finiteNumber,
  c: finiteNumber,
  d: finiteNumber,
  e: finiteNumber,
  f: finiteNumber,
}).superRefine((transform, context) => {
  if (Math.abs(transform.a * transform.d - transform.b * transform.c) <= Number.EPSILON) {
    context.addIssue({ code: "custom", message: "Document-to-canvas transform must be invertible." });
  }
});

export const IDENTITY_DOCUMENT_TO_CANVAS = Object.freeze({
  a: 1,
  b: 0,
  c: 0,
  d: 1,
  e: 0,
  f: 0,
});

export const calibrationInputUnitSchema = z.enum(["m", "cm", "mm", "ft", "in"]);
export const calibrationCandidateSourceSchema = z.enum(["declared", "inferred", "manual"]);

export const calibrationInputDistanceSchema = z.object({
  value: z.number().positive().finite(),
  unit: calibrationInputUnitSchema,
});

export const calibrationProvenanceSchema = z.object({
  method: z.string().min(1).max(120),
  evidence: z.string().min(1).max(1000),
  documentId: z.string().min(1).nullable(),
});

export const calibrationCandidateSchema = z.object({
  id: z.string().min(1),
  source: calibrationCandidateSourceSchema,
  metresPerUnit: z.number().positive().finite(),
  confidence: z.number().min(0).max(1),
  inputDistance: calibrationInputDistanceSchema.nullable(),
  knownDistanceM: z.number().positive().finite().nullable(),
  points: z.tuple([calibrationPointSchema, calibrationPointSchema]).nullable(),
  provenance: calibrationProvenanceSchema,
}).superRefine((candidate, context) => {
  if (candidate.source === "manual" && (!candidate.inputDistance || !candidate.points || !candidate.knownDistanceM)) {
    context.addIssue({ code: "custom", message: "Manual candidates require two points and a known input distance." });
  }
  if (candidate.inputDistance && candidate.knownDistanceM !== null) {
    const converted = convertDistanceToMetres(candidate.inputDistance.value, candidate.inputDistance.unit);
    if (!nearlyEqual(converted, candidate.knownDistanceM)) {
      context.addIssue({ code: "custom", message: "Known distance must equal the input distance converted to metres." });
    }
  }
  if (candidate.points && pointsCoincide(candidate.points)) {
    context.addIssue({ code: "custom", message: "Calibration points must be distinct." });
  }
});

export const calibrationConflictSchema = z.object({
  candidateIds: z.array(z.string().min(1)).min(2),
  maxRelativeDifference: z.number().positive().finite(),
}).nullable();

export const calibrationSchema = z.object({
  sheet: z.number().int().nonnegative(),
  metresPerUnit: z.number().positive().finite(),
  source: z.enum(["unverified", "declared", "inferred", "manual"]),
  confidence: z.number().min(0).max(1),
  locked: z.boolean(),
  knownDistanceM: z.number().positive().finite().nullable(),
  points: z.tuple([calibrationPointSchema, calibrationPointSchema]).nullable(),
  transform: documentToCanvasTransformSchema.default(() => ({ ...IDENTITY_DOCUMENT_TO_CANVAS })),
  inputDistance: calibrationInputDistanceSchema.nullable().default(null),
  candidates: z.array(calibrationCandidateSchema).default([]),
  selectedCandidateId: z.string().min(1).nullable().default(null),
  conflict: calibrationConflictSchema.default(null),
}).superRefine((calibration, context) => {
  const ids = calibration.candidates.map((candidate) => candidate.id);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: "custom", path: ["candidates"], message: "Calibration candidate IDs must be unique." });
  }
  if (calibration.selectedCandidateId && !ids.includes(calibration.selectedCandidateId)) {
    context.addIssue({ code: "custom", path: ["selectedCandidateId"], message: "Selected calibration candidate does not exist." });
  }
  if (calibration.conflict && calibration.conflict.candidateIds.some((id) => !ids.includes(id))) {
    context.addIssue({ code: "custom", path: ["conflict"], message: "Conflict references an unknown candidate." });
  }
  if (calibration.points && pointsCoincide(calibration.points)) {
    context.addIssue({ code: "custom", path: ["points"], message: "Calibration points must be distinct." });
  }
  if (calibration.locked) {
    if (calibration.source === "unverified" || calibration.confidence <= 0) {
      context.addIssue({ code: "custom", message: "A locked calibration must be verified and have positive confidence." });
    }
    if (calibration.conflict) {
      context.addIssue({ code: "custom", message: "A calibration with an unresolved conflict cannot be locked." });
    }
    if (!calibration.selectedCandidateId) {
      context.addIssue({ code: "custom", message: "A locked calibration must identify its selected candidate." });
    }
  }
});

export type CalibrationPoint = z.infer<typeof calibrationPointSchema>;
export type DocumentToCanvasTransform = z.infer<typeof documentToCanvasTransformSchema>;
export type CalibrationInputUnit = z.infer<typeof calibrationInputUnitSchema>;
export type CalibrationInputDistance = z.infer<typeof calibrationInputDistanceSchema>;
export type CalibrationCandidate = z.infer<typeof calibrationCandidateSchema>;
export type Calibration = z.infer<typeof calibrationSchema>;

const METRES_PER_UNIT: Record<CalibrationInputUnit, number> = {
  m: 1,
  cm: 0.01,
  mm: 0.001,
  ft: 0.3048,
  in: 0.0254,
};

export function convertDistanceToMetres(value: number, unit: CalibrationInputUnit): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error("Calibration distance must be a positive finite number.");
  return value * METRES_PER_UNIT[unit];
}

export function documentPointToCanvas(point: CalibrationPoint, transform: DocumentToCanvasTransform): CalibrationPoint {
  return {
    x: transform.a * point.x + transform.c * point.y + transform.e,
    y: transform.b * point.x + transform.d * point.y + transform.f,
  };
}

export function canvasPointToDocument(point: CalibrationPoint, transform: DocumentToCanvasTransform): CalibrationPoint {
  const determinant = transform.a * transform.d - transform.b * transform.c;
  if (!Number.isFinite(determinant) || Math.abs(determinant) <= Number.EPSILON) {
    throw new Error("Document-to-canvas transform must be invertible.");
  }
  const translatedX = point.x - transform.e;
  const translatedY = point.y - transform.f;
  return {
    x: (transform.d * translatedX - transform.c * translatedY) / determinant,
    y: (-transform.b * translatedX + transform.a * translatedY) / determinant,
  };
}

export function measureCanvasDistanceM(
  first: CalibrationPoint,
  second: CalibrationPoint,
  calibration: Pick<Calibration, "sheet" | "metresPerUnit" | "transform">,
  sheet = calibration.sheet,
): number {
  if (calibration.sheet !== sheet) {
    throw new Error(`Calibration for sheet ${calibration.sheet} cannot measure sheet ${sheet}.`);
  }
  const documentFirst = canvasPointToDocument(first, calibration.transform);
  const documentSecond = canvasPointToDocument(second, calibration.transform);
  return pointDistance(documentFirst, documentSecond) * calibration.metresPerUnit;
}

export function getCalibrationForSheet(calibrations: readonly Calibration[], sheet: number): Calibration | null {
  if (!Number.isInteger(sheet) || sheet < 0) throw new Error("Sheet must be a non-negative integer.");
  const matches = calibrations.filter((calibration) => calibration.sheet === sheet);
  if (matches.length > 1) throw new Error(`Duplicate calibrations found for sheet ${sheet}.`);
  return matches[0] ?? null;
}

export type TwoPointCandidateInput = {
  id: string;
  source: CalibrationCandidate["source"];
  points: [CalibrationPoint, CalibrationPoint];
  distance: CalibrationInputDistance;
  transform: DocumentToCanvasTransform;
  confidence: number;
  provenance: CalibrationCandidate["provenance"];
};

export type ScaleCandidateInput = {
  id: string;
  source: "declared" | "inferred";
  metresPerUnit: number;
  confidence: number;
  provenance: CalibrationCandidate["provenance"];
};

/** Creates a scale candidate read from document metadata or inferred by an engine. */
export function createScaleCalibrationCandidate(input: ScaleCandidateInput): CalibrationCandidate {
  return calibrationCandidateSchema.parse({
    ...input,
    inputDistance: null,
    knownDistanceM: null,
    points: null,
  });
}

/** Points are canvas-space; the inverse page transform makes the scale independent of zoom/pan. */
export function createTwoPointCalibrationCandidate(input: TwoPointCandidateInput): CalibrationCandidate {
  const documentFirst = canvasPointToDocument(input.points[0], input.transform);
  const documentSecond = canvasPointToDocument(input.points[1], input.transform);
  const documentDistance = pointDistance(documentFirst, documentSecond);
  if (documentDistance <= Number.EPSILON) throw new Error("Calibration points must be distinct in document space.");
  const knownDistanceM = convertDistanceToMetres(input.distance.value, input.distance.unit);
  return calibrationCandidateSchema.parse({
    id: input.id,
    source: input.source,
    metresPerUnit: knownDistanceM / documentDistance,
    confidence: input.confidence,
    inputDistance: input.distance,
    knownDistanceM,
    points: input.points,
    provenance: input.provenance,
  });
}

const SOURCE_PRIORITY: Record<CalibrationCandidate["source"], number> = { manual: 3, declared: 2, inferred: 1 };

function rankCandidates(candidates: readonly CalibrationCandidate[]): CalibrationCandidate[] {
  return [...candidates].sort((left, right) =>
    SOURCE_PRIORITY[right.source] - SOURCE_PRIORITY[left.source]
    || right.confidence - left.confidence
    || left.id.localeCompare(right.id),
  );
}

export type CalibrationReconciliation = {
  selectedCandidateId: string | null;
  conflict: z.infer<typeof calibrationConflictSchema>;
};

/** A conflict is any pair whose relative scale difference exceeds the declared tolerance. */
export function reconcileCalibrationCandidates(
  candidates: readonly CalibrationCandidate[],
  explicitCandidateId: string | null = null,
  relativeTolerance = 0.005,
): CalibrationReconciliation {
  if (!Number.isFinite(relativeTolerance) || relativeTolerance < 0) throw new Error("Conflict tolerance must be non-negative.");
  const valid = z.array(calibrationCandidateSchema).parse(candidates);
  const chosen = explicitCandidateId ? valid.find((candidate) => candidate.id === explicitCandidateId) : undefined;
  if (explicitCandidateId && !chosen) throw new Error(`Unknown calibration candidate: ${explicitCandidateId}`);
  if (valid.length === 0) return { selectedCandidateId: null, conflict: null };

  let maximumDifference = 0;
  const conflictingIds = new Set<string>();
  for (let leftIndex = 0; leftIndex < valid.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < valid.length; rightIndex += 1) {
      const left = valid[leftIndex];
      const right = valid[rightIndex];
      const difference = Math.abs(left.metresPerUnit - right.metresPerUnit) / Math.max(left.metresPerUnit, right.metresPerUnit);
      if (difference > relativeTolerance) {
        maximumDifference = Math.max(maximumDifference, difference);
        conflictingIds.add(left.id);
        conflictingIds.add(right.id);
      }
    }
  }

  if (conflictingIds.size > 0 && !chosen) {
    return {
      selectedCandidateId: null,
      conflict: {
        candidateIds: [...conflictingIds].sort(),
        maxRelativeDifference: maximumDifference,
      },
    };
  }
  return { selectedCandidateId: chosen?.id ?? rankCandidates(valid)[0].id, conflict: null };
}

export function lockCalibration(calibration: Calibration, explicitCandidateId: string | null = null): Calibration {
  const parsed = calibrationSchema.parse({ ...calibration, locked: false });
  const reconciliation = reconcileCalibrationCandidates(parsed.candidates, explicitCandidateId ?? parsed.selectedCandidateId);
  if (reconciliation.conflict || !reconciliation.selectedCandidateId) {
    throw new Error(reconciliation.conflict
      ? "Calibration candidates conflict; select one explicitly before locking."
      : "At least one calibration candidate is required before locking.");
  }
  const selected = parsed.candidates.find((candidate) => candidate.id === reconciliation.selectedCandidateId)!;
  return calibrationSchema.parse({
    ...parsed,
    metresPerUnit: selected.metresPerUnit,
    source: selected.source,
    confidence: selected.confidence,
    knownDistanceM: selected.knownDistanceM,
    points: selected.points,
    inputDistance: selected.inputDistance,
    selectedCandidateId: selected.id,
    conflict: null,
    locked: true,
  });
}

export function unlockCalibration(calibration: Calibration): Calibration {
  return calibrationSchema.parse({ ...calibration, locked: false });
}

export function createUnverifiedCalibration(sheet: number, transform: DocumentToCanvasTransform = IDENTITY_DOCUMENT_TO_CANVAS): Calibration {
  return calibrationSchema.parse({
    sheet,
    metresPerUnit: 1,
    source: "unverified",
    confidence: 0,
    locked: false,
    knownDistanceM: null,
    points: null,
    transform,
    inputDistance: null,
    candidates: [],
    selectedCandidateId: null,
    conflict: null,
  });
}

function pointDistance(first: CalibrationPoint, second: CalibrationPoint): number {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function pointsCoincide(points: [CalibrationPoint, CalibrationPoint]): boolean {
  return pointDistance(points[0], points[1]) <= Number.EPSILON;
}

function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= Math.max(1, Math.abs(left), Math.abs(right)) * 1e-12;
}
