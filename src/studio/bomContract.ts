import { z } from "zod";

export const JOB_TO_BOM_SCHEMA = "xray.job-to-bom/v1" as const;
export const BOM_SCHEMA = "xray.bom/v1" as const;
export const BOM_RULESET_VERSION = "fencing-v1" as const;

const isoDateTime = z.string().datetime({ offset: true });
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const id = z.string().min(1).max(240);
const positiveInt = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const nonNegativeInt = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const canonicalDecimalSchema = z
  .string()
  .regex(/^(?:0|[1-9]\d*)(?:\.\d*[1-9])?$/, "Expected a canonical non-negative decimal string.");

export const bomUnitSchema = z.enum(["ea", "lm", "m2", "m3", "kg", "t", "L"]);
export const bomConfidenceTierSchema = z.enum([
  "reconciled",
  "single-source",
  "needs-human",
]);
export const bomSystemSchema = z.enum([
  "colorbond",
  "timber-paling",
  "pool",
  "chain-wire",
  "custom",
]);

export const bomIssueSchema = z
  .object({
    code: z.enum([
      "invalid-job",
      "hydration",
      "document-original",
      "photo-original",
      "document-hash",
      "calibration",
      "length-mismatch",
      "run-specification",
      "gate-specification",
      "gate-placement",
      "gate-overlap",
      "review",
      "evidence",
      "recipe",
      "assumption",
      "unsupported-configuration",
      "contract",
    ]),
    message: z.string().min(1).max(1000),
    entityId: id.nullable(),
    path: z.string().max(500).nullable(),
  })
  .strict();

export const bomAssumptionSchema = z
  .object({
    id,
    key: z.string().min(1).max(120),
    label: z.string().min(1).max(300),
    value: canonicalDecimalSchema,
    unit: bomUnitSchema.or(z.enum(["mm", "ratio"])),
    source: z.string().min(1).max(500),
    effectiveAt: isoDateTime,
    status: z.enum(["accepted", "unresolved"]),
    acceptedBy: z.string().max(120).nullable(),
    acceptedAt: isoDateTime.nullable(),
  })
  .strict()
  .superRefine((assumption, context) => {
    if (assumption.status === "accepted") {
      if (!assumption.acceptedBy?.trim())
        context.addIssue({ code: "custom", path: ["acceptedBy"], message: "Accepted assumptions require an actor." });
      if (!assumption.acceptedAt)
        context.addIssue({ code: "custom", path: ["acceptedAt"], message: "Accepted assumptions require a timestamp." });
    } else if (assumption.acceptedBy !== null || assumption.acceptedAt !== null) {
      context.addIssue({ code: "custom", message: "Unresolved assumptions cannot retain acceptance attribution." });
    }
  });

export const bomRecipeComponentSchema = z
  .object({
    id,
    itemCode: z.string().min(1).max(120),
    description: z.string().min(1).max(300),
    unit: bomUnitSchema,
    basis: z.enum([
      "per-ordinary-post",
      "per-end-post",
      "per-corner-post",
      "per-junction-post",
      "per-strainer-post",
      "per-bay",
      "per-gate-post",
      "per-incident-strainer-end",
      "per-infill-sheet",
      "per-paling",
      "rail-cuts",
      "rail-lm",
      "mesh-lm",
      "mesh-m2",
      "per-gate-opening",
      "per-gate-leaf",
      "per-hinge-set",
      "per-latch",
      "per-drop-bolt",
      "concrete-m3",
      "per-removal-lm",
      "per-retaining-lm",
    ]),
    factor: canonicalDecimalSchema,
    assumptionIds: z.array(id),
  })
  .strict();

const assumptionRefsSchema = z.array(id).min(1);
const materialModelSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("colorbond"),
    effectiveSheetCoverMm: positiveInt,
    railRows: positiveInt,
    gateBoundaryPostRole: z.literal("gate"),
    assumptionIds: assumptionRefsSchema,
  }).strict(),
  z.object({
    kind: z.literal("timber-paling"),
    palingCoverMm: positiveInt,
    railRows: positiveInt,
    gateBoundaryPostRole: z.literal("gate"),
    assumptionIds: assumptionRefsSchema,
  }).strict(),
  z.object({
    kind: z.literal("chain-wire"),
    meshHeightMm: positiveInt,
    meshRollLengthMm: positiveInt,
    meshRollReusePolicy: z.enum(["reuse-across-spans", "separate-roll-per-span"]),
    topRailRows: nonNegativeInt,
    braceEveryIncidentStrainerEnd: z.boolean(),
    gateBoundaryPostRole: z.literal("strainer"),
    assumptionIds: assumptionRefsSchema,
  }).strict(),
  z.object({
    kind: z.literal("explicit"),
    system: z.enum(["pool", "custom"]),
    ruleKey: z.string().min(1).max(120),
    gateBoundaryPostRole: z.enum(["gate", "strainer"]),
    assumptionIds: assumptionRefsSchema,
  }).strict(),
]);

