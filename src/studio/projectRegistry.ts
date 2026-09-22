import type { FencingJob } from "./domain.ts";

/**
 * Multi-project index for the workspace.
 *
 * The workspace still holds exactly ONE live project in `xray:fencing-job:v2` (persistence.ts:
 * compare-and-swap writes, stale-window notice). Every other project is "shelved": the exact bytes
 * that were in the main key are parked under `xray:project-shelf:v1:<id>` and listed in the registry.
 * A project switch is planned here as a pure list of storage writes/removes; the caller applies
 * them, writes the main key through `saveFencingJob(..., { expectedRaw })` and re-hydrates the store.
 * Nothing here touches `window` or `localStorage`: storage is always injected.
 */
export const PROJECT_REGISTRY_KEY = "xray:projects:v1";
export const PROJECT_SHELF_PREFIX = "xray:project-shelf:v1:";
export const ASSISTANT_PROJECT_TABS_KEY = "xray:assistant-project-tabs:v1";
export const PROJECT_REGISTRY_SCHEMA = "xray.projects/v1";
export const MAX_PROJECT_TABS = 12;

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type ProjectSummary = { id: string; name: string; updatedAt: string; revision: number; archived?: boolean };
export type ProjectRegistry = { schema: typeof PROJECT_REGISTRY_SCHEMA; entries: ProjectSummary[] };
export type JobSummarySource = Pick<FencingJob, "id" | "name" | "revision" | "updatedAt">;

export function emptyRegistry(): ProjectRegistry {
  return { schema: PROJECT_REGISTRY_SCHEMA, entries: [] };
}

function isSummary(value: unknown): value is ProjectSummary {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    v.id.length > 0 &&
    typeof v.name === "string" &&
    v.name.length > 0 &&
    typeof v.updatedAt === "string" &&
    Number.isFinite(Date.parse(v.updatedAt)) &&
    typeof v.revision === "number" &&
    Number.isInteger(v.revision) &&
    v.revision > 0 && (v.archived === undefined || typeof v.archived === "boolean")
  );
}

/** The four registry fields of a job; throws when any is missing so a half-built record is never indexed. */
export function summarize(job: JobSummarySource): ProjectSummary {
  const summary = { id: job.id, name: job.name, updatedAt: job.updatedAt, revision: job.revision };
  if (!isSummary(summary))
    throw new Error("Project summary is incomplete: id, name, revision and updatedAt are required.");
  return summary;
}

export type QuarantinedLibraryRecord = { id: string | null; reason: string };

/** One damaged record is quarantined. Every sibling that still parses is returned. */
export function readLibraryRecords(texts: readonly string[]): { records: ProjectSummary[]; quarantined: QuarantinedLibraryRecord[] } {
  const records: ProjectSummary[] = [];
  const quarantined: QuarantinedLibraryRecord[] = [];
  for (const text of texts) {
    try {
      records.push(readJobSummary(text));
    } catch (error) {
      let id: string | null = null;
      try {
        const parsed: unknown = JSON.parse(text);
        if (parsed && typeof parsed === "object" && typeof (parsed as { id?: unknown }).id === "string")
          id = (parsed as { id: string }).id;
      } catch { /* The bytes are not JSON, so there is no id to report. */ }
      quarantined.push({ id, reason: error instanceof Error ? error.message : "The project record could not be read." });
    }
  }
  return { records, quarantined };
}

/** The summary of a stored project record (main key or shelf bytes). Throws on unreadable text. */
export function readJobSummary(text: string): ProjectSummary {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("The project record is not valid JSON.");
  }
  if (typeof value !== "object" || value === null) throw new Error("The project record is not an object.");
  return summarize(value as JobSummarySource);
}

