import {
  fencingJobSchema,
  missingGateSpecificationFields,
  missingRunSpecificationFields,
  type FencingJob,
  type GateRecord,
} from "./domain.ts";
import { canvasPointToDocument, measureCanvasDistanceM } from "./calibration.ts";
import { getQuoteReadiness, type RuntimeAssetReadiness } from "./quoteReadiness.ts";
import {
  JOB_TO_BOM_SCHEMA,
  bomBuildRequestSchema,
  bomRecipeSetSchema,
  computeBomInputDigest,
  type BomBuildRequest,
  type BomIssue,
  type BomRecipeSet,
} from "./bomContract.ts";

export type CompileBomRequestInput = {
  job: FencingJob;
  runtimeAssets: RuntimeAssetReadiness;
  hydrationSettled: boolean;
  recipeSet: BomRecipeSet;
  requestId: string;
};

export type CompileBomRequestResult =
  | { ok: true; request: BomBuildRequest }
  | { ok: false; issues: BomIssue[] };

/**
 * Compiles the mutable workbench job into the frozen deterministic engine input.
 * This is a fail-closed boundary: it returns no request while any evidence,
 * approval, recipe, topology or stored-length invariant is unresolved.
 */
export async function compileBomRequest(
  input: CompileBomRequestInput,
): Promise<CompileBomRequestResult> {
  const parsedJob = fencingJobSchema.safeParse(input.job);
  const parsedRecipes = bomRecipeSetSchema.safeParse(input.recipeSet);
  const issues: BomIssue[] = [];
  if (!parsedJob.success) {
    parsedJob.error.issues.forEach((issue) =>
      issues.push(problem("invalid-job", issue.message, null, issue.path.join("."))),
    );
  }
  if (!parsedRecipes.success) {
    parsedRecipes.error.issues.forEach((issue) =>
      issues.push(problem("contract", issue.message, null, `recipeSet.${issue.path.join(".")}`)),
    );
  }
  if (!parsedJob.success || !parsedRecipes.success) return { ok: false, issues };

  const job = parsedJob.data;
  const recipeSet = parsedRecipes.data;
  const readiness = getQuoteReadiness(job, input.runtimeAssets, input.hydrationSettled);
  readiness.blockers.forEach((blocker) => {
    const code =
      blocker.code === "hydration" || blocker.code === "document-original" || blocker.code === "photo-original"
        ? blocker.code
        : blocker.code === "calibration"
          ? "calibration"
          : blocker.code === "run-specification"
            ? "run-specification"
            : blocker.code === "gate-specification"
              ? "gate-specification"
              : blocker.code === "review"
                ? "review"
                : blocker.code === "photo-evidence"
                  ? "evidence"
                  : "invalid-job";
    issues.push(problem(code, blocker.message, blocker.entityId ?? null, null));
  });

  const document = job.documents.find((entry) => entry.id === job.activeDocumentId);
  if (!document || document.source === "sample" || document.sha256 === null) {
    issues.push(problem("document-hash", "A non-sample active document with a verified SHA-256 is required.", document?.id ?? null, "document"));
  }
  if (document && !["pdf", "dxf", "svg"].includes(document.kind)) {
    issues.push(problem("unsupported-configuration", `Document kind ${document.kind} is not supported by the v1 BOM contract.`, document.id, "document.kind"));
  }

  const recipeByRun = new Map<string, BomRecipeSet["recipes"][number]>();
  for (const run of job.runs) {
    const matches = recipeSet.recipes.filter(
      (recipe) => recipe.system === run.specification.system && recipe.profile === run.specification.profile,
    );
    if (matches.length !== 1) {
      issues.push(problem("recipe", `${run.label} requires exactly one recipe matching ${run.specification.system} / ${run.specification.profile}.`, run.id, "runs.recipeId"));
      continue;
    }
    const recipe = matches[0];
    recipeByRun.set(run.id, recipe);
    validateRecipeConfiguration(run, recipe, issues);
  }

  const calibrations = new Map<number, {
    id: string;
    sheet: number;
    candidateId: string;
    digest: string;
    metresPerUnit: string;
  }>();
  for (const sheet of [...new Set(job.runs.map((run) => run.sheet))].sort((left, right) => left - right)) {
    const calibration = job.calibrations.find((entry) => entry.sheet === sheet);
    if (!calibration?.locked || !calibration.selectedCandidateId) continue;
    const candidate = calibration.candidates.find((entry) => entry.id === calibration.selectedCandidateId);
    if (!candidate || !nearlyEqual(candidate.metresPerUnit, calibration.metresPerUnit)) {
      issues.push(problem("calibration", `Sheet ${sheet + 1} calibration does not match its selected candidate.`, `sheet-${sheet}`, "calibrations"));
      continue;
    }
    const digest = await digestValue({
      sheet,
      source: calibration.source,
      selectedCandidateId: calibration.selectedCandidateId,
      metresPerUnit: decimal(calibration.metresPerUnit),
      transform: calibration.transform,
      points: calibration.points,
      knownDistanceM: calibration.knownDistanceM,
    });
    calibrations.set(sheet, {
      id: `calibration-sheet-${sheet}`,
      sheet,
      candidateId: calibration.selectedCandidateId,
      digest,
      metresPerUnit: decimal(calibration.metresPerUnit),
    });
  }

  const runInputs: BomBuildRequest["runs"] = [];
  for (const run of [...job.runs].sort(byId)) {
    if (run.revision === undefined || run.review.status !== "approved" || !run.review.decidedAt || !run.review.decidedBy.trim()) {
      issues.push(problem("review", `${run.label} requires an attributed approval bound to its current revision.`, run.id, "runs.approval"));
      continue;
    }
    const missing = missingRunSpecificationFields(run.specification);
    if (missing.length > 0) continue;
    const calibration = job.calibrations.find((entry) => entry.sheet === run.sheet);
    const calibrationEvidence = calibrations.get(run.sheet);
    const recipe = recipeByRun.get(run.id);
    if (!calibration?.locked || !calibrationEvidence || !recipe) continue;
    const segments = run.points.slice(0, -1).map((point, index) => ({
      index,
      lengthMm: Math.round(measureCanvasDistanceM(point, run.points[index + 1], calibration, run.sheet) * 1000),
    }));
    if (segments.some((segment) => segment.lengthMm <= 0)) {
      issues.push(problem("length-mismatch", `${run.label} contains a segment below one millimetre.`, run.id, "runs.segments"));
      continue;
    }
    const gates = job.gates.filter((gate) => gate.runId === run.id);
    const computed = {
      grossMm: segments.reduce((sum, segment) => sum + segment.lengthMm, 0),
      gateDeductionMm: gates.reduce((sum, gate) => sum + (gate.widthM === null ? 0 : Math.round(gate.widthM * 1000)), 0),
      netMm: 0,
    };
    computed.netMm = computed.grossMm - computed.gateDeductionMm;
    const stored = {
      grossMm: run.grossLengthM === undefined ? -1 : Math.round(run.grossLengthM * 1000),
      gateDeductionMm: run.gateDeductionM === undefined ? -1 : Math.round(run.gateDeductionM * 1000),
      netMm: run.netLengthM === undefined ? -1 : Math.round(run.netLengthM * 1000),
    };
    if (stored.grossMm !== computed.grossMm || stored.gateDeductionMm !== computed.gateDeductionMm || stored.netMm !== computed.netMm) {
      issues.push(problem("length-mismatch", `${run.label} stored lengths do not reconcile with its current calibration and gates.`, run.id, "runs.storedLengths"));
    }
    const corners = new Map(run.specification.corners.map((corner) => [corner.vertexIndex, corner]));
    const overrides = new Map(run.specification.postOverrides.map((override) => [override.vertexIndex, override]));
    runInputs.push({
      id: run.id,
      revision: run.revision,
      sheet: run.sheet,
      label: run.label,
      recipeId: recipe.id,
      segments,
      vertices: run.points.map((point, index) => {
        const corner = corners.get(index);
        const override = overrides.get(index);
        return {
          index,
          topologyNodeId: topologyNodeId(run.sheet, point, calibration.transform),
          cornerTreatment: corner?.treatment ?? (index === 0 || index === run.points.length - 1 ? "end" : "standard"),
          postOverride: override
            ? {
                postSize: override.postSize,
                lengthMm: toNullableMm(override.lengthM),
                embedmentMm: toNullableMm(override.embedmentM),
                notes: override.notes,
              }
            : null,
        };
      }),
      storedLengths: stored.grossMm < 0 || stored.gateDeductionMm < 0 || stored.netMm < 0 ? computed : stored,
      specification: {
        system: run.specification.system as Exclude<typeof run.specification.system, "unselected">,
        customSystem: run.specification.customSystem,
        profile: run.specification.profile,
        heightMm: Math.round(run.specification.heightM! * 1000),
        bayWidthMm: Math.round(run.specification.bayWidthM! * 1000),
        ground: run.specification.ground as Exclude<typeof run.specification.ground, "unselected">,
        slope: run.specification.slope as Exclude<typeof run.specification.slope, "unselected">,
        removalRequired: run.specification.removalRequired,
        removalMaterial: run.specification.removalMaterial,
        removalLengthMm: toNullableMm(run.specification.removalLengthM),
        disposalRequired: run.specification.disposalRequired,
        access: run.specification.access as Exclude<typeof run.specification.access, "unselected">,
        sleepers: run.specification.sleepers as Exclude<typeof run.specification.sleepers, "unselected">,
        retainingRequired: run.specification.retainingRequired,
        retainingType: run.specification.retainingRequired
          ? (run.specification.retainingType as Exclude<typeof run.specification.retainingType, "unselected">)
          : "none",
        retainingHeightMm: run.specification.retainingRequired ? toNullableMm(run.specification.retainingHeightM) : null,
        retainingCondition: run.specification.retainingCondition,
        notes: run.specification.notes,
      },
      photoIds: [...run.photoIds].sort(),
      approval: { status: "approved", entityRevision: run.revision, decidedAt: run.review.decidedAt, decidedBy: run.review.decidedBy, note: run.review.note },
    });
  }

  const gateInputs: BomBuildRequest["gates"] = [];
  for (const gate of [...job.gates].sort(byId)) {
    compileGate(gate, runInputs, recipeByRun, issues, gateInputs);
  }
  validateGateIntervals(runInputs, gateInputs, issues);

  if (issues.length > 0 || !document || document.sha256 === null || !["pdf", "dxf", "svg"].includes(document.kind)) {
    return { ok: false, issues: deduplicateIssues(issues) };
  }

  const photoEvidence = [...job.photos].sort(byId).map((photo) => ({
    kind: "photo" as const,
    id: photo.id,
    revision: photo.revision,
    sha256: photo.sha256!,
  }));
  const calibrationList = [...calibrations.values()].sort((left, right) => left.sheet - right.sheet);
  const draft = {
    schema: JOB_TO_BOM_SCHEMA,
    requestId: input.requestId,
    inputDigest: "0".repeat(64),
    job: { id: job.id, revision: job.revision },
    document: { id: document.id, name: document.name, kind: document.kind as "pdf" | "dxf" | "svg", sha256: document.sha256 },
    verifiedAssets: [
      { kind: "document" as const, id: document.id, sha256: document.sha256 },
      ...photoEvidence.map((photo) => ({ kind: "photo" as const, id: photo.id, sha256: photo.sha256 })),
    ],
    calibrations: calibrationList,
    runs: runInputs,
    gates: gateInputs,
    evidence: [
      { kind: "document" as const, id: document.id, sha256: document.sha256 },
      ...calibrationList.map((entry) => ({ kind: "calibration" as const, ...entry })),
      ...photoEvidence,
    ],
    recipeSet,
  };
  const provisional = bomBuildRequestSchema.parse(draft);
  const request = bomBuildRequestSchema.parse({ ...provisional, inputDigest: await computeBomInputDigest(provisional) });
  return { ok: true, request };
}

