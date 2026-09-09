import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDefaultJob, parseFencingJob, type FencingJob } from "../domain.ts";
import { FENCING_JOB_STORAGE_KEY, saveFencingJob } from "../persistence.ts";
import {
  ASSISTANT_PROJECT_TABS_KEY,
  PROJECT_REGISTRY_KEY,
  readRegistry,
  readTabs,
  shelfKey,
  upsertEntry,
  emptyRegistry,
  writeRegistry,
  writeTabs,
} from "../projectRegistry.ts";
import {
  SWITCH_BUSY_MESSAGE,
  SWITCH_NOT_READY_MESSAGE,
  defaultProjectText,
  listProjects,
  resolveTabs,
  switchProject,
  type ProjectSwitchDeps,
  type ProjectSwitchStoreState,
} from "./projectSwitch.ts";

class MemoryStorage {
  private values = new Map<string, string>();
  log: string[] = [];
  failSetItem: RegExp | null = null;
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.failSetItem?.test(key)) throw new Error(`quota exceeded for ${key}`);
    this.log.push(`set ${key}`);
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.log.push(`remove ${key}`);
    this.values.delete(key);
  }
  keys() {
    return [...this.values.keys()].sort();
  }
}

/** Mirrors the store guards the switch relies on (store.ts saveCurrentProject / retryProjectLoad). */
class FakeStore {
  state: ProjectSwitchStoreState;
  log: string[] = [];
  reloadFails = false;
  private storage: MemoryStorage;
  constructor(job: FencingJob, storage: MemoryStorage, ready = true) {
    this.storage = storage;
    const raw = JSON.stringify(job);
    storage.setItem(FENCING_JOB_STORAGE_KEY, raw);
    storage.log = [];
    this.state = {
      job,
      persistenceHydrated: ready,
      persistenceRecoveryBlocked: !ready,
      hydrationStatus: ready ? "ready" : "loading",
      lastSavedJobRaw: raw,
      persistenceError: null,
      saveCurrentProject: () => {
        this.log.push("saveCurrentProject");
        const s = this.state;
        if (!s.persistenceHydrated || s.persistenceRecoveryBlocked || s.hydrationStatus !== "ready")
          return { ok: false, error: "Saved project recovery must finish before saving." };
        const result = saveFencingJob(s.job, this.storage, { expectedRaw: s.lastSavedJobRaw });
        if (result.ok) this.state = { ...s, lastSavedJobRaw: result.raw ?? null };
        else if (result.stale) this.state = { ...s, persistenceRecoveryBlocked: true, persistenceError: result.error };
        return result;
      },
      retryProjectLoad: async () => {
        this.log.push(`retryProjectLoad(blocked=${this.state.persistenceRecoveryBlocked})`);
        if (!this.state.persistenceRecoveryBlocked) return;
        if (this.reloadFails) {
          this.state = { ...this.state, hydrationStatus: "error", persistenceError: "The saved project is not valid JSON." };
          return;
        }
        const raw = this.storage.getItem(FENCING_JOB_STORAGE_KEY);
        assert.ok(raw, "main key must hold a project when re-hydrating");
        this.state = {
          ...this.state,
          job: parseFencingJob(JSON.parse(raw)),
          persistenceHydrated: true,
          persistenceRecoveryBlocked: false,
          hydrationStatus: "ready",
          lastSavedJobRaw: raw,
        };
      },
    };
  }
  getState = () => this.state;
  setState = (patch: { persistenceRecoveryBlocked: boolean }) => {
    this.log.push(`setState(${JSON.stringify(patch)})`);
    this.state = { ...this.state, ...patch };
  };
}

