import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDefaultJob } from "../domain.ts";
import {
  constructionJobSchema,
  priceLineSchema,
  calculateQuantity,
  parseQuantityResult,
  validateQuantityAgainstJob,
  importLegacyFencingJob,
  validateJobTransition,
} from "./index.ts";
import type { ConstructionJob, Measurement } from "./index.ts";

const time = "2026-09-05T00:00:00.000Z";
const sha256 = "a".repeat(64);
const locator = { kind: "page" as const, sourceRevisionId: "drawing-r1", sha256, pageIndex: 0 };
const rectangle = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 4 },
  { x: 0, y: 4 },
];
function fixture(kind: Measurement["kind"] = "count"): ConstructionJob {
  const common = {
    id: "measure-1",
    revision: 1,
    workPackageId: "package-1",
    label: "Measured work",
    locator,
    evidenceIds: ["drawing-evidence"],
    review: {
      status: "approved" as const,
      measurementRevision: 1,
      decidedBy: "estimator",
      decidedAt: time,
      note: "Checked against source",
    },
    deductions: [],
  };
  const measurement: Measurement =
    kind === "count"
      ? {
          ...common,
          kind,
          items: ["outlet-a", "outlet-b", "outlet-c"].map((id) => ({
            id,
            evidenceIds: ["drawing-evidence"],
          })),
        }
      : kind === "length"
        ? {
            ...common,
            kind,
            calibrationId: "scale-1",
            points: [
              { x: 0, y: 0 },
              { x: 3, y: 4 },
              { x: 6, y: 4 },
            ],
          }
        : kind === "area"
          ? { ...common, kind, calibrationId: "scale-1", points: rectangle }
          : {
              ...common,
              kind,
              basis: {
                method: "area-depth",
                calibrationId: "scale-1",
                points: rectangle,
                depth: { value: 200, unit: "mm", evidenceIds: ["spec-evidence"] },
              },
            };
  return structuredClone({
    schema: "xray.construction-job/v1",
    id: "job-1",
    revision: 1,
    name: "Multi-trade estimate",
    createdAt: time,
    updatedAt: time,
    workPackages: [
      {
        id: "package-1",
        revision: 1,
        trade: { count: "electrical", length: "plumbing", area: "flooring", volume: "concrete" }[
          kind
        ],
        name: "Work package",
        pack: null,
      },
    ],
    sources: [
      {
        id: "drawing-r1",
        documentId: "drawing",
        revision: 1,
        sha256,
        name: "Services drawing",
        kind: "pdf",
        importedAt: time,
        assetId: "asset-1",
        pageCount: 1,
      },
      {
        id: "spec-r1",
        documentId: "spec",
        revision: 1,
        sha256: "b".repeat(64),
        name: "Specification",
        kind: "specification",
        importedAt: time,
        assetId: "asset-2",
        pageCount: null,
      },
    ],
    evidence: [
      { id: "drawing-evidence", locator, note: "Identified on drawing" },
      {
        id: "spec-evidence",
        locator: {
          kind: "document",
          sourceRevisionId: "spec-r1",
          sha256: "b".repeat(64),
          section: "Slab thickness",
        },
        note: "200 mm thickness specified",
      },
    ],
    calibrations:
      kind === "count"
        ? []
        : [
            {
              id: "scale-1",
              revision: 1,
              locator,
              metresPerCoordinateUnit: 1,
              method: "two-point",
              inputDistance: { value: 10, unit: "m" },
              coordinateDistance: 10,
              referencePoints: [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
              ],
              evidenceIds: ["drawing-evidence"],
              verifiedBy: "estimator",
              verifiedAt: time,
            },
          ],
    measurements: [measurement],
    extensions: {},
  });
}
const result = (job: ConstructionJob) => calculateQuantity(job, "measure-1", "result-1");
describe("construction universal quantities", () => {
  it("electrical counts need evidence and no calibration or fence fields", () => {
    const job = fixture();
    const before = structuredClone(job);
    const quantity = result(job);
    assert.equal(quantity.net, 3);
    assert.equal(quantity.unit, "ea");
    assert.deepEqual(quantity.calibrations, []);
    assert.deepEqual(job, before);
    assert.equal("runs" in job, false);
    assert.equal("system" in job.workPackages[0], false);
    assert.deepEqual(parseQuantityResult(quantity), quantity);
  });
  it("measures plumbing polyline length with evidenced deductions", () => {
    const job = fixture("length");
    job.measurements[0].deductions = [
      {
        id: "excluded",
        value: 1.5,
        unit: "m",
        reason: "Existing pipe retained",
        evidenceIds: ["drawing-evidence"],
      },
    ];
    const quantity = result(job);
    assert.equal(quantity.gross, 8);
    assert.equal(quantity.net, 6.5);
    assert.equal(quantity.unit, "m");
    assert.deepEqual(quantity.measurement, job.measurements[0]);
  });
  it("measures flooring area independently of polygon winding", () => {
    const job = fixture("area");
    assert.equal(result(job).net, 40);
    if (job.measurements[0].kind === "area") job.measurements[0].points.reverse();
    assert.equal(result(job).net, 40);
    assert.equal(result(job).unit, "m2");
  });
  it("concrete volume requires explicit cross-document evidenced depth", () => {
    const quantity = result(fixture("volume"));
    assert.equal(quantity.net, 8);
    assert.equal(quantity.unit, "m3");
    assert.equal(quantity.sources.length, 2);
    assert.equal(quantity.evidence.length, 2);
  });
  it("supports verified native model volume with explicit units/property", () => {
    const job = fixture("volume");
    const modelLocator = {
      kind: "model" as const,
      sourceRevisionId: "drawing-r1",
      sha256,
      elementId: "ifc-slab-1",
      property: "NetVolume",
    };
    job.sources[0].kind = "ifc";
    job.sources[0].pageCount = null;
    job.calibrations = [];
    job.evidence[0].locator = modelLocator;
    const measurement = job.measurements[0];
    assert.equal(measurement.kind, "volume");
    if (measurement.kind !== "volume") throw new Error("fixture");
    measurement.locator = modelLocator;
    measurement.basis = {
      method: "native-volume",
      value: 1e9,
      unit: "mm3",
      locator: modelLocator,
      evidenceIds: ["drawing-evidence"],
      verifiedBy: "estimator",
      verifiedAt: time,
    };
    assert.equal(result(job).net, 1);
    if (measurement.basis.locator.kind === "model") delete measurement.basis.locator.property;
    assert.throws(() => result(job));
  });
  it("separates multiple trades and duplicate page numbers across documents", () => {
    const job = fixture();
    const other = fixture("area");
    other.workPackages[0].id = "package-2";
    other.measurements[0].id = "measure-2";
    other.measurements[0].workPackageId = "package-2";
    job.workPackages.push(other.workPackages[0]);
    job.measurements.push(other.measurements[0]);
    job.calibrations = other.calibrations;
    const secondLocator = {
      ...locator,
      sourceRevisionId: "second-drawing-r1",
      sha256: "c".repeat(64),
    };
    job.sources.push({
      ...job.sources[0],
      id: secondLocator.sourceRevisionId,
      documentId: "second-drawing",
      sha256: secondLocator.sha256,
    });
    job.evidence.push({
      id: "second-evidence",
      locator: secondLocator,
      note: "Different document, same sheet 0",
    });
    assert.equal(constructionJobSchema.parse(job).workPackages.length, 2);
    job.calibrations[0].locator = secondLocator;
    job.calibrations[0].evidenceIds = ["second-evidence"];
    assert.throws(
      () => calculateQuantity(job, "measure-2", "result-2"),
      /exact measurement source/,
    );
  });
  it("rejects missing/hash-mismatched/future source identity and out-of-range pages", () => {
    for (const mutation of [
      (job: ConstructionJob) => {
        job.measurements[0].locator.sha256 = "f".repeat(64);
      },
      (job: ConstructionJob) => {
        job.sources = [];
      },
      (job: ConstructionJob) => {
        if (job.measurements[0].locator.kind === "page") job.measurements[0].locator.pageIndex = 1;
      },
    ]) {
      const job = fixture();
      mutation(job);
      assert.throws(() => result(job));
    }
    assert.throws(() =>
      result({ ...fixture(), schema: "xray.construction-job/v99" } as unknown as ConstructionJob),
    );
  });
  it("rejects count item evidence pointing only to another document", () => {
    const job = fixture();
    const measurement = job.measurements[0];
    if (measurement.kind === "count") measurement.items[0].evidenceIds = ["spec-evidence"];
    assert.throws(() => result(job), /Count item requires evidence/);
  });
  it("rejects duplicate count items within and across measurements", () => {
    const job = fixture();
    const copy = structuredClone(job.measurements[0]);
    copy.id = "measure-2";
    job.measurements.push(copy);
    assert.throws(() => result(job), /more than one measurement/);
    job.measurements.pop();
    if (job.measurements[0].kind === "count")
      job.measurements[0].items.push(job.measurements[0].items[0]);
    assert.throws(() => result(job), /unique/);
  });
  it("rejects zero/negative/nonfinite/inconsistent or unevidenced scale", () => {
    for (const scale of [0, -1, NaN, Infinity, 2]) {
      const job = fixture("length");
      job.calibrations[0].metresPerCoordinateUnit = scale;
      assert.throws(() => result(job));
    }
    const job = fixture("length");
    job.calibrations[0].evidenceIds = ["spec-evidence"];
    assert.throws(() => result(job), /Calibration requires evidence/);
  });
  it("rejects absent/zero/negative/unevidenced depth without guessing", () => {
    for (const depth of [
      undefined,
      { value: 0, unit: "m", evidenceIds: ["spec-evidence"] },
      { value: -1, unit: "m", evidenceIds: ["spec-evidence"] },
      { value: 1, unit: "m", evidenceIds: [] },
    ]) {
      const job = fixture("volume");
      (job.measurements[0] as unknown as { basis: { depth: unknown } }).basis.depth = depth;
      assert.throws(() => result(job));
    }
  });
  it("rejects self-crossing, overlapping, degenerate and repeated polygon vertices", () => {
    for (const points of [
      [
        { x: 0, y: 0 },
        { x: 4, y: 4 },
        { x: 0, y: 4 },
        { x: 4, y: 0 },
      ],
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
      [...rectangle, rectangle[0]],
    ]) {
      const job = fixture("area");
      if (job.measurements[0].kind === "area") job.measurements[0].points = points;
      assert.throws(() => result(job));
    }
  });
  it("rejects wrong-unit, excessive and fractional-count deductions", () => {
    for (const [value, unit] of [
      [1, "m"],
      [4, "ea"],
      [0.5, "ea"],
    ] as const) {
      const job = fixture();
      job.measurements[0].deductions = [
        { id: "deduct", value, unit, reason: "Exclusion", evidenceIds: ["drawing-evidence"] },
      ];
      assert.throws(() => result(job));
    }
  });
  it("rejects forged results, stale review, missing evidence, nonfinite coordinates and extra keys", () => {
    const quantity = result(fixture());
    assert.throws(() => parseQuantityResult({ ...quantity, gross: 99, net: 99 }));
    assert.throws(() => parseQuantityResult({ ...quantity, evidence: [] }));
    const job = fixture();
    job.measurements[0].revision = 2;
    assert.throws(() => result(job), /different measurement revision/);
    const draft = fixture();
    draft.measurements[0].review = { status: "draft" };
    assert.throws(() => result(draft), /approval/);
    assert.throws(() => result({ ...fixture(), fenceSystem: "colorbond" } as ConstructionJob));
    const length = fixture("length");
    if (length.measurements[0].kind === "length") length.measurements[0].points[0].x = Infinity;
    assert.throws(() => result(length));
  });
  it("rejects finite input whose calculated quantity overflows supported bounds", () => {
    const job = fixture("area");
    job.calibrations[0].metresPerCoordinateUnit = 1e12;
    job.calibrations[0].inputDistance.value = 1e13;
    assert.throws(() => result(job), /supported range/);
  });
  it("keeps currency rates exact and final amounts in integer minor units", () => {
    const price = {
      id: "price",
      purchaseRequirementId: "purchase",
      currency: "AUD",
      unitRateDecimal: "12.345",
      amountMinorUnits: 1235,
      priceSource: "supplier-quote",
      effectiveAt: time,
    };
    assert.equal(priceLineSchema.parse(price).unitRateDecimal, "12.345");
    assert.equal(priceLineSchema.safeParse({ ...price, amountMinorUnits: 12.35 }).success, false);
    assert.equal(priceLineSchema.safeParse({ ...price, unitRateDecimal: 12.345 }).success, false);
  });
  it("rejects internally consistent quantities with stale job or altered provenance", () => {
    const job = fixture();
    const quantity = result(job);
    assert.deepEqual(validateQuantityAgainstJob(quantity, job), quantity);
    const revised = structuredClone(job);
    revised.revision++;
    assert.throws(() => validateQuantityAgainstJob(quantity, revised), /current job revision/);
    const altered = structuredClone(quantity);
    altered.sources[0].name = "Invented source description";
    assert.deepEqual(parseQuantityResult(altered), altered);
    assert.throws(() => validateQuantityAgainstJob(altered, job), /current job revision/);
  });
});
describe("independent verification regressions", () => {
  it("binds native volume to the exact measured and evidenced model property", () => {
    const job = fixture("volume");
    const model = {
      kind: "model" as const,
      sourceRevisionId: "drawing-r1",
      sha256,
      elementId: "slab-1",
      property: "NetVolume",
    };
    job.sources[0].kind = "ifc";
    job.sources[0].pageCount = null;
    job.calibrations = [];
    job.evidence[0].locator = { ...model };
    const measurement = job.measurements[0];
    if (measurement.kind !== "volume") throw new Error("fixture");
    measurement.locator = { ...model };
    measurement.basis = {
      method: "native-volume",
      value: 30,
      unit: "m3",
      locator: { ...model, property: "GrossVolume" },
      evidenceIds: ["drawing-evidence"],
      verifiedBy: "estimator",
      verifiedAt: time,
    };
    assert.equal(constructionJobSchema.safeParse(job).success, false);
    measurement.locator.property = "GrossVolume";
    assert.throws(() => result(job), /exact model property/);
    job.evidence[0].locator = { ...model, property: "GrossVolume" };
    assert.equal(result(job).gross, 30);
  });
  it("rejects positive length, area and volume underflow rather than certifying zero", () => {
    for (const kind of ["length", "area", "volume"] as const) {
      const job = fixture(kind);
      job.calibrations[0].metresPerCoordinateUnit = 1e-200;
      job.calibrations[0].inputDistance.value = 1e-199;
      if (job.measurements[0].kind === "length")
        job.measurements[0].points = [
          { x: 0, y: 0 },
          { x: 1e-200, y: 0 },
        ];
      assert.throws(() => result(job), /underflows/);
    }
  });
});
describe("construction revision lifecycle", () => {
  it("preserves immutable source/evidence/calibration identity", () => {
    for (const key of ["sources", "evidence", "calibrations"] as const) {
      const previous = fixture("length");
      const next = structuredClone(previous);
      next.revision++;
      if (key === "sources") next.sources[0].name = "Changed";
      if (key === "evidence") next.evidence[0].note = "Changed";
      if (key === "calibrations") next.calibrations[0].verifiedBy = "Changed";
      assert.throws(() => validateJobTransition(previous, next), /append-only/);
    }
  });
  it("requires rereview after operand or work-package changes", () => {
    const previous = fixture();
    const next = structuredClone(previous);
    next.revision++;
    next.measurements[0].label = "Changed scope";
    assert.throws(() => validateJobTransition(previous, next), /fresh draft/);
    next.measurements[0].revision++;
    next.measurements[0].review = { status: "draft" };
    assert.equal(validateJobTransition(previous, next).revision, 2);
    const packageChange = structuredClone(previous);
    packageChange.revision++;
    packageChange.workPackages[0].revision++;
    packageChange.workPackages[0].trade = "mechanical";
    assert.throws(() => validateJobTransition(previous, packageChange), /invalidate/);
  });
  it("allows review-only transitions and rejects lost history/revision conflicts", () => {
    const previous = fixture();
    previous.measurements[0].review = { status: "draft" };
    const next = fixture();
    next.revision++;
    assert.equal(validateJobTransition(previous, next).measurements[0].review.status, "approved");
    assert.throws(() => validateJobTransition(previous, previous));
    next.measurements = [];
    assert.throws(() => validateJobTransition(previous, next), /history/);
  });
});
describe("non-writing legacy fencing import", () => {
  it("preserves complete v1 and v2 originals, IDs, revisions, assets and historical snapshots", () => {
    for (const version of [1, 2]) {
      const legacy = {
        ...createDefaultJob(time),
        id: "original-job",
        schemaVersion: version,
        revision: 12,
        unknownFutureExtension: { original: [1, 2, 3] },
        revisionHistory: [
          {
            id: "history-1",
            sequence: 1,
            occurredAt: time,
            entityType: "job",
            entityId: "original-job",
            action: "update",
            summary: "Original historical edit",
          },
        ],
      };
      const originalJobJson = JSON.stringify(legacy, null, 2);
      const options = {
        workPackageId: "legacy-fence-package",
        preservedAssets: [
          { id: "asset", mediaType: "application/pdf", sha256, bytesBase64: "YWJj" },
        ],
        preservedRecords: [
          { key: "historical-bom", originalJson: '{"schema":"xray.bom/v1","snapshotRevision":7}' },
        ],
      };
      const imported = importLegacyFencingJob(originalJobJson, options);
      assert.equal(imported.id, "original-job");
      assert.equal(imported.revision, 12);
      assert.equal(imported.extensions.legacyFencing!.originalJobJson, originalJobJson);
      assert.equal(imported.extensions.legacyFencing!.originalSchemaVersion, version);
      assert.deepEqual(imported.extensions.legacyFencing!.preservedAssets, options.preservedAssets);
      assert.deepEqual(
        imported.extensions.legacyFencing!.preservedRecords,
        options.preservedRecords,
      );
      assert.deepEqual(imported.measurements, []);
      assert.deepEqual(imported.sources, []);
      assert.equal(imported.workPackages[0].pack, null);
    }
  });
  it("rejects corrupt and future jobs without writing or accepting partial data", () => {
    const options = { workPackageId: "fence", preservedAssets: [], preservedRecords: [] };
    assert.throws(() =>
      importLegacyFencingJob(
        JSON.stringify({ ...createDefaultJob(time), schemaVersion: 1, revisionHistory: "corrupt" }),
        options,
      ),
    );
    for (const original of [
      "{",
      "null",
      "[]",
      '{"schemaVersion":2}',
      JSON.stringify({ ...createDefaultJob(time), schemaVersion: 3 }),
    ])
      assert.throws(() => importLegacyFencingJob(original, options));
    assert.throws(() =>
      importLegacyFencingJob(JSON.stringify(createDefaultJob(time)), {
        ...options,
        preservedRecords: [{ key: "bad", originalJson: "{" }],
      }),
    );
  });
});
