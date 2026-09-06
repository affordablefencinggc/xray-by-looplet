import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDefaultJob, createNewRunSpecification, createRunSpecification, getJobBlockers, missingRunSpecificationFields, parseFencingJob, runSpecificationSchema } from "../domain.ts";
import { createTwoPointCalibrationCandidate, lockCalibration } from "../calibration.ts";
import { applyEvidenceCommand } from "../evidenceCommands.ts";
import { loadFencingJob, saveFencingJob } from "../persistence.ts";
import { constructionRunQuantity } from "./runQuantity.ts";

function fixture() {
  const job = createDefaultJob("2026-09-06T00:00:00.000Z");
  job.documents = [{ id: "source", name: "QA drawing.svg", kind: "svg", importedAt: job.createdAt, pageCount: 1, sha256: "a".repeat(64), source: "web" }];
  job.activeDocumentId = "source";
  const candidate = createTwoPointCalibrationCandidate({ id: "scale", source: "manual", points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], distance: { value: 10, unit: "m" }, transform: job.calibrations[0].transform, confidence: 1, provenance: { method: "two-point", evidence: "QA dimension", documentId: "source" } });
  job.calibrations = [lockCalibration({ ...job.calibrations[0], coordinateSpace: "source-page-v1", candidates: [candidate] })];
  job.runs = [{ id: "general", revision: 3, sheet: 0, label: "QA strip", points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], lengthM: 10, grossLengthM: 10, gateDeductionM: 0, netLengthM: 10, photoIds: [], review: { status: "approved", decidedBy: "QA", decidedAt: job.updatedAt, note: "QA only" }, specification: { ...createRunSpecification(), construction: { assembly: "slab", trade: "Concrete", quantity: "volume", widthM: 2, depthM: 0.2, reference: "QA section dimensions" } } }];
  job.gates = []; job.photos = [];
  return parseFencingJob(job);
}

describe("general construction run quantities", () => {
  it("starts source projects with general runs and follows existing fencing jobs", () => {
    const job = fixture(); job.runs = [];
    assert.equal(createNewRunSpecification(job).constructionEnabled, true);
    job.runs = fixture().runs;
    job.runs[0].specification = createRunSpecification();
    assert.equal(createNewRunSpecification(job).construction, undefined);
    assert.equal(createNewRunSpecification(createDefaultJob()).construction, undefined);
  });
  it("requires general dimensions and references without fence requirements; legacy stays strict", () => {
    const job = fixture(), spec = job.runs[0].specification;
    assert.deepEqual(missingRunSpecificationFields(spec), []);
    assert.deepEqual(getJobBlockers(job), []);
    spec.construction!.widthM = null; spec.construction!.reference = " ";
    assert.deepEqual(missingRunSpecificationFields(spec), ["quantity source reference", "section width / height"]);
    assert.ok(missingRunSpecificationFields(createRunSpecification()).includes("bay width"));
    assert.equal(runSpecificationSchema.safeParse({ ...createRunSpecification(), constructionEnabled: true }).success, false);
    for (const widthM of [0, -1, Infinity, NaN]) assert.equal(runSpecificationSchema.safeParse({ ...spec, construction: { ...spec.construction, widthM } }).success, false);
  });
  it("calculates all three bases from calibrated geometry, ignoring stale stored length", () => {
    const job = fixture(), run = job.runs[0];
    assert.equal(constructionRunQuantity(job, run, true).value, 4);
    assert.equal(constructionRunQuantity(job, run, true).formula, "10 m × 2 m × 0.2 m");
    run.specification.construction!.quantity = "area";
    run.lengthM = 99; run.grossLengthM = 99;
    assert.equal(constructionRunQuantity(job, run, true).value, 20);
    run.specification.construction!.quantity = "length";
    run.specification.construction!.widthM = null;
    assert.equal(constructionRunQuantity(job, run, true).value, 10);
    run.points[1].x = 50;
    assert.equal(constructionRunQuantity(job, run, true).value, 5);
    run.points[1].x = 0.01;
    Object.assign(run.specification.construction!, { quantity: "volume", widthM: 0.001, depthM: 0.001 });
    const tiny = constructionRunQuantity(job, run, true);
    assert.ok(Math.abs(tiny.value! - 1e-9) < 1e-20);
    assert.equal(tiny.formula, "0.001 m × 0.001 m × 0.001 m");
  });
  it("withholds quantities for missing originals, unlocked or foreign calibration, and incomplete dimensions", () => {
    for (const mutate of [
      (job: ReturnType<typeof fixture>) => { job.calibrations[0].locked = false; },
      (job: ReturnType<typeof fixture>) => { job.calibrations[0].coordinateSpace = undefined; },
      (job: ReturnType<typeof fixture>) => { job.calibrations[0].candidates[0].provenance.documentId = "other"; },
      (job: ReturnType<typeof fixture>) => { job.calibrations[0].metresPerUnit *= 2; },
      (job: ReturnType<typeof fixture>) => { job.runs[0].specification.construction!.depthM = null; },
      (job: ReturnType<typeof fixture>) => { job.runs[0].sheet = 1; },
    ]) { const job = fixture(); mutate(job); assert.equal(constructionRunQuantity(job, job.runs[0], true).value, null); }
    const job = fixture(); assert.equal(constructionRunQuantity(job, job.runs[0], false).value, null);
  });
  it("persists general fields and revisions; edits invalidate review and reject stale updates", () => {
    const original = fixture(), run = original.runs[0];
    const changed = applyEvidenceCommand(original, { type: "update-run-specification", runId: run.id, expectedRevision: 3, patch: { construction: { ...run.specification.construction!, depthM: 0.3 } } });
    assert.equal(changed.runs[0].revision, 4); assert.equal(changed.runs[0].review.status, "needs-review");
    assert.equal(constructionRunQuantity(changed, changed.runs[0], true).value, 6);
    assert.throws(() => applyEvidenceCommand(changed, { type: "update-run-specification", runId: run.id, expectedRevision: 3, patch: {} }));
    const data = new Map<string, string>(), storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
    assert.equal(saveFencingJob(changed, storage).ok, true);
    assert.deepEqual(loadFencingJob(storage).job, changed);
    const fence = applyEvidenceCommand(changed, { type: "update-run-specification", runId: run.id, expectedRevision: 4, patch: { constructionEnabled: false } });
    assert.deepEqual(fence.runs[0].specification.construction, changed.runs[0].specification.construction);
    assert.ok(missingRunSpecificationFields(fence.runs[0].specification).includes("bay width"));
    assert.equal(constructionRunQuantity(fence, fence.runs[0], true).value, null);
  });
});
