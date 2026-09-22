import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDefaultJob, parseFencingJob } from "./domain.ts";
import { FENCING_JOB_STORAGE_KEY, loadFencingJob, saveFencingJob } from "./persistence.ts";
import { RECOVERY_JOURNAL_STORAGE_KEY } from "./persistence/recoveryJournal.ts";
import {
  ASSISTANT_PROJECT_TABS_KEY,
  MAX_PROJECT_TABS,
  PROJECT_REGISTRY_KEY,
  PROJECT_SHELF_PREFIX,
  applySwitchRemoves,
  applySwitchRollback,
  applySwitchWrites,
  closeTab,
  emptyRegistry,
  entriesNewestFirst,
  hasShelvedJob,
  nextTabAfterClose,
  normalizeTabs,
  openTab,
  parseRegistry,
  peekShelvedJobText,
  planProjectSwitch,
  readRegistry,
  readTabs,
  removeEntry,
  shelfKey,
  shelveJobText,
  takeShelvedJobText,
  upsertEntry,
  writeRegistry,
  writeTabs,
  type ProjectRegistry,
} from "./projectRegistry.ts";

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
  keys() {
    return [...this.values.keys()];
  }
}

const summary = (id: string, updatedAt: string, name = id, revision = 1) => ({ id, name, updatedAt, revision });
const registryOf = (...entries: ReturnType<typeof summary>[]): ProjectRegistry => ({
  schema: "xray.projects/v1",
  entries,
});

describe("project registry parsing", () => {
  it("returns an empty registry for junk, foreign schemas and non-array entries", () => {
    for (const text of [null, undefined, "", "bad", "[]", "42", "{}", '{"schema":"other","entries":[]}', '{"schema":"xray.projects/v1","entries":"x"}'])
      assert.deepEqual(parseRegistry(text), emptyRegistry(), `text: ${String(text)}`);
  });
  it("keeps valid entries, drops malformed ones and de-duplicates ids (first wins)", () => {
    const text = JSON.stringify({
      schema: "xray.projects/v1",
      entries: [
        summary("job-a", "2026-01-01T00:00:00.000Z", "A", 3),
        { id: "job-b", name: "", updatedAt: "2026-01-01T00:00:00.000Z", revision: 1 },
        { id: "job-c", name: "C", updatedAt: "not a date", revision: 1 },
        { id: "job-d", name: "D", updatedAt: "2026-01-01T00:00:00.000Z", revision: 0 },
        summary("job-a", "2026-02-01T00:00:00.000Z", "A later", 4),
        "junk",
        null,
        { id: "job-e", name: "E", updatedAt: "2026-01-02T00:00:00.000Z", revision: 2, extra: true },
      ],
    });
    assert.deepEqual(parseRegistry(text), registryOf(summary("job-a", "2026-01-01T00:00:00.000Z", "A", 3), summary("job-e", "2026-01-02T00:00:00.000Z", "E", 2)));
  });
  it("round-trips through injected storage and survives a throwing getItem", () => {
    const storage = new MemoryStorage();
    assert.deepEqual(readRegistry(storage), emptyRegistry());
    const registry = registryOf(summary("job-a", "2026-01-01T00:00:00.000Z"));
    const text = writeRegistry(storage, registry);
    assert.equal(storage.getItem(PROJECT_REGISTRY_KEY), text);
    assert.deepEqual(readRegistry(storage), registry);
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem() {}, removeItem() {} };
    assert.deepEqual(readRegistry(broken), emptyRegistry());
  });
});

