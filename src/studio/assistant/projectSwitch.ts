import { createDefaultJob, fencingJobSchema, parseFencingJob, type FencingJob } from "../domain.ts";
import type { JobPersistenceResult } from "../persistence.ts";
import { withProjectLifecycle } from "../projectArchive.ts";
import {
  applySwitchRemoves,
  applySwitchWrites,
  entriesNewestFirst,
  findEntry,
  openTab,
  peekShelvedJobText,
  planProjectSwitch,
  readRegistryStrict,
  readTabs,
  writeRegistry,
  writeTabs,
  type ProjectRegistry,
  type ProjectSummary,
  type ProjectSwitchPlan,
  type StorageLike,
} from "../projectRegistry.ts";

/**
 * Project switch orchestration for the live assistant (SC-18).
 *
 * Pure apart from the injected store, storage and main-key writer, so the whole sequence is
 * testable under node. Order (see `switchProject`): refuse while the chat is busy or the store is
 * not ready → save the open project through the store's compare-and-swap path → plan the switch
 * → parse the target → shelve + index (writes) → CAS write of the main key → on failure roll the
 * writes back, on success free the target shelf, open the tab, index, block autosave and re-hydrate.
 * After hydration `job.id` changes and `useAssistantChat(jobId)` shows that project's thread.
 */

/** The slice of the studio store the switch needs; `useStudio.getState()` satisfies it structurally. */
export type ProjectSwitchStoreState = {
  job: FencingJob;
  persistenceHydrated: boolean;
  persistenceRecoveryBlocked: boolean;
  hydrationStatus: string;
  lastSavedJobRaw: string | null;
  persistenceError: string | null;
  /** `saveCurrentProject: () => JobPersistenceResult` (store.ts): CAS save of `job` against `lastSavedJobRaw`. */
  saveCurrentProject: () => JobPersistenceResult;
  /** `retryProjectLoad: () => Promise<void>` (store.ts): re-hydrates only while `persistenceRecoveryBlocked`. */
  retryProjectLoad: () => Promise<void>;
};
export type ProjectSwitchStore = {
  getState: () => ProjectSwitchStoreState;
  setState: (patch: { persistenceRecoveryBlocked: boolean }) => void;
};
export type ProjectSwitchDeps = {
  store: ProjectSwitchStore;
  storage: StorageLike;
  /** The app passes `(job, options) => saveFencingJob(job, undefined, options)` (persistence.ts). */
  saveJob: (job: FencingJob, options: { expectedRaw: string | null }) => JobPersistenceResult;
  /** `chat.busy || readingImages`: a switch is refused, never queued, while a turn is running. */
  busy: boolean;
  parseJob?: (value: unknown) => FencingJob;
  /** Serialized fresh job for "New project"; defaults to the bytes `saveFencingJob` would write. */
  createJobText?: () => string;
};
export type ProjectSwitchStage = "busy" | "not-ready" | "save" | "plan" | "write" | "main" | "reload";
export type ProjectSwitchResult =
  | { ok: true; kind: "switch" | "new"; target: ProjectSummary; tabs: string[]; registry: ProjectRegistry }
  | { ok: false; stage: ProjectSwitchStage; error: string };

export const SWITCH_BUSY_MESSAGE = "Wait for the assistant to finish, or stop it, before switching projects.";
export const SWITCH_NOT_READY_MESSAGE =
  "The project is still loading or recovery is active. Finish recovery before switching projects.";

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** The exact bytes `saveFencingJob` writes for a fresh job: schema-parsed, then JSON.stringify. */
export function defaultProjectText(now?: string): string {
  return JSON.stringify(fencingJobSchema.parse(createDefaultJob(now)));
}

export async function switchProject(targetId: string | null, deps: ProjectSwitchDeps): Promise<ProjectSwitchResult> {
  try { return await withProjectLifecycle(() => switchProjectLocked(targetId, deps)); }
  catch (error) { return { ok: false, stage: "write", error: messageOf(error) }; }
}