const footingRoleSchema = z.enum(["ordinary", "end", "corner", "junction", "strainer", "gate"]);
const footingRuleSchema = z.object({
  postRole: footingRoleSchema,
  diameterMm: positiveInt,
  depthMm: positiveInt,
  assumptionIds: assumptionRefsSchema,
}).strict();

const allowanceSchema = z.object({
  id,
  componentIds: z.array(id).min(1),
  percent: canonicalDecimalSchema,
  roundingIncrement: canonicalDecimalSchema,
  roundingUnit: bomUnitSchema,
  source: z.string().min(1).max(500),
  effectiveAt: isoDateTime,
  status: z.enum(["accepted", "unresolved"]),
  acceptedBy: z.string().max(120).nullable(),
  acceptedAt: isoDateTime.nullable(),
  assumptionIds: assumptionRefsSchema,
}).strict().superRefine((allowance, context) => {
  if (allowance.status === "accepted") {
    if (!allowance.acceptedBy?.trim()) context.addIssue({ code: "custom", path: ["acceptedBy"], message: "Accepted allowances require an actor." });
    if (!allowance.acceptedAt) context.addIssue({ code: "custom", path: ["acceptedAt"], message: "Accepted allowances require a timestamp." });
  } else if (allowance.acceptedBy !== null || allowance.acceptedAt !== null) {
    context.addIssue({ code: "custom", message: "Unresolved allowances cannot retain acceptance attribution." });
  }
});

const gateHardwareModelSchema = z.object({
  id,
  gateType: z.enum(["single", "double", "sliding", "pedestrian", "custom"]),
  widthMm: positiveInt,
  leafCount: positiveInt,
  boundaryPostCount: positiveInt,
  hingeSetCount: nonNegativeInt,
  latchCount: nonNegativeInt,
  dropBoltCount: nonNegativeInt,
  assumptionIds: assumptionRefsSchema,
}).strict();

