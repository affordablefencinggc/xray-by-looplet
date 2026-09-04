import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calibrationCandidateSchema,
  calibrationSchema,
  canvasPointToDocument,
  convertDistanceToMetres,
  createScaleCalibrationCandidate,
  createTwoPointCalibrationCandidate,
  createUnverifiedCalibration,
  documentPointToCanvas,
  getCalibrationForSheet,
  lockCalibration,
  measureCanvasDistanceM,
  reconcileCalibrationCandidates,
  unlockCalibration,
  type CalibrationCandidate,
  type DocumentToCanvasTransform,
} from "./calibration.ts";
import { createDefaultJob, fencingJobSchema, parseFencingJob } from "./domain.ts";

const provenance = { method: "dimension-label", evidence: "Dimension line reads 10 m", documentId: "doc-1" };
const transform: DocumentToCanvasTransform = { a: 0, b: 2, c: -2, d: 0, e: 100, f: 50 };

function declaredCandidate(id: string, metresPerUnit: number, confidence = 0.8): CalibrationCandidate {
  return calibrationCandidateSchema.parse({
    id,
    source: "declared",
    metresPerUnit,
    confidence,
    inputDistance: null,
    knownDistanceM: null,
    points: null,
    provenance,
  });
}

describe("calibration units and geometry", () => {
  it("converts every supported input unit to metres", () => {
    assert.equal(convertDistanceToMetres(2, "m"), 2);
    assert.equal(convertDistanceToMetres(250, "cm"), 2.5);
    assert.equal(convertDistanceToMetres(2500, "mm"), 2.5);
    assert.equal(convertDistanceToMetres(10, "ft"), 3.048);
    assert.ok(Math.abs(convertDistanceToMetres(12, "in") - 0.3048) < 1e-12);
    assert.throws(() => convertDistanceToMetres(0, "m"), /positive finite/);
    assert.throws(() => convertDistanceToMetres(Number.POSITIVE_INFINITY, "m"), /positive finite/);
  });

  it("round-trips points through an explicit rotated, scaled and translated transform", () => {
    const documentPoint = { x: 3, y: -4 };
    const canvasPoint = documentPointToCanvas(documentPoint, transform);
    assert.deepEqual(canvasPoint, { x: 108, y: 56 });
    assert.deepEqual(canvasPointToDocument(canvasPoint, transform), documentPoint);
    assert.throws(
      () => canvasPointToDocument({ x: 1, y: 1 }, { a: 1, b: 2, c: 2, d: 4, e: 0, f: 0 }),
      /invertible/,
    );
  });

  it("derives a two-point scale from canvas points and explicit input units", () => {
    const candidate = createTwoPointCalibrationCandidate({
      id: "manual-1",
      source: "manual",
      points: [{ x: 100, y: 50 }, { x: 100, y: 70 }],
      distance: { value: 2500, unit: "mm" },
      transform,
      confidence: 1,
      provenance: { method: "two-point", evidence: "Estimator selected endpoints", documentId: "doc-1" },
    });
    assert.equal(candidate.knownDistanceM, 2.5);
    assert.equal(candidate.metresPerUnit, 0.25);

    const calibration = lockCalibration({
      ...createUnverifiedCalibration(4, transform),
      candidates: [candidate],
    });
    assert.equal(measureCanvasDistanceM({ x: 100, y: 50 }, { x: 100, y: 70 }, calibration, 4), 2.5);
    assert.throws(
      () => measureCanvasDistanceM({ x: 100, y: 50 }, { x: 100, y: 70 }, calibration, 3),
      /cannot measure sheet 3/,
    );
  });

  it("rejects zero-length points, singular transforms and inconsistent converted distances", () => {
    assert.throws(() => createTwoPointCalibrationCandidate({
      id: "bad",
      source: "manual",
      points: [{ x: 1, y: 1 }, { x: 1, y: 1 }],
      distance: { value: 1, unit: "m" },
      transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
      confidence: 1,
      provenance,
    }), /distinct/);
    assert.equal(calibrationSchema.safeParse({
      ...createUnverifiedCalibration(0),
      transform: { a: 1, b: 2, c: 2, d: 4, e: 0, f: 0 },
    }).success, false);
    assert.equal(calibrationCandidateSchema.safeParse({
      ...declaredCandidate("bad-distance", 1),
      inputDistance: { value: 100, unit: "cm" },
      knownDistanceM: 2,
    }).success, false);
  });
});

