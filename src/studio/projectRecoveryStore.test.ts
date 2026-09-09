import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { createDefaultJob } from "./domain.ts";
import { FENCING_JOB_STORAGE_KEY } from "./persistence.ts";

const data = new Map<string, string>();
let denyRead = false, denyWrite = false, dropWrite = false;
let writes = 0;
const storage = {
  getItem(key: string) { if (denyRead) throw Error("Storage unavailable"); return data.get(key) ?? null; },
  setItem(key: string, value: string) {
    writes++;
    if (denyWrite) throw Error("Quota exceeded");
    if (!dropWrite) data.set(key, value);
  },
  removeItem(key: string) { data.delete(key); },
};
const windowListeners: Record<string, ((event: unknown) => void)[]> = {};
const fakeWindow = {
  localStorage: storage,
  addEventListener(type: string, listener: (event: unknown) => void) { (windowListeners[type] ??= []).push(listener); },
};
Object.defineProperty(globalThis, "window", { configurable: true, value: fakeWindow });
const { useStudio, resetStudioHydrationForTests } = await import("./store.ts");
/** Simulate the browser's cross-window 'storage' event: another window already wrote the bytes. */
function otherWindowWrites(key: string, newValue: string | null) {
  const oldValue = data.get(key) ?? null;
  if (newValue === null) data.delete(key); else data.set(key, newValue);
  for (const listener of windowListeners.storage ?? []) listener({ key, newValue, oldValue, storageArea: storage });
}
function foreignRevisionOf(raw: string, name: string) {
  const parsed = JSON.parse(raw);
  return JSON.stringify({ ...parsed, name, revision: parsed.revision + 1 });
}
beforeEach(() => {
  resetStudioHydrationForTests(); useStudio.setState(useStudio.getInitialState(), true);
  data.clear(); denyRead = false; denyWrite = false; dropWrite = false; writes = 0;
});

for (const payload of ["{unreadable", JSON.stringify({ ...createDefaultJob(), schemaVersion: 999 })]) {
  test("failed hydration preserves the original through edits, error clearing and explicit save: " + payload.slice(0, 18), async () => {
    data.set(FENCING_JOB_STORAGE_KEY, payload);
    await useStudio.getState().hydratePersistence();
    assert.equal(useStudio.getState().persistenceRecoveryBlocked, true);
    useStudio.getState().updateJobName("An edit after failed loading");
    useStudio.setState({ persistenceError: null });
    assert.equal(useStudio.getState().saveCurrentProject().ok, false);
    assert.equal(data.get(FENCING_JOB_STORAGE_KEY), payload);
    assert.equal(writes, 0, "Neither main job nor dependent autosaves may write after failed hydration");
    assert.equal(useStudio.getState().lastSavedJobRevision, null);
  });
}

test("read failure remains blocked, then retry restores the original identity before allowing saves", async () => {
  const job = createDefaultJob(); job.name = "Recovered architectural project";
  data.set(FENCING_JOB_STORAGE_KEY, JSON.stringify(job)); denyRead = true;
  await useStudio.getState().hydratePersistence();
  assert.equal(useStudio.getState().persistenceRecoveryBlocked, true);
  assert.equal(writes, 0);
  denyRead = false;
  await useStudio.getState().retryProjectLoad();
  assert.equal(useStudio.getState().job.id, job.id);
  assert.equal(useStudio.getState().job.name, job.name);
  assert.equal(useStudio.getState().persistenceRecoveryBlocked, false);
  useStudio.getState().updateJobName("Verified after retry");
  assert.equal(JSON.parse(data.get(FENCING_JOB_STORAGE_KEY)!).name, "Verified after retry");
  assert.equal(useStudio.getState().lastSavedJobRevision, useStudio.getState().job.revision);
});