function validateRecipeConfiguration(run: FencingJob["runs"][number], recipe: BomRecipeSet["recipes"][number], issues: BomIssue[]) {
  const spec = run.specification;
  if (!recipe.supportedSlopes.includes(spec.slope as never)) issues.push(problem("unsupported-configuration", `${recipe.id} does not support slope ${spec.slope}.`, run.id, "runs.specification.slope"));
  if (!recipe.supportedGround.includes(spec.ground as never)) issues.push(problem("unsupported-configuration", `${recipe.id} does not support ground ${spec.ground}.`, run.id, "runs.specification.ground"));
  if (spec.sleepers !== "none" && !recipe.supportsSleepers) issues.push(problem("unsupported-configuration", `${recipe.id} does not support sleepers.`, run.id, "runs.specification.sleepers"));
  if (spec.retainingRequired && !recipe.supportedRetainingTypes.includes(spec.retainingType as never)) issues.push(problem("unsupported-configuration", `${recipe.id} does not support retaining type ${spec.retainingType}.`, run.id, "runs.specification.retainingType"));
  if (spec.bayWidthM !== null && Math.round(spec.bayWidthM * 1000) > recipe.maxBayWidthMm) issues.push(problem("unsupported-configuration", `${recipe.id} supports at most ${recipe.maxBayWidthMm} mm bays; the approved run specifies ${Math.round(spec.bayWidthM * 1000)} mm.`, run.id, "runs.specification.bayWidthMm"));
  const usedAssumptions = new Set([
    ...recipe.components.flatMap((component) => component.assumptionIds),
    ...recipe.materialModel.assumptionIds,
    ...recipe.footings.flatMap((footing) => footing.assumptionIds),
    ...recipe.allowances.flatMap((allowance) => allowance.assumptionIds),
    ...recipe.gateHardwareModels.flatMap((model) => model.assumptionIds),
  ]);
  recipe.assumptions.forEach((assumption) => {
    if (usedAssumptions.has(assumption.id) && assumption.status !== "accepted") issues.push(problem("assumption", `${recipe.id} requires acceptance of ${assumption.label}.`, run.id, `recipeSet.${recipe.id}.assumptions.${assumption.id}`));
  });
  recipe.allowances.forEach((allowance) => {
    if (allowance.status !== "accepted") issues.push(problem("assumption", `${recipe.id} requires acceptance of allowance ${allowance.id}.`, run.id, `recipeSet.${recipe.id}.allowances.${allowance.id}`));
  });
}

