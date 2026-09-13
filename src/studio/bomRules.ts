import {
  BOM_RULESET_VERSION,
  BOM_SCHEMA,
  bomBuildRequestSchema,
  bomBuildResponseSchema,
  verifyBomInputDigest,
  type BomAssumption,
  type BomBuildRequest,
  type BomBuildResponse,
  type BomIssue,
  type BomLineV1,
  type BomRecipeSet,
} from "./bomContract.ts";

type Recipe = BomRecipeSet["recipes"][number];
type Run = BomBuildRequest["runs"][number];
type Gate = BomBuildRequest["gates"][number];
type PostRole = "ordinary" | "end" | "corner" | "junction" | "strainer" | "gate";

export interface BomFacts {
  bays: number;
  bayLengthsMm: number[];
  residualSpanMm: number[];
  postRoles: Record<PostRole, number>;
  incidentStrainerEnds: number;
  infillSheets: number;
  palings: number;
  railCuts: number;
  railLm: number;
  meshLm: number;
  meshM2: number;
  gateOpenings: number;
  gateLeaves: number;
  hingeSets: number;
  latches: number;
  dropBolts: number;
}

interface MutableSite {
  key: string;
  recipeId: string;
  gateBoundary: boolean;
  original: boolean;
  degree: number;
  treatments: Set<string>;
  neighbours: Set<string>;
  vertexNeighbours: Set<string>;
}

interface RecipeAnalysis {
  recipe: Recipe;
  runs: Run[];
  gates: Gate[];
  facts: BomFacts;
  residualSpanEndpoints: [string, string][];
}

interface Fraction {
  numerator: bigint;
  denominator: bigint;
}

const PI = parseDecimalFraction("3.141592653589793");

/** Split a whole-millimetre span into stable, nearly equal bays (remainder first). */
export function distributeSpanMm(spanMm: number, limitMm: number): number[] {
  if (!Number.isSafeInteger(spanMm) || spanMm <= 0 || !Number.isSafeInteger(limitMm) || limitMm <= 0) {
    throw new Error("Span and bay limit must be positive whole millimetres.");
  }
  const bays = Math.ceil(spanMm / limitMm);
  const base = Math.floor(spanMm / bays);
  const remainder = spanMm - base * bays;
  return Array.from({ length: bays }, (_, index) => base + (index < remainder ? 1 : 0));
}

/** Pure, fail-closed request-to-BOM rules entry point. */
export async function buildBom(input: unknown): Promise<BomBuildResponse> {
  const parsed = bomBuildRequestSchema.safeParse(input);
  if (!parsed.success) {
    const overlap = parsed.error.issues.find((issue) => issue.message.toLowerCase().includes("overlap"));
    return failure(
      safeRequestId(input),
      null,
      overlap
        ? [{ code: "gate-overlap", message: overlap.message, entityId: gateIdFromOverlap(input), path: "gates" }]
        : parsed.error.issues.slice(0, 25).map((issue) => ({
            code: "contract" as const,
            message: issue.message,
            entityId: null,
            path: issue.path.length ? issue.path.join(".") : null,
          })),
    );
  }

  const request = parsed.data;
  if (!(await verifyBomInputDigest(request))) {
    return failure(request.requestId, request.inputDigest, [{
      code: "contract",
      message: "The canonical BOM input digest does not match the request payload.",
      entityId: request.job.id,
      path: "inputDigest",
    }]);
  }

  const assumptionProblems = referencedAssumptionIssues(request);
  if (assumptionProblems.length > 0) return failure(request.requestId, request.inputDigest, assumptionProblems);

  try {
    const analyses = analyseRequest(request);
    const lines = analyses.flatMap((analysis) => linesForAnalysis(analysis)).sort((left, right) => left.id.localeCompare(right.id));
    const assumptions = collectAssumptions(analyses);
    const warnings = analyses.flatMap(chainWireWarnings);
    return bomBuildResponseSchema.parse({
      schema: BOM_SCHEMA,
      ok: true,
      requestId: request.requestId,
      bom: {
        jobId: request.job.id,
        jobRevision: request.job.revision,
        inputDigest: request.inputDigest,
        documentSha256: request.document.sha256,
        recipeSet: {
          id: request.recipeSet.id,
          revision: request.recipeSet.revision,
          digest: request.recipeSet.digest,
        },
        ruleset: { id: BOM_RULESET_VERSION, version: 1 },
        status: "review-ready",
        lines,
        assumptions,
        blockers: [],
        warnings,
        summary: { lineCount: lines.length, needsHumanCount: 0, blockerCount: 0 },
      },
    });
  } catch (error) {
    return failure(request.requestId, request.inputDigest, [{
      code: "unsupported-configuration",
      message: error instanceof Error ? error.message : "The BOM rules kernel rejected the request.",
      entityId: request.job.id,
      path: null,
    }]);
  }
}

/** Derive auditable physical facts without emitting recipe component lines. */
export function deriveBomFacts(request: BomBuildRequest): ReadonlyMap<string, BomFacts> {
  return new Map(analyseRequest(request).map(({ recipe, facts }) => [recipe.id, facts]));
}