export const bomRecipeSchema = z
  .object({
    id,
    revision: positiveInt,
    system: bomSystemSchema,
    profile: z.string().min(1).max(120),
    maxBayWidthMm: positiveInt,
    postSpacingMm: positiveInt,
    // Missing on historical recipes: retain their equal-bay calculation exactly.
    bayLayout: z.enum(["equal", "full-bays-terminal-cut"]).optional(),
    materialModel: materialModelSchema,
    footings: z.array(footingRuleSchema),
    allowances: z.array(allowanceSchema),
    gateHardwareModels: z.array(gateHardwareModelSchema),
    supportedSlopes: z.array(z.enum(["level", "stepped", "raked", "mixed"])).min(1),
    supportedGround: z.array(z.enum(["soil", "concrete", "rock", "retaining-wall", "mixed"])).min(1),
    supportedGateTypes: z.array(z.enum(["single", "double", "sliding", "pedestrian", "custom"])),
    supportedRetainingTypes: z.array(z.enum(["none", "timber-sleeper", "concrete-sleeper", "masonry", "existing", "custom"])),
    supportsSleepers: z.boolean(),
    assumptions: z.array(bomAssumptionSchema),
    components: z.array(bomRecipeComponentSchema).min(1),
  })
  .strict()
  .superRefine((recipe, context) => {
    checkUnique(recipe.assumptions.map((entry) => entry.id), context, ["assumptions"], "assumption");
    checkUnique(recipe.components.map((entry) => entry.id), context, ["components"], "component");
    const assumptions = new Set(recipe.assumptions.map((entry) => entry.id));
    const componentIds = new Set(recipe.components.map((entry) => entry.id));
    const referencedAssumptions = [
      ...recipe.materialModel.assumptionIds,
      ...recipe.footings.flatMap((entry) => entry.assumptionIds),
      ...recipe.allowances.flatMap((entry) => entry.assumptionIds),
      ...recipe.gateHardwareModels.flatMap((entry) => entry.assumptionIds),
      ...recipe.components.flatMap((entry) => entry.assumptionIds),
    ];
    referencedAssumptions.forEach((assumptionId) => {
      if (!assumptions.has(assumptionId)) context.addIssue({ code: "custom", path: ["assumptions"], message: `Unknown recipe assumption ${assumptionId}.` });
    });
    const allowanceByComponent = new Map<string, string>();
    recipe.allowances.forEach((allowance, index) => {
      checkUnique(allowance.componentIds, context, ["allowances", index, "componentIds"], "allowance component");
      if (allowance.roundingIncrement === "0") {
        context.addIssue({ code: "custom", path: ["allowances", index, "roundingIncrement"], message: "Allowance rounding increments must be greater than zero." });
      }
      allowance.componentIds.forEach((componentId) => {
        const component = recipe.components.find((entry) => entry.id === componentId);
        if (!componentIds.has(componentId) || !component) {
          context.addIssue({ code: "custom", path: ["allowances", index, "componentIds"], message: `Unknown allowance component ${componentId}.` });
          return;
        }
        if (component.unit !== allowance.roundingUnit) {
          context.addIssue({ code: "custom", path: ["allowances", index, "roundingUnit"], message: `Allowance ${allowance.id} must round ${componentId} in ${component.unit}.` });
        }
        const previous = allowanceByComponent.get(componentId);
        if (previous) {
          context.addIssue({ code: "custom", path: ["allowances", index, "componentIds"], message: `Component ${componentId} already uses allowance ${previous}; v1 does not define allowance ordering.` });
        } else {
          allowanceByComponent.set(componentId, allowance.id);
        }
      });
    });
    checkUnique(recipe.footings.map((entry) => entry.postRole), context, ["footings"], "footing role");
    checkUnique(recipe.allowances.map((entry) => entry.id), context, ["allowances"], "allowance");
    checkUnique(recipe.gateHardwareModels.map((entry) => entry.id), context, ["gateHardwareModels"], "gate hardware model");
    checkUnique(recipe.gateHardwareModels.map((entry) => `${entry.gateType}:${entry.widthMm}`), context, ["gateHardwareModels"], "gate type and width capability");
    recipe.gateHardwareModels.forEach((model, index) => {
      if (!recipe.supportedGateTypes.includes(model.gateType))
        context.addIssue({ code: "custom", path: ["gateHardwareModels", index, "gateType"], message: "Gate hardware models must name a supported gate type." });
    });
    const modelMatches = recipe.materialModel.kind === recipe.system || (recipe.materialModel.kind === "explicit" && recipe.materialModel.system === recipe.system);
    if (!modelMatches) context.addIssue({ code: "custom", path: ["materialModel"], message: "Material model must match the recipe system." });
    recipe.components.forEach((component, index) => {
      component.assumptionIds.forEach((assumptionId) => {
        if (!assumptions.has(assumptionId))
          context.addIssue({ code: "custom", path: ["components", index, "assumptionIds"], message: `Unknown recipe assumption ${assumptionId}.` });
      });
    });
  });

export const bomRecipeSetSchema = z
  .object({
    id,
    revision: positiveInt,
    digest: sha256,
    recipes: z.array(bomRecipeSchema).min(1),
  })
  .strict()
  .superRefine((set, context) => checkUnique(set.recipes.map((entry) => entry.id), context, ["recipes"], "recipe"));

const approvalSchema = z
  .object({
    status: z.literal("approved"),
    entityRevision: positiveInt,
    decidedAt: isoDateTime,
    decidedBy: z.string().trim().min(1).max(120),
    note: z.string().max(1000),
  })
  .strict();

const vertexSchema = z
  .object({
    index: nonNegativeInt,
    topologyNodeId: id,
    cornerTreatment: z.enum(["standard", "boxed", "mitred", "end", "custom"]),
    postOverride: z
      .object({
        postSize: z.string().min(1).max(120),
        lengthMm: positiveInt.nullable(),
        embedmentMm: positiveInt.nullable(),
        notes: z.string().max(500),
      })
      .strict()
      .nullable(),
  })
  .strict();