const job = (name: string, at: string) => ({ ...createDefaultJob(at), name });
const depsFor = (store: FakeStore, storage: MemoryStorage, extra: Partial<ProjectSwitchDeps> = {}): ProjectSwitchDeps => ({
  store,
  storage,
  saveJob: (target, options) => {
    storage.log.push(`saveJob ${target.id} expecting ${options.expectedRaw === null ? "empty" : "current"}`);
    return saveFencingJob(target, storage, options);
  },
  busy: false,
  ...extra,
});
/** A shelved target: exact bytes under its shelf key plus a registry entry, as a previous switch leaves them. */
function shelve(storage: MemoryStorage, target: FencingJob) {
  storage.setItem(shelfKey(target.id), JSON.stringify(target));
  writeRegistry(storage, upsertEntry(readRegistry(storage), target));
  storage.log = [];
}

describe("switchProject refusals", () => {
  it("refuses while the chat is busy without touching the store or storage", async () => {
    const storage = new MemoryStorage();
    const store = new FakeStore(job("Open", "2026-05-01T00:00:00.000Z"), storage);
    const result = await switchProject(null, depsFor(store, storage, { busy: true }));
    assert.deepEqual(result, { ok: false, stage: "busy", error: SWITCH_BUSY_MESSAGE });
    assert.deepEqual(store.log, []);
    assert.deepEqual(storage.log, []);
  });

  it("refuses while the store is not hydrated, blocked, or not ready", async () => {
    for (const patch of [
      { persistenceHydrated: false },
      { persistenceRecoveryBlocked: true },
      { hydrationStatus: "loading" },
      { hydrationStatus: "error" },
    ]) {
      const storage = new MemoryStorage();
      const store = new FakeStore(job("Open", "2026-05-01T00:00:00.000Z"), storage);
      store.state = { ...store.state, ...patch };
      const result = await switchProject(null, depsFor(store, storage));
      assert.deepEqual(result, { ok: false, stage: "not-ready", error: SWITCH_NOT_READY_MESSAGE }, JSON.stringify(patch));
      assert.deepEqual(store.log, [], JSON.stringify(patch));
      assert.deepEqual(storage.log, [], JSON.stringify(patch));
    }
  });

  it("refuses when saving the open project fails (stale main key) and writes nothing else", async () => {
    const storage = new MemoryStorage();
    const store = new FakeStore(job("Open", "2026-05-01T00:00:00.000Z"), storage);
    // Another window saved a newer revision: the CAS save inside saveCurrentProject is refused.
    storage.setItem(FENCING_JOB_STORAGE_KEY, JSON.stringify({ ...store.state.job, revision: 9 }));
    storage.log = [];
    const result = await switchProject(null, depsFor(store, storage));
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.stage, "save");
    assert.match(!result.ok ? result.error : "", /newer revision/);
    assert.deepEqual(store.log, ["saveCurrentProject"]);
    assert.deepEqual(storage.log, []);
    assert.deepEqual(storage.keys(), [FENCING_JOB_STORAGE_KEY]);
  });

  it("refuses an unknown or already-open target at the planning stage without writing", async () => {
    const storage = new MemoryStorage();
    const open = job("Open", "2026-05-01T00:00:00.000Z");
    const store = new FakeStore(open, storage);
    const missing = await switchProject("job-missing", depsFor(store, storage));
    assert.deepEqual(missing, { ok: false, stage: "plan", error: "Project job-missing has no shelved record to open." });
    const same = await switchProject(open.id, depsFor(store, storage));
    assert.deepEqual(same, { ok: false, stage: "plan", error: "This project is already open." });
    assert.deepEqual(storage.log, ["set " + FENCING_JOB_STORAGE_KEY, "set " + FENCING_JOB_STORAGE_KEY], "only the two saves of the open project");
    assert.deepEqual(storage.keys(), [FENCING_JOB_STORAGE_KEY]);
    assert.equal(store.state.job.id, open.id);
  });

  it("refuses a target whose bytes do not parse, before any storage write", async () => {
    const storage = new MemoryStorage();
    const store = new FakeStore(job("Open", "2026-05-01T00:00:00.000Z"), storage);
    const result = await switchProject(null, depsFor(store, storage, { createJobText: () => JSON.stringify({ ...createDefaultJob(), runs: "nope" }) }));
    assert.equal(!result.ok && result.stage, "plan");
    assert.deepEqual(storage.log, ["set " + FENCING_JOB_STORAGE_KEY]);
    assert.deepEqual(storage.keys(), [FENCING_JOB_STORAGE_KEY]);
  });
});