describe("project registry entries", () => {
  it("upserts in place, appends new ids, and returns the same object when nothing changes", () => {
    const a = summary("job-a", "2026-01-01T00:00:00.000Z", "A");
    const b = summary("job-b", "2026-03-01T00:00:00.000Z", "B");
    let registry = upsertEntry(upsertEntry(emptyRegistry(), a), b);
    assert.deepEqual(registry.entries.map((e) => e.id), ["job-a", "job-b"]);
    assert.equal(upsertEntry(registry, a), registry, "unchanged upsert is referentially stable");
    registry = upsertEntry(registry, { ...a, name: "A renamed", revision: 2, updatedAt: "2026-04-01T00:00:00.000Z" });
    assert.deepEqual(registry.entries.map((e) => [e.id, e.name, e.revision]), [["job-a", "A renamed", 2], ["job-b", "B", 1]]);
    assert.throws(() => upsertEntry(registry, { id: "", name: "x", revision: 1, updatedAt: "2026-04-01T00:00:00.000Z" }), /incomplete/);
  });
  it("orders newest first with deterministic tie-breaks and removes by id", () => {
    const registry = registryOf(
      summary("job-old", "2026-01-01T00:00:00.000Z", "Old"),
      summary("job-tie-b", "2026-02-01T00:00:00.000Z", "Tie"),
      summary("job-new", "2026-03-01T00:00:00.000Z", "New"),
      summary("job-tie-a", "2026-02-01T00:00:00.000Z", "Tie"),
    );
    assert.deepEqual(entriesNewestFirst(registry).map((e) => e.id), ["job-new", "job-tie-a", "job-tie-b", "job-old"]);
    assert.deepEqual(registry.entries.map((e) => e.id), ["job-old", "job-tie-b", "job-new", "job-tie-a"], "sorting never mutates the registry");
    assert.equal(removeEntry(registry, "job-missing"), registry);
    assert.deepEqual(removeEntry(registry, "job-new").entries.map((e) => e.id), ["job-old", "job-tie-b", "job-tie-a"]);
  });
});

describe("project shelf", () => {
  it("parks exact bytes under the prefixed key and hands them back once", () => {
    const storage = new MemoryStorage();
    const raw = JSON.stringify(createDefaultJob());
    assert.equal(hasShelvedJob(storage, "job-a"), false);
    shelveJobText(storage, "job-a", raw);
    assert.equal(shelfKey("job-a"), `${PROJECT_SHELF_PREFIX}job-a`);
    assert.equal(storage.getItem(`${PROJECT_SHELF_PREFIX}job-a`), raw);
    assert.equal(hasShelvedJob(storage, "job-a"), true);
    assert.equal(peekShelvedJobText(storage, "job-a"), raw, "peek is non-destructive");
    assert.equal(hasShelvedJob(storage, "job-a"), true);
    assert.equal(takeShelvedJobText(storage, "job-a"), raw);
    assert.equal(hasShelvedJob(storage, "job-a"), false);
    assert.equal(takeShelvedJobText(storage, "job-a"), null);
    assert.throws(() => shelveJobText(storage, "job-a", ""), /empty/);
    assert.throws(() => shelfKey(""), /project id/);
  });
});