function analyseRequest(request: BomBuildRequest): RecipeAnalysis[] {
  const recipeMap = new Map(request.recipeSet.recipes.map((recipe) => [recipe.id, recipe]));
  const analyses = new Map<string, RecipeAnalysis>();
  for (const run of request.runs) {
    const recipe = recipeMap.get(run.recipeId);
    if (!recipe) throw new Error(`Run ${run.id} references missing recipe ${run.recipeId}.`);
    if (run.specification.bayWidthMm > recipe.maxBayWidthMm) {
      throw new Error(`Run ${run.id} approved bay width exceeds recipe capability.`);
    }
    const analysis = analyses.get(recipe.id) ?? {
      recipe,
      runs: [],
      gates: [],
      facts: emptyFacts(),
      residualSpanEndpoints: [],
    };
    analysis.runs.push(run);
    analyses.set(recipe.id, analysis);
  }
  for (const gate of request.gates) {
    const run = request.runs.find((candidate) => candidate.id === gate.runId)!;
    if (gate.boundaryPostCount !== 2) throw new Error(`Gate ${gate.id} must bind its typed model to exactly two physical opening boundaries.`);
    analyses.get(run.recipeId)!.gates.push(gate);
  }

  const sites = new Map<string, MutableSite>();
  const siteRecipeIds = new Map<string, Set<string>>();
  for (const run of request.runs) {
    const recipe = recipeMap.get(run.recipeId)!;
    const analysis = analyses.get(recipe.id)!;
    reconcileLengths(run, analysis.gates);
    const effectiveLimit = Math.min(run.specification.bayWidthMm, recipe.postSpacingMm);

    run.segments.forEach((segment) => {
      const segmentGates = analysis.gates
        .filter((gate) => gate.runId === run.id && gate.segmentIndex === segment.index)
        .map((gate) => ({ gate, start2: gate.centreOffsetMm * 2 - gate.widthMm, end2: gate.centreOffsetMm * 2 + gate.widthMm }))
        .sort((left, right) => left.start2 - right.start2 || left.gate.id.localeCompare(right.gate.id));
      assertNonOverlapping(run, segment.index, segment.lengthMm, segmentGates);
      for (const interval of segmentGates) {
        for (const offset2 of [interval.start2, interval.end2]) {
          const key = siteKey(run, segment.index, segment.lengthMm, offset2);
          const site = sites.get(key) ?? {
            key,
            recipeId: recipe.id,
            gateBoundary: false,
            original: offset2 === 0 || offset2 === segment.lengthMm * 2,
            degree: 0,
            treatments: new Set<string>(),
            neighbours: new Set<string>(),
            vertexNeighbours: new Set<string>(),
          };
          site.gateBoundary = true;
          sites.set(key, site);
          const recipeIds = siteRecipeIds.get(key) ?? new Set<string>();
          recipeIds.add(recipe.id);
          siteRecipeIds.set(key, recipeIds);
        }
      }
      const cuts2 = [0, ...segmentGates.flatMap((interval) => [interval.start2, interval.end2]), segment.lengthMm * 2];
      for (let cutIndex = 0; cutIndex < cuts2.length - 1; cutIndex += 1) {
        if (cutIndex % 2 === 1) continue;
        const start2 = cuts2[cutIndex];
        const end2 = cuts2[cutIndex + 1];
        if (end2 <= start2) continue;
        const span2 = end2 - start2;
        const bayCount = Math.ceil(span2 / (effectiveLimit * 2));
        const bayLengths2 = recipe.bayLayout === "full-bays-terminal-cut"
          ? Array.from({ length: bayCount }, (_, index) => Math.min(effectiveLimit * 2, span2 - index * effectiveLimit * 2))
          : span2 % 2 === 0
          ? distributeSpanMm(span2 / 2, effectiveLimit).map((lengthMm) => lengthMm * 2)
          : distributeUnits(span2, bayCount);
        const spanMm = span2 / 2;
        const bayLengthsMm = bayLengths2.map((length2) => length2 / 2);
        analysis.facts.residualSpanMm.push(spanMm);
        analysis.facts.bayLengthsMm.push(...bayLengthsMm);
        analysis.facts.bays += bayCount;

        const boundaryOffsets2 = [start2];
        let cursor2 = start2;
        bayLengths2.forEach((length2) => {
          cursor2 += length2;
          boundaryOffsets2.push(cursor2);
        });
        boundaryOffsets2.forEach((offset2, boundaryIndex) => {
          const key = siteKey(run, segment.index, segment.lengthMm, offset2);
          const original = offset2 === 0 || offset2 === segment.lengthMm * 2;
          const gateBoundary = segmentGates.some((interval) => interval.start2 === offset2 || interval.end2 === offset2);
          const site = sites.get(key) ?? {
            key,
            recipeId: recipe.id,
            gateBoundary: false,
            original,
            degree: 0,
            treatments: new Set<string>(),
            neighbours: new Set<string>(),
            vertexNeighbours: new Set<string>(),
          };
          site.gateBoundary ||= gateBoundary;
          sites.set(key, site);
          const recipeIds = siteRecipeIds.get(key) ?? new Set<string>();
          recipeIds.add(recipe.id);
          siteRecipeIds.set(key, recipeIds);
          if (boundaryIndex > 0) site.neighbours.add(siteKey(run, segment.index, segment.lengthMm, boundaryOffsets2[boundaryIndex - 1]));
          if (boundaryIndex < boundaryOffsets2.length - 1) site.neighbours.add(siteKey(run, segment.index, segment.lengthMm, boundaryOffsets2[boundaryIndex + 1]));
        });
        analysis.residualSpanEndpoints.push([
          siteKey(run, segment.index, segment.lengthMm, boundaryOffsets2[0]),
          siteKey(run, segment.index, segment.lengthMm, boundaryOffsets2[boundaryOffsets2.length - 1]),
        ]);
      }

      const left = ensureOriginalSite(sites, run, segment.index, recipe.id);
      const right = ensureOriginalSite(sites, run, segment.index + 1, recipe.id);
      left.degree += 1;
      right.degree += 1;
      left.treatments.add(run.vertices[segment.index].cornerTreatment);
      right.treatments.add(run.vertices[segment.index + 1].cornerTreatment);
      left.neighbours.add(right.key);
      right.neighbours.add(left.key);
      left.vertexNeighbours.add(right.key);
      right.vertexNeighbours.add(left.key);
    });
  }

  for (const [key, recipeIds] of siteRecipeIds) {
    if (recipeIds.size !== 1) throw new Error(`Topology node ${key} joins incompatible recipes.`);
  }
  const winningRoles = new Map<string, PostRole>();
  for (const site of sites.values()) {
    const analysis = analyses.get(site.recipeId)!;
    const role = classifySite(site, analysis.recipe, sites);
    winningRoles.set(site.key, role);
    analysis.facts.postRoles[role] += 1;
  }

  for (const analysis of analyses.values()) {
    analysis.facts.incidentStrainerEnds = analysis.residualSpanEndpoints.reduce(
      (count, endpoints) => count + endpoints.filter((key) => winningRoles.get(key) === "strainer").length,
      0,
    );
  }

  for (const analysis of analyses.values()) finishMaterialFacts(analysis);
  return [...analyses.values()].sort((left, right) => left.recipe.id.localeCompare(right.recipe.id));
}

