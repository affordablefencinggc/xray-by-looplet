import { parseFencingJob } from "./domain.ts";
import { FENCING_JOB_STORAGE_KEY } from "./persistence.ts";
import { PROJECT_REGISTRY_KEY, readRegistryStrict, serializeRegistry, shelfKey, type StorageLike, type ProjectRegistry } from "./projectRegistry.ts";

export const PROJECT_LIFECYCLE_LOCK = "xray:project-lifecycle:v1";
export const PROJECT_LIBRARY_CHANGED = "xray:project-library-changed";

/** The same origin lock protects archive and project switching in cooperating windows. */
export async function withProjectLifecycle<T>(action: () => Promise<T>): Promise<T> {
  if (typeof window === "undefined") return action();
  if (!navigator.locks) throw Error("Project management needs browser storage locking. Use a supported browser.");
  return navigator.locks.request(PROJECT_LIFECYCLE_LOCK, { mode: "exclusive", ifAvailable: true }, lock => {
    if (!lock) throw Error("Another window is changing projects. Try again when it finishes.");
    return action();
  });
}

/** One metadata write; no original, shelf, module or conversation is removed or rewritten. */
export function setProjectArchived(storage: StorageLike, id: string, archived: boolean, expectedRegistryRaw: string | null): ProjectRegistry {
  const raw = storage.getItem(PROJECT_REGISTRY_KEY);
  if (raw !== expectedRegistryRaw) throw Error("The project library changed. Refresh it before trying again.");
  const registry = readRegistryStrict(storage);
  const entry = registry.entries.find(item => item.id === id);
  if (!entry) throw Error("This project is no longer listed. Refresh the library.");
  const main = storage.getItem(FENCING_JOB_STORAGE_KEY);
  if (!main) throw Error("The active project is not saved. Save it before managing projects.");
  const current = parseFencingJob(JSON.parse(main));
  if (current.id === id) throw Error("Open another project before archiving this one.");
  const shelf = storage.getItem(shelfKey(id));
  if (!shelf || parseFencingJob(JSON.parse(shelf)).id !== id)
    throw Error("This project's saved record is missing or unreadable. Nothing was changed.");
  const next = { ...registry, entries: registry.entries.map(item => item.id === id ? { ...item, archived } : item) };
  const text = serializeRegistry(next);
  if (storage.getItem(PROJECT_REGISTRY_KEY) !== raw || storage.getItem(FENCING_JOB_STORAGE_KEY) !== main || storage.getItem(shelfKey(id)) !== shelf)
    throw Error("Saved projects changed during review. Refresh the library.");
  storage.setItem(PROJECT_REGISTRY_KEY, text);
  if (storage.getItem(PROJECT_REGISTRY_KEY) !== text)
    throw Error("The archive change was not confirmed saved. Refresh the library to check its state.");
  return next;
}