describe("switchProject rollback", () => {
  it("rolls the shelf and registry back when the main-key write is stale, and leaves the store alone", async () => {
    const storage = new MemoryStorage();
    const open = job("Open", "2026-05-01T00:00:00.000Z");
    const target = job("Rear fence", "2026-04-01T00:00:00.000Z");
    const store = new FakeStore(open, storage);
    shelve(storage, target);
    writeTabs(storage, ["job-other"]);
    const registryBefore = storage.getItem(PROJECT_REGISTRY_KEY);
    // The other window wins the race between saveCurrentProject and the main-key swap.
    let raced = false;
    const deps = depsFor(store, storage, {
      saveJob: (t, options) => {
        if (!raced) {
          raced = true;
          storage.setItem(FENCING_JOB_STORAGE_KEY, JSON.stringify({ ...open, revision: 7 }));
        }
        return saveFencingJob(t, storage, options);
      },
    });
    const result = await switchProject(target.id, deps);
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.stage, "main");
    assert.match(!result.ok ? result.error : "", /newer revision/);
    assert.equal(storage.getItem(shelfKey(open.id)), null, "the open project's shelf slot is removed again");
    assert.equal(storage.getItem(shelfKey(target.id)), JSON.stringify(target), "the target stays shelved");
    assert.equal(storage.getItem(PROJECT_REGISTRY_KEY), registryBefore, "the registry is restored");
    assert.deepEqual(readTabs(storage), ["job-other"], "tabs are untouched");
    assert.deepEqual(store.log, ["saveCurrentProject"], "no recovery block, no reload");
    assert.equal(store.state.job.id, open.id);
  });

  it("restores the shelf slot's previous bytes when the main-key write loses a race (two windows shelving the same project)", async () => {
    const storage = new MemoryStorage();
    const open = job("Open", "2026-05-01T00:00:00.000Z");
    const target = job("Rear fence", "2026-04-01T00:00:00.000Z");
    const store = new FakeStore(open, storage);
    shelve(storage, target);
    // Another window already shelved this same project a moment ago (identical bytes) and moved on.
    const otherWindowsCopy = JSON.stringify({ ...open, revision: 3 });
    storage.setItem(shelfKey(open.id), otherWindowsCopy);
    storage.log = [];
    let raced = false;
    const deps = depsFor(store, storage, {
      saveJob: (t, options) => {
        if (!raced) {
          raced = true;
          storage.setItem(FENCING_JOB_STORAGE_KEY, JSON.stringify({ ...open, revision: 7 }));
        }
        return saveFencingJob(t, storage, options);
      },
    });
    const result = await switchProject(target.id, deps);
    assert.equal(!result.ok && result.stage, "main");
    assert.equal(storage.getItem(shelfKey(open.id)), otherWindowsCopy, "the other window's shelf copy survives the lost race");
    assert.equal(storage.getItem(shelfKey(target.id)), JSON.stringify(target), "the target stays shelved");
    assert.deepEqual(store.log, ["saveCurrentProject"], "no recovery block, no reload");
  });

  it("rolls back when shelving itself throws (storage quota)", async () => {
    const storage = new MemoryStorage();
    const open = job("Open", "2026-05-01T00:00:00.000Z");
    const target = job("Rear fence", "2026-04-01T00:00:00.000Z");
    const store = new FakeStore(open, storage);
    shelve(storage, target);
    const registryBefore = storage.getItem(PROJECT_REGISTRY_KEY);
    storage.failSetItem = /project-shelf/;
    const result = await switchProject(target.id, depsFor(store, storage));
    assert.equal(!result.ok && result.stage, "write");
    assert.match(!result.ok ? result.error : "", /quota exceeded/);
    assert.equal(storage.getItem(PROJECT_REGISTRY_KEY), registryBefore);
    assert.equal(storage.getItem(FENCING_JOB_STORAGE_KEY), store.state.lastSavedJobRaw, "main key still holds the open project");
    assert.deepEqual(store.log, ["saveCurrentProject"]);
  });
});