function compileGate(
  gate: GateRecord,
  runs: BomBuildRequest["runs"],
  recipeByRun: ReadonlyMap<string, BomRecipeSet["recipes"][number]>,
  issues: BomIssue[],
  output: BomBuildRequest["gates"],
) {
  const missing = missingGateSpecificationFields(gate);
  if (missing.length > 0) return;
  if (gate.revision === undefined || gate.review.status !== "approved" || !gate.review.decidedAt || !gate.review.decidedBy.trim()) {
    issues.push(problem("review", `${gate.label} requires an attributed approval bound to its current revision.`, gate.id, "gates.approval"));
    return;
  }
  if (!gate.runId || gate.segmentIndex === null || gate.segmentIndex === undefined || gate.segmentT === null || gate.segmentT === undefined) {
    issues.push(problem("gate-placement", `${gate.label} must be associated with an exact run segment.`, gate.id, "gates.segmentIndex"));
    return;
  }
  const run = runs.find((entry) => entry.id === gate.runId);
  const segment = run?.segments[gate.segmentIndex];
  if (!run || !segment) {
    issues.push(problem("gate-placement", `${gate.label} references an unavailable run segment.`, gate.id, "gates.runId"));
    return;
  }
  const recipe = recipeByRun.get(gate.runId);
  if (!recipe || !recipe.supportedGateTypes.includes(gate.type as never)) {
    issues.push(problem("unsupported-configuration", `${recipe?.id ?? "The selected recipe"} does not support gate type ${gate.type}.`, gate.id, "gates.type"));
    return;
  }
  const widthMm = Math.round(gate.widthM! * 1000);
  const hardwareModels = recipe.gateHardwareModels.filter((model) => model.gateType === gate.type && model.widthMm === widthMm);
  if (hardwareModels.length !== 1) {
    issues.push(problem("unsupported-configuration", `${recipe.id} requires exactly one typed ${widthMm} mm ${gate.type} gate hardware model.`, gate.id, "gates.hardwareModelId"));
    return;
  }
  const hardwareModel = hardwareModels[0];
  output.push({
    id: gate.id,
    revision: gate.revision,
    sheet: gate.sheet,
    label: gate.label,
    runId: gate.runId,
    segmentIndex: gate.segmentIndex,
    centreOffsetMm: Math.round(segment.lengthMm * gate.segmentT),
    widthMm,
    heightMm: Math.round(gate.heightM! * 1000),
    type: gate.type as Exclude<typeof gate.type, "unselected">,
    customType: gate.customType,
    openingDirection: gate.openingDirection as Exclude<typeof gate.openingDirection, "unselected">,
    hingeSide: gate.hingeSide as Exclude<typeof gate.hingeSide, "unselected">,
    hardware: gate.hardware,
    latch: gate.latch,
    postSize: gate.postSize,
    finish: gate.finish,
    clearanceMm: toNullableMm(gate.clearanceM),
    motorised: gate.motorised,
    hardwareModelId: hardwareModel.id,
    leafCount: hardwareModel.leafCount,
    boundaryPostCount: hardwareModel.boundaryPostCount,
    hingeSetCount: hardwareModel.hingeSetCount,
    latchCount: hardwareModel.latchCount,
    dropBoltCount: hardwareModel.dropBoltCount,
    photoIds: [...gate.photoIds].sort(),
    approval: { status: "approved", entityRevision: gate.revision, decidedAt: gate.review.decidedAt, decidedBy: gate.review.decidedBy, note: gate.review.note },
  });
}

