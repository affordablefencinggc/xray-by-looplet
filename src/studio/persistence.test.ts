import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDefaultJob } from "./domain.ts";
import { recoverStoredJournal } from "./persistence/recoveryJournal.ts";
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

describe("project persistence", () => {
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

    const saved = saveFencingJob(job, storage);
    assert.deepEqual(saved, { ok: true, error: null, raw: storage.getItem(FENCING_JOB_STORAGE_KEY) });
    const loaded = loadFencingJob(storage);
    assert.equal(loaded.error, null);
    assert.deepEqual(loaded.job, job);
    assert.equal(loaded.raw, saved.raw, "the load reports the exact bytes it parsed");
  });

  it("refuses a stale write when storage holds bytes the writer never saw and leaves them untouched", () => {
    const storage = new MemoryStorage();
    const mine = createDefaultJob("2026-09-04T00:00:00.000Z");
    const first = saveFencingJob(mine, storage);
    const expectedRaw = first.raw ?? null;
    assert.equal(expectedRaw, storage.getItem(FENCING_JOB_STORAGE_KEY));

    // Another window saved a newer revision that this writer has not loaded.
    const other = { ...mine, name: "Other window revision", revision: mine.revision + 1 };
    const foreign = JSON.stringify(other);
    storage.setItem(FENCING_JOB_STORAGE_KEY, foreign);

    const attempt = saveFencingJob({ ...mine, name: "Stale window edit", revision: mine.revision + 1 }, storage, { expectedRaw });
    assert.equal(attempt.ok, false);
    assert.equal(attempt.stale, true);
    assert.match(attempt.error ?? "", /newer revision .* another window/i);
    assert.match(attempt.error ?? "", /reload/i);
    assert.equal(storage.getItem(FENCING_JOB_STORAGE_KEY), foreign, "the newer bytes are byte-identical after the refused write");
  });

  it("accepts a write whose expectedRaw matches the stored bytes and returns the bytes it wrote", () => {
    const storage = new MemoryStorage();
    const job = createDefaultJob("2026-09-04T00:00:00.000Z");
    const first = saveFencingJob(job, storage);
    const next = { ...job, name: "Same window edit", revision: job.revision + 1 };
    const saved = saveFencingJob(next, storage, { expectedRaw: first.raw ?? null });
    assert.equal(saved.ok, true);
    assert.equal(saved.stale, undefined);
    assert.equal(saved.raw, storage.getItem(FENCING_JOB_STORAGE_KEY));
    assert.equal(loadFencingJob(storage).raw, saved.raw);
    // Tracking the returned bytes keeps the next write valid.
    assert.equal(saveFencingJob({ ...next, revision: next.revision + 1 }, storage, { expectedRaw: saved.raw ?? null }).ok, true);
  });

  it("treats an empty slot as the expected state for a first write, and a filled slot as stale for it", () => {
    const storage = new MemoryStorage();
    const job = createDefaultJob("2026-09-04T00:00:00.000Z");
    assert.equal(saveFencingJob(job, storage, { expectedRaw: null }).ok, true);
    const stored = storage.getItem(FENCING_JOB_STORAGE_KEY);
    const second = saveFencingJob(createDefaultJob("2026-09-04T00:00:00.000Z"), storage, { expectedRaw: null });
    assert.equal(second.ok, false);
    assert.equal(second.stale, true);
    assert.equal(storage.getItem(FENCING_JOB_STORAGE_KEY), stored);
  });

  it("still fails on a readback mismatch when the compare-and-swap check passed", () => {
    const job = createDefaultJob();
    const replaced = { getItem: () => '{"another":"record"}', setItem: () => {}, removeItem: () => {} };
    const saved = saveFencingJob(job, replaced, { expectedRaw: '{"another":"record"}' });
    assert.equal(saved.ok, false);
    assert.equal(saved.stale, undefined);
    assert.match(saved.error ?? "", /could not be verified|Recovery journal could not be staged/);
  });

  it("reports a read failure during the compare-and-swap check instead of writing blind", () => {
    const backing = new MemoryStorage();
    const unreadable = { getItem: () => { throw Error("Storage read denied"); }, setItem: backing.setItem.bind(backing), removeItem: backing.removeItem.bind(backing) };
    const saved = saveFencingJob(createDefaultJob(), unreadable, { expectedRaw: null });
    assert.equal(saved.ok, false);
    assert.match(saved.error ?? "", /before saving.*Storage read denied/);
    assert.equal(backing.getItem(FENCING_JOB_STORAGE_KEY), null, "nothing was written");
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
    assert.match(loaded.error ?? "", /unsupported project schema version 99/i);
  });

  it("loads and migrates the legacy storage key without stranding saved work", () => {
    const storage = new MemoryStorage();
    const legacy = { ...createDefaultJob("2026-09-04T00:00:00.000Z"), schemaVersion: 1 };
    storage.setItem(LEGACY_FENCING_JOB_STORAGE_KEY, JSON.stringify(legacy));

    const loaded = loadFencingJob(storage);
    assert.equal(loaded.error, null);
    assert.equal(loaded.job?.schemaVersion, 2);
    assert.equal(loaded.job?.name, legacy.name);
    assert.equal(loaded.raw, JSON.stringify(legacy), "the legacy bytes are reported as the loaded raw");

    // A writer that loaded the legacy record may save with those bytes as its expectation.
    const saved = saveFencingJob({ ...loaded.job!, name: "Migrated edit", revision: loaded.job!.revision + 1 }, storage, { expectedRaw: loaded.raw });
    assert.equal(saved.ok, true);
    assert.equal(storage.getItem(LEGACY_FENCING_JOB_STORAGE_KEY), JSON.stringify(legacy), "legacy bytes stay intact");
    assert.equal(JSON.parse(storage.getItem(FENCING_JOB_STORAGE_KEY)!).name, "Migrated edit");
    // Once the v2 record exists, the legacy bytes are no longer the expected state.
    const stale = saveFencingJob(loaded.job!, storage, { expectedRaw: loaded.raw });
    assert.equal(stale.stale, true);
    assert.equal(storage.getItem(FENCING_JOB_STORAGE_KEY), saved.raw);
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
    assert.deepEqual(loadFencingJob(storage), { job: null, error: null, raw: null });
  });

  it("does not report success when storage silently drops or replaces a write", () => {
    const job = createDefaultJob();
    const dropped = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
    assert.equal(saveFencingJob(job, dropped).ok, false);
    const replaced = { ...dropped, getItem: () => '{"another":"record"}' };
    assert.match(saveFencingJob(job, replaced).error ?? "", /could not be verified|Recovery journal could not be staged/);
  });

  it("reports a failed readback and permits an explicit retry without mutating the open job", () => {
    const backing = new MemoryStorage(), job = createDefaultJob();
    const original = JSON.stringify(job);
    const unreadable = { getItem: () => { throw Error("Storage read denied"); }, setItem: backing.setItem.bind(backing), removeItem: backing.removeItem.bind(backing) };
    assert.equal(saveFencingJob(job, unreadable).ok, false);
    assert.equal(JSON.stringify(job), original);
    assert.equal(saveFencingJob(job, backing).ok, true);
    assert.deepEqual(loadFencingJob(backing).job, job);
  });

  it("rolls an interrupted project save back to the previous bytes on startup playback", () => {
    const storage = new MemoryStorage();
    const original = createDefaultJob("2026-09-22T00:00:00.000Z");
    const first = saveFencingJob(original, storage);
    assert.equal(first.ok, true);
    const previous = storage.getItem(FENCING_JOB_STORAGE_KEY);
    const edited = { ...original, name: "Interrupted edit" };
    const interrupted = saveFencingJob(edited, storage, {
      expectedRaw: previous,
      beforeCommit: () => { throw Error("process stopped"); },
    });
    assert.equal(interrupted.ok, false);
    assert.match(interrupted.error ?? "", /interrupted before its recovery journal committed/);
    assert.equal(storage.getItem(FENCING_JOB_STORAGE_KEY)?.includes("Interrupted edit"), true);
    const played = recoverStoredJournal(storage);
    assert.equal(played.status, "rolled-back");
    assert.equal(storage.getItem(FENCING_JOB_STORAGE_KEY), previous);
    assert.equal(loadFencingJob(storage).job?.name, original.name);
  });
});
