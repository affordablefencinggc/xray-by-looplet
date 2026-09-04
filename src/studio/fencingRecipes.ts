import { bomRecipeSetSchema, type BomRecipeSet } from "./bomContract.ts";

type BomRecipe = BomRecipeSet["recipes"][number];
type BomSystem = BomRecipe["system"];

const CANDIDATE_EFFECTIVE_AT = "2026-09-04T00:00:00.000Z";
const EMPTY_DIGEST = "0".repeat(64);

export const FENCING_RECIPE_SET_ID = "xray-fencing-candidates-v1";

export type RecipeSelection = {
  system: BomSystem | null;
  profile: string | null;
};

export type RecipeSelectionResult =
  | { ok: true; recipe: BomRecipe }
  | {
      ok: false;
      issue: {
        code: "unselected" | "unsupported-system" | "unsupported-profile" | "invalid-recipe-set";
        message: string;
      };
    };

export type RecipeAssumptionAction = "accept" | "reopen";

export type RecipeAssumptionTransitionInput = {
  recipeId: string;
  assumptionId: string;
  expectedSetRevision: number;
  expectedRecipeRevision: number;
  actor: string;
  at: string;
};

export type RecipeAssumptionTransition = {
  recipeSet: BomRecipeSet;
  event: {
    action: RecipeAssumptionAction;
    recipeId: string;
    assumptionId: string;
    actor: string;
    at: string;
    fromStatus: "accepted" | "unresolved";
    toStatus: "accepted" | "unresolved";
    previousSetRevision: number;
    setRevision: number;
    previousRecipeRevision: number;
    recipeRevision: number;
  };
};

export class RecipeRevisionConflictError extends Error {
  readonly name = "RecipeRevisionConflictError";
}

export class RecipeAssumptionTransitionError extends Error {
  readonly name = "RecipeAssumptionTransitionError";
}

export class RecipeSetIntegrityError extends Error {
  readonly name = "RecipeSetIntegrityError";
}

const SUPPORTED_RECIPE_IDS = new Map([
  ["colorbond\u0000Good Neighbour", "recipe-colorbond-good-neighbour"],
  ["timber-paling\u0000Standard paling", "recipe-timber-standard"],
  ["chain-wire\u000050 mm galvanised", "recipe-chain-standard"],
]);

function unresolvedAssumption(
  id: string,
  key: string,
  label: string,
  value: string,
  unit: "ea" | "mm" | "ratio",
  sourceDetail: string,
): BomRecipe["assumptions"][number] {
  return {
    id,
    key,
    label: `Needs human confirmation — ${label}`,
    value,
    unit,
    source: `Candidate preparation value only; not site, engineering, supplier, or manufacturer approval. Verify against ${sourceDetail}.`,
    effectiveAt: CANDIDATE_EFFECTIVE_AT,
    status: "unresolved",
    acceptedBy: null,
    acceptedAt: null,
  };
}

