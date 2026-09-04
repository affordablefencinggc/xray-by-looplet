import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTwoPointCalibrationCandidate, createUnverifiedCalibration, lockCalibration } from "./calibration.ts";
import {
  createDefaultJob,
  createGateSpecification,
  createReviewDecision,
  createRunSpecification,
  fencingJobSchema,
  parseFencingJob,
  type FenceRun,
  type GateRecord,
} from "./domain.ts";
import {
  applyTraceCommand,
  calculatePolylineDistanceM,
  calculateRunLengths,
  migrateTraceState,
  placeGateOnRun,
  validateTraceTopology,
  type TraceState,
} from "./tracing.ts";

function lockedCalibration(sheet = 0, metres = 10, canvasUnits = 10) {
  const base = createUnverifiedCalibration(sheet);
  const candidate = createTwoPointCalibrationCandidate({
    id: `manual-${sheet}`,
    source: "manual",
    points: [{ x: 0, y: 0 }, { x: canvasUnits, y: 0 }],
    distance: { value: metres, unit: "m" },
    transform: base.transform,
    confidence: 1,
    provenance: { method: "two-point", evidence: "Verified boundary", documentId: "doc-1" },
  });
  return lockCalibration({ ...base, candidates: [candidate] });
}

function run(overrides: Partial<FenceRun> = {}): FenceRun {
  return {
    id: "run-1",
    sheet: 0,
    label: "Run 01",
    points: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
    lengthM: 10,
    specification: createRunSpecification(),
    photoIds: [],
    review: createReviewDecision(),
    ...overrides,
  };
}

function gate(overrides: Partial<GateRecord> = {}): GateRecord {
  return {
    ...createGateSpecification(),
    id: "gate-1",
    sheet: 0,
    label: "Gate 01",
    point: { x: 5, y: 0 },
    runId: "run-1",
    widthM: 2,
    heightM: null,
    type: "unselected",
    hardware: "",
    motorised: false,
    photoIds: [],
    review: createReviewDecision(),
    ...overrides,
  };
}

function stateWith(points = [{ x: 0, y: 0 }, { x: 10, y: 0 }], gates: GateRecord[] = []): TraceState {
  return migrateTraceState([run({ points })], gates, [lockedCalibration()]);
}

describe("trace measurement and migration", () => {
  it("measures every polyline segment against the locked page calibration", () => {
    const calibration = lockedCalibration(2, 20, 10);
    assert.equal(calculatePolylineDistanceM([
      { x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 4 },
    ], calibration), 14);
    assert.throws(() => calculatePolylineDistanceM([{ x: 0, y: 0 }, { x: 1, y: 0 }], createUnverifiedCalibration(2)), /locked/);
    assert.throws(() => calculatePolylineDistanceM([{ x: 0, y: 0 }, { x: 0, y: 0 }], calibration), /zero length/);
  });

  it("migrates existing v1 two-point runs and gates without changing IDs", () => {
    const migrated = migrateTraceState([run()], [gate()], [lockedCalibration()]);
    assert.equal(migrated.runs[0].id, "run-1");
    assert.equal(migrated.runs[0].revision, 1);
    assert.equal(migrated.runs[0].grossLengthM, 10);
    assert.equal(migrated.runs[0].gateDeductionM, 2);
    assert.equal(migrated.runs[0].netLengthM, 8);
    assert.equal(migrated.runs[0].lengthM, 8);
    assert.equal(migrated.gates[0].id, "gate-1");
    assert.equal(migrated.gates[0].segmentIndex, 0);
    assert.equal(migrated.gates[0].segmentT, 0.5);
  });

  it("unions overlapping gate openings and caps deductions to gross length", () => {
    const gates = [
      gate({ id: "wide-left", point: { x: 2, y: 0 }, widthM: 6 }),
      gate({ id: "wide-right", point: { x: 7, y: 0 }, widthM: 6 }),
    ];
    assert.deepEqual(calculateRunLengths(run(), gates, lockedCalibration()), {
      grossLengthM: 10,
      gateDeductionM: 10,
      netLengthM: 0,
    });
    assert.deepEqual(calculateRunLengths(run(), [gate({ widthM: null })], lockedCalibration()), {
      grossLengthM: 10,
      gateDeductionM: 0,
      netLengthM: 10,
    });
  });

  it("projects gate points deterministically onto a run", () => {
    const placed = placeGateOnRun(gate({ point: { x: 6, y: 3 } }), run(), lockedCalibration());
    assert.deepEqual(placed.point, { x: 6, y: 0 });
    assert.equal(placed.segmentIndex, 0);
    assert.equal(placed.segmentT, 0.6);
  });
});