const runSpecificationInputSchema = z
  .object({
    system: bomSystemSchema,
    customSystem: z.string().max(120),
    profile: z.string().min(1).max(120),
    heightMm: positiveInt,
    bayWidthMm: positiveInt,
    ground: z.enum(["soil", "concrete", "rock", "retaining-wall", "mixed"]),
    slope: z.enum(["level", "stepped", "raked", "mixed"]),
    removalRequired: z.boolean(),
    removalMaterial: z.string().max(120),
    removalLengthMm: positiveInt.nullable(),
    disposalRequired: z.boolean(),
    access: z.enum(["clear", "restricted", "hand-carry", "plant-required"]),
    sleepers: z.enum(["none", "timber", "concrete", "custom"]),
    retainingRequired: z.boolean(),
    retainingType: z.enum(["none", "timber-sleeper", "concrete-sleeper", "masonry", "existing", "custom"]),
    retainingHeightMm: nonNegativeInt.nullable(),
    retainingCondition: z.string().max(500),
    notes: z.string().max(2000),
  })
  .strict();

export const bomRunInputSchema = z
  .object({
    id,
    revision: positiveInt,
    sheet: nonNegativeInt,
    label: z.string().min(1).max(120),
    recipeId: id,
    segments: z.array(z.object({ index: nonNegativeInt, lengthMm: positiveInt }).strict()).min(1),
    vertices: z.array(vertexSchema).min(2),
    storedLengths: z.object({ grossMm: nonNegativeInt, gateDeductionMm: nonNegativeInt, netMm: nonNegativeInt }).strict(),
    specification: runSpecificationInputSchema,
    photoIds: z.array(id),
    approval: approvalSchema,
  })
  .strict()
  .superRefine((run, context) => {
    if (run.vertices.length !== run.segments.length + 1)
      context.addIssue({ code: "custom", path: ["vertices"], message: "A run requires one more vertex than segment." });
    run.segments.forEach((segment, index) => {
      if (segment.index !== index) context.addIssue({ code: "custom", path: ["segments", index, "index"], message: "Segment indexes must be contiguous from zero." });
    });
    run.vertices.forEach((vertex, index) => {
      if (vertex.index !== index) context.addIssue({ code: "custom", path: ["vertices", index, "index"], message: "Vertex indexes must be contiguous from zero." });
    });
    checkUnique(run.photoIds, context, ["photoIds"], "photo link");
    if (run.approval.entityRevision !== run.revision)
      context.addIssue({ code: "custom", path: ["approval", "entityRevision"], message: "Run approval must be bound to the current revision." });
  });

export const bomGateInputSchema = z
  .object({
    id,
    revision: positiveInt,
    sheet: nonNegativeInt,
    label: z.string().min(1).max(120),
    runId: id,
    segmentIndex: nonNegativeInt,
    centreOffsetMm: nonNegativeInt,
    widthMm: positiveInt,
    heightMm: positiveInt,
    type: z.enum(["single", "double", "sliding", "pedestrian", "custom"]),
    customType: z.string().max(120),
    openingDirection: z.enum(["inward", "outward", "sliding-left", "sliding-right", "reversible", "not-applicable"]),
    hingeSide: z.enum(["left", "right", "double", "not-applicable"]),
    hardware: z.string().min(1).max(500),
    latch: z.string().min(1).max(200),
    postSize: z.string().min(1).max(120),
    finish: z.string().max(200),
    clearanceMm: nonNegativeInt.nullable(),
    motorised: z.boolean(),
    hardwareModelId: id,
    leafCount: positiveInt,
    boundaryPostCount: positiveInt,
    hingeSetCount: nonNegativeInt,
    latchCount: nonNegativeInt,
    dropBoltCount: nonNegativeInt,
    photoIds: z.array(id),
    approval: approvalSchema,
  })
  .strict()
  .superRefine((gate, context) => {
    checkUnique(gate.photoIds, context, ["photoIds"], "photo link");
    if (gate.approval.entityRevision !== gate.revision)
      context.addIssue({ code: "custom", path: ["approval", "entityRevision"], message: "Gate approval must be bound to the current revision." });
  });

const documentEvidenceSchema = z.object({ kind: z.literal("document"), id, sha256 }).strict();
const calibrationEvidenceSchema = z.object({ kind: z.literal("calibration"), id, sheet: nonNegativeInt, candidateId: id, digest: sha256, metresPerUnit: canonicalDecimalSchema }).strict();
const photoEvidenceSchema = z.object({ kind: z.literal("photo"), id, revision: positiveInt, sha256 }).strict();
export const bomInputEvidenceSchema = z.discriminatedUnion("kind", [documentEvidenceSchema, calibrationEvidenceSchema, photoEvidenceSchema]);

