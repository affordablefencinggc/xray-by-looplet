import {
  COMPONENT_INVENTORY_SCHEMA,
  componentInventorySchema,
  type ComponentInventory,
} from "./inventory.ts";

export interface ComponentInventoryStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type InventoryPersistenceLoadResult =
  | { ok: true; inventory: ComponentInventory }
  | {
      ok: false;
      reason:
        | "storage-unavailable"
        | "read-failed"
        | "not-found"
        | "invalid-json"
        | "unsupported-version"
        | "invalid-schema";
    };

export type InventoryPersistenceWriteResult =
  | { ok: true; key: string }
  | {
      ok: false;
      reason: "storage-unavailable" | "invalid-schema" | "read-failed" | "write-failed";
      preservedPrevious: boolean;
    };

const STORAGE_PREFIX = "xray:component-inventory:v1:";

export function inventoryStorageKey(jobId: string): string {
  const trimmed = jobId.trim();
  if (!trimmed) throw new Error("Job ID cannot be empty.");
  return `${STORAGE_PREFIX}${encodeURIComponent(trimmed)}`;
}

export function saveComponentInventory(
  jobId: string,
  inventoryInput: ComponentInventory,
  storageInput?: ComponentInventoryStorageLike | null,
): InventoryPersistenceWriteResult {
  let inventory: ComponentInventory;
  let serialized: string;
  let key: string;

  try {
    inventory = componentInventorySchema.parse(inventoryInput);
    serialized = JSON.stringify(inventory);
    key = inventoryStorageKey(jobId);
  } catch {
    return { ok: false, reason: "invalid-schema", preservedPrevious: true };
  }

  const storage = resolveStorage(storageInput);
  if (!storage) return { ok: false, reason: "storage-unavailable", preservedPrevious: true };

  let previous: string | null = null;
  try {
    previous = storage.getItem(key);
  } catch {
    return { ok: false, reason: "read-failed", preservedPrevious: true };
  }

  try {
    storage.setItem(key, serialized);
    if (storage.getItem(key) !== serialized) {
      throw new Error("Storage did not retain exact component inventory bytes.");
    }
    return { ok: true, key };
  } catch {
    return {
      ok: false,
      reason: "write-failed",
      preservedPrevious: restorePrevious(storage, key, previous),
    };
  }
}

export function loadComponentInventory(
  jobId: string,
  storageInput?: ComponentInventoryStorageLike | null,
): InventoryPersistenceLoadResult {
  let key: string;
  try {
    key = inventoryStorageKey(jobId);
  } catch {
    return { ok: false, reason: "invalid-schema" };
  }

  const storage = resolveStorage(storageInput);
  if (!storage) return { ok: false, reason: "storage-unavailable" };

  let serialized: string | null = null;
  try {
    serialized = storage.getItem(key);
  } catch {
    return { ok: false, reason: "read-failed" };
  }

  if (serialized === null) return { ok: false, reason: "not-found" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    return { ok: false, reason: "invalid-json" };
  }

  if (typeof parsed !== "object" || parsed === null || !("schema" in parsed)) {
    return { ok: false, reason: "unsupported-version" };
  }

  if ((parsed as { schema: unknown }).schema !== COMPONENT_INVENTORY_SCHEMA) {
    return { ok: false, reason: "unsupported-version" };
  }

  const validation = componentInventorySchema.safeParse(parsed);
  if (!validation.success) {
    return { ok: false, reason: "invalid-schema" };
  }

  return { ok: true, inventory: validation.data };
}

export function clearComponentInventory(
  jobId: string,
  storageInput?: ComponentInventoryStorageLike | null,
): InventoryPersistenceWriteResult {
  let key: string;
  try {
    key = inventoryStorageKey(jobId);
  } catch {
    return { ok: false, reason: "invalid-schema", preservedPrevious: true };
  }

  const storage = resolveStorage(storageInput);
  if (!storage) return { ok: false, reason: "storage-unavailable", preservedPrevious: true };

  let previous: string | null = null;
  try {
    previous = storage.getItem(key);
  } catch {
    return { ok: false, reason: "read-failed", preservedPrevious: true };
  }

  try {
    storage.removeItem(key);
    return { ok: true, key };
  } catch {
    return {
      ok: false,
      reason: "write-failed",
      preservedPrevious: restorePrevious(storage, key, previous),
    };
  }
}

function resolveStorage(custom?: ComponentInventoryStorageLike | null): ComponentInventoryStorageLike | null {
  if (custom) return custom;
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

function restorePrevious(
  storage: ComponentInventoryStorageLike,
  key: string,
  previous: string | null,
): boolean {
  try {
    if (storage.getItem(key) === previous) return true;
  } catch {
    // continue
  }

  try {
    if (previous === null) {
      storage.removeItem(key);
    } else {
      storage.setItem(key, previous);
    }
    return storage.getItem(key) === previous;
  } catch {
    try {
      return storage.getItem(key) === previous;
    } catch {
      return false;
    }
  }
}