function candidateRecipes(): BomRecipe[] {
  const colorbond: BomRecipe = {
    id: "recipe-colorbond-good-neighbour",
    revision: 1,
    system: "colorbond",
    profile: "Good Neighbour",
    maxBayWidthMm: 2400,
    postSpacingMm: 2400,
    materialModel: {
      kind: "colorbond",
      effectiveSheetCoverMm: 762,
      railRows: 2,
      gateBoundaryPostRole: "gate",
      assumptionIds: ["cb-material"],
    },
    footings: [
      { postRole: "ordinary", diameterMm: 250, depthMm: 600, assumptionIds: ["cb-footing"] },
      { postRole: "end", diameterMm: 250, depthMm: 600, assumptionIds: ["cb-footing"] },
      { postRole: "corner", diameterMm: 300, depthMm: 800, assumptionIds: ["cb-footing"] },
      { postRole: "junction", diameterMm: 300, depthMm: 800, assumptionIds: ["cb-footing"] },
      { postRole: "gate", diameterMm: 300, depthMm: 800, assumptionIds: ["cb-footing"] },
    ],
    allowances: [],
    gateHardwareModels: [
      {
        id: "gate-model-double-2000",
        gateType: "double",
        widthMm: 2000,
        leafCount: 2,
        boundaryPostCount: 2,
        hingeSetCount: 2,
        latchCount: 1,
        dropBoltCount: 1,
        assumptionIds: ["cb-gate"],
      },
    ],
    supportedSlopes: ["level"],
    supportedGround: ["soil"],
    supportedGateTypes: ["double"],
    supportedRetainingTypes: ["none"],
    supportsSleepers: false,
    assumptions: [
      unresolvedAssumption("cb-spacing", "post-spacing-mm", "maximum post and bay spacing", "2400", "mm", "the project design and selected product engineering schedule"),
      unresolvedAssumption("cb-material", "sheet-cover-and-rail-rows", "762 mm effective sheet cover and two rail rows", "762", "mm", "the selected manufacturer profile data sheet"),
      unresolvedAssumption("cb-footing", "role-footing-dimensions", "role-specific footing diameters and depths", "1", "ratio", "the site classification and engineer-approved footing schedule"),
      unresolvedAssumption("cb-gate", "double-gate-components", "2,000 mm double-gate component schedule", "1", "ratio", "the selected gate supplier schedule"),
    ],
    components: [
      { id: "cb-post-ordinary", itemCode: "CB-POST-ORD", description: "Ordinary Colorbond post", unit: "ea", basis: "per-ordinary-post", factor: "1", assumptionIds: ["cb-spacing"] },
      { id: "cb-post-end", itemCode: "CB-POST-END", description: "End Colorbond post", unit: "ea", basis: "per-end-post", factor: "1", assumptionIds: ["cb-spacing"] },
      { id: "cb-post-corner", itemCode: "CB-POST-CORNER", description: "Corner Colorbond post", unit: "ea", basis: "per-corner-post", factor: "1", assumptionIds: ["cb-spacing"] },
      { id: "cb-post-junction", itemCode: "CB-POST-JUNCTION", description: "Junction Colorbond post", unit: "ea", basis: "per-junction-post", factor: "1", assumptionIds: ["cb-spacing"] },
      { id: "cb-post-gate", itemCode: "CB-POST-GATE", description: "Colorbond gate boundary post", unit: "ea", basis: "per-gate-post", factor: "1", assumptionIds: ["cb-gate"] },
      { id: "cb-sheet", itemCode: "CB-SHEET", description: "Colorbond infill sheet", unit: "ea", basis: "per-infill-sheet", factor: "1", assumptionIds: ["cb-material"] },
      { id: "cb-rail-cut", itemCode: "CB-RAIL-CUT", description: "Colorbond rail cut", unit: "ea", basis: "rail-cuts", factor: "1", assumptionIds: ["cb-material"] },
      { id: "cb-rail-lm", itemCode: "CB-RAIL-LM", description: "Colorbond rail material", unit: "lm", basis: "rail-lm", factor: "1", assumptionIds: ["cb-material"] },
      { id: "cb-gate-opening", itemCode: "CB-GATE-OPENING", description: "Colorbond double gate opening", unit: "ea", basis: "per-gate-opening", factor: "1", assumptionIds: ["cb-gate"] },
      { id: "cb-gate-leaf", itemCode: "CB-GATE-LEAF", description: "Colorbond gate leaf", unit: "ea", basis: "per-gate-leaf", factor: "1", assumptionIds: ["cb-gate"] },
      { id: "cb-gate-hinge", itemCode: "CB-GATE-HINGE-SET", description: "Colorbond gate hinge set", unit: "ea", basis: "per-hinge-set", factor: "1", assumptionIds: ["cb-gate"] },
      { id: "cb-gate-latch", itemCode: "CB-GATE-LATCH", description: "Colorbond gate latch", unit: "ea", basis: "per-latch", factor: "1", assumptionIds: ["cb-gate"] },
      { id: "cb-gate-drop", itemCode: "CB-GATE-DROP-BOLT", description: "Colorbond gate drop bolt", unit: "ea", basis: "per-drop-bolt", factor: "1", assumptionIds: ["cb-gate"] },
    ],
  };

  const timber: BomRecipe = {
    id: "recipe-timber-standard",
    revision: 1,
    system: "timber-paling",
    profile: "Standard paling",
    maxBayWidthMm: 2400,
    postSpacingMm: 2400,
    materialModel: { kind: "timber-paling", palingCoverMm: 90, railRows: 2, gateBoundaryPostRole: "gate", assumptionIds: ["tp-material"] },
    footings: [
      { postRole: "ordinary", diameterMm: 250, depthMm: 600, assumptionIds: ["tp-footing"] },
      { postRole: "end", diameterMm: 250, depthMm: 600, assumptionIds: ["tp-footing"] },
      { postRole: "corner", diameterMm: 300, depthMm: 800, assumptionIds: ["tp-footing"] },
      { postRole: "junction", diameterMm: 300, depthMm: 800, assumptionIds: ["tp-footing"] },
      { postRole: "gate", diameterMm: 300, depthMm: 800, assumptionIds: ["tp-footing"] },
    ],
    allowances: [],
    gateHardwareModels: [{ id: "timber-double-2000", gateType: "double", widthMm: 2000, leafCount: 2, boundaryPostCount: 2, hingeSetCount: 2, latchCount: 1, dropBoltCount: 1, assumptionIds: ["tp-gate"] }],
    supportedSlopes: ["level"],
    supportedGround: ["soil"],
    supportedGateTypes: ["double"],
    supportedRetainingTypes: ["none"],
    supportsSleepers: false,
    assumptions: [
      unresolvedAssumption("tp-spacing", "post-spacing-mm", "maximum post and bay spacing", "2400", "mm", "the project design and engineer-approved framing schedule"),
      unresolvedAssumption("tp-material", "paling-cover-and-rail-rows", "90 mm paling cover and two rail rows", "90", "mm", "the selected timber supplier and framing schedule"),
      unresolvedAssumption("tp-footing", "role-footing-dimensions", "role-specific footing diameters and depths", "1", "ratio", "the site classification and engineer-approved footing schedule"),
      unresolvedAssumption("tp-gate", "double-gate-components", "2,000 mm timber double-gate component schedule", "1", "ratio", "the selected gate supplier schedule"),
    ],
    components: [
      { id: "tp-post-ordinary", itemCode: "TP-POST-ORD", description: "Timber line post", unit: "ea", basis: "per-ordinary-post", factor: "1", assumptionIds: ["tp-spacing"] },
      { id: "tp-post-end", itemCode: "TP-POST-END", description: "Timber end post", unit: "ea", basis: "per-end-post", factor: "1", assumptionIds: ["tp-spacing"] },
      { id: "tp-post-corner", itemCode: "TP-POST-CORNER", description: "Timber corner post", unit: "ea", basis: "per-corner-post", factor: "1", assumptionIds: ["tp-spacing"] },
      { id: "tp-post-junction", itemCode: "TP-POST-JUNCTION", description: "Timber junction post", unit: "ea", basis: "per-junction-post", factor: "1", assumptionIds: ["tp-spacing"] },
      { id: "tp-post-gate", itemCode: "TP-POST-GATE", description: "Timber gate post", unit: "ea", basis: "per-gate-post", factor: "1", assumptionIds: ["tp-gate"] },
      { id: "tp-paling", itemCode: "TP-PALING", description: "Timber paling", unit: "ea", basis: "per-paling", factor: "1", assumptionIds: ["tp-material"] },
      { id: "tp-rail-cut", itemCode: "TP-RAIL-CUT", description: "Timber rail cut", unit: "ea", basis: "rail-cuts", factor: "1", assumptionIds: ["tp-material"] },
      { id: "tp-rail-lm", itemCode: "TP-RAIL-LM", description: "Timber rail material", unit: "lm", basis: "rail-lm", factor: "1", assumptionIds: ["tp-material"] },
      { id: "tp-gate-opening", itemCode: "TP-GATE-OPENING", description: "Timber double gate opening", unit: "ea", basis: "per-gate-opening", factor: "1", assumptionIds: ["tp-gate"] },
      { id: "tp-gate-leaf", itemCode: "TP-GATE-LEAF", description: "Timber gate leaf", unit: "ea", basis: "per-gate-leaf", factor: "1", assumptionIds: ["tp-gate"] },
      { id: "tp-gate-hinge", itemCode: "TP-GATE-HINGE-SET", description: "Timber gate hinge set", unit: "ea", basis: "per-hinge-set", factor: "1", assumptionIds: ["tp-gate"] },
      { id: "tp-gate-latch", itemCode: "TP-GATE-LATCH", description: "Timber gate latch", unit: "ea", basis: "per-latch", factor: "1", assumptionIds: ["tp-gate"] },
      { id: "tp-gate-drop", itemCode: "TP-GATE-DROP-BOLT", description: "Timber gate drop bolt", unit: "ea", basis: "per-drop-bolt", factor: "1", assumptionIds: ["tp-gate"] },
    ],
  };

  const chainWire: BomRecipe = {
    id: "recipe-chain-standard",
    revision: 1,
    system: "chain-wire",
    profile: "50 mm galvanised",
    maxBayWidthMm: 3000,
    postSpacingMm: 3000,
    materialModel: { kind: "chain-wire", meshHeightMm: 1800, meshRollLengthMm: 10000, meshRollReusePolicy: "reuse-across-spans", topRailRows: 1, braceEveryIncidentStrainerEnd: true, gateBoundaryPostRole: "strainer", assumptionIds: ["cw-material"] },
    footings: [
      { postRole: "ordinary", diameterMm: 250, depthMm: 600, assumptionIds: ["cw-footing"] },
      { postRole: "end", diameterMm: 300, depthMm: 800, assumptionIds: ["cw-footing"] },
      { postRole: "corner", diameterMm: 300, depthMm: 800, assumptionIds: ["cw-footing"] },
      { postRole: "junction", diameterMm: 300, depthMm: 800, assumptionIds: ["cw-footing"] },
      { postRole: "strainer", diameterMm: 300, depthMm: 800, assumptionIds: ["cw-footing"] },
    ],
    allowances: [],
    gateHardwareModels: [{ id: "chain-double-2000", gateType: "double", widthMm: 2000, leafCount: 2, boundaryPostCount: 2, hingeSetCount: 2, latchCount: 1, dropBoltCount: 1, assumptionIds: ["cw-gate"] }],
    supportedSlopes: ["level"],
    supportedGround: ["soil"],
    supportedGateTypes: ["double"],
    supportedRetainingTypes: ["none"],
    supportsSleepers: false,
    assumptions: [
      unresolvedAssumption("cw-spacing", "post-spacing-mm", "maximum line-post and bay spacing", "3000", "mm", "the project design and selected system engineering schedule"),
      unresolvedAssumption("cw-material", "mesh-roll-and-bracing-policy", "1,800 mm mesh, 10,000 mm roll, one top rail and incident-strainer bracing policy", "1", "ratio", "the selected manufacturer and installer system schedule"),
      unresolvedAssumption("cw-footing", "role-footing-dimensions", "role-specific footing diameters and depths", "1", "ratio", "the site classification and engineer-approved footing schedule"),
      unresolvedAssumption("cw-gate", "double-gate-components", "2,000 mm chain-wire double-gate component schedule", "1", "ratio", "the selected gate supplier schedule"),
    ],
    components: [
      { id: "cw-post-line", itemCode: "CW-POST-LINE", description: "Chain-wire line post", unit: "ea", basis: "per-ordinary-post", factor: "1", assumptionIds: ["cw-spacing"] },
      { id: "cw-post-strainer", itemCode: "CW-POST-STRAINER", description: "Chain-wire strainer post", unit: "ea", basis: "per-strainer-post", factor: "1", assumptionIds: ["cw-spacing"] },
      { id: "cw-brace", itemCode: "CW-BRACE", description: "Chain-wire strainer brace assembly", unit: "ea", basis: "per-incident-strainer-end", factor: "1", assumptionIds: ["cw-material"] },
      { id: "cw-mesh-lm", itemCode: "CW-MESH-LM", description: "Chain-wire mesh length", unit: "lm", basis: "mesh-lm", factor: "1", assumptionIds: ["cw-material"] },
      { id: "cw-mesh-m2", itemCode: "CW-MESH-M2", description: "Chain-wire mesh area", unit: "m2", basis: "mesh-m2", factor: "1", assumptionIds: ["cw-material"] },
      { id: "cw-top-rail", itemCode: "CW-TOP-RAIL", description: "Chain-wire top rail", unit: "lm", basis: "rail-lm", factor: "1", assumptionIds: ["cw-material"] },
      { id: "cw-gate-opening", itemCode: "CW-GATE-OPENING", description: "Chain-wire double gate opening", unit: "ea", basis: "per-gate-opening", factor: "1", assumptionIds: ["cw-gate"] },
      { id: "cw-gate-leaf", itemCode: "CW-GATE-LEAF", description: "Chain-wire gate leaf", unit: "ea", basis: "per-gate-leaf", factor: "1", assumptionIds: ["cw-gate"] },
      { id: "cw-gate-hinge", itemCode: "CW-GATE-HINGE-SET", description: "Chain-wire gate hinge set", unit: "ea", basis: "per-hinge-set", factor: "1", assumptionIds: ["cw-gate"] },
      { id: "cw-gate-latch", itemCode: "CW-GATE-LATCH", description: "Chain-wire gate latch", unit: "ea", basis: "per-latch", factor: "1", assumptionIds: ["cw-gate"] },
      { id: "cw-gate-drop", itemCode: "CW-GATE-DROP-BOLT", description: "Chain-wire gate drop bolt", unit: "ea", basis: "per-drop-bolt", factor: "1", assumptionIds: ["cw-gate"] },
    ],
  };

  return [colorbond, timber, chainWire];
}

