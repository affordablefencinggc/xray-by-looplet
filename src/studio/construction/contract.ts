import { z } from "zod";

export const CONSTRUCTION_JOB_SCHEMA = "xray.construction-job/v1" as const;
export const QUANTITY_RESULT_SCHEMA = "xray.quantity-result/v1" as const;
export const QUANTITY_RULESET = "universal-quantity/v1" as const;
const id = z
  .string()
  .min(1)
  .max(240)
  .refine(
    (value) => value.trim() === value && value.length > 0,
    "Identifiers cannot have surrounding whitespace.",
  );
const revision = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const scalar = z.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER);
const positive = scalar.positive();
const timestamp = z.string().datetime({ offset: true });
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const ids = z
  .array(id)
  .refine((values) => new Set(values).size === values.length, "Duplicate references.");
export const lengthUnitSchema = z.enum(["mm", "cm", "m", "in", "ft"]);
export const quantityUnitSchema = z.enum(["ea", "m", "m2", "m3"]);
export const pointSchema = z
  .object({
    x: z.number().finite().min(-1e12).max(1e12),
    y: z.number().finite().min(-1e12).max(1e12),
  })
  .strict();
export const sourceRevisionSchema = z
  .object({
    id,
    documentId: id,
    revision,
    sha256: hash,
    name: id,
    kind: z.enum(["pdf", "dxf", "svg", "ifc", "image", "specification", "other"]),
    importedAt: timestamp,
    assetId: id,
    pageCount: z.number().int().positive().nullable(),
  })
  .strict();
const sourceBinding = { sourceRevisionId: id, sha256: hash };
export const sourceLocatorSchema = z.discriminatedUnion("kind", [
  z
    .object({
      ...sourceBinding,
      kind: z.literal("page"),
      pageIndex: z.number().int().nonnegative(),
      region: z.array(pointSchema).min(1).optional(),
    })
    .strict(),
  z
    .object({ ...sourceBinding, kind: z.literal("model"), elementId: id, property: id.optional() })
    .strict(),
  z.object({ ...sourceBinding, kind: z.literal("document"), section: id }).strict(),
]);
export const evidenceSchema = z
  .object({
    id,
    locator: sourceLocatorSchema,
    note: z
      .string()
      .min(1)
      .max(4000)
      .refine((value) => !!value.trim(), "Evidence note required."),
  })
  .strict();
export const calibrationSchema = z
  .object({
    id,
    revision,
    locator: sourceLocatorSchema,
    metresPerCoordinateUnit: positive,
    method: z.enum(["two-point", "declared-unit"]),
    inputDistance: z.object({ value: positive, unit: lengthUnitSchema }).strict(),
    coordinateDistance: positive,
    referencePoints: z.tuple([pointSchema, pointSchema]).nullable(),
    evidenceIds: ids.nonempty(),
    verifiedBy: id,
    verifiedAt: timestamp,
  })
  .strict()
  .superRefine((value, context) => {
    const expected =
      (value.inputDistance.value * METRES_PER_UNIT[value.inputDistance.unit]) /
      value.coordinateDistance;
    if (
      !Number.isFinite(expected) ||
      expected <= 0 ||
      Math.abs(expected / value.metresPerCoordinateUnit - 1) > 1e-12
    )
      context.addIssue({
        code: "custom",
        message: "Scale must match its explicit distance operands.",
      });
    if (value.method === "two-point") {
      const points = value.referencePoints;
      const distance = points
        ? Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y)
        : 0;
      if (distance <= 0 || Math.abs(distance / value.coordinateDistance - 1) > 1e-12)
        context.addIssue({
          code: "custom",
          message: "Two-point scale requires matching reference-point distance.",
        });
    } else if (
      value.referencePoints !== null ||
      value.coordinateDistance !== 1 ||
      value.inputDistance.value !== 1
    )
      context.addIssue({
        code: "custom",
        message: "Declared units require exactly one input unit per coordinate unit.",
      });
    if (value.locator.kind === "document")
      context.addIssue({
        code: "custom",
        message: "Geometry calibration requires a page or model locator.",
      });
  });
