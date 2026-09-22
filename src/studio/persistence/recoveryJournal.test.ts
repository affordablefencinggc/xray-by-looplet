import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  RECOVERY_BEFORE_STORAGE_KEY,
  RECOVERY_JOURNAL_SCHEMA,
  RECOVERY_JOURNAL_STORAGE_KEY,
  commitStagedWrite,
  digestText,
  emptyRecoveryJournal,
  parseRecoveryJournal,
  playbackRecoveryJournal,
  recoverStoredJournal,
  stageJournalledWrite,
  type JournalEntry,
  type JournalStorage,
} from "./recoveryJournal.ts";

const PROJECT = "project-1";
const NOW = new Date("2026-09-22T00:00:00.000Z");
const LATER = new Date("2026-09-22T00:00:01.000Z");

class MemoryStorage implements JournalStorage {
  readonly map = new Map<string, string>();
  getItem(key: string) { return this.map.has(key) ? this.map.get(key)! : null; }
  setItem(key: string, value: string) { this.map.set(key, value); }
  removeItem(key: string) { this.map.delete(key); }
}

function entry(sequence: number, committedAt: string | null, targetKey = `key-${sequence}`, text = `value-${sequence}`): JournalEntry {
  const before = sequence === 1 ? null : `before-${sequence}`;
  return {
    format: RECOVERY_JOURNAL_SCHEMA,
    sequence,
    operation: "save-project",
    targetKey,
    beforeSha256: before === null ? null : digestText(before),
    afterSha256: digestText(text),
    startedAt: NOW.toISOString(),
    committedAt,
  };
}

describe("SC-16 recovery journal", () => {
  it("B3 rejects a journal whose sequences go backwards", async () => {
    const journal = {
      ...emptyRecoveryJournal(PROJECT),
      entries: [entry(1, NOW.toISOString()), entry(3, NOW.toISOString()), entry(2, NOW.toISOString())],
    };
    await assert.rejects(async () => parseRecoveryJournal(journal), /strictly increase/);
  });

  it("B4 rejects two uncommitted entries", async () => {
    const journal = { ...emptyRecoveryJournal(PROJECT), entries: [entry(1, null), entry(2, null)] };
    await assert.rejects(async () => parseRecoveryJournal(journal), /more than one uncommitted/);
  });

  it("B8 rolls back the in-flight save and leaves the committed entry", () => {
    const storage = new MemoryStorage();
    const committed = entry(1, NOW.toISOString(), "kept", "kept-after");
    const staged = stageJournalledWrite({
      storage, projectId: PROJECT, operation: "save-project", targetKey: "draft", next: "new-draft", now: LATER,
    });
    assert.equal(staged.status, "staged");
    commitStagedWrite(storage, LATER);
    storage.setItem("kept", "kept-after");
    const second = stageJournalledWrite({
      storage, projectId: PROJECT, operation: "save-project", targetKey: "draft", next: "crashed-draft", now: new Date("2026-09-22T00:00:02.000Z"),
    });
    assert.equal(second.status, "staged");
    assert.equal(storage.getItem("draft"), "crashed-draft");
    const played = recoverStoredJournal(storage);
    assert.equal(played.status, "rolled-back");
    if (played.status !== "rolled-back") return;
    assert.equal(storage.getItem("draft"), "new-draft");
    assert.equal(storage.getItem("kept"), "kept-after");
    assert.equal(played.journal.entries.length, 1);
    assert.equal(played.journal.entries[0].committedAt, LATER.toISOString());
    assert.equal(played.journal.entries[0].targetKey, "draft");
    assert.equal(storage.getItem(RECOVERY_BEFORE_STORAGE_KEY), null);
    assert.equal(committed.targetKey, "kept");
    const again = recoverStoredJournal(storage);
    assert.equal(again.status, "clean");
  });

  it("B9 quarantines two in-flight entries and does not change stored bytes", () => {
    const storage = new MemoryStorage();
    storage.setItem("draft", "untouched");
    const raw = { ...emptyRecoveryJournal(PROJECT), entries: [entry(1, null, "draft", "one"), entry(2, null, "draft", "two")] };
    storage.setItem(RECOVERY_JOURNAL_STORAGE_KEY, JSON.stringify(raw));
    const calls: string[] = [];
    const played = playbackRecoveryJournal(raw, null, (key) => {
      calls.push(key);
      return storage.getItem(key);
    });
    assert.equal(played.status, "quarantined");
    if (played.status === "quarantined") assert.match(played.reason, /more than one uncommitted/);
    assert.deepEqual(calls, []);
    const recovered = recoverStoredJournal(storage);
    assert.equal(recovered.status, "quarantined");
    assert.equal(storage.getItem("draft"), "untouched");
    assert.equal(storage.getItem(RECOVERY_JOURNAL_STORAGE_KEY), JSON.stringify(raw));
  });

  it("refuses a second staged write while one save is in flight", () => {
    const storage = new MemoryStorage();
    assert.equal(stageJournalledWrite({
      storage, projectId: PROJECT, operation: "save-project", targetKey: "draft", next: "first", now: NOW,
    }).status, "staged");
    const second = stageJournalledWrite({
      storage, projectId: PROJECT, operation: "save-project", targetKey: "draft", next: "second", now: LATER,
    });
    assert.equal(second.status, "quarantined");
    assert.equal(storage.getItem("draft"), "first");
  });

  it("moves a fully committed journal to the next project saved, but refuses while another project's save is in flight", () => {
    const storage = new MemoryStorage();
    stageJournalledWrite({ storage, projectId: PROJECT, operation: "save-project", targetKey: "main", next: "a", now: NOW });
    const other = { storage, projectId: "project-2", operation: "save-project", targetKey: "main", next: "b", now: LATER };
    const blocked = stageJournalledWrite(other);
    assert.deepEqual(blocked, { status: "quarantined", reason: "Recovery journal belongs to another project. The target was not written." });
    assert.equal(storage.getItem("main"), "a");
    commitStagedWrite(storage, NOW);
    const moved = stageJournalledWrite(other);
    assert.equal(moved.status, "staged");
    assert.equal(storage.getItem("main"), "b");
    const journal = parseRecoveryJournal(JSON.parse(storage.getItem(RECOVERY_JOURNAL_STORAGE_KEY)!));
    assert.equal(journal.projectId, "project-2");
    assert.deepEqual(journal.entries.map((item) => [item.sequence, item.committedAt]), [[1, null]]);
    assert.equal(recoverStoredJournal(storage).status, "rolled-back");
    assert.equal(storage.getItem("main"), "a", "an interrupted save of the new project still rolls back to the old bytes");
  });
});