export const bomBuildRequestSchema = z
  .object({
    schema: z.literal(JOB_TO_BOM_SCHEMA),
    requestId: id,
    inputDigest: sha256,
    job: z.object({ id, revision: positiveInt }).strict(),
    document: z.object({ id, name: z.string().min(1).max(300), kind: z.enum(["pdf", "dxf", "svg"]), sha256 }).strict(),
    verifiedAssets: z.array(z.object({ kind: z.enum(["document", "photo"]), id, sha256 }).strict()).min(1),
    calibrations: z.array(calibrationEvidenceSchema.omit({ kind: true })),
    runs: z.array(bomRunInputSchema).min(1),
    gates: z.array(bomGateInputSchema),
    evidence: z.array(bomInputEvidenceSchema),
    recipeSet: bomRecipeSetSchema,
  })
  .strict()
  .superRefine(validateRequestReferences);

const evidenceRefSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("document"), id, sha256 }).strict(),
  z.object({ kind: z.literal("calibration"), id, digest: sha256 }).strict(),
  z.object({ kind: z.literal("run"), id, revision: positiveInt }).strict(),
  z.object({ kind: z.literal("gate"), id, revision: positiveInt }).strict(),
  z.object({ kind: z.literal("photo"), id, revision: positiveInt, sha256 }).strict(),
  z.object({ kind: z.literal("approval"), id, revision: positiveInt }).strict(),
  z.object({ kind: z.literal("assumption"), id }).strict(),
  z.object({ kind: z.literal("recipe"), id, revision: positiveInt }).strict(),
]);

const calculationOperandSchema = z.object({ name: id, value: canonicalDecimalSchema, unit: bomUnitSchema.or(z.enum(["mm", "ratio"])), evidenceRefs: z.array(evidenceRefSchema) }).strict();
export const bomLineSchemaV1 = z
  .object({
    id,
    groupKey: z.string().min(1).max(500),
    category: z.enum(["post", "infill", "rail", "gate", "gate-hardware", "footing", "concrete", "retaining", "removal", "other"]),
    itemCode: z.string().min(1).max(120).nullable(),
    description: z.string().min(1).max(300),
    quantity: z.object({ value: canonicalDecimalSchema, unit: bomUnitSchema }).strict(),
    calculation: z.object({ ruleId: id, ruleVersion: positiveInt, expression: z.string().min(1).max(1000), operands: z.array(calculationOperandSchema), result: z.object({ value: canonicalDecimalSchema, unit: bomUnitSchema }).strict() }).strict(),
    confidenceTier: bomConfidenceTierSchema,
    evidenceRefs: z.array(evidenceRefSchema).min(1),
    assumptionRefs: z.array(id),
  })
  .strict();

const bomDocumentSchema = z
  .object({
    jobId: id,
    jobRevision: positiveInt,
    inputDigest: sha256,
    documentSha256: sha256,
    recipeSet: z.object({ id, revision: positiveInt, digest: sha256 }).strict(),
    ruleset: z.object({ id: z.literal(BOM_RULESET_VERSION), version: positiveInt }).strict(),
    status: z.enum(["draft", "review-ready"]),
    lines: z.array(bomLineSchemaV1),
    assumptions: z.array(bomAssumptionSchema),
    blockers: z.array(bomIssueSchema),
    warnings: z.array(bomIssueSchema),
    summary: z.object({ lineCount: nonNegativeInt, needsHumanCount: nonNegativeInt, blockerCount: nonNegativeInt }).strict(),
  })
  .strict()
  .superRefine((bom, context) => {
    checkUnique(bom.lines.map((line) => line.id), context, ["lines"], "BOM line");
    checkUnique(bom.lines.map((line) => line.groupKey), context, ["lines"], "BOM group key");
    if (bom.summary.lineCount !== bom.lines.length) context.addIssue({ code: "custom", path: ["summary", "lineCount"], message: "BOM line summary does not reconcile." });
    if (bom.summary.blockerCount !== bom.blockers.length) context.addIssue({ code: "custom", path: ["summary", "blockerCount"], message: "BOM blocker summary does not reconcile." });
    const needsHuman = bom.lines.filter((line) => line.confidenceTier === "needs-human").length;
    if (bom.summary.needsHumanCount !== needsHuman) context.addIssue({ code: "custom", path: ["summary", "needsHumanCount"], message: "BOM review summary does not reconcile." });
    const assumptions = new Set(bom.assumptions.map((entry) => entry.id));
    bom.lines.forEach((line, index) => line.assumptionRefs.forEach((entry) => {
      if (!assumptions.has(entry)) context.addIssue({ code: "custom", path: ["lines", index, "assumptionRefs"], message: `Unknown BOM assumption ${entry}.` });
    }));
    checkSorted(bom.lines.map((line) => line.id), context, ["lines"], "BOM lines");
  });