function reconcileLengths(run: Run, gates: Gate[]) {
  const grossMm = run.segments.reduce((sum, segment) => sum + segment.lengthMm, 0);
  const gateDeductionMm = gates.filter((gate) => gate.runId === run.id).reduce((sum, gate) => sum + gate.widthMm, 0);
  if (grossMm !== run.storedLengths.grossMm || gateDeductionMm !== run.storedLengths.gateDeductionMm || grossMm - gateDeductionMm !== run.storedLengths.netMm) {
    throw new Error(`Run ${run.id} stored lengths do not reconcile with geometry and gates.`);
  }
}

function assertNonOverlapping(
  run: Run,
  segmentIndex: number,
  lengthMm: number,
  gates: { gate: Gate; start2: number; end2: number }[],
) {
  gates.forEach((interval) => {
    if (interval.start2 < 0 || interval.end2 > lengthMm * 2) throw new Error(`Gate ${interval.gate.id} falls outside run ${run.id} segment ${segmentIndex}.`);
  });
  for (let index = 1; index < gates.length; index += 1) {
    if (gates[index].start2 < gates[index - 1].end2) throw new Error(`Gate openings overlap on ${run.id} segment ${segmentIndex}.`);
  }
}

function ensureOriginalSite(sites: Map<string, MutableSite>, run: Run, vertexIndex: number, recipeId: string) {
  const key = run.vertices[vertexIndex].topologyNodeId;
  const site = sites.get(key) ?? {
    key,
    recipeId,
    gateBoundary: false,
    original: true,
    degree: 0,
    treatments: new Set<string>(),
    neighbours: new Set<string>(),
    vertexNeighbours: new Set<string>(),
  };
  sites.set(key, site);
  return site;
}

function siteKey(run: Run, segmentIndex: number, segmentLengthMm: number, offset2: number): string {
  if (offset2 === 0) return run.vertices[segmentIndex].topologyNodeId;
  if (offset2 === segmentLengthMm * 2) return run.vertices[segmentIndex + 1].topologyNodeId;
  return `segment:${run.id}:${segmentIndex}:offset2:${offset2}`;
}

function classifySite(site: MutableSite, recipe: Recipe, allSites: ReadonlyMap<string, MutableSite>): PostRole {
  if (site.gateBoundary) return recipe.materialModel.gateBoundaryPostRole;
  if (site.original && site.degree >= 3) return "junction";
  if (site.original && site.degree === 2 && isCorner(site, allSites)) return "corner";
  if (recipe.system === "chain-wire" && site.original && site.degree === 1) return "strainer";
  if (site.original && site.degree === 1) return "end";
  return "ordinary";
}

function isCorner(site: MutableSite, allSites: ReadonlyMap<string, MutableSite>): boolean {
  if ([...site.treatments].some((value) => ["boxed", "mitred", "custom"].includes(value))) return true;
  if (site.vertexNeighbours.size !== 2) return true;
  const origin = topologyPoint(site.key);
  const neighbours = [...site.vertexNeighbours].map((key) => topologyPoint(allSites.get(key)?.key ?? key));
  if (!origin || neighbours.some((point) => point === null)) throw new Error(`Degree-two topology node ${site.key} lacks exact document-space coordinates.`);
  const [a, b] = neighbours as [{ x: Fraction; y: Fraction }, { x: Fraction; y: Fraction }];
  const ax = subtractFractions(a.x, origin.x);
  const ay = subtractFractions(a.y, origin.y);
  const bx = subtractFractions(b.x, origin.x);
  const by = subtractFractions(b.y, origin.y);
  const cross = subtractFractions(multiplyFractions(ax, by), multiplyFractions(ay, bx));
  const dot = addFractions(multiplyFractions(ax, bx), multiplyFractions(ay, by));
  return cross.numerator !== 0n || dot.numerator >= 0n;
}

function topologyPoint(key: string): { x: Fraction; y: Fraction } | null {
  const match = /^sheet:\d+:x:([^:]+):y:([^:]+)$/.exec(key);
  if (!match) return null;
  try {
    return { x: parseCoordinateFraction(match[1]), y: parseCoordinateFraction(match[2]) };
  } catch {
    return null;
  }
}

function finishMaterialFacts(analysis: RecipeAnalysis) {
  const { recipe, facts } = analysis;
  facts.gateOpenings = analysis.gates.length;
  facts.gateLeaves = analysis.gates.reduce((sum, gate) => sum + gate.leafCount, 0);
  facts.hingeSets = analysis.gates.reduce((sum, gate) => sum + gate.hingeSetCount, 0);
  facts.latches = analysis.gates.reduce((sum, gate) => sum + gate.latchCount, 0);
  facts.dropBolts = analysis.gates.reduce((sum, gate) => sum + gate.dropBoltCount, 0);
  const netMm = analysis.runs.reduce((sum, run) => sum + run.storedLengths.netMm, 0);
  const model = recipe.materialModel;
  if (model.kind === "colorbond") {
    facts.infillSheets = facts.bayLengthsMm.reduce((sum, bay) => sum + Math.ceil(bay / model.effectiveSheetCoverMm), 0);
    facts.railCuts = facts.bays * model.railRows;
    facts.railLm = netMm / 1000 * model.railRows;
  } else if (model.kind === "timber-paling") {
    facts.palings = facts.bayLengthsMm.reduce((sum, bay) => sum + Math.ceil(bay / model.palingCoverMm), 0);
    facts.railCuts = facts.bays * model.railRows;
    facts.railLm = netMm / 1000 * model.railRows;
  } else if (model.kind === "chain-wire") {
    facts.meshLm = netMm / 1000;
    facts.meshM2 = facts.meshLm * model.meshHeightMm / 1000;
    facts.railLm = facts.meshLm * model.topRailRows;
    if (!model.braceEveryIncidentStrainerEnd) facts.incidentStrainerEnds = 0;
  } else {
    throw new Error(`Explicit ${model.system} rules are not implemented by fencing-v1 (${model.ruleKey}).`);
  }
}