describe("calibration candidate trust and locking", () => {
  it("creates declared and inferred scale candidates with auditable provenance", () => {
    const declared = createScaleCalibrationCandidate({
      id: "title-block",
      source: "declared",
      metresPerUnit: 0.01,
      confidence: 0.95,
      provenance,
    });
    const inferred = createScaleCalibrationCandidate({
      id: "engine",
      source: "inferred",
      metresPerUnit: 0.01,
      confidence: 0.65,
      provenance: { method: "engine", evidence: "Dimension geometry consensus", documentId: "doc-1" },
    });
    assert.equal(declared.provenance.method, "dimension-label");
    assert.equal(inferred.source, "inferred");
    assert.equal(calibrationCandidateSchema.safeParse({ ...inferred, provenance: { ...inferred.provenance, evidence: "" } }).success, false);
  });

  it("selects deterministically when candidates agree within tolerance", () => {
    const candidates = [
      { ...declaredCandidate("z-declared", 1.002, 0.99), source: "inferred" as const },
      declaredCandidate("b-declared", 1.001, 0.8),
      { ...declaredCandidate("a-manual", 1, 0.7), source: "manual" as const,
        inputDistance: { value: 1, unit: "m" as const }, knownDistanceM: 1,
        points: [{ x: 0, y: 0 }, { x: 1, y: 0 }] as [{ x: number; y: number }, { x: number; y: number }] },
    ];
    const result = reconcileCalibrationCandidates(candidates);
    assert.deepEqual(result, { selectedCandidateId: "a-manual", conflict: null });
    assert.deepEqual(reconcileCalibrationCandidates([...candidates].reverse()), result);
  });

  it("detects conflicts independent of input order and requires explicit resolution", () => {
    const first = declaredCandidate("declared", 1);
    const second = declaredCandidate("inferred", 1.02);
    const expected = reconcileCalibrationCandidates([first, second], null, 0.005);
    assert.equal(expected.selectedCandidateId, null);
    assert.deepEqual(expected.conflict?.candidateIds, ["declared", "inferred"]);
    assert.deepEqual(reconcileCalibrationCandidates([second, first], null, 0.005), expected);

    const unresolved = { ...createUnverifiedCalibration(0), candidates: [first, second] };
    assert.throws(() => lockCalibration(unresolved), /conflict/);
    const locked = lockCalibration(unresolved, "inferred");
    assert.equal(locked.locked, true);
    assert.equal(locked.selectedCandidateId, "inferred");
    assert.equal(locked.metresPerUnit, 1.02);
    assert.equal(locked.conflict, null);
    assert.equal(unlockCalibration(locked).locked, false);
    assert.throws(() => lockCalibration(unresolved, "missing"), /Unknown/);
  });

  it("treats the exact relative tolerance boundary as agreement", () => {
    const upper = 1 / (1 - 0.005);
    assert.equal(reconcileCalibrationCandidates([
      declaredCandidate("one", 1),
      declaredCandidate("upper", upper),
    ], null, 0.005).conflict, null);
  });

  it("enforces candidate, selection, conflict and lock invariants", () => {
    const base = createUnverifiedCalibration(0);
    assert.equal(calibrationSchema.safeParse({ ...base, locked: true }).success, false);
    assert.equal(calibrationSchema.safeParse({ ...base, candidates: [declaredCandidate("same", 1), declaredCandidate("same", 1)] }).success, false);
    assert.equal(calibrationSchema.safeParse({ ...base, selectedCandidateId: "absent" }).success, false);
    assert.equal(calibrationCandidateSchema.safeParse({
      ...declaredCandidate("manual-incomplete", 1),
      source: "manual",
    }).success, false);
  });
});

describe("page-specific job calibration contract", () => {
  it("retrieves calibration only for its page and rejects duplicate page records", () => {
    const pageZero = createUnverifiedCalibration(0);
    const pageTwo = createUnverifiedCalibration(2);
    assert.equal(getCalibrationForSheet([pageZero, pageTwo], 2), pageTwo);
    assert.equal(getCalibrationForSheet([pageZero, pageTwo], 1), null);
    assert.throws(() => getCalibrationForSheet([pageTwo, { ...pageTwo }], 2), /Duplicate/);

    const job = createDefaultJob();
    job.calibrations.push(createUnverifiedCalibration(0));
    const parsed = fencingJobSchema.safeParse(job);
    assert.equal(parsed.success, false);
    if (!parsed.success) assert.match(parsed.error.issues[0].message, /Only one calibration/);
  });

  it("migrates unlocked and valid locked version-1 calibration records", () => {
    const unlocked = createDefaultJob();
    const legacyUnlocked = JSON.parse(JSON.stringify(unlocked));
    legacyUnlocked.schemaVersion = 1;
    delete legacyUnlocked.calibrations[0].transform;
    delete legacyUnlocked.calibrations[0].inputDistance;
    delete legacyUnlocked.calibrations[0].candidates;
    delete legacyUnlocked.calibrations[0].selectedCandidateId;
    delete legacyUnlocked.calibrations[0].conflict;
    assert.deepEqual(parseFencingJob(legacyUnlocked).calibrations[0].transform, { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });

    const legacyLocked = JSON.parse(JSON.stringify(legacyUnlocked));
    Object.assign(legacyLocked.calibrations[0], {
      source: "manual",
      confidence: 1,
      metresPerUnit: 0.25,
      locked: true,
      knownDistanceM: 2.5,
      points: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
    });
    const migrated = parseFencingJob(legacyLocked).calibrations[0];
    assert.equal(migrated.locked, true);
    assert.equal(migrated.selectedCandidateId, "legacy-sheet-0");
    assert.equal(migrated.candidates[0].inputDistance?.unit, "m");
    assert.equal(migrated.candidates[0].provenance.method, "legacy-v1-migration");
  });
});
