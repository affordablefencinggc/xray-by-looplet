import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import type { BomBuildRequest, BomBuildResponse } from "./bomContract.ts";
import {
  BOM_STORAGE_SCHEMA,
  bomStorageKey,
  clearBomState,
  loadBomState,
  saveBomState,
  type BomStorageLike,
} from "./bomPersistence.ts";
import {
  beginBomBuild,
  completeBomBuild,
  createBomState,
  serializeBomState,
  type BomStateEnvelope,
} from "./bomState.ts";

const FIXTURES = new URL("../../engine/fixtures/bom-contract/", import.meta.url);
const T0 = "2026-09-04T00:00:00.000Z";
const T1 = "2026-09-04T00:00:01.000Z";

class MemoryStorage implements BomStorageLike {
  readonly values = new Map<string, string>();
  reads = 0;
  writes = 0;
  removals = 0;

  getItem(key: string) {
    this.reads += 1;
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.writes += 1;
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.removals += 1;
    this.values.delete(key);
  }
}

async function committedState(): Promise<BomStateEnvelope> {
  const request = JSON.parse(await readFile(new URL("colorbond.request.json", FIXTURES), "utf8")) as BomBuildRequest;
  const response = JSON.parse(await readFile(new URL("colorbond.response.json", FIXTURES), "utf8")) as BomBuildResponse;
  const pending = beginBomBuild(createBomState(request.job.id), request, T0);
  const result = completeBomBuild(pending, {
    expectedRequestId: request.requestId,
    expectedJobRevision: request.job.revision,
    completedAt: T1,
    response,
  });
  assert.equal(result.ok, true);
  return result.state;
}

describe("SC-07F BOM persistence adapter", () => {
  it("saves, reloads and clears exact validated bytes under a versioned job key", async () => {
    const state = await committedState();
    const storage = new MemoryStorage();
    const saved = saveBomState(state, storage);
    assert.deepEqual(saved, { ok: true, key: bomStorageKey(state.jobId) });
    assert.equal(storage.values.get(bomStorageKey(state.jobId)), serializeBomState(state));
    assert.deepEqual(loadBomState(state.jobId, storage), { ok: true, state });
    assert.deepEqual(clearBomState(state.jobId, storage), { ok: true, key: bomStorageKey(state.jobId) });
    assert.deepEqual(loadBomState(state.jobId, storage), { ok: false, reason: "not-found" });
    assert.equal(BOM_STORAGE_SCHEMA, "xray.bom-state/v1");
  });

  it("uses collision-safe job-specific keys", () => {
    assert.notEqual(bomStorageKey("job/a"), bomStorageKey("job%2Fa"));
    assert.match(bomStorageKey("job/a"), /^xray:bom-state:v1:/);
  });

  it("never falls back to fabricated state for corrupt, unknown or cross-job bytes", async () => {
    const state = await committedState();
    const key = bomStorageKey(state.jobId);
    const storage = new MemoryStorage();
    storage.values.set(key, "not-json");
    assert.deepEqual(loadBomState(state.jobId, storage), { ok: false, reason: "invalid-json" });
    storage.values.set(key, JSON.stringify({ ...state, schema: "xray.bom-state/v2" }));
    assert.deepEqual(loadBomState(state.jobId, storage), { ok: false, reason: "unsupported-version" });
    storage.values.set(key, JSON.stringify({ ...state, surprise: true }));
    assert.deepEqual(loadBomState(state.jobId, storage), { ok: false, reason: "invalid-state" });
    storage.values.set(key, serializeBomState({ ...state, jobId: "other-job", snapshot: null, invalidation: null }));
    assert.deepEqual(loadBomState(state.jobId, storage), { ok: false, reason: "job-mismatch" });
  });

  it("validates before touching storage", async () => {
    const state = await committedState();
    const storage = new MemoryStorage();
    const invalid = { ...state, surprise: true } as BomStateEnvelope;
    assert.deepEqual(saveBomState(invalid, storage), { ok: false, reason: "invalid-state", preservedPrevious: true });
    assert.deepEqual([storage.reads, storage.writes, storage.removals], [0, 0, 0]);
  });

  it("restores the exact previous bytes when setItem mutates and then throws", async () => {
    const state = await committedState();
    const key = bomStorageKey(state.jobId);
    const previous = "previous-valid-generation";
    const storage = new MemoryStorage();
    storage.values.set(key, previous);
    let firstWrite = true;
    storage.setItem = (writeKey, value) => {
      storage.writes += 1;
      storage.values.set(writeKey, value);
      if (firstWrite) {
        firstWrite = false;
        throw new Error("quota failure after mutation");
      }
    };
    assert.deepEqual(saveBomState(state, storage), { ok: false, reason: "write-failed", preservedPrevious: true });
    assert.equal(storage.values.get(key), previous);
  });

  it("removes a partially-created key when the first write fails", async () => {
    const state = await committedState();
    const key = bomStorageKey(state.jobId);
    const storage = new MemoryStorage();
    storage.setItem = (writeKey, value) => {
      storage.values.set(writeKey, value);
      throw new Error("write failed after mutation");
    };
    assert.deepEqual(saveBomState(state, storage), { ok: false, reason: "write-failed", preservedPrevious: true });
    assert.equal(storage.values.has(key), false);
  });

  it("restores cleared bytes when removeItem mutates and then throws", async () => {
    const state = await committedState();
    const key = bomStorageKey(state.jobId);
    const previous = serializeBomState(state);
    const storage = new MemoryStorage();
    storage.values.set(key, previous);
    storage.removeItem = (removeKey) => {
      storage.values.delete(removeKey);
      throw new Error("clear failed after mutation");
    };
    assert.deepEqual(clearBomState(state.jobId, storage), { ok: false, reason: "write-failed", preservedPrevious: true });
    assert.equal(storage.values.get(key), previous);
  });

  it("reports when even rollback cannot preserve previous bytes", async () => {
    const state = await committedState();
    const key = bomStorageKey(state.jobId);
    const storage = new MemoryStorage();
    storage.values.set(key, "previous");
    let writes = 0;
    storage.setItem = (writeKey, value) => {
      writes += 1;
      if (writes === 1) storage.values.set(writeKey, value);
      throw new Error("all writes denied");
    };
    assert.deepEqual(saveBomState(state, storage), { ok: false, reason: "write-failed", preservedPrevious: false });
    assert.notEqual(storage.values.get(key), "previous");
  });

  it("fails closed when storage is unavailable or throws on read", async () => {
    const state = await committedState();
    assert.deepEqual(saveBomState(state, null), { ok: false, reason: "storage-unavailable", preservedPrevious: true });
    assert.deepEqual(loadBomState(state.jobId, null), { ok: false, reason: "storage-unavailable" });
    assert.deepEqual(clearBomState(state.jobId, null), { ok: false, reason: "storage-unavailable", preservedPrevious: true });
    const storage = new MemoryStorage();
    storage.getItem = () => { throw new Error("storage access denied"); };
    assert.deepEqual(saveBomState(state, storage), { ok: false, reason: "read-failed", preservedPrevious: true });
    assert.deepEqual(loadBomState(state.jobId, storage), { ok: false, reason: "read-failed" });
  });
});
