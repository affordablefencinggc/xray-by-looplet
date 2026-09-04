import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createUnverifiedCalibration } from "./calibration.ts";
import { createDefaultJob, parseFencingJob, type FencingJob } from "./domain.ts";
import { useStudio } from "./store.ts";

const provenance = {
  method: "store-test",
  evidence: "A scale explicitly supplied by the estimator for this test.",
  documentId: "doc-test",
};

function twoPageJob(): FencingJob {
  const job = createDefaultJob("2026-09-04T00:00:00.000Z");
  job.documents[0] = {
    ...job.documents[0],
    id: "doc-test",
    pageCount: 2,
    source: "web",
  };
  job.activeDocumentId = "doc-test";
  job.calibrations = [createUnverifiedCalibration(0), createUnverifiedCalibration(1)];
  return job;
}

function resetStore(job = twoPageJob()) {
  useStudio.setState({
    job,
    sheet: 0,
    currentCalibration: job.calibrations[0],
    scaleM: 1,
    calibrationCapture: null,
    calibrationError: null,
    pending: [],
    markups: [],
    selectedRunId: null,
    tool: "none",
  });
}

function declared(id: string, metresPerUnit: number) {
  return {
    id,
    source: "declared" as const,
    metresPerUnit,
    confidence: 0.95,
    provenance,
  };
}