function linesForAnalysis(analysis: RecipeAnalysis): BomLineV1[] {
  const concrete = concreteFacts(analysis);
  return analysis.recipe.components.flatMap((component) => {
    const base = basisQuantity(component.basis, analysis, concrete);
    const factored = multiplyFractions(base, parseDecimalFraction(component.factor));
    const allowance = allowanceForComponent(analysis.recipe, component.id, component.unit);
    const allowed = allowance
      ? multiplyFractions(factored, addFractions(fraction(1n, 1n), divideFractions(parseDecimalFraction(allowance.percent), fraction(100n, 1n))))
      : factored;
    const finalQuantity = allowance ? ceilToIncrement(allowed, parseDecimalFraction(allowance.roundingIncrement)) : allowed;
    if (finalQuantity.numerator <= 0n) return [];
    const value = fractionToDecimal(finalQuantity);
    const evidenceRefs = evidenceForBasis(component.basis, analysis);
    const calculation = calculationForBasis(component.basis, analysis, value, component.unit, concrete, {
      base,
      factored,
      factor: component.factor,
      allowance,
      componentAssumptionId: component.assumptionIds[0],
    });
    return [{
      id: lineId(component.itemCode, component.id),
      groupKey: `${systemKey(analysis.recipe.system)}|${component.itemCode}|${component.unit}`,
      category: categoryForBasis(component.basis),
      itemCode: component.itemCode,
      description: outputDescription(component.description, component.basis, Number(value)),
      quantity: { value, unit: component.unit },
      calculation: { ...calculation, result: { value, unit: component.unit } },
      confidenceTier: "single-source",
      evidenceRefs,
      assumptionRefs: assumptionLineage(component, analysis),
    } satisfies BomLineV1];
  });
}

function concreteFacts(analysis: RecipeAnalysis) {
  let raw = fraction(0n, 1n);
  const needsConcrete = analysis.recipe.components.some((component) => component.basis === "concrete-m3");
  for (const footing of analysis.recipe.footings) {
    const count = analysis.facts.postRoles[footing.postRole];
    const radius = fraction(BigInt(footing.diameterMm), 2000n);
    const depth = fraction(BigInt(footing.depthMm), 1000n);
    const volume = multiplyFractions(
      fraction(BigInt(count), 1n),
      multiplyFractions(PI, multiplyFractions(multiplyFractions(radius, radius), depth)),
    );
    raw = addFractions(raw, volume);
  }
  if (needsConcrete) {
    for (const [role, count] of Object.entries(analysis.facts.postRoles)) {
      if (count > 0 && !analysis.recipe.footings.some((footing) => footing.postRole === role)) {
        throw new Error(`Recipe ${analysis.recipe.id} has ${count} ${role} posts but no ${role} footing rule.`);
      }
    }
  }
  const concreteComponent = analysis.recipe.components.find((component) => component.basis === "concrete-m3");
  const allowance = concreteComponent
    ? analysis.recipe.allowances.find((candidate) => candidate.componentIds.includes(concreteComponent.id))
    : undefined;
  const factoredRaw = concreteComponent ? multiplyFractions(raw, parseDecimalFraction(concreteComponent.factor)) : raw;
  const allowed = allowance
    ? multiplyFractions(factoredRaw, addFractions(fraction(1n, 1n), divideFractions(parseDecimalFraction(allowance.percent), fraction(100n, 1n))))
    : factoredRaw;
  const increment = allowance ? parseDecimalFraction(allowance.roundingIncrement) : fraction(0n, 1n);
  const ordered = increment.numerator > 0n ? ceilToIncrement(allowed, increment) : allowed;
  return { raw, factoredRaw, allowed, ordered, allowance };
}

function basisQuantity(basis: Recipe["components"][number]["basis"], analysis: RecipeAnalysis, concrete: ReturnType<typeof concreteFacts>): Fraction {
  const facts = analysis.facts;
  const netMm = analysis.runs.reduce((sum, run) => sum + run.storedLengths.netMm, 0);
  const model = analysis.recipe.materialModel;
  const railRows = model.kind === "chain-wire" ? model.topRailRows : model.kind === "colorbond" || model.kind === "timber-paling" ? model.railRows : 0;
  const meshHeightMm = model.kind === "chain-wire" ? model.meshHeightMm : 0;
  const values: Record<typeof basis, Fraction> = {
    "per-ordinary-post": integerFraction(facts.postRoles.ordinary),
    "per-end-post": integerFraction(facts.postRoles.end),
    "per-corner-post": integerFraction(facts.postRoles.corner),
    "per-junction-post": integerFraction(facts.postRoles.junction),
    "per-strainer-post": integerFraction(facts.postRoles.strainer),
    "per-bay": integerFraction(facts.bays),
    "per-gate-post": integerFraction(facts.postRoles.gate),
    "per-incident-strainer-end": integerFraction(facts.incidentStrainerEnds),
    "per-infill-sheet": integerFraction(facts.infillSheets),
    "per-paling": integerFraction(facts.palings),
    "rail-cuts": integerFraction(facts.railCuts),
    "rail-lm": fraction(BigInt(netMm) * BigInt(railRows), 1000n),
    "mesh-lm": fraction(BigInt(netMm), 1000n),
    "mesh-m2": fraction(BigInt(netMm) * BigInt(meshHeightMm), 1_000_000n),
    "per-gate-opening": integerFraction(facts.gateOpenings),
    "per-gate-leaf": integerFraction(facts.gateLeaves),
    "per-hinge-set": integerFraction(facts.hingeSets),
    "per-latch": integerFraction(facts.latches),
    "per-drop-bolt": integerFraction(facts.dropBolts),
    "concrete-m3": concrete.raw,
    "per-removal-lm": fraction(0n, 1n),
    "per-retaining-lm": fraction(0n, 1n),
  };
  return values[basis];
}