describe("pure editable trace commands", () => {
  it("moves, inserts and removes vertices with stable IDs and monotonic revisions", () => {
    const original = stateWith();
    const moved = applyTraceCommand(original, {
      type: "move-vertex", runId: "run-1", expectedRevision: 1, vertexIndex: 1, point: { x: 20, y: 0 },
    }, [lockedCalibration()]);
    assert.equal(original.runs[0].points[1].x, 10, "previous state remains immutable for undo");
    assert.equal(moved.previous, original);
    assert.equal(moved.next.runs[0].id, "run-1");
    assert.equal(moved.next.runs[0].revision, 2);
    assert.equal(moved.next.runs[0].netLengthM, 20);
    assert.throws(() => applyTraceCommand(moved.next, {
      type: "move-vertex", runId: "run-1", expectedRevision: 1, vertexIndex: 0, point: { x: 1, y: 0 },
    }, [lockedCalibration()]), /Stale/);

    const inserted = applyTraceCommand(moved.next, {
      type: "insert-vertex", runId: "run-1", expectedRevision: 2, segmentIndex: 0, point: { x: 10, y: 0 },
    }, [lockedCalibration()]);
    assert.equal(inserted.next.runs[0].points.length, 3);
    assert.equal(inserted.next.runs[0].revision, 3);
    const removed = applyTraceCommand(inserted.next, {
      type: "remove-vertex", runId: "run-1", expectedRevision: 3, vertexIndex: 1,
    }, [lockedCalibration()]);
    assert.equal(removed.next.runs[0].points.length, 2);
    assert.equal(removed.next.runs[0].revision, 4);
    assert.throws(() => applyTraceCommand(removed.next, {
      type: "remove-vertex", runId: "run-1", expectedRevision: 4, vertexIndex: 0,
    }, [lockedCalibration()]), /at least two/);
  });

  it("rejects edits that produce zero-length geometry", () => {
    const original = stateWith();
    assert.throws(() => applyTraceCommand(original, {
      type: "move-vertex", runId: "run-1", expectedRevision: 1, vertexIndex: 1, point: { x: 0, y: 0 },
    }, [lockedCalibration()]), /zero length/);
    assert.throws(() => applyTraceCommand(original, {
      type: "insert-vertex", runId: "run-1", expectedRevision: 1, segmentIndex: 0, point: { x: 0, y: 0 },
    }, [lockedCalibration()]), /zero length/);
  });

  it("repairs corner and post vertex annotations across topology edits", () => {
    const calibration = lockedCalibration();
    const specification = {
      ...createRunSpecification(),
      corners: [
        { id: "corner-mid", vertexIndex: 1, treatment: "boxed" as const, notes: "Junction" },
        { id: "corner-end", vertexIndex: 2, treatment: "end" as const, notes: "Termination" },
      ],
      postOverrides: [
        { id: "post-end", vertexIndex: 2, postSize: "100x100", lengthM: 2.4, embedmentM: 0.6, notes: "" },
      ],
    };
    const original = migrateTraceState([run({
      points: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }],
      specification,
    })], [], [calibration]);
    const inserted = applyTraceCommand(original, {
      type: "insert-vertex", runId: "run-1", expectedRevision: 1, segmentIndex: 0, point: { x: 2, y: 0 },
    }, [calibration]);
    assert.deepEqual(inserted.next.runs[0].specification.corners.map((entry) => entry.vertexIndex), [2, 3]);
    assert.equal(inserted.next.runs[0].specification.postOverrides[0].vertexIndex, 3);

    const removed = applyTraceCommand(inserted.next, {
      type: "remove-vertex", runId: "run-1", expectedRevision: 2, vertexIndex: 1,
    }, [calibration]);
    assert.deepEqual(removed.next.runs[0].specification.corners.map((entry) => entry.vertexIndex), [1, 2]);

    const split = applyTraceCommand(original, {
      type: "split-run", runId: "run-1", expectedRevision: 1, vertexIndex: 1, newRunIds: ["left", "right"],
    }, [calibration]);
    const left = split.next.runs.find((entry) => entry.id === "left")!;
    const right = split.next.runs.find((entry) => entry.id === "right")!;
    assert.deepEqual(left.specification.corners.map((entry) => entry.vertexIndex), [1]);
    assert.deepEqual(right.specification.corners.map((entry) => entry.vertexIndex), [0, 1]);
    assert.equal(right.specification.postOverrides[0].vertexIndex, 1);

    const merged = applyTraceCommand(split.next, {
      type: "merge-runs",
      firstRunId: left.id, firstExpectedRevision: left.revision, firstEndpoint: "end",
      secondRunId: right.id, secondExpectedRevision: right.revision, secondEndpoint: "start",
      mergedRunId: "joined",
    }, [calibration]);
    assert.deepEqual(merged.next.runs[0].specification.corners.map((entry) => entry.vertexIndex), [1, 2]);
    assert.equal(merged.next.runs[0].specification.postOverrides[0].vertexIndex, 2);
  });

  it("splits only at an internal vertex and deterministically reassigns gates", () => {
    const original = stateWith([{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }], [gate({ point: { x: 7, y: 0 } })]);
    const result = applyTraceCommand(original, {
      type: "split-run", runId: "run-1", expectedRevision: 1, vertexIndex: 1,
      newRunIds: ["run-left", "run-right"],
    }, [lockedCalibration()]);
    assert.deepEqual(result.next.runs.map((entry) => entry.id).sort(), ["run-left", "run-right"]);
    assert.equal(result.next.gates[0].id, "gate-1");
    assert.equal(result.next.gates[0].runId, "run-right");
    assert.equal(result.next.gates[0].revision, 2);
    assert.throws(() => applyTraceCommand(original, {
      type: "split-run", runId: "run-1", expectedRevision: 1, vertexIndex: 0, newRunIds: ["a", "b"],
    }, [lockedCalibration()]), /internal/);
  });

  it("merges compatible runs using explicit endpoint orientation", () => {
    const calibration = lockedCalibration();
    const first = run({ id: "first", points: [{ x: 5, y: 0 }, { x: 0, y: 0 }] });
    const second = run({ id: "second", points: [{ x: 10, y: 0 }, { x: 5, y: 0 }] });
    const original = migrateTraceState([first, second], [], [calibration]);
    const result = applyTraceCommand(original, {
      type: "merge-runs",
      firstRunId: "first", firstExpectedRevision: 1, firstEndpoint: "start",
      secondRunId: "second", secondExpectedRevision: 1, secondEndpoint: "end",
      mergedRunId: "merged", label: "Boundary",
    }, [calibration]);
    assert.deepEqual(result.next.runs[0].points, [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }]);
    assert.equal(result.next.runs[0].revision, 2);
    assert.equal(result.next.runs[0].label, "Boundary");

    const incompatible = migrateTraceState([first, { ...second, specification: { ...second.specification, system: "pool" } }], [], [calibration]);
    assert.throws(() => applyTraceCommand(incompatible, {
      type: "merge-runs", firstRunId: "first", firstExpectedRevision: 1, firstEndpoint: "start",
      secondRunId: "second", secondExpectedRevision: 1, secondEndpoint: "end", mergedRunId: "merged",
    }, [calibration]), /compatible/);
    assert.throws(() => applyTraceCommand(original, {
      type: "merge-runs", firstRunId: "first", firstExpectedRevision: 1, firstEndpoint: "end",
      secondRunId: "second", secondExpectedRevision: 1, secondEndpoint: "start", mergedRunId: "merged",
    }, [calibration]), /do not meet/);
  });

  it("places and removes a gate while recomputing net length and preserving undo state", () => {
    const original = stateWith();
    const placed = applyTraceCommand(original, { type: "place-gate", gate: gate({ point: { x: 5, y: 2 } }), runId: "run-1", expectedRevision: null }, [lockedCalibration()]);
    assert.equal(original.gates.length, 0);
    assert.equal(placed.next.runs[0].grossLengthM, 10);
    assert.equal(placed.next.runs[0].netLengthM, 8);
    assert.deepEqual(placed.affectedGateIds, ["gate-1"]);
    assert.throws(() => applyTraceCommand(placed.next, {
      type: "place-gate", gate: gate(), runId: "run-1", expectedRevision: null,
    }, [lockedCalibration()]), /already exists/);
    assert.throws(() => applyTraceCommand(placed.next, {
      type: "place-gate", gate: gate(), runId: "run-1", expectedRevision: 99,
    }, [lockedCalibration()]), /Stale gate revision/);
    const removed = applyTraceCommand(placed.next, { type: "remove-gate", gateId: "gate-1" }, [lockedCalibration()]);
    assert.equal(removed.next.runs[0].netLengthM, 10);
    assert.equal(removed.next.gates.length, 0);
  });
});