describe("studio calibration store", () => {
  beforeEach(() => resetStore());

  it("isolates locked scales per page and loads only the current page scale", () => {
    const store = useStudio.getState();
    store.ingestCalibrationCandidate(declared("page-0", 0.1));
    useStudio.getState().lockCurrentCalibration();

    assert.equal(useStudio.getState().currentCalibration.sheet, 0);
    assert.equal(useStudio.getState().currentCalibration.locked, true);
    assert.equal(useStudio.getState().scaleM, 0.1);

    useStudio.getState().setSheet(1);
    assert.equal(useStudio.getState().currentCalibration.sheet, 1);
    assert.equal(useStudio.getState().currentCalibration.locked, false);
    assert.equal(useStudio.getState().scaleM, 1);

    useStudio.getState().ingestCalibrationCandidate(declared("page-1", 0.25));
    useStudio.getState().lockCurrentCalibration();
    useStudio.getState().setTool("length");
    useStudio.getState().addPoint({ x: 0, y: 0 });
    useStudio.getState().addPoint({ x: 8, y: 0 });
    useStudio.getState().commitPending();
    assert.equal(useStudio.getState().job.runs[0].lengthM, 2);
    assert.equal(useStudio.getState().job.runs[0].sheet, 1);

    useStudio.getState().setSheet(0);
    assert.equal(useStudio.getState().scaleM, 0.1);
    assert.equal(useStudio.getState().currentCalibration.selectedCandidateId, "page-0");
  });

  it("requires explicit resolution before conflicting candidates can be locked", () => {
    useStudio.getState().ingestCalibrationCandidate(declared("declared", 0.1));
    useStudio.getState().ingestCalibrationCandidate({
      id: "inferred",
      source: "inferred",
      metresPerUnit: 0.2,
      confidence: 0.8,
      provenance: { ...provenance, method: "engine inference" },
    });

    assert.deepEqual(useStudio.getState().currentCalibration.conflict?.candidateIds, ["declared", "inferred"]);
    assert.equal(useStudio.getState().currentCalibration.selectedCandidateId, null);
    useStudio.getState().lockCurrentCalibration();
    assert.equal(useStudio.getState().currentCalibration.locked, false);
    assert.match(useStudio.getState().calibrationError ?? "", /conflict/i);

    useStudio.getState().resolveCalibrationCandidate("inferred");
    assert.equal(useStudio.getState().currentCalibration.conflict, null);
    assert.equal(useStudio.getState().currentCalibration.selectedCandidateId, "inferred");
    useStudio.getState().lockCurrentCalibration();
    assert.equal(useStudio.getState().currentCalibration.locked, true);
    assert.equal(useStudio.getState().scaleM, 0.2);
  });

  it("captures exactly two points and creates or updates a manual candidate", () => {
    useStudio.getState().startCalibrationCapture();
    useStudio.getState().addPoint({ x: 10, y: 5 });
    useStudio.getState().addPoint({ x: 20, y: 5 });
    useStudio.getState().addPoint({ x: 30, y: 5 });
    assert.equal(useStudio.getState().calibrationCapture?.points.length, 2);
    assert.match(useStudio.getState().calibrationError ?? "", /already captured/i);

    useStudio.getState().upsertManualCalibrationCandidate({
      distance: { value: 5, unit: "m" },
      provenance: { ...provenance, method: "two-point ruler" },
    });
    assert.equal(useStudio.getState().currentCalibration.candidates.length, 1);
    assert.equal(useStudio.getState().currentCalibration.metresPerUnit, 0.5);
    assert.equal(useStudio.getState().currentCalibration.locked, false);

    useStudio.getState().startCalibrationCapture();
    useStudio.getState().addCalibrationPoint({ x: 0, y: 0 });
    useStudio.getState().addCalibrationPoint({ x: 20, y: 0 });
    useStudio.getState().upsertManualCalibrationCandidate({
      distance: { value: 5, unit: "m" },
      provenance: { ...provenance, method: "corrected two-point ruler" },
    });
    assert.equal(useStudio.getState().currentCalibration.candidates.length, 1);
    assert.equal(useStudio.getState().currentCalibration.metresPerUnit, 0.25);
  });

  it("fails closed for metric markups until the current page calibration is locked", () => {
    useStudio.getState().setScale(99);
    assert.equal(useStudio.getState().scaleM, 1);
    assert.match(useStudio.getState().calibrationError ?? "", /verified calibration/i);

    useStudio.getState().setTool("length");
    useStudio.getState().addPoint({ x: 0, y: 0 });
    useStudio.getState().addPoint({ x: 100, y: 0 });
    assert.equal(useStudio.getState().job.runs.length, 0);
    assert.equal(useStudio.getState().markups.length, 0);
    assert.equal(useStudio.getState().pending.length, 0);
    assert.match(useStudio.getState().calibrationError ?? "", /lock a verified calibration/i);

    useStudio.getState().setTool("area");
    useStudio.setState({ pending: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 2 }] });
    useStudio.getState().commitPending();
    assert.equal(useStudio.getState().markups.length, 0);

    useStudio.getState().setTool("count");
    useStudio.getState().addPoint({ x: 4, y: 5 });
    assert.equal(useStudio.getState().job.gates.length, 0, "gate openings require an associated measured run");
    assert.match(useStudio.getState().traceError ?? "", /select a fence run/i);
  });

  it("uses the locked calibration itself for length and area measurements", () => {
    useStudio.getState().ingestCalibrationCandidate(declared("trusted", 0.5));
    useStudio.getState().lockCurrentCalibration();
    useStudio.setState({ scaleM: 999 });

    useStudio.getState().setTool("length");
    useStudio.getState().addPoint({ x: 0, y: 0 });
    useStudio.getState().addPoint({ x: 4, y: 0 });
    useStudio.getState().commitPending();
    assert.equal(useStudio.getState().job.runs[0].lengthM, 2);

    useStudio.getState().setTool("area");
    useStudio.setState({ pending: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 2 }] });
    useStudio.getState().commitPending();
    const area = useStudio.getState().markups.find((markup) => markup.kind === "area");
    assert.equal(area?.value, 0.5);
  });

  it("round-trips the page calibration through the durable job schema", () => {
    useStudio.getState().ingestCalibrationCandidate(declared("persisted", 0.125));
    useStudio.getState().lockCurrentCalibration();
    const parsed = parseFencingJob(JSON.stringify(useStudio.getState().job));

    resetStore(parsed);
    useStudio.getState().setSheet(0);
    assert.equal(useStudio.getState().currentCalibration.locked, true);
    assert.equal(useStudio.getState().currentCalibration.selectedCandidateId, "persisted");
    assert.equal(useStudio.getState().scaleM, 0.125);

    useStudio.getState().unlockCurrentCalibration();
    assert.equal(useStudio.getState().scaleM, 1);
    assert.equal(useStudio.getState().currentCalibration.locked, false);
    assert.equal(useStudio.getState().job.calibrations[0].candidates[0].id, "persisted");
  });
});