test("quota and silent-write failures retain the in-memory edit, explicit retry persists it across reopen", async () => {
  await useStudio.getState().hydratePersistence();
  const before = data.get(FENCING_JOB_STORAGE_KEY), savedRevision = useStudio.getState().lastSavedJobRevision;
  assert.equal(useStudio.getState().lastSavedJobRaw, before, "hydration tracks the bytes it loaded");
  denyWrite = true;
  useStudio.getState().updateJobName("Unsaved design revision");
  assert.equal(data.get(FENCING_JOB_STORAGE_KEY), before, "stored bytes are byte-identical during the quota failure");
  assert.equal(useStudio.getState().job.name, "Unsaved design revision");
  assert.equal(useStudio.getState().lastSavedJobRevision, savedRevision);
  assert.equal(useStudio.getState().lastSavedJobRaw, before);
  assert.equal(useStudio.getState().projectWriteStale, false, "a quota failure is not a stale write");
  assert.equal(useStudio.getState().persistenceRecoveryBlocked, false, "retry remains available");
  assert.match(useStudio.getState().persistenceError ?? "", /Quota/);
  denyWrite = false; dropWrite = true;
  assert.equal(useStudio.getState().saveCurrentProject().ok, false);
  assert.match(useStudio.getState().persistenceError ?? "", /verified/);
  assert.equal(data.get(FENCING_JOB_STORAGE_KEY), before, "stored bytes are byte-identical during the silent-write failure");
  assert.equal(useStudio.getState().lastSavedJobRaw, before);
  dropWrite = false;
  assert.equal(useStudio.getState().saveCurrentProject().ok, true);
  assert.equal(useStudio.getState().persistenceError, null);
  assert.equal(useStudio.getState().lastSavedJobRaw, data.get(FENCING_JOB_STORAGE_KEY));
  assert.equal(useStudio.getState().lastSavedJobRevision, useStudio.getState().job.revision);
  useStudio.setState(useStudio.getInitialState(), true);
  await useStudio.getState().hydratePersistence();
  assert.equal(useStudio.getState().job.name, "Unsaved design revision");
});

test("a stale window's autosave is refused, the newer stored revision survives and reload adopts it", async () => {
  await useStudio.getState().hydratePersistence();
  const mine = useStudio.getState().lastSavedJobRaw!;
  assert.equal(mine, data.get(FENCING_JOB_STORAGE_KEY));
  // Same-window simulation of another window's write: no storage event fires, only the bytes change.
  const foreign = foreignRevisionOf(mine, "Other window revision");
  data.set(FENCING_JOB_STORAGE_KEY, foreign);
  const writesBefore = writes;

  useStudio.getState().updateJobName("Losing window edit");
  const state = useStudio.getState();
  assert.equal(data.get(FENCING_JOB_STORAGE_KEY), foreign, "the newer revision is byte-identical after the refused autosave");
  assert.equal(writes, writesBefore, "no write reached storage");
  assert.equal(state.projectWriteStale, true);
  assert.equal(state.persistenceRecoveryBlocked, true, "autosave stops silently retrying");
  assert.match(state.persistenceError ?? "", /newer revision .* another window/i);
  assert.equal(state.job.name, "Losing window edit", "the in-memory revision is retained for download");
  assert.equal(state.lastSavedJobRaw, mine, "tracking never adopts bytes it did not write");
  assert.notEqual(state.lastSavedJobRevision, state.job.revision);

  useStudio.getState().updateJobName("Second losing edit");
  assert.equal(writes, writesBefore, "further edits do not write while stale");
  assert.equal(useStudio.getState().saveCurrentProject().ok, false, "explicit save is refused while stale");
  assert.equal(data.get(FENCING_JOB_STORAGE_KEY), foreign);

  await useStudio.getState().retryProjectLoad();
  const reloaded = useStudio.getState();
  assert.equal(reloaded.projectWriteStale, false);
  assert.equal(reloaded.persistenceRecoveryBlocked, false);
  assert.equal(reloaded.persistenceError, null);
  assert.equal(reloaded.job.name, "Other window revision", "reload adopts the newer revision");
  assert.equal(reloaded.lastSavedJobRaw, foreign);
  assert.equal(reloaded.lastSavedJobRevision, JSON.parse(foreign).revision);

  useStudio.getState().updateJobName("Edit after adopting the newer revision");
  assert.equal(JSON.parse(data.get(FENCING_JOB_STORAGE_KEY)!).name, "Edit after adopting the newer revision");
  assert.equal(useStudio.getState().lastSavedJobRaw, data.get(FENCING_JOB_STORAGE_KEY));
  assert.equal(useStudio.getState().persistenceError, null);
});