export const METRES_PER_UNIT = { mm: 0.001, cm: 0.01, m: 1, in: 0.0254, ft: 0.3048 } as const;
export const reviewSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("draft") }).strict(),
  z
    .object({
      status: z.enum(["approved", "rejected"]),
      measurementRevision: revision,
      decidedBy: id,
      decidedAt: timestamp,
      note: z.string().max(2000),
    })
    .strict(),
]);
const common = {
  id,
  revision,
  workPackageId: id,
  label: id,
  locator: sourceLocatorSchema,
  evidenceIds: ids.nonempty(),
  review: reviewSchema,
};
const deduction = z
  .object({ id, value: scalar, unit: quantityUnitSchema, reason: id, evidenceIds: ids.nonempty() })
  .strict();
const planar = { calibrationId: id, points: z.array(pointSchema).min(3).max(10000) };
export const measurementSchema = z
  .discriminatedUnion("kind", [
    z
      .object({
        ...common,
        kind: z.literal("count"),
        items: z.array(z.object({ id, evidenceIds: ids.nonempty() }).strict()).max(100000),
        deductions: z.array(deduction),
      })
      .strict(),
    z
      .object({
        ...common,
        kind: z.literal("length"),
        calibrationId: id,
        points: z.array(pointSchema).min(2).max(10000),
        deductions: z.array(deduction),
      })
      .strict(),
    z
      .object({ ...common, kind: z.literal("area"), ...planar, deductions: z.array(deduction) })
      .strict(),
    z
      .object({
        ...common,
        kind: z.literal("volume"),
        basis: z.discriminatedUnion("method", [
          z
            .object({
              method: z.literal("area-depth"),
              ...planar,
              depth: z
                .object({ value: positive, unit: lengthUnitSchema, evidenceIds: ids.nonempty() })
                .strict(),
            })
            .strict(),
          z
            .object({
              method: z.literal("native-volume"),
              value: positive,
              unit: z.enum(["mm3", "m3", "ft3"]),
              locator: sourceLocatorSchema,
              evidenceIds: ids.nonempty(),
              verifiedBy: id,
              verifiedAt: timestamp,
            })
            .strict(),
        ]),
        deductions: z.array(deduction),
      })
      .strict(),
  ])
  .superRefine((value, context) => {
    const unit = { count: "ea", length: "m", area: "m2", volume: "m3" }[value.kind];
    if (
      value.deductions.some(
        (entry) => entry.unit !== unit || (unit === "ea" && !Number.isSafeInteger(entry.value)),
      )
    )
      context.addIssue({
        code: "custom",
        message: "Deductions require the measurement's canonical unit; counts must be integers.",
      });
    if (new Set(value.deductions.map((entry) => entry.id)).size !== value.deductions.length)
      context.addIssue({ code: "custom", message: "Duplicate deduction IDs." });
    if (
      value.kind === "count" &&
      new Set(value.items.map((entry) => entry.id)).size !== value.items.length
    )
      context.addIssue({ code: "custom", message: "Count item IDs must be unique." });
    if (value.review.status !== "draft" && value.review.measurementRevision !== value.revision)
      context.addIssue({
        code: "custom",
        message: "Review is bound to a different measurement revision.",
      });
    if (value.kind !== "count" && value.locator.kind === "document")
      context.addIssue({ code: "custom", message: "Geometry requires a page or model locator." });
    if (
      value.kind === "volume" &&
      value.basis.method === "native-volume" &&
      value.basis.locator.kind !== "model"
    )
      context.addIssue({
        code: "custom",
        message: "Native volume requires an explicit model property locator.",
      });
  });
export const workPackageSchema = z
  .object({
    id,
    revision,
    trade: id,
    name: id,
    pack: z.object({ id, version: id }).strict().nullable(),
  })
  .strict();