export const bomBuildResponseSchema = z.discriminatedUnion("ok", [
  z.object({ schema: z.literal(BOM_SCHEMA), ok: z.literal(true), requestId: id, bom: bomDocumentSchema }).strict(),
  z.object({ schema: z.literal(BOM_SCHEMA), ok: z.literal(false), requestId: id, inputDigest: sha256.nullable(), issues: z.array(bomIssueSchema).min(1) }).strict(),
]);

export type BomIssue = z.infer<typeof bomIssueSchema>;
export type BomAssumption = z.infer<typeof bomAssumptionSchema>;
export type BomRecipeSet = z.infer<typeof bomRecipeSetSchema>;
export type BomBuildRequest = z.infer<typeof bomBuildRequestSchema>;
export type BomBuildResponse = z.infer<typeof bomBuildResponseSchema>;
export type BomLineV1 = z.infer<typeof bomLineSchemaV1>;

/** Canonical contract JSON. `requestId` and `inputDigest` are transport metadata. */
export function canonicalBomInputJson(request: BomBuildRequest): string {
  const { requestId: _requestId, inputDigest: _inputDigest, ...input } = request;
  return JSON.stringify(sortJson(input));
}

export async function computeBomInputDigest(request: BomBuildRequest): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalBomInputJson(request));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifyBomInputDigest(request: BomBuildRequest): Promise<boolean> {
  return (await computeBomInputDigest(request)) === request.inputDigest;
}