export function canonicalRecipeSetJson(recipeSet: BomRecipeSet): string {
  const { digest: _excludedDigest, ...digestInput } = recipeSet;
  return JSON.stringify(sortJson(digestInput));
}

export async function computeRecipeSetDigest(recipeSet: BomRecipeSet): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalRecipeSetJson(recipeSet));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifyRecipeSetDigest(recipeSet: BomRecipeSet): Promise<boolean> {
  return (await computeRecipeSetDigest(recipeSet)) === recipeSet.digest;
}

export async function createCandidateFencingRecipeSet(): Promise<BomRecipeSet> {
  const draft = bomRecipeSetSchema.parse({
    id: FENCING_RECIPE_SET_ID,
    revision: 1,
    digest: EMPTY_DIGEST,
    recipes: candidateRecipes(),
  });
  return bomRecipeSetSchema.parse({ ...draft, digest: await computeRecipeSetDigest(draft) });
}

export async function selectFencingRecipe(recipeSet: BomRecipeSet, selection: RecipeSelection): Promise<RecipeSelectionResult> {
  const parsed = bomRecipeSetSchema.safeParse(recipeSet);
  if (!parsed.success || parsed.data.id !== FENCING_RECIPE_SET_ID || !(await verifyRecipeSetDigest(parsed.data))) {
    return { ok: false, issue: { code: "invalid-recipe-set", message: "The candidate recipe set failed schema, identity, or digest verification." } };
  }
  if (selection.system === null || selection.profile === null || selection.profile === "") {
    return { ok: false, issue: { code: "unselected", message: "Select an exact supported fencing system and profile before preparing a BOM." } };
  }
  if (selection.system === "pool" || selection.system === "custom") {
    return { ok: false, issue: { code: "unsupported-system", message: `${selection.system} has no reviewed candidate recipe and is blocked.` } };
  }
  const expectedRecipeId = SUPPORTED_RECIPE_IDS.get(`${selection.system}\u0000${selection.profile}`);
  if (!expectedRecipeId) {
    return { ok: false, issue: { code: "unsupported-profile", message: `No reviewed candidate recipe exactly matches ${selection.system}/${selection.profile}.` } };
  }
  const recipe = parsed.data.recipes.find((entry) => entry.id === expectedRecipeId && entry.system === selection.system && entry.profile === selection.profile);
  if (!recipe) {
    return { ok: false, issue: { code: "unsupported-profile", message: `No reviewed candidate recipe exactly matches ${selection.system}/${selection.profile}.` } };
  }
  return { ok: true, recipe };
}