export const legacyExtensionSchema = z
  .object({
    schema: z.literal("xray.legacy-fencing-import/v1"),
    originalSchemaVersion: z.union([z.literal(1), z.literal(2)]),
    originalJobJson: z.string().min(1),
    preservedAssets: z.array(
      z
        .object({
          id,
          mediaType: id,
          sha256: hash,
          bytesBase64: z
            .string()
            .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
        })
        .strict(),
    ),
    preservedRecords: z.array(z.object({ key: id, originalJson: z.string().min(1) }).strict()),
  })
  .strict();
export const constructionJobSchema = z
  .object({
    schema: z.literal(CONSTRUCTION_JOB_SCHEMA),
    id,
    revision,
    name: id,
    createdAt: timestamp,
    updatedAt: timestamp,
    workPackages: z.array(workPackageSchema),
    sources: z.array(sourceRevisionSchema),
    evidence: z.array(evidenceSchema),
    calibrations: z.array(calibrationSchema),
    measurements: z.array(measurementSchema),
    extensions: z.object({ legacyFencing: legacyExtensionSchema.optional() }).strict(),
  })
  .strict()
  .superRefine((job, context) => {
    const issue = (message: string) => context.addIssue({ code: "custom", message });
    for (const key of [
      "workPackages",
      "sources",
      "evidence",
      "calibrations",
      "measurements",
    ] as const)
      if (new Set(job[key].map((entry) => entry.id)).size !== job[key].length)
        issue(`Duplicate ${key} IDs.`);
    if (
      new Set(job.sources.map((entry) => JSON.stringify([entry.documentId, entry.revision])))
        .size !== job.sources.length
    )
      issue("Duplicate document revision.");
    const checkLocator = (locator: SourceLocator) => {
      const source = job.sources.find((entry) => entry.id === locator.sourceRevisionId);
      if (!source || source.sha256 !== locator.sha256)
        issue("Missing or hash-mismatched source revision.");
      if (
        source &&
        locator.kind === "page" &&
        (source.pageCount === null || locator.pageIndex >= source.pageCount)
      )
        issue("Page locator is outside the known source page range.");
    };
    const checkEvidence = (references: string[]) => {
      for (const ref of references)
        if (!job.evidence.some((entry) => entry.id === ref)) issue(`Missing evidence ${ref}.`);
    };
    job.evidence.forEach((entry) => checkLocator(entry.locator));
    const hasAssociatedEvidence = (references: string[], locator: SourceLocator) =>
      references.some((ref) =>
        job.evidence.some(
          (entry) => entry.id === ref && locatorKey(entry.locator) === locatorKey(locator),
        ),
      );
    job.calibrations.forEach((entry) => {
      checkLocator(entry.locator);
      checkEvidence(entry.evidenceIds);
      if (!hasAssociatedEvidence(entry.evidenceIds, entry.locator))
        issue("Calibration requires evidence from its exact source page/model.");
    });
    const countedItems = new Set<string>();
    for (const measurement of job.measurements) {
      checkLocator(measurement.locator);
      checkEvidence(measurement.evidenceIds);
      if (!hasAssociatedEvidence(measurement.evidenceIds, measurement.locator))
        issue("Measurement requires evidence from its exact source page/model.");
      if (!job.workPackages.some((entry) => entry.id === measurement.workPackageId))
        issue("Missing work package.");
      measurement.deductions.forEach((entry) => checkEvidence(entry.evidenceIds));
      if (measurement.kind === "count")
        measurement.items.forEach((entry) => {
          checkEvidence(entry.evidenceIds);
          if (!hasAssociatedEvidence(entry.evidenceIds, measurement.locator))
            issue("Count item requires evidence on its source page/model.");
          const key = JSON.stringify([locatorKey(measurement.locator), entry.id]);
          if (countedItems.has(key))
            issue("Count item contributes to more than one measurement on this source page/model.");
          countedItems.add(key);
        });
      const calibrationId =
        measurement.kind === "area" || measurement.kind === "length"
          ? measurement.calibrationId
          : measurement.kind === "volume" && measurement.basis.method === "area-depth"
            ? measurement.basis.calibrationId
            : null;
      if (calibrationId) {
        const calibration = job.calibrations.find((entry) => entry.id === calibrationId);
        if (!calibration || locatorKey(calibration.locator) !== locatorKey(measurement.locator))
          issue("Calibration must bind the exact measurement source and page/model.");
      }
      if (measurement.kind === "volume") {
        if (measurement.basis.method === "area-depth")
          checkEvidence(measurement.basis.depth.evidenceIds);
        else {
          checkLocator(measurement.basis.locator);
          checkEvidence(measurement.basis.evidenceIds);
          const nativeLocator = measurement.basis.locator;
          if (
            !measurement.basis.evidenceIds.some((ref) =>
              job.evidence.some(
                (entry) =>
                  entry.id === ref &&
                  locatorKey(entry.locator) === locatorKey(nativeLocator) &&
                  entry.locator.kind === "model" &&
                  nativeLocator.kind === "model" &&
                  entry.locator.property === nativeLocator.property,
              ),
            )
          )
            issue("Native volume requires evidence for its exact model property.");
          if (
            locatorKey(measurement.basis.locator) !== locatorKey(measurement.locator) ||
            measurement.basis.locator.kind !== "model" ||
            !measurement.basis.locator.property ||
            measurement.locator.kind !== "model" ||
            measurement.locator.property !== measurement.basis.locator.property
          )
            issue("Native volume must reference the measured model element and explicit property.");
        }
      }
    }
  });
