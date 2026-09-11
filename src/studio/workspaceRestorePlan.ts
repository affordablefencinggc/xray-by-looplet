import { fencingJobSchema } from "./domain.ts";
import { FENCING_JOB_STORAGE_KEY } from "./persistence.ts";
import { architectKey } from "./architect/persistence.ts";
import { bomStorageKey } from "./bomPersistence.ts";
import { inventoryStorageKey } from "./construction/inventoryPersistence.ts";
import { fencingRecipeStorageKey } from "./fencingRecipePersistence.ts";
import { takeoffKey } from "./construction/altitudeTakeoff.ts";
import { trialKey } from "./construction/connectionTrial.ts";
import { priceBookKey } from "./pricing/priceBooks.ts";
import { sheetLifecycleStorageKey, sheetSourceIdentity, validateJobSheetMetadata } from "./sheetLifecycle.ts";
import { PROJECT_REGISTRY_KEY, readRegistryStrict, serializeRegistry, shelfKey, upsertEntry } from "./projectRegistry.ts";
import { BACKUP_FORMAT, type ProjectBackup } from "./projectBackup.ts";
import type { RestoreMutation, RestoreOperation } from "./workspaceRestore.ts";

/** One explicit address list serves preparation and replay validation. No arbitrary storage keys. */
export async function planRestoreMutations(backup: ProjectBackup, includeRates: boolean,
  read: (storage: RestoreMutation["storage"], key: string) => Promise<string | null>): Promise<RestoreMutation[]> {
  if (backup.format !== BACKUP_FORMAT) throw Error("This older package can be inspected, but restoration requires a v2 package.");
  const currentRaw = await read("local", FENCING_JOB_STORAGE_KEY);
  if (!currentRaw) throw Error("Save the current workspace before restoring a backup.");
  const current = fencingJobSchema.parse(JSON.parse(currentRaw)), target = backup.job;
  const mutations: RestoreMutation[] = [];
  const add = async (storage: RestoreMutation["storage"], key: string, label: string, after: string | null) => {
    mutations.push({ storage, key, label, before: await read(storage, key), after });
  };
  const modules = [
    [architectKey(target.id), "Architectural design", backup.records.architecture],
    [bomStorageKey(target.id), "BOM", backup.records.bom],
    [inventoryStorageKey(target.id), "Component inventory", backup.records.components],
    [fencingRecipeStorageKey(target.id), "Recipes", backup.records.recipes],
    [takeoffKey(target.id), "Source takeoff", backup.records.sourceTakeoff],
    [trialKey(target.id), "Connection review", backup.records.connectionReview],
    [priceBookKey(target.id), "Supplier price books", backup.records.priceBooks ?? null],
  ] as const;
  for (const [key, label, after] of modules) await add("local", key, label, after);
  await add("materials", target.id, "Project materials", backup.records.materials);
  const sheets = new Map(validateJobSheetMetadata(backup.records.sheetMetadata ?? null, target).map(v => [sheetLifecycleStorageKey(v.identity), JSON.stringify(v)]));
  const sheetKeys = new Set(sheets.keys());
  for (const owner of current.id === target.id ? [current, target] : [target]) for (const doc of owner.documents) {
    const identity = sheetSourceIdentity(owner.id, doc); if (identity) sheetKeys.add(sheetLifecycleStorageKey(identity));
  }
  for (const key of [...sheetKeys].sort()) await add("local", key, "Sheet organisation", sheets.get(key) ?? null);
  if (includeRates) await add("local", "xray.price-sheet.v1", "Shared reference rates", backup.records.referenceRates);
  const registryRaw = await read("local", PROJECT_REGISTRY_KEY);
  let registry = readRegistryStrict({ getItem: () => registryRaw, setItem() {}, removeItem() {} });
  registry = upsertEntry(upsertEntry(registry, current), target);
  registry = { ...registry, entries: registry.entries.map(v => v.id === target.id ? { ...v, archived: false } : v) };
  if (current.id !== target.id) await add("local", shelfKey(current.id), "Previous project shelf", currentRaw);
  await add("local", shelfKey(target.id), "Restored project shelf", null);
  await add("local", PROJECT_REGISTRY_KEY, "Project library", serializeRegistry(registry));
  await add("local", FENCING_JOB_STORAGE_KEY, "Active editing project", JSON.stringify(target));
  return mutations;
}

export async function validateRestorePlan(operation: RestoreOperation, backup: ProjectBackup) {
  if (!operation.plan) {
    if (operation.phase !== "requested") throw Error("Recovery journal is missing its write plan.");
    return;
  }
  if (operation.phase === "requested") throw Error("Unprepared request contains a write plan.");
  const before = new Map<string, string | null>();
  for (const item of operation.plan.mutations) {
    const id = `${item.storage}:${item.key}`;
    if (before.has(id)) throw Error("Recovery journal contains duplicate storage addresses.");
    before.set(id, item.before);
  }
  const expected = await planRestoreMutations(backup, operation.restoreReferenceRates, async (storage, key) => {
    const id = `${storage}:${key}`;
    if (!before.has(id)) throw Error("Recovery journal is incomplete.");
    return before.get(id)!;
  });
  if (JSON.stringify(expected) !== JSON.stringify(operation.plan.mutations) || operation.plan.targetId !== backup.job.id || operation.plan.targetName !== backup.job.name)
    throw Error("Recovery journal does not match its verified package and allowed storage addresses.");
}
