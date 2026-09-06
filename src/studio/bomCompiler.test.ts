import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDefaultJob, createGateSpecification, createRunSpecification, type FencingJob } from "./domain.ts";
import { createTwoPointCalibrationCandidate, lockCalibration } from "./calibration.ts";
import { compileBomRequest } from "./bomCompiler.ts";
import { verifyBomInputDigest, type BomRecipeSet } from "./bomContract.ts";

const NOW = "2026-09-04T00:00:00.000Z";
const HASH_A = "a".repeat(64);

function recipeSet(status: "accepted" | "unresolved" = "accepted"): BomRecipeSet {
  return {
    id: "recipes-au-fence",
    revision: 1,
    digest: "b".repeat(64),
    recipes: [
      {
        id: "recipe-colorbond-good-neighbour",
        revision: 1,
        system: "colorbond",
        profile: "Good Neighbour",
        maxBayWidthMm: 2400,
        postSpacingMm: 2400,
        materialModel: { kind: "colorbond", effectiveSheetCoverMm: 762, railRows: 2, gateBoundaryPostRole: "gate", assumptionIds: ["assumption-rail-count"] },
        footings: [],
        allowances: [],
        gateHardwareModels: [],
        supportedSlopes: ["level"],
        supportedGround: ["soil"],
        supportedGateTypes: ["single"],
        supportedRetainingTypes: ["none"],
        supportsSleepers: false,
        assumptions: [
          {
            id: "assumption-rail-count",
            key: "rails-per-bay",
            label: "Two rails per bay",
            value: "2",
            unit: "ea",
            source: "Estimator-selected recipe",
            effectiveAt: NOW,
            status,
            acceptedBy: status === "accepted" ? "Daniel" : null,
            acceptedAt: status === "accepted" ? NOW : null,
          },
        ],
        components: [
          {
            id: "component-rail",
            itemCode: "CB-RAIL",
            description: "Colorbond rail",
            unit: "ea",
            basis: "per-bay",
            factor: "2",
            assumptionIds: ["assumption-rail-count"],
          },
        ],
      },
    ],
  };
}

function approvedJob(): FencingJob {
  const job = createDefaultJob(NOW);
  job.id = "job-contract";
  job.revision = 7;
  job.name = "Boundary fence";
  job.documents = [
    {
      id: "doc-plan",
      name: "boundary.svg",
      kind: "svg",
      importedAt: NOW,
      pageCount: 1,
      sha256: HASH_A,
      source: "web",
    },
  ];
  job.activeDocumentId = "doc-plan";
  const candidate = createTwoPointCalibrationCandidate({
    id: "candidate-manual",
    source: "manual",
    points: [
      { x: 0, y: 0 },
      { x: 4.8, y: 0 },
    ],
    distance: { value: 4.8, unit: "m" },
    transform: job.calibrations[0].transform,
    confidence: 1,
    provenance: { method: "two-point", evidence: "Known boundary", documentId: "doc-plan" },
  });
  job.calibrations = [lockCalibration({ ...job.calibrations[0], coordinateSpace: "source-page-v1", candidates: [candidate] })];
  job.runs = [
    {
      id: "run-north",
      revision: 2,
      sheet: 0,
      label: "North boundary",
      points: [
        { x: 0, y: 0 },
        { x: 4.8, y: 0 },
      ],
      lengthM: 4.8,
      grossLengthM: 4.8,
      gateDeductionM: 0,
      netLengthM: 4.8,
      specification: {
        ...createRunSpecification(),
        system: "colorbond",
        profile: "Good Neighbour",
        heightM: 1.8,
        bayWidthM: 2.4,
        ground: "soil",
        slope: "level",
        access: "clear",
        sleepers: "none",
      },
      photoIds: [],
      review: { status: "approved", decidedAt: NOW, decidedBy: "Daniel", note: "Checked" },
    },
  ];
  job.gates = [];
  job.photos = [];
  return job;
}

const READY = {
  document: { state: "ready" as const, message: null },
  photos: {},
};