function calculationForBasis(
  basis: Recipe["components"][number]["basis"],
  analysis: RecipeAnalysis,
  value: string,
  unit: BomLineV1["quantity"]["unit"],
  concrete: ReturnType<typeof concreteFacts>,
  audit: ComponentQuantityAudit,
): Omit<BomLineV1["calculation"], "result"> {
  const f = analysis.facts;
  const grossMm = analysis.runs.reduce((sum, run) => sum + run.storedLengths.grossMm, 0);
  const gateDeductionMm = analysis.runs.reduce((sum, run) => sum + run.storedLengths.gateDeductionMm, 0);
  const netMm = analysis.runs.reduce((sum, run) => sum + run.storedLengths.netMm, 0);
  const physicalSites = Object.values(f.postRoles).reduce((sum, count) => sum + count, 0);
  const basisValue = fractionToDecimal(audit.base);
  const bays = `[${f.bayLengthsMm.map(canonical).join(",")}]`;
  const simple = (ruleId: string, expression: string) => applyGenericQuantityAudit({ ruleId, ruleVersion: 1, expression, operands: [] }, value, unit, audit);
  switch (basis) {
    case "per-end-post": return simple("post-role-sites", analysis.recipe.system === "colorbond" && f.postRoles.end === 2 && analysis.runs.length === 1 ? "two outer run endpoints = 2 end posts" : analysis.recipe.system === "timber-paling" && analysis.runs.length === 1 ? `${basisValue} end posts` : `${basisValue} physical sites resolved to end role = ${basisValue} end posts`);
    case "per-gate-post": return simple("post-role-sites", analysis.recipe.system === "colorbond" && f.postRoles.gate === 2 && analysis.gates.length === 1 ? "two gate boundaries = 2 gate posts" : analysis.recipe.system === "timber-paling" && analysis.gates.length === 1 ? `${basisValue} gate posts` : `${analysis.gates.length * 2} gate boundaries resolve to ${basisValue} gate posts`);
    case "per-ordinary-post": return simple(analysis.recipe.system === "chain-wire" ? "chain-post-roles" : "post-role-sites", analysis.recipe.system === "colorbond" && physicalSites === 7 && f.postRoles.end === 2 && f.postRoles.gate === 2 && f.postRoles.ordinary === 3 ? `7 physical sites - 2 ends - 2 gate boundaries = ${basisValue} ordinary posts` : analysis.recipe.system === "chain-wire" && physicalSites === 5 && f.postRoles.strainer === 4 && f.postRoles.ordinary === 1 ? `5 sites - 4 strainer sites = ${basisValue} line post` : analysis.recipe.system === "timber-paling" && analysis.runs.length === 1 ? `${basisValue} ordinary posts` : `${physicalSites} physical sites - ${physicalSites - f.postRoles.ordinary} higher-role sites = ${basisValue} ordinary posts`);
    case "per-strainer-post": return simple("chain-post-roles", physicalSites === 5 && f.postRoles.strainer === 4 ? "two outer ends + two gate boundaries = 4 strainers" : `${basisValue} physical sites resolved to strainer role = ${basisValue} strainers`);
    case "per-incident-strainer-end": return simple("incident-strainer-ends", `${basisValue} residual-span incident strainer ends`);
    case "per-infill-sheet": return simple("infill-sheets-per-bay", `ceil each bay ${bays} / ${(analysis.recipe.materialModel as { effectiveSheetCoverMm: number }).effectiveSheetCoverMm} = ${basisValue} sheets`);
    case "per-paling": return simple("palings-per-distributed-bay", `sum ceil(${bays} / ${(analysis.recipe.materialModel as { palingCoverMm: number }).palingCoverMm}) = ${basisValue}`);
    case "rail-cuts": return simple("rail-cuts", `${f.bays} bays × ${(analysis.recipe.materialModel as { railRows: number }).railRows} rail rows = ${basisValue} cuts`);
    case "rail-lm": return simple("rail-length", analysis.recipe.system === "chain-wire" ? `${canonical(netMm / 1000)} lm net × ${(analysis.recipe.materialModel as { topRailRows: number }).topRailRows} top rail row = ${basisValue} lm` : `${canonical(netMm / 1000)} lm net fence × ${(analysis.recipe.materialModel as { railRows: number }).railRows} rail rows = ${basisValue} lm`);
    case "mesh-lm": return simple("mesh-net-length", `${canonical(grossMm / 1000)} lm gross - ${canonical(gateDeductionMm / 1000)} lm gate = ${basisValue} lm`);
    case "mesh-m2": return simple("mesh-area", `${canonical(netMm / 1000)} lm × ${canonical((analysis.recipe.materialModel as { meshHeightMm: number }).meshHeightMm / 1000)} m = ${basisValue} m2`);
    case "per-gate-opening": return simple("gate-opening", analysis.gates.length === 1 ? "one approved gate opening = 1" : `${analysis.gates.length} approved gate openings = ${basisValue}`);
    case "per-gate-leaf": return simple("typed-gate-hardware", analysis.gates.length === 1 ? `typed ${analysis.gates[0].type}-gate model = ${basisValue} leaves` : `typed gate models (${gateMix(analysis.gates)}) = ${basisValue} leaves`);
    case "per-hinge-set": return simple("typed-gate-hardware", `typed gate model${analysis.gates.length === 1 ? "" : "s"} = ${basisValue} hinge sets`);
    case "per-latch": return simple("typed-gate-hardware", `typed gate model${analysis.gates.length === 1 ? "" : "s"} = ${basisValue} latch${Number(basisValue) === 1 ? "" : "es"}`);
    case "per-drop-bolt": return simple("typed-gate-hardware", `typed gate model${analysis.gates.length === 1 ? "" : "s"} = ${basisValue} drop bolt${Number(basisValue) === 1 ? "" : "s"}`);
    case "concrete-m3": return {
      ruleId: "role-footing-concrete",
      ruleVersion: 1,
      expression: concreteExpression(analysis, concrete, value),
      operands: [
        operand("raw-full-precision", fractionToDecimal(concrete.factoredRaw), "m3", footingAssumptionId(analysis)),
        operand("raw-display-round-half-up-6", roundHalfUpFraction(concrete.factoredRaw, 6), "m3", footingAssumptionId(analysis)),
        operand("allowed-full-precision", fractionToDecimal(concrete.allowed), "m3", allowanceAssumptionId(concrete)),
        operand("allowed-display-round-half-up-6", roundHalfUpFraction(concrete.allowed, 6), "m3", allowanceAssumptionId(concrete)),
      ],
    };
    default: return simple(basis, `${basis} = ${value} ${unit}`);
  }
}

