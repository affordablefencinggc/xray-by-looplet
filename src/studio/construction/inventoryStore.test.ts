import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createSampleStructuralInventory, updateDisplayMark } from "./inventory.ts";
import { inventoryStorageKey } from "./inventoryPersistence.ts";

// Install storage BEFORE importing the store so its real browser autosave
// subscriptions run. These tests exercise actions, not a copy of their logic.
const data = new Map<string, string>();
let failWrites = false;
let inventoryWrites = 0;
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    localStorage: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (key.startsWith("xray:component-inventory:")) {
          inventoryWrites++;
          if (failWrites) throw new Error("Quota exceeded");
        }
        data.set(key, value);
      },
      removeItem: (key: string) => data.delete(key),
    },
  },
});
const { useStudio, resetStudioHydrationForTests } = await import("../store.ts");

function key() {
  return inventoryStorageKey(useStudio.getState().job.id);
}

describe("inventory restore protection through real store actions and autosave", () => {
  beforeEach(() => {
    resetStudioHydrationForTests();
    useStudio.setState(useStudio.getInitialState(), true);
    data.clear();
    failWrites = false;
    inventoryWrites = 0;
  });

  for (const [reason, payload] of [
    ["unsupported-version", JSON.stringify({ schema: "xray.component-inventory/v99", revision: 99 })],
    ["invalid-json", "{unreadable inventory"],
    ["invalid-schema", JSON.stringify({ schema: "xray.component-inventory/v1", instances: [] })],
  ]) {
    it(`preserves ${reason} bytes through hydration, edits, autosave, explicit save and retry`, async () => {
      const storageKey = key();
      data.set(storageKey, payload);
      await useStudio.getState().hydratePersistence();
      assert.equal(data.get(storageKey), payload);
      const restoreError = useStudio.getState().inventoryPersistenceError;
      assert.match(restoreError!, new RegExp(reason));

      const edited = updateDisplayMark(useStudio.getState().componentInventory, "conn-c1-01", "My connection");
      useStudio.getState().setComponentInventory(edited);
      assert.equal(data.get(storageKey), payload, "Ordinary edits must never replace unreadable saved data");
      assert.equal(useStudio.getState().inventoryPersistenceError, restoreError);
      const saved = useStudio.getState().saveCurrentInventory();
      assert.equal(saved.ok, false);
      if (!saved.ok) assert.equal(saved.reason, "recovery-required");
      assert.equal(data.get(storageKey), payload);
      assert.equal(useStudio.getState().loadCurrentInventory().ok, false);
      assert.equal(inventoryWrites, 0, "Blocked actions must not attempt any inventory write");

      // A presentation-error change cannot release the independent recovery lock.
      useStudio.setState({ inventoryPersistenceError: null });
      useStudio.setState({ componentInventory: createSampleStructuralInventory() });
      assert.equal(data.get(storageKey), payload);
      assert.equal(inventoryWrites, 0);
    });
  }

  it("unblocks only after a successful restore and persists the next edit across reload", async () => {
    data.set(key(), "{broken");
    await useStudio.getState().hydratePersistence();
    const restored = updateDisplayMark(createSampleStructuralInventory(), "conn-c1-01", "Recovered connection");
    data.set(key(), JSON.stringify(restored));
    assert.equal(useStudio.getState().loadCurrentInventory().ok, true);
    assert.equal(useStudio.getState().inventoryPersistenceError, null);
    const edited = updateDisplayMark(useStudio.getState().componentInventory, "conn-c1-01", "Saved after recovery");
    useStudio.getState().setComponentInventory(edited);
    assert.deepEqual(JSON.parse(data.get(key())!), edited);

    useStudio.setState({ persistenceHydrated: false, componentInventory: createSampleStructuralInventory() });
    await useStudio.getState().hydratePersistence();
    assert.deepEqual(useStudio.getState().componentInventory, edited);
  });

  it("keeps recovery blocked if explicit demo replacement fails, then permits a successful replacement", async () => {
    const payload = "{broken saved work";
    data.set(key(), payload);
    await useStudio.getState().hydratePersistence();
    failWrites = true;
    useStudio.getState().resetSampleInventory();
    assert.equal(data.get(key()), payload);
    assert.ok(useStudio.getState().inventoryPersistenceError);
    failWrites = false;
    const beforeEditWrites = inventoryWrites;
    useStudio.getState().setComponentInventory(createSampleStructuralInventory());
    assert.equal(data.get(key()), payload);
    assert.equal(inventoryWrites, beforeEditWrites);
    useStudio.getState().resetSampleInventory();
    assert.equal(useStudio.getState().inventoryPersistenceError, null);
    assert.equal(JSON.parse(data.get(key())!).schema, "xray.component-inventory/v1");
    assert.equal(useStudio.getState().saveCurrentInventory().ok, true);
  });

  it("reports ordinary write failures and retries without treating them as failed restores", async () => {
    await useStudio.getState().hydratePersistence();
    const previous = data.get(key());
    failWrites = true;
    const edited = updateDisplayMark(useStudio.getState().componentInventory, "conn-c1-01", "Pending save");
    useStudio.getState().setComponentInventory(edited);
    assert.equal(data.get(key()), previous);
    assert.match(useStudio.getState().inventoryPersistenceError!, /write-failed/);
    failWrites = false;
    assert.equal(useStudio.getState().saveCurrentInventory().ok, true);
    assert.equal(useStudio.getState().inventoryPersistenceError, null);
    assert.deepEqual(JSON.parse(data.get(key())!), edited);
  });
});