function validateGateIntervals(runs: BomBuildRequest["runs"], gates: BomBuildRequest["gates"], issues: BomIssue[]) {
  for (const run of runs) {
    for (const segment of run.segments) {
      const intervals = gates.filter((gate) => gate.runId === run.id && gate.segmentIndex === segment.index).map((gate) => ({ gate, start2: gate.centreOffsetMm * 2 - gate.widthMm, end2: gate.centreOffsetMm * 2 + gate.widthMm })).sort((left, right) => left.start2 - right.start2 || left.gate.id.localeCompare(right.gate.id));
      intervals.forEach(({ gate, start2, end2 }) => {
        if (start2 < 0 || end2 > segment.lengthMm * 2) issues.push(problem("gate-placement", `${gate.label} must fit wholly inside segment ${segment.index}.`, gate.id, "gates.widthMm"));
      });
      for (let index = 1; index < intervals.length; index += 1) if (intervals[index].start2 < intervals[index - 1].end2) issues.push(problem("gate-overlap", `${intervals[index - 1].gate.label} overlaps ${intervals[index].gate.label}.`, intervals[index].gate.id, "gates"));
    }
  }
}

function problem(code: BomIssue["code"], message: string, entityId: string | null, path: string | null): BomIssue {
  return { code, message, entityId, path };
}