describe("project switch planner", () => {
  const openJob = () => createDefaultJob("2026-05-01T00:00:00.000Z");

  it("switches to a shelved project: shelves the open bytes, indexes both, frees the target shelf", () => {
    const current = openJob();
    const target = { ...createDefaultJob("2026-04-01T00:00:00.000Z"), name: "Rear fence" };
    const currentRaw = JSON.stringify(current);
    const shelved = JSON.stringify(target);
    const plan = planProjectSwitch({ currentJob: current, currentRaw, targetId: target.id, registry: emptyRegistry(), shelvedTargetText: shelved, createJobText: () => { throw new Error("must not create"); } });
    assert.equal(plan.kind, "switch");
    assert.equal(plan.targetId, target.id);
    assert.equal(plan.nextMainText, shelved);
    assert.deepEqual(plan.writes[0], { key: shelfKey(current.id), value: currentRaw });
    assert.equal(plan.writes[1].key, PROJECT_REGISTRY_KEY);
    assert.deepEqual(parseRegistry(plan.writes[1].value), plan.registry);
    assert.deepEqual(plan.removes, [shelfKey(target.id)]);
    assert.deepEqual(entriesNewestFirst(plan.registry).map((e) => [e.id, e.name]), [[current.id, "New project"], [target.id, "Rear fence"]]);
    assert.deepEqual(plan.rollback, { writes: [{ key: PROJECT_REGISTRY_KEY, value: JSON.stringify(emptyRegistry()) }], removes: [shelfKey(current.id)] });
  });

  it("creates a new project: no shelf to free, fresh id indexed alongside the shelved current one", () => {
    const current = openJob();
    const fresh = createDefaultJob("2026-06-01T00:00:00.000Z");
    let created = 0;
    const plan = planProjectSwitch({ currentJob: current, currentRaw: JSON.stringify(current), targetId: null, registry: emptyRegistry(), shelvedTargetText: null, createJobText: () => { created += 1; return JSON.stringify(fresh); } });
    assert.equal(created, 1);
    assert.equal(plan.kind, "new");
    assert.equal(plan.targetId, fresh.id);
    assert.equal(plan.nextMainText, JSON.stringify(fresh));
    assert.deepEqual(plan.removes, []);
    assert.deepEqual(plan.registry.entries.map((e) => e.id), [current.id, fresh.id]);
  });

  it("refuses to switch to itself, to an unknown target, or with mismatched or missing bytes", () => {
    const current = openJob();
    const currentRaw = JSON.stringify(current);
    const base = { currentJob: current, currentRaw, registry: emptyRegistry(), createJobText: () => JSON.stringify(createDefaultJob()) };
    assert.throws(() => planProjectSwitch({ ...base, targetId: current.id, shelvedTargetText: currentRaw }), /already open/);
    assert.throws(() => planProjectSwitch({ ...base, targetId: "job-ghost", shelvedTargetText: null }), /no shelved record/);
    assert.throws(() => planProjectSwitch({ ...base, targetId: "job-ghost", shelvedTargetText: JSON.stringify(createDefaultJob()) }), /belongs to project/);
    assert.throws(() => planProjectSwitch({ ...base, targetId: "job-ghost", shelvedTargetText: "{broken" }), /not valid JSON/);
    assert.throws(() => planProjectSwitch({ ...base, currentRaw: "", targetId: null, shelvedTargetText: null }), /Save it first/);
    assert.throws(() => planProjectSwitch({ ...base, currentRaw: JSON.stringify(createDefaultJob()), targetId: null, shelvedTargetText: null }), /not the open project/);
    assert.throws(() => planProjectSwitch({ ...base, targetId: null, shelvedTargetText: null, createJobText: () => currentRaw }), /fresh id/);
    const listed = createDefaultJob();
    assert.throws(() => planProjectSwitch({ ...base, registry: upsertEntry(emptyRegistry(), listed), targetId: null, shelvedTargetText: null, createJobText: () => JSON.stringify(listed) }), /already listed/);
  });

  it("applies against the real compare-and-swap main key and restores byte-identical projects on the way back", () => {
    const storage = new MemoryStorage();
    const first = { ...createDefaultJob("2026-05-01T00:00:00.000Z"), name: "Front fence" };
    const saved = saveFencingJob(first, storage);
    assert.equal(saved.ok, true);
    const firstRaw = saved.raw!;

    // Open a brand-new project.
    const toNew = planProjectSwitch({ currentJob: first, currentRaw: firstRaw, targetId: null, registry: readRegistry(storage), shelvedTargetText: null, createJobText: () => JSON.stringify(createDefaultJob("2026-06-01T00:00:00.000Z")) });
    applySwitchWrites(storage, toNew);
    const newSave = saveFencingJob(parseFencingJob(JSON.parse(toNew.nextMainText)), storage, { expectedRaw: firstRaw });
    assert.equal(newSave.ok, true);
    applySwitchRemoves(storage, toNew);
    assert.equal(storage.getItem(shelfKey(first.id)), firstRaw, "the open project is parked byte-for-byte");
    assert.equal(loadFencingJob(storage).job?.id, toNew.targetId);
    assert.deepEqual(readRegistry(storage).entries.map((e) => e.id), [first.id, toNew.targetId]);

    // Switch back to the first project.
    const secondRaw = newSave.raw!;
    const back = planProjectSwitch({ currentJob: loadFencingJob(storage).job!, currentRaw: secondRaw, targetId: first.id, registry: readRegistry(storage), shelvedTargetText: peekShelvedJobText(storage, first.id), createJobText: () => { throw new Error("unused"); } });
    applySwitchWrites(storage, back);
    const backSave = saveFencingJob(parseFencingJob(JSON.parse(back.nextMainText)), storage, { expectedRaw: secondRaw });
    assert.equal(backSave.ok, true);
    applySwitchRemoves(storage, back);
    assert.equal(storage.getItem(FENCING_JOB_STORAGE_KEY), firstRaw, "the first project comes back byte-identical");
    assert.equal(hasShelvedJob(storage, first.id), false);
    assert.equal(storage.getItem(shelfKey(toNew.targetId)), secondRaw);
    assert.deepEqual(storage.keys().sort(), [FENCING_JOB_STORAGE_KEY, PROJECT_REGISTRY_KEY, RECOVERY_JOURNAL_STORAGE_KEY, shelfKey(toNew.targetId)].sort());
    assert.equal(JSON.parse(storage.getItem(RECOVERY_JOURNAL_STORAGE_KEY)!).projectId, first.id, "the committed journal follows the project saved last");
  });

  it("leaves the main key alone when the compare-and-swap is stale and the rollback undoes its writes", () => {
    const storage = new MemoryStorage();
    const first = createDefaultJob("2026-05-01T00:00:00.000Z");
    const firstRaw = saveFencingJob(first, storage).raw!;
    const plan = planProjectSwitch({ currentJob: first, currentRaw: firstRaw, targetId: null, registry: readRegistry(storage), shelvedTargetText: null, createJobText: () => JSON.stringify(createDefaultJob()) });
    applySwitchWrites(storage, plan);
    // Another window saved a newer revision in between.
    const foreign = saveFencingJob({ ...first, revision: 2, name: "Edited elsewhere" }, storage).raw!;
    const attempt = saveFencingJob(parseFencingJob(JSON.parse(plan.nextMainText)), storage, { expectedRaw: firstRaw });
    assert.equal(attempt.stale, true);
    assert.equal(storage.getItem(FENCING_JOB_STORAGE_KEY), foreign);
    applySwitchRollback(storage, plan);
    assert.equal(hasShelvedJob(storage, first.id), false);
    assert.deepEqual(readRegistry(storage), emptyRegistry());
  });
});