/** Strict: a malformed document or schema yields an empty registry; malformed or duplicate entries are dropped. */
export function parseRegistry(text: string | null | undefined): ProjectRegistry {
  if (typeof text !== "string" || !text) return emptyRegistry();
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return emptyRegistry();
  }
  if (typeof value !== "object" || value === null) return emptyRegistry();
  const { schema, entries } = value as { schema?: unknown; entries?: unknown };
  if (schema !== PROJECT_REGISTRY_SCHEMA || !Array.isArray(entries)) return emptyRegistry();
  const seen = new Set<string>();
  const kept: ProjectSummary[] = [];
  for (const entry of entries) {
    if (!isSummary(entry) || seen.has(entry.id)) continue;
    seen.add(entry.id);
    kept.push({ id: entry.id, name: entry.name, updatedAt: entry.updatedAt, revision: entry.revision, ...(entry.archived === undefined ? {} : { archived: entry.archived }) });
  }
  return { schema: PROJECT_REGISTRY_SCHEMA, entries: kept };
}

export function serializeRegistry(registry: ProjectRegistry): string {
  return JSON.stringify({ schema: PROJECT_REGISTRY_SCHEMA, entries: registry.entries });
}

export function readRegistry(storage: StorageLike): ProjectRegistry {
  try {
    return parseRegistry(storage.getItem(PROJECT_REGISTRY_KEY));
  } catch {
    return emptyRegistry();
  }
}

/** Mutations must not silently drop unreadable entries as the display parser does. */
export function readRegistryStrict(storage: StorageLike): ProjectRegistry {
  const raw = storage.getItem(PROJECT_REGISTRY_KEY);
  if (raw === null) return emptyRegistry();
  const registry = parseRegistry(raw);
  try {
    if (JSON.stringify(JSON.parse(raw)) === serializeRegistry(registry)) return registry;
  } catch { /* Preserve original bytes and report below. */ }
  throw Error("The project library is unreadable. Saved data has been preserved.");
}

/** Writes the registry and returns the exact text stored. Storage errors propagate to the caller. */
export function writeRegistry(storage: StorageLike, registry: ProjectRegistry): string {
  const text = serializeRegistry(registry);
  storage.setItem(PROJECT_REGISTRY_KEY, text);
  return text;
}

export function findEntry(registry: ProjectRegistry, id: string): ProjectSummary | null {
  return registry.entries.find((entry) => entry.id === id) ?? null;
}

/** Replaces the entry in place or appends it; returns the same registry object when nothing changes. */
export function upsertEntry(registry: ProjectRegistry, job: JobSummarySource): ProjectRegistry {
  const summary = summarize(job);
  const index = registry.entries.findIndex((entry) => entry.id === summary.id);
  if (index < 0) return { schema: PROJECT_REGISTRY_SCHEMA, entries: [...registry.entries, summary] };
  const existing = registry.entries[index];
  if (
    existing.name === summary.name &&
    existing.updatedAt === summary.updatedAt &&
    existing.revision === summary.revision
  )
    return registry;
  const entries = registry.entries.slice();
  entries[index] = { ...summary, ...(existing.archived === undefined ? {} : { archived: existing.archived }) };
  return { schema: PROJECT_REGISTRY_SCHEMA, entries };
}

export function removeEntry(registry: ProjectRegistry, id: string): ProjectRegistry {
  if (!registry.entries.some((entry) => entry.id === id)) return registry;
  return { schema: PROJECT_REGISTRY_SCHEMA, entries: registry.entries.filter((entry) => entry.id !== id) };
}

const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Most recently updated first; ties fall back to name then id so the list order is deterministic. */
export function entriesNewestFirst(registry: ProjectRegistry): ProjectSummary[] {
  return registry.entries.slice().sort((a, b) => {
    const byTime = Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
    if (byTime) return byTime;
    return compareText(a.name, b.name) || compareText(a.id, b.id);
  });
}

// ---------------------------------------------------------------------------------------------
// Shelf: the exact main-key bytes of every project that is not currently open.

export function shelfKey(id: string): string {
  if (typeof id !== "string" || !id) throw new Error("A project id is required to address the shelf.");
  return PROJECT_SHELF_PREFIX + id;
}