export async function acceptRecipeAssumption(
  recipeSet: BomRecipeSet,
  input: RecipeAssumptionTransitionInput,
): Promise<RecipeAssumptionTransition> {
  return transitionAssumption(recipeSet, input, "accept");
}

export async function reopenRecipeAssumption(
  recipeSet: BomRecipeSet,
  input: RecipeAssumptionTransitionInput,
): Promise<RecipeAssumptionTransition> {
  return transitionAssumption(recipeSet, input, "reopen");
}

async function transitionAssumption(
  recipeSet: BomRecipeSet,
  input: RecipeAssumptionTransitionInput,
  action: RecipeAssumptionAction,
): Promise<RecipeAssumptionTransition> {
  const parsed = bomRecipeSetSchema.parse(recipeSet);
  if (parsed.id !== FENCING_RECIPE_SET_ID || !(await verifyRecipeSetDigest(parsed))) {
    throw new RecipeSetIntegrityError("The candidate recipe set failed identity or digest verification.");
  }
  if (parsed.revision !== input.expectedSetRevision) {
    throw new RecipeRevisionConflictError(`Recipe set revision ${parsed.revision} does not match expected revision ${input.expectedSetRevision}.`);
  }
  const recipeIndex = parsed.recipes.findIndex((entry) => entry.id === input.recipeId);
  if (recipeIndex < 0) throw new RecipeAssumptionTransitionError(`Unknown recipe ${input.recipeId}.`);
  const recipe = parsed.recipes[recipeIndex];
  if (recipe.revision !== input.expectedRecipeRevision) {
    throw new RecipeRevisionConflictError(`Recipe ${recipe.id} revision ${recipe.revision} does not match expected revision ${input.expectedRecipeRevision}.`);
  }
  const assumptionIndex = recipe.assumptions.findIndex((entry) => entry.id === input.assumptionId);
  if (assumptionIndex < 0) throw new RecipeAssumptionTransitionError(`Unknown assumption ${input.assumptionId} in recipe ${recipe.id}.`);
  const actor = input.actor.trim();
  if (!actor) throw new RecipeAssumptionTransitionError("An assumption decision requires a non-empty actor.");
  if (!Number.isFinite(Date.parse(input.at)) || !/(?:Z|[+-]\d\d:\d\d)$/.test(input.at)) {
    throw new RecipeAssumptionTransitionError("An assumption decision requires an ISO timestamp with an explicit offset.");
  }
  const previous = recipe.assumptions[assumptionIndex];
  const desiredStatus = action === "accept" ? "accepted" : "unresolved";
  if (previous.status === desiredStatus) {
    throw new RecipeAssumptionTransitionError(`Assumption ${previous.id} is already ${desiredStatus}.`);
  }

  const recipes = parsed.recipes.map((entry, index) => {
    if (index !== recipeIndex) return entry;
    const assumptions = entry.assumptions.map((assumption, innerIndex) => {
      if (innerIndex !== assumptionIndex) return assumption;
      return action === "accept"
        ? { ...assumption, status: "accepted" as const, acceptedBy: actor, acceptedAt: input.at }
        : { ...assumption, status: "unresolved" as const, acceptedBy: null, acceptedAt: null };
    });
    return { ...entry, revision: entry.revision + 1, assumptions };
  });
  const nextWithoutDigest = bomRecipeSetSchema.parse({
    ...parsed,
    revision: parsed.revision + 1,
    digest: EMPTY_DIGEST,
    recipes,
  });
  const next = bomRecipeSetSchema.parse({
    ...nextWithoutDigest,
    digest: await computeRecipeSetDigest(nextWithoutDigest),
  });
  return {
    recipeSet: next,
    event: {
      action,
      recipeId: recipe.id,
      assumptionId: previous.id,
      actor,
      at: input.at,
      fromStatus: previous.status,
      toStatus: desiredStatus,
      previousSetRevision: parsed.revision,
      setRevision: next.revision,
      previousRecipeRevision: recipe.revision,
      recipeRevision: next.recipes[recipeIndex].revision,
    },
  };
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortJson(child)]),
  );
}