describe("assistant project tabs", () => {
  it("reads junk as no tabs and normalizes stored lists", () => {
    const storage = new MemoryStorage();
    assert.deepEqual(readTabs(storage), []);
    for (const text of ["bad", "{}", "42", '["a", 3, null, "", "a", "b"]']) {
      storage.setItem(ASSISTANT_PROJECT_TABS_KEY, text);
      assert.deepEqual(readTabs(storage), text.startsWith("[") ? ["a", "b"] : []);
    }
    assert.deepEqual(writeTabs(storage, ["b", "a", "b"]), ["b", "a"]);
    assert.equal(storage.getItem(ASSISTANT_PROJECT_TABS_KEY), '["b","a"]');
  });
  it("opens without moving existing tabs, closes, and picks the neighbour to focus", () => {
    let tabs = openTab([], "job-a");
    tabs = openTab(tabs, "job-b");
    tabs = openTab(tabs, "job-c");
    assert.deepEqual(tabs, ["job-a", "job-b", "job-c"]);
    assert.equal(openTab(tabs, "job-a"), tabs, "re-opening keeps order and identity");
    assert.equal(normalizeTabs(tabs), tabs);
    assert.deepEqual(closeTab(tabs, "job-b"), ["job-a", "job-c"]);
    assert.equal(closeTab(tabs, "job-zzz"), tabs);
    assert.equal(nextTabAfterClose(tabs, "job-b"), "job-c");
    assert.equal(nextTabAfterClose(tabs, "job-c"), "job-b");
    assert.equal(nextTabAfterClose(["job-a"], "job-a"), null);
    assert.equal(nextTabAfterClose(tabs, "job-zzz"), null);
    assert.throws(() => openTab(tabs, ""), /project id/);
  });
  it(`caps at ${MAX_PROJECT_TABS} tabs by evicting the oldest`, () => {
    let tabs: string[] = [];
    for (let i = 0; i < MAX_PROJECT_TABS; i += 1) tabs = openTab(tabs, `job-${i}`);
    assert.equal(tabs.length, MAX_PROJECT_TABS);
    const overflow = openTab(tabs, "job-extra");
    assert.equal(overflow.length, MAX_PROJECT_TABS);
    assert.equal(overflow[0], "job-1");
    assert.equal(overflow.at(-1), "job-extra");
    assert.equal(normalizeTabs([...tabs, "job-x", "job-y"]).length, MAX_PROJECT_TABS);
  });
});