function validateRequestReferences(request: z.infer<typeof bomBuildRequestSchema>, context: z.RefinementCtx) {
  checkUnique(request.runs.map((run) => run.id), context, ["runs"], "run");
  checkUnique(request.gates.map((gate) => gate.id), context, ["gates"], "gate");
  checkUnique(request.calibrations.map((entry) => entry.sheet), context, ["calibrations"], "calibration sheet");
  checkUnique(request.evidence.map((entry) => `${entry.kind}:${entry.id}`), context, ["evidence"], "evidence");
  checkUnique(request.verifiedAssets.map((entry) => `${entry.kind}:${entry.id}`), context, ["verifiedAssets"], "verified asset");
  checkSorted(request.runs.map((entry) => entry.id), context, ["runs"], "runs");
  checkSorted(request.gates.map((entry) => entry.id), context, ["gates"], "gates");
  checkSorted(request.calibrations.map((entry) => entry.sheet), context, ["calibrations"], "calibrations");
  const verifiedAssets = new Map(request.verifiedAssets.map((entry) => [`${entry.kind}:${entry.id}`, entry.sha256]));
  if (verifiedAssets.get(`document:${request.document.id}`) !== request.document.sha256)
    context.addIssue({ code: "custom", path: ["verifiedAssets"], message: "The active document must have a matching verified original." });
  const documentEvidence = request.evidence.find((entry) => entry.kind === "document" && entry.id === request.document.id);
  if (!documentEvidence || documentEvidence.kind !== "document" || documentEvidence.sha256 !== request.document.sha256)
    context.addIssue({ code: "custom", path: ["evidence"], message: "The active document must have matching evidence." });
  request.calibrations.forEach((calibration, index) => {
    const evidence = request.evidence.find((entry) => entry.kind === "calibration" && entry.id === calibration.id);
    if (!evidence || evidence.kind !== "calibration" || evidence.digest !== calibration.digest || evidence.sheet !== calibration.sheet || evidence.candidateId !== calibration.candidateId)
      context.addIssue({ code: "custom", path: ["calibrations", index], message: "Calibration identity must match its evidence record." });
  });
  request.evidence.filter((entry) => entry.kind === "photo").forEach((photo) => {
    if (verifiedAssets.get(`photo:${photo.id}`) !== photo.sha256)
      context.addIssue({ code: "custom", path: ["verifiedAssets"], message: `Photo ${photo.id} must have a matching verified original.` });
  });
  const recipes = new Map(request.recipeSet.recipes.map((recipe) => [recipe.id, recipe]));
  const runs = new Map(request.runs.map((run) => [run.id, run]));
  const photos = new Set(request.evidence.filter((entry) => entry.kind === "photo").map((entry) => entry.id));
  request.runs.forEach((run, index) => {
    if (!request.calibrations.some((calibration) => calibration.sheet === run.sheet)) {
      context.addIssue({ code: "custom", path: ["runs", index, "sheet"], message: `Run ${run.id} requires one locked calibration for sheet ${run.sheet}.` });
    }
    const recipe = recipes.get(run.recipeId);
    if (!recipe || recipe.system !== run.specification.system || recipe.profile !== run.specification.profile)
      context.addIssue({ code: "custom", path: ["runs", index, "recipeId"], message: "Run recipe must exactly match its system and profile." });
    run.photoIds.forEach((photoId) => { if (!photos.has(photoId)) context.addIssue({ code: "custom", path: ["runs", index, "photoIds"], message: `Unknown photo evidence ${photoId}.` }); });
  });
  request.gates.forEach((gate, index) => {
    const run = runs.get(gate.runId);
    if (!run || run.sheet !== gate.sheet) {
      context.addIssue({ code: "custom", path: ["gates", index, "runId"], message: "Gate must reference a run on the same sheet." });
      return;
    }
    const segment = run.segments[gate.segmentIndex];
    if (!segment) {
      context.addIssue({ code: "custom", path: ["gates", index, "segmentIndex"], message: "Gate segment is outside its run." });
      return;
    }
    if (gate.centreOffsetMm * 2 < gate.widthMm || (segment.lengthMm - gate.centreOffsetMm) * 2 < gate.widthMm)
      context.addIssue({ code: "custom", path: ["gates", index], message: "Gate opening must fit wholly inside its segment." });
    const recipe = recipes.get(run.recipeId);
    const model = recipe?.gateHardwareModels.find((entry) => entry.id === gate.hardwareModelId);
    if (!recipe?.supportedGateTypes.includes(gate.type) || !model || model.gateType !== gate.type || model.widthMm !== gate.widthMm ||
      model.leafCount !== gate.leafCount || model.boundaryPostCount !== gate.boundaryPostCount || model.hingeSetCount !== gate.hingeSetCount ||
      model.latchCount !== gate.latchCount || model.dropBoltCount !== gate.dropBoltCount)
      context.addIssue({ code: "custom", path: ["gates", index, "hardwareModelId"], message: "Gate hardware facts must exactly match one supported recipe model." });
    gate.photoIds.forEach((photoId) => { if (!photos.has(photoId)) context.addIssue({ code: "custom", path: ["gates", index, "photoIds"], message: `Unknown photo evidence ${photoId}.` }); });
  });
  for (const [runId, run] of runs) {
    for (const segment of run.segments) {
      const intervals = request.gates
        .filter((gate) => gate.runId === runId && gate.segmentIndex === segment.index)
        .map((gate) => ({ id: gate.id, start2: gate.centreOffsetMm * 2 - gate.widthMm, end2: gate.centreOffsetMm * 2 + gate.widthMm }))
        .sort((left, right) => left.start2 - right.start2 || left.id.localeCompare(right.id));
      for (let index = 1; index < intervals.length; index += 1) {
        if (intervals[index].start2 < intervals[index - 1].end2)
          context.addIssue({ code: "custom", path: ["gates"], message: `Gate openings ${intervals[index - 1].id} and ${intervals[index].id} overlap.` });
      }
    }
  }
}

function checkUnique(values: readonly unknown[], context: z.RefinementCtx, path: PropertyKey[], label: string) {
  if (new Set(values).size !== values.length) context.addIssue({ code: "custom", path, message: `Duplicate ${label} identifiers are not allowed.` });
}

function checkSorted(values: readonly (string | number)[], context: z.RefinementCtx, path: PropertyKey[], label: string) {
  for (let index = 1; index < values.length; index += 1) {
    if (typeof values[index] === "number" && typeof values[index - 1] === "number" ? values[index] < values[index - 1] : String(values[index]).localeCompare(String(values[index - 1])) < 0) {
      context.addIssue({ code: "custom", path, message: `${label} must be stored in stable ascending order.` });
      return;
    }
  }
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, sortJson(child)]));
}