export function shelveJobText(storage: StorageLike, id: string, rawText: string): void {
  if (typeof rawText !== "string" || !rawText) throw new Error("Refusing to shelve an empty project record.");
  storage.setItem(shelfKey(id), rawText);
}

/** Non-destructive read; null when the shelf is empty or storage cannot be read. */
export function peekShelvedJobText(storage: StorageLike, id: string): string | null {
  try {
    return storage.getItem(shelfKey(id));
  } catch {
    return null;
  }
}

export function hasShelvedJob(storage: StorageLike, id: string): boolean {
  return peekShelvedJobText(storage, id) !== null;
}

/** Returns the shelved bytes and clears the shelf slot. Storage errors propagate: this is destructive. */
export function takeShelvedJobText(storage: StorageLike, id: string): string | null {
  const key = shelfKey(id);
  const text = storage.getItem(key);
  if (text !== null) storage.removeItem(key);
  return text;
}

// ---------------------------------------------------------------------------------------------
// Switch planner: pure. The caller applies `writes`, then saves `nextMainText` through the
// compare-and-swap main-key path, then applies `removes` and re-hydrates the store.

export type StorageWrite = { key: string; value: string };
export type ProjectSwitchRequest = {
  /** The project open in the store (identity cross-check against `currentRaw`). */
  currentJob: JobSummarySource;
  /** The exact main-key bytes the store last loaded or wrote (`lastSavedJobRaw`); becomes the shelf copy. */
  currentRaw: string;
  /** Registry id to open, or null to create a fresh project. */
  targetId: string | null;
  registry: ProjectRegistry;
  /** `peekShelvedJobText(storage, targetId)`, read by the caller so the planner stays storage-free. */
  shelvedTargetText: string | null;
  /** Serialized fresh job for `targetId === null` (e.g. `JSON.stringify(createDefaultJob())`). */
  createJobText: () => string;
};
export type ProjectSwitchPlan = {
  kind: "switch" | "new";
  targetId: string;
  target: ProjectSummary;
  current: ProjectSummary;
  /** Apply BEFORE the main-key save: shelve the open project and index both projects. */
  writes: StorageWrite[];
  /** Apply AFTER the main-key save succeeds: the target shelf slot is then redundant. */
  removes: string[];
  /** The bytes to parse and save into the main key with `expectedRaw: currentRaw`. */
  nextMainText: string;
  registry: ProjectRegistry;
  /** Undo `writes` when the main-key save is refused (stale) or fails. */
  rollback: { writes: StorageWrite[]; removes: string[] };
};

export function planProjectSwitch(request: ProjectSwitchRequest): ProjectSwitchPlan {
  const open = summarize(request.currentJob);
  if (typeof request.currentRaw !== "string" || !request.currentRaw)
    throw new Error("The open project has no saved record to shelve. Save it first, then switch.");
  // The shelf must hold the open project, never another window's record or a half-migrated one.
  const current = readJobSummary(request.currentRaw);
  if (current.id !== open.id)
    throw new Error(
      `The saved record belongs to project ${current.id}, not the open project ${open.id}. Reload before switching.`,
    );

  let kind: ProjectSwitchPlan["kind"];
  let target: ProjectSummary;
  let nextMainText: string;
  let removes: string[];
  if (request.targetId === null) {
    nextMainText = request.createJobText();
    target = readJobSummary(nextMainText);
    if (target.id === current.id) throw new Error("A new project must have a fresh id.");
    if (findEntry(request.registry, target.id))
      throw new Error(`A project with id ${target.id} is already listed; refusing to overwrite it.`);
    kind = "new";
    removes = [];
  } else {
    if (findEntry(request.registry, request.targetId)?.archived) throw new Error("Restore this project from Archived before opening it.");
    if (request.targetId === current.id) throw new Error("This project is already open.");
    if (typeof request.shelvedTargetText !== "string" || !request.shelvedTargetText)
      throw new Error(`Project ${request.targetId} has no shelved record to open.`);
    target = readJobSummary(request.shelvedTargetText);
    if (target.id !== request.targetId)
      throw new Error(
        `The shelved record for ${request.targetId} belongs to project ${target.id}; refusing to open it.`,
      );
    kind = "switch";
    nextMainText = request.shelvedTargetText;
    removes = [shelfKey(target.id)];
  }

  const registry = upsertEntry(upsertEntry(request.registry, current), target);
  return {
    kind,
    targetId: target.id,
    target,
    current,
    writes: [
      { key: shelfKey(current.id), value: request.currentRaw },
      { key: PROJECT_REGISTRY_KEY, value: serializeRegistry(registry) },
    ],
    removes,
    nextMainText,
    registry,
    rollback: {
      writes: [{ key: PROJECT_REGISTRY_KEY, value: serializeRegistry(request.registry) }],
      removes: [shelfKey(current.id)],
    },
  };
}