describe("switchProject success", () => {
  it("opens a shelved project in order: save → shelve+index → CAS main key → free shelf → tab → index → block → reload", async () => {
    const storage = new MemoryStorage();
    const open = job("Open", "2026-05-01T00:00:00.000Z");
    const target = job("Rear fence", "2026-04-01T00:00:00.000Z");
    const store = new FakeStore(open, storage);
    shelve(storage, target);
    const result = await switchProject(target.id, depsFor(store, storage));
    assert.equal(result.ok, true, JSON.stringify(result));
    if (!result.ok) return;
    assert.equal(result.kind, "switch");
    assert.deepEqual(result.target, { id: target.id, name: "Rear fence", updatedAt: target.updatedAt, revision: 1 });
    assert.deepEqual(result.tabs, [target.id]);
    assert.deepEqual(storage.log, [
      `set ${FENCING_JOB_STORAGE_KEY}`, // saveCurrentProject
      `set ${shelfKey(open.id)}`,
      `set ${PROJECT_REGISTRY_KEY}`,
      `saveJob ${target.id} expecting current`,
      `set ${FENCING_JOB_STORAGE_KEY}`,
      `remove ${shelfKey(target.id)}`,
      `set ${ASSISTANT_PROJECT_TABS_KEY}`,
      `set ${PROJECT_REGISTRY_KEY}`,
    ]);
    assert.deepEqual(store.log, ["saveCurrentProject", 'setState({"persistenceRecoveryBlocked":true})', "retryProjectLoad(blocked=true)"]);
    assert.equal(store.state.job.id, target.id, "the store now holds the target");
    assert.equal(store.state.job.name, "Rear fence");
    assert.equal(store.state.lastSavedJobRaw, storage.getItem(FENCING_JOB_STORAGE_KEY));
    assert.equal(storage.getItem(shelfKey(open.id)), JSON.stringify(open), "the previously open project is shelved byte-for-byte");
    assert.equal(storage.getItem(shelfKey(target.id)), null);
    assert.deepEqual(readRegistry(storage).entries.map((e) => [e.id, e.name]), [[target.id, "Rear fence"], [open.id, "Open"]]);
    assert.deepEqual(readTabs(storage), [target.id]);
    assert.deepEqual(storage.keys(), [ASSISTANT_PROJECT_TABS_KEY, FENCING_JOB_STORAGE_KEY, PROJECT_REGISTRY_KEY, shelfKey(open.id)].sort());
  });

  it("creates a new project with the bytes saveFencingJob would write, and switching back restores the first", async () => {
    const storage = new MemoryStorage();
    const open = job("Open", "2026-05-01T00:00:00.000Z");
    const store = new FakeStore(open, storage);
    const created = await switchProject(null, depsFor(store, storage));
    assert.equal(created.ok, true, JSON.stringify(created));
    if (!created.ok) return;
    assert.equal(created.kind, "new");
    assert.equal(created.target.name, "New project");
    assert.notEqual(created.target.id, open.id);
    assert.equal(store.state.job.id, created.target.id);
    const newRaw = storage.getItem(FENCING_JOB_STORAGE_KEY);
    assert.equal(newRaw, JSON.stringify(store.state.job), "main key holds the parsed new job");
    assert.deepEqual(readTabs(storage), [created.target.id]);
    // Back to the first project: its shelf bytes come back unchanged and the new one is shelved byte-for-byte.
    const back = await switchProject(open.id, depsFor(store, storage));
    assert.equal(back.ok, true, JSON.stringify(back));
    assert.equal(store.state.job.id, open.id);
    assert.equal(store.state.job.name, "Open");
    assert.equal(storage.getItem(FENCING_JOB_STORAGE_KEY), JSON.stringify(open));
    assert.equal(storage.getItem(shelfKey(created.target.id)), newRaw);
    assert.equal(storage.getItem(shelfKey(open.id)), null);
    assert.deepEqual(readTabs(storage), [created.target.id, open.id], "tabs keep insertion order");
    assert.deepEqual(readRegistry(storage).entries.map((e) => e.name).sort(), ["New project", "Open"]);
    // The default text is exactly what persistence writes for the same job.
    const now = "2026-06-01T00:00:00.000Z";
    const fresh = JSON.parse(defaultProjectText(now));
    const viaPersistence = new MemoryStorage();
    saveFencingJob(parseFencingJob(fresh), viaPersistence);
    assert.equal(viaPersistence.getItem(FENCING_JOB_STORAGE_KEY), JSON.stringify(fresh));
  });

  it("reports a reload failure after the storage swap committed", async () => {
    const storage = new MemoryStorage();
    const open = job("Open", "2026-05-01T00:00:00.000Z");
    const target = job("Rear fence", "2026-04-01T00:00:00.000Z");
    const store = new FakeStore(open, storage);
    shelve(storage, target);
    store.reloadFails = true;
    const result = await switchProject(target.id, depsFor(store, storage));
    assert.deepEqual(result, { ok: false, stage: "reload", error: "The saved project is not valid JSON." });
    assert.equal(storage.getItem(FENCING_JOB_STORAGE_KEY), JSON.stringify(target), "the swap stays committed for the recovery flow");
    assert.deepEqual(store.log, ["saveCurrentProject", 'setState({"persistenceRecoveryBlocked":true})', "retryProjectLoad(blocked=true)"]);
  });
});