describe("job-to-BOM compiler", () => {
  it("rejects general runs even when retained fence attributes match a valid recipe", async () => {
    const job = approvedJob();
    job.runs[0].specification.construction = { assembly: "wall", trade: "Masonry", quantity: "area", widthM: 3, depthM: null, reference: "QA wall section" };
    const result = await compileBomRequest({ job, recipeSet: recipeSet(), runtimeAssets: READY, hydrationSettled: true, requestId: "general" });
    assert.equal(result.ok, false);
    if (!result.ok) assert.deepEqual(result.issues.map((issue) => issue.code), ["unsupported-configuration"]);
    job.runs[0].specification.constructionEnabled = false;
    assert.equal((await compileBomRequest({ job, recipeSet: recipeSet(), runtimeAssets: READY, hydrationSettled: true, requestId: "fence-again" })).ok, true);
  });
  it("rejects preserved imported legacy calibration even when locked and approved",async()=>{
    const job=approvedJob();delete job.calibrations[0].coordinateSpace;const before=JSON.stringify(job);
    const result=await compileBomRequest({job,recipeSet:recipeSet(),runtimeAssets:READY,hydrationSettled:true,requestId:"legacy-rejected"});
    assert.equal(result.ok,false);if(!result.ok)assert.ok(result.issues.some(issue=>/legacy source coordinates/i.test(issue.message)));assert.equal(JSON.stringify(job),before);
  });
  it("compiles an approved, verified job into sorted integer-millimetre input", async () => {
    const result = await compileBomRequest({
      job: approvedJob(),
      runtimeAssets: READY,
      hydrationSettled: true,
      recipeSet: recipeSet(),
      requestId: "request-one",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.request.runs[0].segments, [{ index: 0, lengthMm: 4800 }]);
    assert.equal(result.request.runs[0].vertices[0].topologyNodeId, "sheet:0:x:0:y:0");
    assert.equal(result.request.runs[0].approval.entityRevision, 2);
    assert.equal(await verifyBomInputDigest(result.request), true);
  });

  it("fails closed for runtime originals and stale lengths", async () => {
    const job = approvedJob();
    job.runs[0].grossLengthM = 4.7;
    job.runs[0].netLengthM = 4.7;
    job.runs[0].lengthM = 4.7;
    const result = await compileBomRequest({
      job,
      runtimeAssets: { document: { state: "corrupt", message: "Hash mismatch" }, photos: {} },
      hydrationSettled: true,
      recipeSet: recipeSet(),
      requestId: "request-bad",
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.issues.some((issue) => issue.code === "length-mismatch"));
    assert.ok(result.issues.some((issue) => issue.code === "document-original"));
  });

  it("rejects structurally invalid approval attribution before compilation", async () => {
    const job = approvedJob();
    job.runs[0].review = { status: "approved", decidedAt: null, decidedBy: "", note: "" };
    const result = await compileBomRequest({ job, runtimeAssets: READY, hydrationSettled: true, recipeSet: recipeSet(), requestId: "request-review" });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.issues.some((issue) => issue.code === "invalid-job"));
  });

  it("blocks unresolved recipe assumptions instead of applying a default", async () => {
    const result = await compileBomRequest({
      job: approvedJob(),
      runtimeAssets: READY,
      hydrationSettled: true,
      recipeSet: recipeSet("unresolved"),
      requestId: "request-assumption",
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.issues.some((issue) => issue.code === "assumption"));
  });

  it("treats the approved bay width as input and the recipe maximum as a hard capability", async () => {
    const recipes = recipeSet();
    recipes.recipes[0].maxBayWidthMm = 2300;
    const result = await compileBomRequest({ job: approvedJob(), runtimeAssets: READY, hydrationSettled: true, recipeSet: recipes, requestId: "request-bay-limit" });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.issues.some((issue) => issue.code === "unsupported-configuration" && issue.path === "runs.specification.bayWidthMm"));
  });

  it("copies exact typed gate hardware facts from one supported recipe model", async () => {
    const job = approvedJob();
    job.gates = [{
      id: "gate-double",
      revision: 3,
      sheet: 0,
      label: "Driveway gate",
      point: { x: 2.4, y: 0 },
      runId: "run-north",
      segmentIndex: 0,
      segmentT: 0.5,
      photoIds: [],
      review: { status: "approved", decidedAt: NOW, decidedBy: "Daniel", note: "Checked" },
      ...createGateSpecification(),
      widthM: 1.2,
      heightM: 1.8,
      type: "double",
      openingDirection: "inward",
      hingeSide: "double",
      hardware: "Two hinge sets",
      latch: "Centre latch",
      postSize: "100 x 100",
    }];
    job.runs[0].gateDeductionM = 1.2;
    job.runs[0].netLengthM = 3.6;
    job.runs[0].lengthM = 3.6;
    const recipes = recipeSet();
    recipes.recipes[0].supportedGateTypes = ["double"];
    recipes.recipes[0].gateHardwareModels = [{
      id: "gate-model-double-1200",
      gateType: "double",
      widthMm: 1200,
      leafCount: 2,
      boundaryPostCount: 2,
      hingeSetCount: 2,
      latchCount: 1,
      dropBoltCount: 1,
      assumptionIds: ["assumption-rail-count"],
    }];
    const result = await compileBomRequest({ job, runtimeAssets: READY, hydrationSettled: true, recipeSet: recipes, requestId: "request-gate-model" });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(
      [result.request.gates[0].hardwareModelId, result.request.gates[0].leafCount, result.request.gates[0].boundaryPostCount, result.request.gates[0].hingeSetCount, result.request.gates[0].latchCount, result.request.gates[0].dropBoltCount],
      ["gate-model-double-1200", 2, 2, 2, 1, 1],
    );
  });

  it("shares exact same-sheet endpoints and T-junction vertices independent of run order", async () => {
    const first = approvedJob();
    const specification = first.runs[0].specification;
    const approval = { status: "approved" as const, decidedAt: NOW, decidedBy: "Daniel", note: "Checked" };
    first.runs = [
      {
        ...first.runs[0],
        id: "run-a",
        label: "Main",
        points: [{ x: 0, y: 0 }, { x: 2.4, y: 0 }, { x: 4.8, y: 0 }],
        specification,
        grossLengthM: 4.8,
        gateDeductionM: 0,
        netLengthM: 4.8,
        lengthM: 4.8,
        review: approval,
      },
      {
        ...first.runs[0],
        id: "run-b",
        label: "T branch",
        points: [{ x: 2.4, y: 0 }, { x: 2.4, y: 2.4 }],
        specification,
        grossLengthM: 2.4,
        gateDeductionM: 0,
        netLengthM: 2.4,
        lengthM: 2.4,
        review: approval,
      },
      {
        ...first.runs[0],
        id: "run-c",
        label: "Connected end",
        points: [{ x: 4.8, y: 0 }, { x: 7.2, y: 0 }],
        specification,
        grossLengthM: 2.4,
        gateDeductionM: 0,
        netLengthM: 2.4,
        lengthM: 2.4,
        review: approval,
      },
    ];
    const second = structuredClone(first);
    second.runs.reverse();
    const compile = (job: FencingJob, requestId: string) => compileBomRequest({ job, runtimeAssets: READY, hydrationSettled: true, recipeSet: recipeSet(), requestId });
    const [left, right] = await Promise.all([compile(first, "ordered"), compile(second, "shuffled")]);
    assert.equal(left.ok, true);
    assert.equal(right.ok, true);
    if (!left.ok || !right.ok) return;
    const byRun = new Map(left.request.runs.map((run) => [run.id, run]));
    assert.equal(byRun.get("run-a")!.vertices[1].topologyNodeId, byRun.get("run-b")!.vertices[0].topologyNodeId, "T-junction");
    assert.equal(byRun.get("run-a")!.vertices[2].topologyNodeId, byRun.get("run-c")!.vertices[0].topologyNodeId, "connected endpoint");
    assert.deepEqual(left.request.runs, right.request.runs);
    assert.equal(left.request.inputDigest, right.request.inputDigest);
  });
});
