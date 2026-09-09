import {
  JOB_SCHEMA_VERSION,
  LEGACY_JOB_SCHEMA_VERSION,
  fencingJobSchema,
  parseFencingJob,
  type FencingJob,
} from "./domain.ts";

export const FENCING_JOB_STORAGE_KEY = "xray:fencing-job:v2";
export const LEGACY_FENCING_JOB_STORAGE_KEY = "xray:fencing-job:v1";

export type JobLoadResult = {
  job: FencingJob | null;
  error: string | null;
};

export type JobPersistenceResult = {
  ok: boolean;
  error: string | null;
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function browserStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadFencingJob(storage: StorageLike | null = browserStorage()): JobLoadResult {
  if (!storage) return { job: null, error: null };

  let raw: string | null;
  try {
    raw =
      storage.getItem(FENCING_JOB_STORAGE_KEY) ?? storage.getItem(LEGACY_FENCING_JOB_STORAGE_KEY);
  } catch (error) {
    return { job: null, error: `Could not read the saved project: ${messageOf(error)}` };
  }
  if (raw === null) return { job: null, error: null };

  let candidate: unknown;
  try {
    candidate = JSON.parse(raw);
  } catch {
    return { job: null, error: "The saved project is not valid JSON." };
  }

  if (typeof candidate !== "object" || candidate === null) {
    return { job: null, error: "The saved project is not an object." };
  }

  const version = (candidate as { schemaVersion?: unknown }).schemaVersion;
  if (version !== JOB_SCHEMA_VERSION && version !== LEGACY_JOB_SCHEMA_VERSION) {
    return {
      job: null,
      error: `Unsupported project schema version ${String(version)}; expected ${JOB_SCHEMA_VERSION}.`,
    };
  }

  try {
    return { job: parseFencingJob(candidate), error: null };
  } catch {
    return { job: null, error: "The saved project failed validation and was not loaded." };
  }
}

export function saveFencingJob(
  job: FencingJob,
  storage: StorageLike | null = browserStorage(),
): JobPersistenceResult {
  if (!storage) return { ok: false, error: "Browser storage is unavailable." };

  const parsed = fencingJobSchema.safeParse(job);
  if (!parsed.success) {
    return { ok: false, error: "The project failed validation and was not saved." };
  }

  try {
    const serialized = JSON.stringify(parsed.data);
    storage.setItem(FENCING_JOB_STORAGE_KEY, serialized);
    if (storage.getItem(FENCING_JOB_STORAGE_KEY) !== serialized)
      return { ok: false, error: "The project save could not be verified. Keep this window open and retry saving; the open work has been retained." };
    return { ok: true, error: null };
  } catch (error) {
    return { ok: false, error: `Could not save the project: ${messageOf(error)}` };
  }
}

/** Establish a durable identity before any project-scoped library can be written. */
export function loadOrCreateProject(fallback: FencingJob, storage: StorageLike | null = browserStorage()): JobLoadResult {
  const loaded = loadFencingJob(storage);
  if (loaded.job || loaded.error) return loaded;
  const saved = saveFencingJob(fallback, storage);
  if (!saved.ok) return { job: null, error: saved.error };
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