export function applySwitchWrites(storage: StorageLike, plan: ProjectSwitchPlan): void {
  for (const write of plan.writes) storage.setItem(write.key, write.value);
}

export function applySwitchRemoves(storage: StorageLike, plan: ProjectSwitchPlan): void {
  for (const key of plan.removes) storage.removeItem(key);
}

export function applySwitchRollback(storage: StorageLike, plan: ProjectSwitchPlan): void {
  for (const write of plan.rollback.writes) storage.setItem(write.key, write.value);
  for (const key of plan.rollback.removes) storage.removeItem(key);
}

// ---------------------------------------------------------------------------------------------
// Assistant project tabs: an ordered, de-duplicated list of project ids (at most MAX_PROJECT_TABS).

/** Drops non-ids and duplicates (first occurrence wins) and keeps the newest MAX_PROJECT_TABS entries. */
export function normalizeTabs(ids: readonly unknown[]): string[] {
  const seen = new Set<string>();
  const tabs: string[] = [];
  for (const id of ids) {
    if (typeof id !== "string" || !id || seen.has(id)) continue;
    seen.add(id);
    tabs.push(id);
  }
  const kept = tabs.length > MAX_PROJECT_TABS ? tabs.slice(tabs.length - MAX_PROJECT_TABS) : tabs;
  // Hand back the caller's array when it was already normalized so React state stays referentially stable.
  if (kept.length === ids.length && kept.every((id, index) => ids[index] === id)) return ids as string[];
  return kept;
}

export function readTabs(storage: StorageLike): string[] {
  try {
    const value: unknown = JSON.parse(storage.getItem(ASSISTANT_PROJECT_TABS_KEY) ?? "null");
    return Array.isArray(value) ? normalizeTabs(value) : [];
  } catch {
    return [];
  }
}

export function writeTabs(storage: StorageLike, ids: readonly string[]): string[] {
  const tabs = normalizeTabs(ids);
  storage.setItem(ASSISTANT_PROJECT_TABS_KEY, JSON.stringify(tabs));
  return tabs;
}

/** Appends `id` (order preserved; an open tab is not moved). Beyond the limit the oldest tab is evicted. */
export function openTab(ids: readonly string[], id: string): string[] {
  if (typeof id !== "string" || !id) throw new Error("A project id is required to open a tab.");
  const tabs = normalizeTabs(ids);
  if (tabs.includes(id)) return tabs;
  return normalizeTabs([...tabs, id]);
}

export function closeTab(ids: readonly string[], id: string): string[] {
  const tabs = normalizeTabs(ids);
  return tabs.includes(id) ? tabs.filter((tab) => tab !== id) : tabs;
}

/** The tab to focus after closing `id`: its right-hand neighbour, else the left one, else null. */
export function nextTabAfterClose(ids: readonly string[], id: string): string | null {
  const tabs = normalizeTabs(ids);
  const index = tabs.indexOf(id);
  if (index < 0) return null;
  return tabs[index + 1] ?? tabs[index - 1] ?? null;
}
