import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  saveComponentInventory,
  loadComponentInventory,
  clearComponentInventory,
  inventoryStorageKey,
  type ComponentInventoryStorageLike,
} from "./inventoryPersistence.ts";
import {
  createSampleStructuralInventory,
  type ComponentInventory,
} from "./inventory.ts";

class MemoryStorage implements ComponentInventoryStorageLike {
  public store = new Map<string, string>();
  public shouldFailWrite = false;
  public shouldCorruptWrite = false;

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    if (this.shouldFailWrite) throw new Error("Disk quota exceeded");
    if (this.shouldCorruptWrite) {
      this.store.set(key, value.slice(0, 20));
      return;
    }
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
}

describe("Component Inventory Persistence (xray:component-inventory:v1)", () => {
  const jobId = "job-hospital-expansion-01";

  it("round-trips exact validated inventory via storage", () => {
    const storage = new MemoryStorage();
    const original = createSampleStructuralInventory();

    const saveResult = saveComponentInventory(jobId, original, storage);
    assert.equal(saveResult.ok, true);
    if (saveResult.ok) {
      assert.equal(saveResult.key, inventoryStorageKey(jobId));
    }

    const loadResult = loadComponentInventory(jobId, storage);
    assert.equal(loadResult.ok, true);
    if (loadResult.ok) {
      assert.equal(loadResult.inventory.instances.length, 60);
      assert.equal(loadResult.inventory.projectId, original.projectId);
      assert.deepEqual(loadResult.inventory, original);
    }
  });

  it("returns not-found when storage has no entry for the job", () => {
    const storage = new MemoryStorage();
    const result = loadComponentInventory("unknown-job", storage);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "not-found");
    }
  });

  it("fails closed and rejects corrupted JSON without crashing", () => {
    const storage = new MemoryStorage();
    const key = inventoryStorageKey(jobId);
    storage.store.set(key, "{ invalid json corrupt content");

    const result = loadComponentInventory(jobId, storage);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "invalid-json");
    }
  });

  it("fails closed on schema version mismatch or invalid schema structure", () => {
    const storage = new MemoryStorage();
    const key = inventoryStorageKey(jobId);
    storage.store.set(key, JSON.stringify({ schema: "wrong-version", instances: [] }));

    const result = loadComponentInventory(jobId, storage);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "unsupported-version");
    }
  });

  it("preserves previous valid snapshot if a subsequent write fails", () => {
    const storage = new MemoryStorage();
    const original = createSampleStructuralInventory();

    // First save succeeds
    const firstSave = saveComponentInventory(jobId, original, storage);
    assert.equal(firstSave.ok, true);

    // Turn on write failure
    storage.shouldFailWrite = true;
    const mutated = { ...original, revision: original.revision + 1 };
    const secondSave = saveComponentInventory(jobId, mutated, storage);

    assert.equal(secondSave.ok, false);
    if (!secondSave.ok) {
      assert.equal(secondSave.preservedPrevious, true);
    }

    // Previous valid inventory can still be read
    storage.shouldFailWrite = false;
    const reload = loadComponentInventory(jobId, storage);
    assert.equal(reload.ok, true);
    if (reload.ok) {
      assert.equal(reload.inventory.revision, original.revision);
    }
  });

  it("clears component inventory cleanly", () => {
    const storage = new MemoryStorage();
    const original = createSampleStructuralInventory();

    saveComponentInventory(jobId, original, storage);
    assert.equal(loadComponentInventory(jobId, storage).ok, true);

    const clearRes = clearComponentInventory(jobId, storage);
    assert.equal(clearRes.ok, true);
    assert.equal(loadComponentInventory(jobId, storage).ok, false);
  });
});