type ComponentQuantityAudit = {
  base: Fraction;
  factored: Fraction;
  factor: string;
  allowance: Recipe["allowances"][number] | undefined;
  componentAssumptionId: string | undefined;
};

function allowanceForComponent(recipe: Recipe, componentId: string, unit: BomLineV1["quantity"]["unit"]) {
  const matches = recipe.allowances.filter((allowance) => allowance.componentIds.includes(componentId));
  if (matches.length > 1) throw new Error(`Component ${componentId} has multiple allowances.`);
  const allowance = matches[0];
  if (!allowance) return undefined;
  if (allowance.status !== "accepted") throw new Error(`Component ${componentId} allowance ${allowance.id} is unresolved.`);
  if (allowance.roundingUnit !== unit) throw new Error(`Component ${componentId} allowance unit does not match its component unit.`);
  return allowance;
}

function applyGenericQuantityAudit(
  calculation: Omit<BomLineV1["calculation"], "result">,
  result: string,
  unit: BomLineV1["quantity"]["unit"],
  audit: ComponentQuantityAudit,
): Omit<BomLineV1["calculation"], "result"> {
  if (!audit.allowance && audit.factor === "1") return calculation;
  if (!audit.componentAssumptionId) throw new Error("Component factor lacks assumption evidence.");
  const recipeEvidence = [{ kind: "assumption" as const, id: audit.componentAssumptionId }];
  if (!audit.allowance) {
    return {
      ...calculation,
      expression: `(${calculation.expression}) × ${audit.factor} = ${result} ${unit}`,
      operands: [
        ...calculation.operands,
        { name: "basis-quantity", value: fractionToDecimal(audit.base), unit, evidenceRefs: recipeEvidence },
        { name: "component-factor", value: audit.factor, unit: "ratio", evidenceRefs: recipeEvidence },
      ],
    };
  }
  const assumptionId = audit.allowance.assumptionIds[0];
  if (!assumptionId) throw new Error(`Allowance ${audit.allowance.id} lacks assumption evidence.`);
  const evidenceRefs = [{ kind: "assumption" as const, id: assumptionId }];
  return {
    ...calculation,
    expression: `ROUND_UP_INCREMENT((${calculation.expression}) × ${audit.factor} × (1 + ${audit.allowance.percent}/100), ${audit.allowance.roundingIncrement}) = ${result} ${unit}`,
    operands: [
      ...calculation.operands,
      { name: "basis-quantity", value: fractionToDecimal(audit.base), unit, evidenceRefs: recipeEvidence },
      { name: "component-factor", value: audit.factor, unit: "ratio", evidenceRefs: recipeEvidence },
      { name: "factored-base", value: fractionToDecimal(audit.factored), unit, evidenceRefs },
      { name: "allowance-percent", value: audit.allowance.percent, unit: "ratio", evidenceRefs },
      { name: "rounding-increment", value: audit.allowance.roundingIncrement, unit, evidenceRefs },
    ],
  };
}

function concreteExpression(analysis: RecipeAnalysis, concrete: ReturnType<typeof concreteFacts>, result: string): string {
  const groups = new Map<string, { count: number; diameterMm: number; depthMm: number }>();
  analysis.recipe.footings.forEach((footing) => {
    const count = analysis.facts.postRoles[footing.postRole];
    if (count === 0) return;
    const key = `${footing.diameterMm}:${footing.depthMm}`;
    const group = groups.get(key) ?? { count: 0, diameterMm: footing.diameterMm, depthMm: footing.depthMm };
    group.count += count;
    groups.set(key, group);
  });
  const terms = [...groups.values()].map((group) => `${group.count}×π×${canonical(group.diameterMm / 2000)}²×${canonical(group.depthMm / 1000)}`);
  const allowance = concrete.allowance;
  const componentFactor = analysis.recipe.components.find((component) => component.basis === "concrete-m3")?.factor ?? "1";
  const factorTerm = componentFactor === "1" ? "" : ` × ${componentFactor}`;
  const multiplier = allowance ? (1 + Number(allowance.percent) / 100).toFixed(2) : "1";
  const increment = allowance?.roundingIncrement ?? "0";
  return `ROUND_UP_INCREMENT((${terms.join(" + ")})${factorTerm} × ${multiplier}, ${increment}) = ${result} m3`;
}

function footingAssumptionId(analysis: RecipeAnalysis): string {
  const id = analysis.recipe.footings.flatMap((footing) => footing.assumptionIds)[0];
  if (!id) throw new Error(`Recipe ${analysis.recipe.id} concrete requires a footing assumption.`);
  return id;
}

function allowanceAssumptionId(concrete: ReturnType<typeof concreteFacts>): string {
  const id = concrete.allowance?.assumptionIds[0];
  if (!id) throw new Error("Concrete quantity requires an accepted allowance assumption.");
  return id;
}

function operand(name: string, value: string, unit: "m3", assumptionId: string) {
  return { name, value, unit, evidenceRefs: [{ kind: "assumption" as const, id: assumptionId }] };
}

function evidenceForBasis(basis: Recipe["components"][number]["basis"], analysis: RecipeAnalysis): BomLineV1["evidenceRefs"] {
  const runRefs = analysis.runs.map((run) => ({ kind: "run" as const, id: run.id, revision: run.revision }));
  const gateRefs = analysis.gates.map((gate) => ({ kind: "gate" as const, id: gate.id, revision: gate.revision }));
  if (["per-gate-post", "per-gate-opening", "per-gate-leaf", "per-hinge-set", "per-latch", "per-drop-bolt"].includes(basis)) return gateRefs;
  if (basis === "per-strainer-post") return [...runRefs, ...gateRefs];
  if (basis === "concrete-m3") return [...runRefs, ...gateRefs, { kind: "recipe", id: analysis.recipe.id, revision: analysis.recipe.revision }];
  return runRefs;
}

