import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultJob } from "./domain.ts";
import { FENCING_JOB_STORAGE_KEY } from "./persistence.ts";
import { emptyRegistry, upsertEntry, serializeRegistry, parseRegistry, readRegistryStrict, PROJECT_REGISTRY_KEY, shelfKey, planProjectSwitch } from "./projectRegistry.ts";
import { setProjectArchived } from "./projectArchive.ts";
import { listProjects, resolveTabs } from "./assistant/projectSwitch.ts";

function fixture() {
  const current = createDefaultJob(), target = createDefaultJob();
  current.name = target.name = "Same project name";
  const registry = upsertEntry(upsertEntry(emptyRegistry(), current), target);
  const raw = serializeRegistry(registry);
  const values = new Map([[PROJECT_REGISTRY_KEY, raw], [FENCING_JOB_STORAGE_KEY, JSON.stringify(current)], [shelfKey(target.id), JSON.stringify(target)], [`architecture:${target.id}`, 'keep design'], [`history:${target.id}`, 'keep chat']]);
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  return { current, target, registry, raw, values, storage };
}
test("archive and restore duplicate-named project preserves every non-registry byte and identity", () => {
  const f = fixture(), before = new Map(f.values);
  const archived = setProjectArchived(f.storage, f.target.id, true, f.raw);
  assert.deepEqual(listProjects(archived, f.current).map(r => r.id), [f.current.id]);
  assert.deepEqual(resolveTabs([f.target.id, f.current.id], archived, f.current).map(r => r.id), [f.current.id]);
  assert.throws(() => planProjectSwitch({ currentJob: f.current, currentRaw: JSON.stringify(f.current), targetId: f.target.id, registry: archived, shelvedTargetText: JSON.stringify(f.target), createJobText: () => '' }), /Restore this project/);
  const restored = setProjectArchived(f.storage, f.target.id, false, serializeRegistry(archived));
  assert.equal(listProjects(restored, f.current).length, 2);
  assert.equal(resolveTabs([f.target.id], restored, f.current)[0].id, f.target.id);
  for (const [key, value] of before) if (key !== PROJECT_REGISTRY_KEY) assert.equal(f.storage.getItem(key), value);
});
test("archive marker survives registry parsing and summary updates", () => {
  const f = fixture();
  const archived = setProjectArchived(f.storage, f.target.id, true, f.raw);
  const parsed = parseRegistry(serializeRegistry(archived));
  const updated = upsertEntry(parsed, { ...f.target, name: "Changed", revision: 2 });
  assert.equal(updated.entries.find(e => e.id === f.target.id)?.archived, true);
});
test("current, absent and corrupt shelved projects cannot be archived", () => {
  for (const mode of ['current', 'absent', 'corrupt', 'wrong-identity']) {
    const f = fixture();
    if (mode === 'absent') f.values.delete(shelfKey(f.target.id));
    if (mode === 'corrupt') f.values.set(shelfKey(f.target.id), '{}');
    if (mode === 'wrong-identity') f.values.set(shelfKey(f.target.id), JSON.stringify(f.current));
    const before = [...f.values];
    assert.throws(() => setProjectArchived(f.storage, mode === 'current' ? f.current.id : f.target.id, true, f.raw));
    assert.deepEqual([...f.values], before);
  }
});
test("stale review and malformed registry preserve existing records", () => {
  for (const value of ['broken', JSON.stringify({schema:'xray.projects/v1',entries:[{bad:true}]}), serializeRegistry(emptyRegistry())]) {
    const f = fixture(); f.values.set(PROJECT_REGISTRY_KEY, value);
    assert.throws(() => setProjectArchived(f.storage, f.target.id, true, f.raw), /changed/);
    assert.throws(() => setProjectArchived(f.storage, f.target.id, true, value));
    assert.equal(f.storage.getItem(PROJECT_REGISTRY_KEY), value);
  }
});
test("quota failure cannot discard the project or its shelf", () => {
  const f = fixture(), before = [...f.values];
  f.storage.setItem = () => { throw Error('Quota exceeded'); };
  assert.throws(() => setProjectArchived(f.storage, f.target.id, true, f.raw), /Quota/);
  assert.deepEqual([...f.values], before);
});
test("silent write failure is never reported as saved", () => {
  const f = fixture(); f.storage.setItem = () => {};
  assert.throws(() => setProjectArchived(f.storage, f.target.id, true, f.raw), /not confirmed saved/);
  assert.equal(f.storage.getItem(PROJECT_REGISTRY_KEY), f.raw);
});
test("a changed shelf during validation refuses before writing", () => {
  const f = fixture(); let reads = 0;
  const get = f.storage.getItem;
  f.storage.getItem = key => key === shelfKey(f.target.id) && ++reads > 1 ? 'changed' : get(key);
  assert.throws(() => setProjectArchived(f.storage, f.target.id, true, f.raw), /changed during review/);
  assert.equal(get(PROJECT_REGISTRY_KEY), f.raw);
});

test("mutating registry reads refuse data the display parser would drop", () => {
  for (const raw of ['{}','broken',JSON.stringify({schema:'xray.projects/v1',entries:[{id:'damaged'}]})]) {
    const f=fixture();f.values.set(PROJECT_REGISTRY_KEY,raw);
    assert.throws(()=>readRegistryStrict(f.storage),/unreadable/);
    assert.equal(f.storage.getItem(PROJECT_REGISTRY_KEY),raw);
  }
});
