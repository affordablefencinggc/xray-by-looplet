import {
  BOM_STATE_SCHEMA,
  bomStateEnvelopeSchema,
  createBomState,
  deserializeBomState,
  serializeBomState,
  type BomStateEnvelope,
  type BomStateLoadResult,
} from "./bomState.ts";

export interface BomStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type BomPersistenceLoadResult =
  | { ok: true; state: BomStateEnvelope }
  | { ok: false; reason: "storage-unavailable" | "read-failed" | "not-found" | "invalid-json" | "unsupported-version" | "invalid-state" | "job-mismatch" };

export type BomPersistenceWriteResult =
  | { ok: true; key: string }
  | { ok: false; reason: "storage-unavailable" | "invalid-state" | "read-failed" | "write-failed"; preservedPrevious: boolean };

const STORAGE_PREFIX = "xray:bom-state:v1:";

/** The schema version is part of the key so a future format cannot shadow v1 bytes. */
export function bomStorageKey(jobId: string): string {
  const validatedJobId = createBomState(jobId).jobId;
  return `${STORAGE_PREFIX}${encodeURIComponent(validatedJobId)}`;
}

export function saveBomState(
  stateInput: BomStateEnvelope,
  storageInput?: BomStorageLike | null,
): BomPersistenceWriteResult {
  let state: BomStateEnvelope;
  let serialized: string;
  let key: string;
  try {
    state = bomStateEnvelopeSchema.parse(stateInput);
    serialized = serializeBomState(state);
    key = bomStorageKey(state.jobId);
  } catch {
    return { ok: false, reason: "invalid-state", preservedPrevious: true };
  }

  const storage = resolveStorage(storageInput);
  if (!storage) return { ok: false, reason: "storage-unavailable", preservedPrevious: true };

  let previous: string | null;
  try {
    previous = storage.getItem(key);
  } catch {
    return { ok: false, reason: "read-failed", preservedPrevious: true };
  }

  try {
    storage.setItem(key, serialized);
    if (storage.getItem(key) !== serialized) throw new Error("BOM state storage did not retain the exact validated bytes.");
    return { ok: true, key };
  } catch {
    return {
      ok: false,
      reason: "write-failed",
      preservedPrevious: restorePrevious(storage, key, previous),
    };
  }
}

export function loadBomState(
  jobId: string,
  storageInput?: BomStorageLike | null,
): BomPersistenceLoadResult {
  let key: string;
  try {
    key = bomStorageKey(jobId);
  } catch {
    return { ok: false, reason: "invalid-state" };
  }
  const storage = resolveStorage(storageInput);
  if (!storage) return { ok: false, reason: "storage-unavailable" };
  let serialized: string | null;
  try {
    serialized = storage.getItem(key);
  } catch {
    return { ok: false, reason: "read-failed" };
  }
  if (serialized === null) return { ok: false, reason: "not-found" };
  const loaded: BomStateLoadResult = deserializeBomState(serialized);
  if (!loaded.ok) return loaded;
  if (loaded.state.jobId !== jobId) return { ok: false, reason: "job-mismatch" };
  return loaded;
}

export function clearBomState(
  jobId: string,
  storageInput?: BomStorageLike | null,
): BomPersistenceWriteResult {
  let key: string;
  try {
    key = bomStorageKey(jobId);
  } catch {
    return { ok: false, reason: "invalid-state", preservedPrevious: true };
  }
  const storage = resolveStorage(storageInput);
  if (!storage) return { ok: false, reason: "storage-unavailable", preservedPrevious: true };
  let previous: string | null;
  try {
    previous = storage.getItem(key);
  } catch {
    return { ok: false, reason: "read-failed", preservedPrevious: true };
  }
  try {
    storage.removeItem(key);
    if (storage.getItem(key) !== null) throw new Error("BOM state storage did not clear the requested key.");
    return { ok: true, key };
  } catch {
    return {
      ok: false,
      reason: "write-failed",
      preservedPrevious: restorePrevious(storage, key, previous),
    };
  }
}

/** Browser storage is optional; SSR, privacy modes and denied property access fail closed. */
export function availableBrowserBomStorage(): BomStorageLike | null {
  try {
    const candidate = globalThis.localStorage;
    return candidate &&
      typeof candidate.getItem === "function" &&
      typeof candidate.setItem === "function" &&
      typeof candidate.removeItem === "function"
      ? candidate
      : null;
  } catch {
    return null;
  }
}

function resolveStorage(storage: BomStorageLike | null | undefined): BomStorageLike | null {
  return storage === undefined ? availableBrowserBomStorage() : storage;
}

function restorePrevious(storage: BomStorageLike, key: string, previous: string | null): boolean {
  try {
    if (previous === null) storage.removeItem(key);
    else storage.setItem(key, previous);
    return storage.getItem(key) === previous;
  } catch {
    // Some storage shims mutate and then throw. Verify bytes once more before
    // reporting rollback failure; the persisted generation is authoritative.
    try {
      return storage.getItem(key) === previous;
    } catch {
      return false;
    }
  }
}

export const BOM_STORAGE_SCHEMA = BOM_STATE_SCHEMA;