function categoryForBasis(basis: Recipe["components"][number]["basis"]): BomLineV1["category"] {
  if (basis.includes("post")) return "post";
  if (["per-infill-sheet", "per-paling", "mesh-lm", "mesh-m2"].includes(basis)) return "infill";
  if (["rail-cuts", "rail-lm"].includes(basis)) return "rail";
  if (["per-gate-opening", "per-gate-leaf"].includes(basis)) return "gate";
  if (["per-hinge-set", "per-latch", "per-drop-bolt"].includes(basis)) return "gate-hardware";
  if (basis === "concrete-m3") return "concrete";
  if (basis === "per-removal-lm") return "removal";
  if (basis === "per-retaining-lm") return "retaining";
  return "other";
}

function lineId(itemCode: string, componentId: string): string {
  const overrides: Record<string, string> = {
    "CB-POST-END": "bom-cb-end-post", "CB-POST-GATE": "bom-cb-gate-post", "CB-POST-ORD": "bom-cb-ordinary-post",
    "CW-TOP-RAIL": "bom-cw-top-rail", "GATE-DROP-BOLT": "bom-gate-drop-bolt",
  };
  return overrides[itemCode] ?? `bom-${componentId}`;
}

function outputDescription(description: string, basis: string, quantity: number): string {
  if (quantity === 1) return description;
  const overrides: Record<string, string> = {
    "per-infill-sheet": `${description}s`,
    "per-paling": `${description}s`,
    "rail-cuts": `${description}s`,
    "per-gate-leaf": description.replace(/leaf$/, "leaves"),
    "per-hinge-set": `${description}s`,
    "per-incident-strainer-end": description.replace(/assembly$/, "assemblies"),
  };
  return overrides[basis] ?? description;
}

function chainWireWarnings(analysis: RecipeAnalysis): BomIssue[] {
  const model = analysis.recipe.materialModel;
  if (model.kind !== "chain-wire") return [];
  return [{
    code: "unsupported-configuration",
    message: `Roll ordering remains a separate SC-07 order-kernel operation; this BOM records ${canonical(analysis.facts.meshLm)} lm raw mesh and the explicit reuse policy only.`,
    entityId: analysis.runs[0].id,
    path: "recipeSet.materialModel.meshRollReusePolicy",
  }];
}

function gateMix(gates: Gate[]): string {
  const counts = new Map<string, number>();
  gates.forEach((gate) => counts.set(gate.type, (counts.get(gate.type) ?? 0) + 1));
  return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([type, count]) => `${count}×${type}`).join(", ");
}

function assumptionLineage(component: Recipe["components"][number], analysis: RecipeAnalysis): string[] {
  const additions: string[] = [];
  const materialBases = new Set(["per-infill-sheet", "per-paling", "rail-cuts", "rail-lm", "mesh-lm", "mesh-m2", "per-incident-strainer-end"]);
  const gateBases = new Set(["per-gate-post", "per-gate-opening", "per-gate-leaf", "per-hinge-set", "per-latch", "per-drop-bolt"]);
  if (materialBases.has(component.basis)) addDependencyGroup(additions, component.assumptionIds, analysis.recipe.materialModel.assumptionIds);
  if (component.basis === "concrete-m3") addDependencyGroup(additions, component.assumptionIds, analysis.recipe.footings.flatMap((footing) => footing.assumptionIds));
  if (gateBases.has(component.basis)) addDependencyGroup(additions, component.assumptionIds, analysis.recipe.gateHardwareModels.flatMap((model) => model.assumptionIds));
  analysis.recipe.allowances.filter((allowance) => allowance.componentIds.includes(component.id)).forEach((allowance) => addDependencyGroup(additions, component.assumptionIds, allowance.assumptionIds));
  const result = [...component.assumptionIds];
  [...new Set(additions)].sort().forEach((id) => { if (!result.includes(id)) result.push(id); });
  return result;
}

function addDependencyGroup(target: string[], existing: readonly string[], dependencies: readonly string[]) {
  if (!dependencies.some((id) => existing.includes(id))) target.push(...dependencies);
}

function referencedAssumptionIssues(request: BomBuildRequest): BomIssue[] {
  const issues: BomIssue[] = [];
  for (const recipe of request.recipeSet.recipes) {
    const assumptions = new Map(recipe.assumptions.map((assumption) => [assumption.id, assumption]));
    const references = new Set([
      ...recipe.materialModel.assumptionIds,
      ...recipe.footings.flatMap((footing) => footing.assumptionIds),
      ...recipe.gateHardwareModels.flatMap((model) => model.assumptionIds),
      ...recipe.components.flatMap((component) => component.assumptionIds),
      ...recipe.allowances.flatMap((allowance) => allowance.assumptionIds),
    ]);
    for (const assumptionId of [...references].sort()) {
      const assumption = assumptions.get(assumptionId);
      if (!assumption || assumption.status !== "accepted" || !assumption.acceptedBy?.trim() || !assumption.acceptedAt) {
        issues.push({
          code: "assumption",
          message: `Recipe ${recipe.id} references unresolved or unattributed assumption ${assumptionId}.`,
          entityId: recipe.id,
          path: `recipeSet.recipes.${recipe.id}.assumptions.${assumptionId}`,
        });
      }
    }
    for (const allowance of recipe.allowances) {
      if (allowance.status !== "accepted" || !allowance.acceptedBy?.trim() || !allowance.acceptedAt) {
        issues.push({
          code: "assumption",
          message: `Recipe ${recipe.id} references unresolved or unattributed allowance ${allowance.id}.`,
          entityId: recipe.id,
          path: `recipeSet.recipes.${recipe.id}.allowances.${allowance.id}`,
        });
      }
    }
  }
  return issues;
}

