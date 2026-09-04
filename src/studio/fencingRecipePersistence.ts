import { z } from "zod";
import { bomRecipeSetSchema, type BomRecipeSet } from "./bomContract.ts";
import { verifyRecipeSetDigest } from "./fencingRecipes.ts";

export const FENCING_RECIPE_STATE_SCHEMA = "xray.fencing-recipe-state/v1" as const;
const STORAGE_PREFIX = "xray:fencing-recipe-state:v1:";

const recipeStateSchema = z.object({
  schema: z.literal(FENCING_RECIPE_STATE_SCHEMA),
  jobId: z.string().min(1),
  recipeSet: bomRecipeSetSchema,
}).strict();

export interface RecipeStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function fencingRecipeStorageKey(jobId: string): string {
  const value = z.string().min(1).parse(jobId);
  return `${STORAGE_PREFIX}${encodeURIComponent(value)}`;
}

export async function loadFencingRecipeSet(
  jobId: string,
  storageInput?: RecipeStorageLike | null,
): Promise<{ ok: true; recipeSet: BomRecipeSet } | { ok: false; reason: "unavailable" | "not-found" | "invalid" | "job-mismatch" | "digest-mismatch" }> {
  const storage = resolveStorage(storageInput);
  if (!storage) return { ok: false, reason: "unavailable" };
  let raw: string | null;
  try {
    raw = storage.getItem(fencingRecipeStorageKey(jobId));
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  if (raw === null) return { ok: false, reason: "not-found" };
  let parsed: z.infer<typeof recipeStateSchema>;
  try {
    parsed = recipeStateSchema.parse(JSON.parse(raw));
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (parsed.jobId !== jobId) return { ok: false, reason: "job-mismatch" };
  if (!(await verifyRecipeSetDigest(parsed.recipeSet))) return { ok: false, reason: "digest-mismatch" };
  return { ok: true, recipeSet: parsed.recipeSet };
}

export async function saveFencingRecipeSet(
  jobId: string,
  recipeSet: BomRecipeSet,
  storageInput?: RecipeStorageLike | null,
): Promise<{ ok: true } | { ok: false; reason: "unavailable" | "invalid" | "digest-mismatch" | "write-failed" }> {
  const storage = resolveStorage(storageInput);
  if (!storage) return { ok: false, reason: "unavailable" };
  const parsed = bomRecipeSetSchema.safeParse(recipeSet);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  if (!(await verifyRecipeSetDigest(parsed.data))) return { ok: false, reason: "digest-mismatch" };
  const key = fencingRecipeStorageKey(jobId);
  const bytes = JSON.stringify({ schema: FENCING_RECIPE_STATE_SCHEMA, jobId, recipeSet: parsed.data });
  try {
    storage.setItem(key, bytes);
    if (storage.getItem(key) !== bytes) return { ok: false, reason: "write-failed" };
    return { ok: true };
  } catch {
    return { ok: false, reason: "write-failed" };
  }
}

function resolveStorage(storage: RecipeStorageLike | null | undefined): RecipeStorageLike | null {
  if (storage !== undefined) return storage;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
