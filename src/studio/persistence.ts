import {
  JOB_SCHEMA_VERSION,
  LEGACY_JOB_SCHEMA_VERSION,
  fencingJobSchema,
  parseFencingJob,
  type FencingJob,
} from "./domain.ts";
import { commitStagedWrite, stageJournalledWrite } from "./persistence/recoveryJournal.ts";

export const FENCING_JOB_STORAGE_KEY = "xray:fencing-job:v2";
export const LEGACY_FENCING_JOB_STORAGE_KEY = "xray:fencing-job:v1";

export type JobLoadResult = {
  job: FencingJob | null;
  error: string | null;
  /** The exact stored text this result was parsed from; null when nothing was stored. */
  raw: string | null;
};

export type JobPersistenceResult = {
  ok: boolean;
  error: string | null;
  /** True when the write was refused because storage no longer holds the bytes the writer expected. */
  stale?: boolean;
  /** The serialized bytes written on success, so the caller can track the stored revision. */
  raw?: string | null;
};

export type JobSaveOptions = {
  /**
   * Compare-and-swap guard: the exact bytes the caller last loaded or wrote (null for an empty slot).
   * When provided and storage now holds different bytes, the write is refused so a stale
   * window cannot silently overwrite a newer revision. Omit to skip the guard.
   */
  expectedRaw?: string | null;
  /**
   * Runs after the new bytes and the in-flight recovery journal are stored, before the journal
   * is committed. A throw leaves the save uncommitted so startup playback can roll it back.
   */
  beforeCommit?: () => void;
};

export const STALE_PROJECT_WRITE_MESSAGE =
  "A newer revision of this project was saved by another window. This window's change was not written so the newer revision is preserved. Reload the latest revision to continue, or download this window's unsaved revision first.";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function browserStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** The stored project text a load would parse: the v2 record, else the legacy record. */
function readStoredJobText(storage: StorageLike): string | null {
  return storage.getItem(FENCING_JOB_STORAGE_KEY) ?? storage.getItem(LEGACY_FENCING_JOB_STORAGE_KEY);
}

export function loadFencingJob(storage: StorageLike | null = browserStorage()): JobLoadResult {
  if (!storage) return { job: null, error: null, raw: null };

  let raw: string | null;
  try {
    raw = readStoredJobText(storage);
  } catch (error) {
    return { job: null, error: `Could not read the saved project: ${messageOf(error)}`, raw: null };
  }
  if (raw === null) return { job: null, error: null, raw: null };

  let candidate: unknown;
  try {
    candidate = JSON.parse(raw);
  } catch {
    return { job: null, error: "The saved project is not valid JSON.", raw };
  }

  if (typeof candidate !== "object" || candidate === null) {
    return { job: null, error: "The saved project is not an object.", raw };
  }

  const version = (candidate as { schemaVersion?: unknown }).schemaVersion;
  if (version !== JOB_SCHEMA_VERSION && version !== LEGACY_JOB_SCHEMA_VERSION) {
    return {
      job: null,
      error: `Unsupported project schema version ${String(version)}; expected ${JOB_SCHEMA_VERSION}.`,
      raw,
    };
  }

  try {
    return { job: parseFencingJob(candidate), error: null, raw };
  } catch {
    return { job: null, error: "The saved project failed validation and was not loaded.", raw };
  }
}

export function saveFencingJob(
  job: FencingJob,
  storage: StorageLike | null = browserStorage(),
  options: JobSaveOptions = {},
): JobPersistenceResult {
  if (!storage) return { ok: false, error: "Browser storage is unavailable." };

  const parsed = fencingJobSchema.safeParse(job);
  if (!parsed.success) {
    return { ok: false, error: "The project failed validation and was not saved." };
  }

  if (options.expectedRaw !== undefined) {
    // Compare-and-swap immediately before the write: never replace bytes this writer has not seen.
    let current: string | null;
    try {
      current = readStoredJobText(storage);
    } catch (error) {
      return { ok: false, error: `Could not read the saved project before saving: ${messageOf(error)}` };
    }
    if (current !== options.expectedRaw) return { ok: false, stale: true, error: STALE_PROJECT_WRITE_MESSAGE };
  }

  try {
    const serialized = JSON.stringify(parsed.data);
    const staged = stageJournalledWrite({
      storage,
      projectId: parsed.data.id,
      operation: "save-project",
      targetKey: FENCING_JOB_STORAGE_KEY,
      next: serialized,
      now: new Date(),
    });
    if (staged.status !== "staged") return { ok: false, error: staged.reason };
    if (storage.getItem(FENCING_JOB_STORAGE_KEY) !== serialized)
      return { ok: false, error: "The project save could not be verified. Keep this window open and retry saving; the open work has been retained." };
    try {
      options.beforeCommit?.();
    } catch (error) {
      return { ok: false, error: `Project save was interrupted before its recovery journal committed. ${messageOf(error)}` };
    }
    commitStagedWrite(storage, new Date());
    return { ok: true, error: null, raw: serialized };
  } catch (error) {
    return { ok: false, error: `Could not save the project: ${messageOf(error)}` };
  }
}

/** Establish a durable identity before any project-scoped library can be written. */
export function loadOrCreateProject(fallback: FencingJob, storage: StorageLike | null = browserStorage()): JobLoadResult {
  const loaded = loadFencingJob(storage);
  if (loaded.job || loaded.error) return loaded;
  // The slot must still be empty at write time; a window that initialised first keeps its record.
  const saved = saveFencingJob(fallback, storage, { expectedRaw: null });
  if (!saved.ok && !saved.stale) return { job: null, error: saved.error, raw: null };
  return loadFencingJob(storage);
}

export async function loadOrCreateBrowserProject(fallback: FencingJob): Promise<JobLoadResult> {
  // Serialize first-open windows, then re-read inside the lock. Normal editing
  // remains governed by the existing persistence path, not this initialization lock.
  if (typeof navigator !== "undefined" && navigator.locks)
    return navigator.locks.request("xray:project-initialization", () => loadOrCreateProject(fallback));
  return loadOrCreateProject(fallback);
}

export function clearFencingJob(
  storage: StorageLike | null = browserStorage(),
): JobPersistenceResult {
  if (!storage) return { ok: false, error: "Browser storage is unavailable." };
  try {
    storage.removeItem(FENCING_JOB_STORAGE_KEY);
    storage.removeItem(LEGACY_FENCING_JOB_STORAGE_KEY);
    return { ok: true, error: null };
  } catch (error) {
    return { ok: false, error: `Could not clear the project: ${messageOf(error)}` };
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