export function locatorKey(locator: SourceLocator): string {
  return JSON.stringify([
    locator.sourceRevisionId,
    locator.sha256,
    locator.kind,
    locator.kind === "page"
      ? locator.pageIndex
      : locator.kind === "model"
        ? locator.elementId
        : locator.section,
  ]);
}
export type SourceLocator = z.infer<typeof sourceLocatorSchema>;
export type SourceRevision = z.infer<typeof sourceRevisionSchema>;
export type Measurement = z.infer<typeof measurementSchema>;
export type ConstructionJob = z.infer<typeof constructionJobSchema>;
export type Calibration = z.infer<typeof calibrationSchema>;

export const quantityResultSchema = z
  .object({
    schema: z.literal(QUANTITY_RESULT_SCHEMA),
    ruleset: z.literal(QUANTITY_RULESET),
    id,
    jobId: id,
    jobRevision: revision,
    workPackage: workPackageSchema,
    measurement: measurementSchema,
    gross: scalar,
    deduction: scalar,
    net: scalar,
    unit: quantityUnitSchema,
    sources: z.array(sourceRevisionSchema).nonempty(),
    evidence: z.array(evidenceSchema).nonempty(),
    calibrations: z.array(calibrationSchema),
  })
  .strict()
  .superRefine((result, context) => {
    if (
      result.measurement.review.status !== "approved" ||
      result.deduction > result.gross ||
      result.net !== result.gross - result.deduction ||
      result.unit !==
        { count: "ea", length: "m", area: "m2", volume: "m3" }[result.measurement.kind]
    )
      context.addIssue({ code: "custom", message: "Invalid verified quantity result." });
  });
export type QuantityResult = z.infer<typeof quantityResultSchema>;
// Downstream records are deliberately separate from measured quantities. No implicit waste or pricing.
export const purchaseRequirementSchema = z
  .object({
    id,
    quantityResultId: id,
    jobRevision: revision,
    packId: id,
    packVersion: id,
    itemCode: id,
    quantity: scalar,
    unit: id,
    rule: id,
    evidenceIds: ids.nonempty(),
  })
  .strict();
export const priceLineSchema = z
  .object({
    id,
    purchaseRequirementId: id,
    currency: z.literal("AUD"),
    unitRateDecimal: z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d*[1-9])?$/),
    amountMinorUnits: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    priceSource: id,
    effectiveAt: timestamp,
  })
  .strict();
export type PurchaseRequirement = z.infer<typeof purchaseRequirementSchema>;
export type PriceLine = z.infer<typeof priceLineSchema>;
