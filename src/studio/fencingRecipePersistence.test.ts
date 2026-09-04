import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createCandidateFencingRecipeSet } from "./fencingRecipes.ts";
import { fencingRecipeStorageKey, loadFencingRecipeSet, saveFencingRecipeSet } from "./fencingRecipePersistence.ts";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}

describe("job-scoped fencing recipe persistence", () => {
  it("round-trips exact validated recipe decisions only for the owning job", async () => {
    const storage = memoryStorage();
    const recipeSet = await createCandidateFencingRecipeSet();
    assert.deepEqual(await saveFencingRecipeSet("job-1", recipeSet, storage), { ok: true });
    assert.deepEqual(await loadFencingRecipeSet("job-1", storage), { ok: true, recipeSet });
    assert.deepEqual(await loadFencingRecipeSet("job-2", storage), { ok: false, reason: "not-found" });
  });

  it("rejects corrupt, cross-job and digest-tampered bytes", async () => {
    const storage = memoryStorage();
    const recipeSet = await createCandidateFencingRecipeSet();
    storage.values.set(fencingRecipeStorageKey("job-1"), "{");
    assert.deepEqual(await loadFencingRecipeSet("job-1", storage), { ok: false, reason: "invalid" });
    storage.values.set(fencingRecipeStorageKey("job-1"), JSON.stringify({ schema: "xray.fencing-recipe-state/v1", jobId: "job-2", recipeSet }));
    assert.deepEqual(await loadFencingRecipeSet("job-1", storage), { ok: false, reason: "job-mismatch" });
    storage.values.set(fencingRecipeStorageKey("job-1"), JSON.stringify({ schema: "xray.fencing-recipe-state/v1", jobId: "job-1", recipeSet: { ...recipeSet, revision: recipeSet.revision + 1 } }));
    assert.deepEqual(await loadFencingRecipeSet("job-1", storage), { ok: false, reason: "digest-mismatch" });
  });

  it("fails closed when storage cannot retain exact bytes", async () => {
    const recipeSet = await createCandidateFencingRecipeSet();
    const storage = { getItem: () => null, setItem: () => undefined };
    assert.deepEqual(await saveFencingRecipeSet("job-1", recipeSet, storage), { ok: false, reason: "write-failed" });
  });
});