describe("trace topology and serialized domain invariants", () => {
  it("reports duplicate IDs, stale lengths and invalid gate topology", () => {
    const malformed = stateWith();
    malformed.runs[0] = { ...malformed.runs[0], points: [{ x: 0, y: 0 }] };
    assert.match(validateTraceTopology(malformed, [lockedCalibration()])[0].message, /at least two/);

    const state = stateWith();
    const invalid: TraceState = {
      runs: [state.runs[0], { ...state.runs[0] }, { ...state.runs[0], id: "stale", netLengthM: 999, lengthM: 999 }],
      gates: [{ ...placeGateOnRun(gate(), state.runs[0], lockedCalibration()), point: { x: 5, y: 1 } }],
    };
    const codes = validateTraceTopology(invalid, [lockedCalibration()]).map((issue) => issue.code);
    assert.ok(codes.includes("duplicate-run"));
    assert.ok(codes.includes("length"));
    assert.ok(codes.includes("gate-placement"));
  });

  it("migrates legacy serialized run/gate fields and validates domain relationships", () => {
    const job = createDefaultJob();
    job.runs.push(run());
    job.gates.push(gate());
    const legacy = JSON.parse(JSON.stringify(job));
    legacy.schemaVersion = 1;
    delete legacy.revision;
    delete legacy.revisionHistory;
    const parsed = parseFencingJob(legacy);
    assert.equal(parsed.runs[0].revision, 1);
    assert.equal(parsed.runs[0].grossLengthM, 10);
    assert.equal(parsed.runs[0].gateDeductionM, 0);
    assert.equal(parsed.runs[0].netLengthM, 10);
    assert.equal(parsed.gates[0].revision, 1);
    assert.equal(parsed.gates[0].segmentIndex, 0);
    assert.equal(parsed.gates[0].segmentT, 0.5);

    const duplicate = { ...parsed, runs: [...parsed.runs, { ...parsed.runs[0] }] };
    assert.equal(fencingJobSchema.safeParse(duplicate).success, false);
    const missingRun = { ...parsed, gates: [{ ...parsed.gates[0], runId: "missing" }] };
    assert.equal(fencingJobSchema.safeParse(missingRun).success, false);
    const wrongSegment = { ...parsed, gates: [{ ...parsed.gates[0], segmentIndex: 10, segmentT: 0.5 }] };
    assert.equal(fencingJobSchema.safeParse(wrongSegment).success, false);
    assert.throws(() => parseFencingJob({
      ...legacy,
      runs: [{ ...legacy.runs[0], grossLengthM: 10, gateDeductionM: 1, netLengthM: 10 }],
    }), /inconsistent/);
  });
});