test("a storage event from another window marks the project stale, blocks autosave and reload clears it", async () => {
  await useStudio.getState().hydratePersistence();
  const mine = useStudio.getState().lastSavedJobRaw!;
  const writesBefore = writes;

  // Unrelated keys and echoes of our own bytes never trip the guard.
  otherWindowWrites("xray:something-else", "{}");
  otherWindowWrites(FENCING_JOB_STORAGE_KEY, mine);
  assert.equal(useStudio.getState().projectWriteStale, false);
  assert.equal(useStudio.getState().persistenceRecoveryBlocked, false);

  const foreign = foreignRevisionOf(mine, "Second window name");
  otherWindowWrites(FENCING_JOB_STORAGE_KEY, foreign);
  const state = useStudio.getState();
  assert.equal(state.projectWriteStale, true);
  assert.equal(state.persistenceRecoveryBlocked, true);
  assert.match(state.persistenceError ?? "", /another window saved a newer revision/i);

  useStudio.getState().updateJobName("Edit in the stale window");
  assert.equal(writes, writesBefore, "autosave is blocked after the storage event");
  assert.equal(data.get(FENCING_JOB_STORAGE_KEY), foreign, "the other window's bytes survive untouched");
  assert.equal(useStudio.getState().job.name, "Edit in the stale window", "the in-memory edit is retained");

  await useStudio.getState().retryProjectLoad();
  assert.equal(useStudio.getState().projectWriteStale, false);
  assert.equal(useStudio.getState().persistenceRecoveryBlocked, false);
  assert.equal(useStudio.getState().job.name, "Second window name");
  assert.equal(useStudio.getState().lastSavedJobRaw, foreign);
});

test("a failed reload after a stale event shows the load-failure notice, not the newer-revision heading", async () => {
  await useStudio.getState().hydratePersistence();
  const mine = useStudio.getState().lastSavedJobRaw!;
  otherWindowWrites(FENCING_JOB_STORAGE_KEY, foreignRevisionOf(mine, "Second window name"));
  assert.equal(useStudio.getState().projectWriteStale, true);

  // The newer bytes become unreadable before this window reloads them.
  otherWindowWrites(FENCING_JOB_STORAGE_KEY, "{unreadable");
  await useStudio.getState().retryProjectLoad();
  const state = useStudio.getState();
  assert.equal(state.projectWriteStale, false, "a load failure is not presented as a stale-writer condition");
  assert.equal(state.persistenceRecoveryBlocked, true, "editing stays paused so the unreadable record is preserved");
  assert.match(state.persistenceError ?? "", /not valid JSON/);
  assert.equal(data.get(FENCING_JOB_STORAGE_KEY), "{unreadable", "the unreadable bytes are untouched");

  // A read error on reload behaves the same way.
  otherWindowWrites(FENCING_JOB_STORAGE_KEY, mine);
  await useStudio.getState().retryProjectLoad();
  assert.equal(useStudio.getState().projectWriteStale, false);
  otherWindowWrites(FENCING_JOB_STORAGE_KEY, foreignRevisionOf(mine, "Third window name"));
  assert.equal(useStudio.getState().projectWriteStale, true);
  denyRead = true;
  await useStudio.getState().retryProjectLoad();
  denyRead = false;
  assert.equal(useStudio.getState().projectWriteStale, false);
  assert.equal(useStudio.getState().persistenceRecoveryBlocked, true);
  assert.match(useStudio.getState().persistenceError ?? "", /Storage unavailable/);
});

test("storage events before hydration or after our own write are ignored", async () => {
  otherWindowWrites(FENCING_JOB_STORAGE_KEY, JSON.stringify({ ...createDefaultJob(), name: "Pre-hydration write" }));
  assert.equal(useStudio.getState().projectWriteStale, false, "nothing is stale before the project was loaded");
  await useStudio.getState().hydratePersistence();
  assert.equal(useStudio.getState().job.name, "Pre-hydration write");
  useStudio.getState().updateJobName("Own write");
  const own = useStudio.getState().lastSavedJobRaw!;
  assert.equal(JSON.parse(own).name, "Own write");
  otherWindowWrites(FENCING_JOB_STORAGE_KEY, own);
  assert.equal(useStudio.getState().projectWriteStale, false);
  assert.equal(useStudio.getState().persistenceRecoveryBlocked, false);
});