function collectAssumptions(analyses: RecipeAnalysis[]): BomAssumption[] {
  const seen = new Set<string>();
  return analyses.flatMap(({ recipe }) => recipe.assumptions).filter((assumption) => {
    if (seen.has(assumption.id)) return false;
    seen.add(assumption.id);
    return true;
  });
}

function emptyFacts(): BomFacts {
  return {
    bays: 0, bayLengthsMm: [], residualSpanMm: [],
    postRoles: { ordinary: 0, end: 0, corner: 0, junction: 0, strainer: 0, gate: 0 },
    incidentStrainerEnds: 0, infillSheets: 0, palings: 0, railCuts: 0, railLm: 0,
    meshLm: 0, meshM2: 0, gateOpenings: 0, gateLeaves: 0, hingeSets: 0, latches: 0, dropBolts: 0,
  };
}

function distributeUnits(span: number, count: number): number[] {
  const base = Math.floor(span / count);
  const remainder = span - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

function canonical(value: number): string {
  if (!Number.isFinite(value) || value < 0) throw new Error("BOM arithmetic produced an invalid quantity.");
  if (Object.is(value, -0) || value === 0) return "0";
  const text = value.toString();
  if (!/[eE]/.test(text)) return text;
  return value.toFixed(20).replace(/0+$/, "").replace(/\.$/, "");
}

function systemKey(system: Recipe["system"]): string {
  return system === "timber-paling" ? "timber" : system === "chain-wire" ? "chain" : system;
}

function failure(requestId: string, inputDigest: string | null, issues: BomIssue[]): BomBuildResponse {
  return bomBuildResponseSchema.parse({ schema: BOM_SCHEMA, ok: false, requestId, inputDigest, issues });
}

function safeRequestId(input: unknown): string {
  if (input && typeof input === "object" && typeof (input as { requestId?: unknown }).requestId === "string" && (input as { requestId: string }).requestId.length > 0) {
    return (input as { requestId: string }).requestId.slice(0, 240);
  }
  return "invalid-request";
}

function gateIdFromOverlap(input: unknown): string | null {
  if (!input || typeof input !== "object" || !Array.isArray((input as { gates?: unknown }).gates)) return null;
  const gates = (input as { gates: unknown[] }).gates;
  const candidate = gates[1];
  return candidate && typeof candidate === "object" && typeof (candidate as { id?: unknown }).id === "string" ? (candidate as { id: string }).id : null;
}

function fraction(numerator: bigint, denominator: bigint): Fraction {
  if (denominator === 0n) throw new Error("Decimal arithmetic cannot divide by zero.");
  if (denominator < 0n) return fraction(-numerator, -denominator);
  const divisor = greatestCommonDivisor(numerator < 0n ? -numerator : numerator, denominator);
  return { numerator: numerator / divisor, denominator: denominator / divisor };
}

function integerFraction(value: number): Fraction {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("BOM count must be a non-negative safe integer.");
  return fraction(BigInt(value), 1n);
}

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  let a = left;
  let b = right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a === 0n ? 1n : a;
}

function addFractions(left: Fraction, right: Fraction): Fraction {
  return fraction(left.numerator * right.denominator + right.numerator * left.denominator, left.denominator * right.denominator);
}

function subtractFractions(left: Fraction, right: Fraction): Fraction {
  return fraction(left.numerator * right.denominator - right.numerator * left.denominator, left.denominator * right.denominator);
}

function multiplyFractions(left: Fraction, right: Fraction): Fraction {
  return fraction(left.numerator * right.numerator, left.denominator * right.denominator);
}

function divideFractions(left: Fraction, right: Fraction): Fraction {
  return fraction(left.numerator * right.denominator, left.denominator * right.numerator);
}

function parseDecimalFraction(value: string): Fraction {
  if (!/^(?:0|[1-9]\d*)(?:\.\d*[1-9])?$/.test(value)) throw new Error(`Invalid canonical decimal ${value}.`);
  const [whole, fractional = ""] = value.split(".");
  return fraction(BigInt(`${whole}${fractional}`), 10n ** BigInt(fractional.length));
}

function parseCoordinateFraction(value: string): Fraction {
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(value);
  if (!match) throw new Error(`Invalid topology coordinate ${value}.`);
  const sign = match[1] === "-" ? -1n : 1n;
  const fractional = match[3] ?? "";
  const exponent = Number(match[4] ?? "0") - fractional.length;
  const coefficient = sign * BigInt(`${match[2]}${fractional}`);
  return exponent >= 0
    ? fraction(coefficient * 10n ** BigInt(exponent), 1n)
    : fraction(coefficient, 10n ** BigInt(-exponent));
}

function fractionToDecimal(value: Fraction): string {
  let denominator = value.denominator;
  let twos = 0;
  let fives = 0;
  while (denominator % 2n === 0n) { denominator /= 2n; twos += 1; }
  while (denominator % 5n === 0n) { denominator /= 5n; fives += 1; }
  if (denominator !== 1n) throw new Error("BOM decimal result is non-terminating.");
  const scale = Math.max(twos, fives);
  const scaled = value.numerator * 2n ** BigInt(scale - twos) * 5n ** BigInt(scale - fives);
  if (scale === 0) return scaled.toString();
  const digits = scaled.toString().padStart(scale + 1, "0");
  const rendered = `${digits.slice(0, -scale)}.${digits.slice(-scale)}`.replace(/0+$/, "").replace(/\.$/, "");
  return rendered === "" ? "0" : rendered;
}

function roundHalfUpFraction(value: Fraction, scale: number): string {
  const multiplier = 10n ** BigInt(scale);
  const scaledNumerator = value.numerator * multiplier;
  let quotient = scaledNumerator / value.denominator;
  const remainder = scaledNumerator % value.denominator;
  if (remainder * 2n >= value.denominator) quotient += 1n;
  return fractionToDecimal(fraction(quotient, multiplier));
}

function ceilToIncrement(value: Fraction, increment: Fraction): Fraction {
  const ratio = divideFractions(value, increment);
  const wholeIncrements = (ratio.numerator + ratio.denominator - 1n) / ratio.denominator;
  return multiplyFractions(fraction(wholeIncrements, 1n), increment);
}
