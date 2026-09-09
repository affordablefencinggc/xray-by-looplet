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
Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: storage } });
const { useStudio, resetStudioHydrationForTests } = await import("./store.ts");
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
  denyWrite = true;
  useStudio.getState().updateJobName("Unsaved design revision");
  assert.equal(data.get(FENCING_JOB_STORAGE_KEY), before);
  assert.equal(useStudio.getState().job.name, "Unsaved design revision");
  assert.equal(useStudio.getState().lastSavedJobRevision, savedRevision);
  assert.match(useStudio.getState().persistenceError ?? "", /Quota/);
  denyWrite = false; dropWrite = true;
  assert.equal(useStudio.getState().saveCurrentProject().ok, false);
  assert.match(useStudio.getState().persistenceError ?? "", /verified/);
  dropWrite = false;
  assert.equal(useStudio.getState().saveCurrentProject().ok, true);
  assert.equal(useStudio.getState().persistenceError, null);
  useStudio.setState(useStudio.getInitialState(), true);
  await useStudio.getState().hydratePersistence();
  assert.equal(useStudio.getState().job.name, "Unsaved design revision");
});
