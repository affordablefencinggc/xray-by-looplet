import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bomRecipeSetSchema } from "./bomContract.ts";
import {
  RecipeAssumptionTransitionError,
  RecipeRevisionConflictError,
  RecipeSetIntegrityError,
  acceptRecipeAssumption,
  canonicalRecipeSetJson,
  computeRecipeSetDigest,
  createCandidateFencingRecipeSet,
  reopenRecipeAssumption,
  selectFencingRecipe,
  verifyRecipeSetDigest,
} from "./fencingRecipes.ts";

const DECISION_AT = "2026-09-04T10:15:30.000+10:00";

describe("SC-07H fencing recipe preparation", () => {
  it("creates a deterministic contract-valid candidate set and real digest", async () => {
    const first = await createCandidateFencingRecipeSet();
    const second = await createCandidateFencingRecipeSet();
    assert.deepEqual(first, second);
    assert.equal(bomRecipeSetSchema.safeParse(first).success, true);
    assert.match(first.digest, /^[a-f0-9]{64}$/);
    assert.notEqual(first.digest, "0".repeat(64));
    assert.equal(await verifyRecipeSetDigest(first), true);
    assert.equal(await computeRecipeSetDigest({ ...first, digest: "f".repeat(64) }), first.digest);
    assert.equal(canonicalRecipeSetJson(first), canonicalRecipeSetJson({ ...first, digest: "f".repeat(64) }));
  });

  it("starts every candidate real-world assumption unresolved and unattributed", async () => {
    const set = await createCandidateFencingRecipeSet();
    assert.deepEqual(set.recipes.map((recipe) => [recipe.system, recipe.profile]), [
      ["colorbond", "Good Neighbour"],
      ["timber-paling", "Standard paling"],
      ["chain-wire", "50 mm galvanised"],
    ]);
    for (const assumption of set.recipes.flatMap((recipe) => recipe.assumptions)) {
      assert.equal(assumption.status, "unresolved");
      assert.equal(assumption.acceptedBy, null);
      assert.equal(assumption.acceptedAt, null);
      assert.match(assumption.label, /^Needs human confirmation — /);
      assert.match(assumption.source, /not site, engineering, supplier, or manufacturer approval/);
    }
  });

  it("selects only an exact supported system/profile and fails closed otherwise", async () => {
    const set = await createCandidateFencingRecipeSet();
    assert.equal((await selectFencingRecipe(set, { system: "colorbond", profile: "Good Neighbour" })).ok, true);
    assert.deepEqual(await selectFencingRecipe(set, { system: null, profile: null }), {
      ok: false,
      issue: { code: "unselected", message: "Select an exact supported fencing system and profile before preparing a BOM." },
    });
    assert.equal((await selectFencingRecipe(set, { system: "pool", profile: "Anything" })).ok, false);
    assert.equal((await selectFencingRecipe(set, { system: "custom", profile: "Anything" })).ok, false);
    assert.equal((await selectFencingRecipe(set, { system: "colorbond", profile: "good neighbour" })).ok, false);
    assert.equal((await selectFencingRecipe(set, { system: "colorbond", profile: "Good Neighbour " })).ok, false);
    const injected = {
      ...set,
      recipes: [{ ...set.recipes[0], id: "injected", profile: "Unreviewed profile" }, ...set.recipes.slice(1)],
    };
    injected.digest = await computeRecipeSetDigest(injected);
    assert.equal((await selectFencingRecipe(injected, { system: "colorbond", profile: "Unreviewed profile" })).ok, false);
  });

  it("accepts and reopens one assumption immutably with actor/time audit events", async () => {
    const original = await createCandidateFencingRecipeSet();
    const accepted = await acceptRecipeAssumption(original, {
      recipeId: "recipe-colorbond-good-neighbour",
      assumptionId: "cb-material",
      expectedSetRevision: 1,
      expectedRecipeRevision: 1,
      actor: "  Estimator  ",
      at: DECISION_AT,
    });
    assert.equal(original.revision, 1);
    assert.equal(original.recipes[0].revision, 1);
    assert.equal(original.recipes[0].assumptions.find((entry) => entry.id === "cb-material")?.status, "unresolved");
    assert.equal(accepted.recipeSet.revision, 2);
    assert.equal(accepted.recipeSet.recipes[0].revision, 2);
    assert.equal(accepted.recipeSet.recipes[1].revision, 1);
    assert.deepEqual(accepted.recipeSet.recipes[0].assumptions.find((entry) => entry.id === "cb-material"), {
      ...original.recipes[0].assumptions.find((entry) => entry.id === "cb-material"),
      status: "accepted",
      acceptedBy: "Estimator",
      acceptedAt: DECISION_AT,
    });
    assert.deepEqual(accepted.event, {
      action: "accept",
      recipeId: "recipe-colorbond-good-neighbour",
      assumptionId: "cb-material",
      actor: "Estimator",
      at: DECISION_AT,
      fromStatus: "unresolved",
      toStatus: "accepted",
      previousSetRevision: 1,
      setRevision: 2,
      previousRecipeRevision: 1,
      recipeRevision: 2,
    });
    assert.equal(await verifyRecipeSetDigest(accepted.recipeSet), true);
    assert.equal(bomRecipeSetSchema.safeParse(accepted.recipeSet).success, true);

    const reopened = await reopenRecipeAssumption(accepted.recipeSet, {
      recipeId: "recipe-colorbond-good-neighbour",
      assumptionId: "cb-material",
      expectedSetRevision: 2,
      expectedRecipeRevision: 2,
      actor: "Reviewer",
      at: "2026-09-04T11:00:00.000+10:00",
    });
    const value = reopened.recipeSet.recipes[0].assumptions.find((entry) => entry.id === "cb-material");
    assert.equal(value?.status, "unresolved");
    assert.equal(value?.acceptedBy, null);
    assert.equal(value?.acceptedAt, null);
    assert.equal(reopened.event.actor, "Reviewer");
    assert.equal(reopened.event.at, "2026-09-04T11:00:00.000+10:00");
    assert.equal(reopened.recipeSet.revision, 3);
    assert.equal(await verifyRecipeSetDigest(reopened.recipeSet), true);
  });

  it("rejects stale revisions and invalid or redundant transitions", async () => {
    const set = await createCandidateFencingRecipeSet();
    const input = {
      recipeId: "recipe-colorbond-good-neighbour",
      assumptionId: "cb-material",
      expectedSetRevision: 0,
      expectedRecipeRevision: 1,
      actor: "Estimator",
      at: DECISION_AT,
    };
    await assert.rejects(() => acceptRecipeAssumption(set, input), RecipeRevisionConflictError);
    await assert.rejects(() => acceptRecipeAssumption(set, { ...input, expectedSetRevision: 1, expectedRecipeRevision: 99 }), RecipeRevisionConflictError);
    await assert.rejects(() => reopenRecipeAssumption(set, { ...input, expectedSetRevision: 1 }), RecipeAssumptionTransitionError);
    await assert.rejects(() => acceptRecipeAssumption(set, { ...input, expectedSetRevision: 1, actor: " " }), RecipeAssumptionTransitionError);
    await assert.rejects(() => acceptRecipeAssumption(set, { ...input, expectedSetRevision: 1, at: "2026-09-04" }), RecipeAssumptionTransitionError);

    const tampered = structuredClone(set);
    tampered.recipes[0].maxBayWidthMm = 9999;
    await assert.rejects(
      () => acceptRecipeAssumption(tampered, { ...input, expectedSetRevision: 1 }),
      RecipeSetIntegrityError,
    );
  });
});
