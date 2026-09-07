import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDefaultJob } from "./domain.ts";
import {
  FENCING_JOB_STORAGE_KEY,
  LEGACY_FENCING_JOB_STORAGE_KEY,
  clearFencingJob,
  loadFencingJob,
  loadOrCreateProject,
  saveFencingJob,
} from "./persistence.ts";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

describe("fencing job persistence", () => {
  it("persists a new project identity before separate libraries are saved and reuses it after reopen", () => {
    const storage = new MemoryStorage(), first = createDefaultJob(), second = createDefaultJob();
    assert.notEqual(first.id, second.id);
    assert.equal(loadOrCreateProject(first, storage).job?.id, first.id);
    assert.equal(loadOrCreateProject(second, storage).job?.id, first.id);
    assert.equal(loadFencingJob(storage).job?.trade, "general");
  });
  it("never initializes over corrupt work and reports unavailable project storage", () => {
    const storage = new MemoryStorage(); storage.setItem(FENCING_JOB_STORAGE_KEY, "{broken");
    assert.equal(loadOrCreateProject(createDefaultJob(), storage).job, null);
    assert.equal(storage.getItem(FENCING_JOB_STORAGE_KEY), "{broken");
    const missing = loadOrCreateProject(createDefaultJob(), null);
    assert.equal(missing.job, null); assert.match(missing.error ?? "", /unavailable/i);
  });
  it("saves and loads a validated job", () => {
    const storage = new MemoryStorage();
    const job = createDefaultJob("2026-09-04T00:00:00.000Z");
    job.name = "Boundary replacement";

    assert.deepEqual(saveFencingJob(job, storage), { ok: true, error: null });
    const loaded = loadFencingJob(storage);
    assert.equal(loaded.error, null);
    assert.deepEqual(loaded.job, job);
  });

  it("fails closed when stored JSON is corrupt", () => {
    const storage = new MemoryStorage();
    storage.setItem(FENCING_JOB_STORAGE_KEY, "{not-json");

    const loaded = loadFencingJob(storage);
    assert.equal(loaded.job, null);
    assert.match(loaded.error ?? "", /not valid JSON/i);
  });

  it("fails closed for an unknown schema version", () => {
    const storage = new MemoryStorage();
    const value = { ...createDefaultJob(), schemaVersion: 99 };
    storage.setItem(FENCING_JOB_STORAGE_KEY, JSON.stringify(value));

    const loaded = loadFencingJob(storage);
    assert.equal(loaded.job, null);
    assert.match(loaded.error ?? "", /unsupported fencing job schema version 99/i);
  });

  it("loads and migrates the legacy storage key without stranding saved work", () => {
    const storage = new MemoryStorage();
    const legacy = { ...createDefaultJob("2026-09-04T00:00:00.000Z"), schemaVersion: 1 };
    storage.setItem(LEGACY_FENCING_JOB_STORAGE_KEY, JSON.stringify(legacy));

    const loaded = loadFencingJob(storage);
    assert.equal(loaded.error, null);
    assert.equal(loaded.job?.schemaVersion, 2);
    assert.equal(loaded.job?.name, legacy.name);
  });

  it("does not overwrite storage with an invalid job", () => {
    const storage = new MemoryStorage();
    const valid = createDefaultJob();
    saveFencingJob(valid, storage);
    const before = storage.getItem(FENCING_JOB_STORAGE_KEY);

    const invalid = { ...valid, name: "" };
    const saved = saveFencingJob(invalid as typeof valid, storage);
    assert.equal(saved.ok, false);
    assert.equal(storage.getItem(FENCING_JOB_STORAGE_KEY), before);
  });

  it("clears the saved job", () => {
    const storage = new MemoryStorage();
    saveFencingJob(createDefaultJob(), storage);

    assert.deepEqual(clearFencingJob(storage), { ok: true, error: null });
    assert.deepEqual(loadFencingJob(storage), { job: null, error: null });
  });
});