describe("project rows and tabs", () => {
  const registry = () =>
    upsertEntry(
      upsertEntry(upsertEntry(emptyRegistry(), { id: "job-a", name: "A", revision: 1, updatedAt: "2026-01-01T00:00:00.000Z" }), {
        id: "job-b",
        name: "B",
        revision: 2,
        updatedAt: "2026-03-01T00:00:00.000Z",
      }),
      { id: "job-c", name: "C stale", revision: 1, updatedAt: "2026-02-01T00:00:00.000Z" },
    );

  it("lists the open project first with its live name, then the rest newest first", () => {
    const rows = listProjects(registry(), { id: "job-c", name: "C live", updatedAt: "2026-04-01T00:00:00.000Z" });
    assert.deepEqual(rows, [
      { id: "job-c", name: "C live", updatedAt: "2026-04-01T00:00:00.000Z", current: true },
      { id: "job-b", name: "B", updatedAt: "2026-03-01T00:00:00.000Z", current: false },
      { id: "job-a", name: "A", updatedAt: "2026-01-01T00:00:00.000Z", current: false },
    ]);
    const unindexed = listProjects(registry(), { id: "job-new", name: "New", updatedAt: "2026-05-01T00:00:00.000Z" });
    assert.deepEqual(unindexed.map((r) => [r.id, r.current]), [["job-new", true], ["job-b", false], ["job-c", false], ["job-a", false]]);
  });

  it("resolves tab names and drops ids that are neither open nor indexed", () => {
    const tabs = resolveTabs(["job-b", "job-open", "job-ghost", "job-a"], registry(), { id: "job-open", name: "Open" });
    assert.deepEqual(tabs, [
      { id: "job-b", name: "B" },
      { id: "job-open", name: "Open" },
      { id: "job-a", name: "A" },
    ]);
  });
});