function decimal(value: number): string {
  if (!Number.isFinite(value) || value < 0) throw new Error("Canonical BOM decimals must be finite and non-negative.");
  return value.toFixed(12).replace(/(?:\.0+|(?:(\.\d*?[1-9])0+))$/, "$1");
}

function toNullableMm(value: number | null): number | null {
  return value === null ? null : Math.round(value * 1000);
}

function topologyNodeId(
  sheet: number,
  point: { x: number; y: number },
  transform: Parameters<typeof canvasPointToDocument>[1],
): string {
  const documentPoint = canvasPointToDocument(point, transform);
  return `sheet:${sheet}:x:${coordinate(documentPoint.x)}:y:${coordinate(documentPoint.y)}`;
}

function coordinate(value: number): string {
  if (!Number.isFinite(value)) throw new Error("Topology coordinates must be finite.");
  return value === 0 || Object.is(value, -0) ? "0" : value.toString();
}

function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= Math.max(1, Math.abs(left), Math.abs(right)) * 1e-12;
}

function byId<T extends { id: string }>(left: T, right: T) {
  return left.id.localeCompare(right.id);
}

function deduplicateIssues(issues: BomIssue[]): BomIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = JSON.stringify(issue);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function digestValue(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(sortValue(value)));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, sortValue(child)]));
}