async function switchProjectLocked(targetId: string | null, deps: ProjectSwitchDeps): Promise<ProjectSwitchResult> {
  const { store, storage } = deps;
  const parseJob = deps.parseJob ?? parseFencingJob;
  const createJobText = deps.createJobText ?? defaultProjectText;
  if (deps.busy) return { ok: false, stage: "busy", error: SWITCH_BUSY_MESSAGE };
  const before = store.getState();
  if (!before.persistenceHydrated || before.persistenceRecoveryBlocked || before.hydrationStatus !== "ready")
    return { ok: false, stage: "not-ready", error: SWITCH_NOT_READY_MESSAGE };

  // 1. The open project must be on disk before it is shelved; the store's CAS path reports staleness.
  const saved = store.getState().saveCurrentProject();
  if (!saved.ok) return { ok: false, stage: "save", error: saved.error ?? "The open project could not be saved." };
  const state = store.getState();
  const currentRaw = state.lastSavedJobRaw;

  // 2. Plan and parse before touching storage, so a bad target changes nothing.
  let plan: ProjectSwitchPlan;
  let targetJob: FencingJob;
  try {
    if (currentRaw === null) throw new Error("The open project has no saved record to shelve. Save it first, then switch.");
    plan = planProjectSwitch({
      currentJob: state.job,
      currentRaw,
      targetId,
      registry: readRegistryStrict(storage),
      shelvedTargetText: targetId === null ? null : peekShelvedJobText(storage, targetId),
      createJobText,
    });
    targetJob = parseJob(JSON.parse(plan.nextMainText));
  } catch (error) {
    return { ok: false, stage: "plan", error: messageOf(error) };
  }

  // 3. Shelve the open project and index both, then swap the main key under the CAS guard.
  // Rollback restores each slot's PREVIOUS value rather than deleting it: when two windows shelve the same
  // project at once and one loses the CAS race, the winner's shelf copy must survive.
  const previous = new Map(plan.writes.map(write => [write.key, storage.getItem(write.key)] as const));
  const rollback = () => {
    for (const [key, value] of previous) { if (value === null) storage.removeItem(key); else storage.setItem(key, value); }
    for (const key of plan.rollback.removes) if (!previous.has(key)) storage.removeItem(key);
  };
  try {
    applySwitchWrites(storage, plan);
  } catch (error) {
    try {
      rollback();
    } catch {
      // Storage is failing; the rollback error is not more useful than the write error.
    }
    return { ok: false, stage: "write", error: `The open project could not be shelved: ${messageOf(error)}` };
  }
  const written = deps.saveJob(targetJob, { expectedRaw: currentRaw });
  if (!written.ok) {
    rollback();
    return { ok: false, stage: "main", error: written.error ?? "The project could not be opened." };
  }

  // 4. Commit: the main key now holds the target, so block the old in-memory project first, then tidy and re-hydrate.
  store.setState({ persistenceRecoveryBlocked: true });
  let tabs: string[];
  try {
    applySwitchRemoves(storage, plan);
    tabs = writeTabs(storage, openTab(readTabs(storage), plan.targetId));
    writeRegistry(storage, plan.registry);
  } catch (error) {
    tabs = readTabs(storage);
    // The switch itself succeeded; a failed tidy-up must not leave the store on the old project.
    await store.getState().retryProjectLoad();
    return { ok: false, stage: "reload", error: `The project was opened but its tabs could not be saved: ${messageOf(error)}` };
  }
  await store.getState().retryProjectLoad();
  const after = store.getState();
  if (after.hydrationStatus !== "ready" || after.job.id !== plan.targetId)
    return {
      ok: false,
      stage: "reload",
      error: after.persistenceError ?? "The project was switched but could not be reloaded. Use the recovery notice to reload it.",
    };
  return { ok: true, kind: plan.kind, target: plan.target, tabs, registry: plan.registry };
}

// ---------------------------------------------------------------------------------------------
// Presentation helpers for the drawer list and the tab strip (pure, tested alongside the switch).

export type ProjectRow = { id: string; name: string; updatedAt: string; current: boolean };
export type ProjectTab = { id: string; name: string };
export type CurrentProject = { id: string; name: string; updatedAt: string };

/** The open project first (live name and time), then every other indexed project newest first. */
export function listProjects(registry: ProjectRegistry, current: CurrentProject): ProjectRow[] {
  const rows: ProjectRow[] = [{ id: current.id, name: current.name, updatedAt: current.updatedAt, current: true }];
  for (const entry of entriesNewestFirst(registry))
    if (entry.id !== current.id && !entry.archived) rows.push({ id: entry.id, name: entry.name, updatedAt: entry.updatedAt, current: false });
  return rows;
}

/** Tab ids resolved to names; ids that are neither the open project nor indexed are dropped. */
export function resolveTabs(tabs: readonly string[], registry: ProjectRegistry, current: Pick<CurrentProject, "id" | "name">): ProjectTab[] {
  const resolved: ProjectTab[] = [];
  for (const id of tabs) {
    if (id === current.id) {
      resolved.push({ id, name: current.name });
      continue;
    }
    const entry = findEntry(registry, id);
    if (entry && !entry.archived) resolved.push({ id, name: entry.name });
  }
  return resolved;
}
