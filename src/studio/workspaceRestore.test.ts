import { test } from "node:test";
import assert from "node:assert/strict";
import { executeWorkspaceRestore, type RestoreOperation, type RestorePorts, type RestoreMutation } from "./workspaceRestore.ts";
import { planRestoreMutations, validateRestorePlan } from "./workspaceRestorePlan.ts";
import { createDefaultJob } from "./domain.ts";
import { BACKUP_FORMAT, emptyBackupRecords, type ProjectBackup } from "./projectBackup.ts";
import { FENCING_JOB_STORAGE_KEY } from "./persistence.ts";
import { shelfKey } from "./projectRegistry.ts";

function harness() {
  const mutations: RestoreMutation[] = [
    { storage: "local", key: "module", label: "Design", before: "old", after: "new" },
    { storage: "materials", key: "materials", label: "Materials", before: null, after: "new materials" },
    { storage: "local", key: "removed", label: "Removed module", before: "old module", after: null },
    { storage: "local", key: "active", label: "Active project", before: "old job", after: "new job" },
  ];
  const values = new Map(mutations.map(v => [v.key, v.before]));
  let saved: RestoreOperation = { schema: "xray.restore/v1", id: crypto.randomUUID(), revision: 1, createdAt: new Date().toISOString(),
    phase: "requested", backup: "verified package", expectedFingerprint: "a".repeat(64), restoreReferenceRates: false, progress: 0, message: "" };
  const phases: string[] = [], writes: string[] = [];
  const ports: RestorePorts = {
    prepare: async () => ({ mutations, recoveryBackupId: crypto.randomUUID(), targetId: "target", targetName: "Target" }),
    read: async v => values.get(v.key) ?? null,
    compareWrite: async (v, expected, next) => { assert.equal(values.get(v.key) ?? null, expected); values.set(v.key, next); writes.push(v.key); },
    ensureAssets: async () => { phases.push("assets"); }, verifyAssets: async () => { phases.push("verify assets"); },
    journal: async (next, expected) => { assert.equal(saved.revision, expected); saved = structuredClone(next); phases.push(next.phase); },
  };
  return { mutations, values, ports, phases, writes, saved: () => structuredClone(saved), setSaved: (v: RestoreOperation) => { saved = structuredClone(v); } };
}
test("durable restore orders recovery plan, originals, module writes, active project and commit", async () => {
  const h = harness(), result = await executeWorkspaceRestore(h.saved(), h.ports);
  assert.equal(result.phase, "verified"); assert.deepEqual(h.writes, h.mutations.map(v => v.key));
  assert.deepEqual(h.phases.slice(0, 3), ["prepared", "assets", "writing"]);
  assert.deepEqual(h.phases.slice(-3), ["verify assets", "committed", "verified"]);
  for (const item of h.mutations) assert.equal(h.values.get(item.key), item.after);
});
for (let failAt = 0; failAt < 4; failAt++) test(`write failure ${failAt + 1} rolls back exact before-images including absent records`, async () => {
  const h = harness(), write = h.ports.compareWrite; let calls = 0;
  h.ports.compareWrite = async (...args) => { if (calls++ === failAt) throw Error("Injected write failure"); await write(...args); };
  const result = await executeWorkspaceRestore(h.saved(), h.ports);
  assert.equal(result.phase, "rolled-back");
  for (const item of h.mutations) assert.equal(h.values.get(item.key), item.before);
});
for (const phase of ["prepared", "writing", "recovery-required"] as const) test(`${phase} startup rolls back even when saved progress missed a write`, async () => {
  const h = harness(), initial = { ...h.saved(), phase, plan: await h.ports.prepare(h.saved()), progress: 0 };
  h.setSaved(initial); for (const item of h.mutations.slice(0, 3)) h.values.set(item.key, item.after);
  assert.equal((await executeWorkspaceRestore(initial, h.ports)).phase, "rolled-back");
  for (const item of h.mutations) assert.equal(h.values.get(item.key), item.before);
});
test("recovery refuses unexpected third-party bytes and remains blocked", async () => {
  const h = harness(), initial = { ...h.saved(), phase: "writing" as const, plan: await h.ports.prepare(h.saved()) };
  h.setSaved(initial); h.values.set("module", "third party edit");
  assert.equal((await executeWorkspaceRestore(initial, h.ports)).phase, "recovery-required");
  assert.equal(h.values.get("module"), "third party edit"); assert.deepEqual(h.writes, []);
});
test("preparation and first journal failures do not write active records", async () => {
  for (const part of ["prepare", "journal"] as const) {
    const h = harness(); h.ports[part] = async () => { throw Error("Storage unavailable"); };
    await assert.rejects(executeWorkspaceRestore(h.saved(), h.ports), /Storage unavailable/); assert.deepEqual(h.writes, []);
  }
});
test("committed restart verifies without replaying or rolling back module writes", async () => {
  const h = harness(), result = await executeWorkspaceRestore(h.saved(), h.ports);
  const committed = { ...result, phase: "committed" as const }; h.setSaved(committed); h.writes.length = 0;
  assert.equal((await executeWorkspaceRestore(committed, h.ports)).phase, "verified"); assert.deepEqual(h.writes, []);
  h.values.set("module", "third party edit");
  await assert.rejects(executeWorkspaceRestore(h.saved(), h.ports), /no longer matches/);
  assert.equal(h.values.get("module"), "third party edit");
});
test("lost final acknowledgement leaves a durable commit that startup can verify", async () => {
  const h = harness(), journal = h.ports.journal;
  h.ports.journal = async (next, expected) => { if (next.phase === "verified") throw Error("Lost acknowledgement"); await journal(next, expected); };
  await assert.rejects(executeWorkspaceRestore(h.saved(), h.ports), /Lost acknowledgement/);
  assert.equal(h.saved().phase, "committed"); h.ports.journal = journal;
  assert.equal((await executeWorkspaceRestore(h.saved(), h.ports)).phase, "verified");
});
test("original-file failure restores previous records and never deletes originals", async () => {
  const h = harness(); h.ports.ensureAssets = async () => { throw Error("Conflicting original"); };
  assert.equal((await executeWorkspaceRestore(h.saved(), h.ports)).phase, "rolled-back"); assert.deepEqual(h.writes, []);
});
for (const phase of ["writing", "committed"] as const) test(`lost acknowledgement after durable ${phase} is recovered from saved phase`, async () => {
  const h = harness(), journal = h.ports.journal;
  h.ports.journal = async (next, expected) => {
    await journal(next, expected); if (next.phase === phase) throw Error("Connection lost after commit");
  };
  await assert.rejects(executeWorkspaceRestore(h.saved(), h.ports), /acknowledgement failed/);
  assert.equal(h.saved().phase, phase); h.ports.journal = journal;
  assert.equal((await executeWorkspaceRestore(h.saved(), h.ports)).phase, phase === "committed" ? "verified" : "rolled-back");
});
test("planner shelves the previous project, restores absent records and validates its address allowlist", async () => {
  const current = createDefaultJob(), target = { ...createDefaultJob(), id: crypto.randomUUID(), name: "Restored project" };
  const backup: ProjectBackup = { format: BACKUP_FORMAT, createdAt: new Date().toISOString(), name: "Snapshot", job: target, records: emptyBackupRecords(), assets: [] };
  const read = async (_storage: string, key: string) => key === FENCING_JOB_STORAGE_KEY ? JSON.stringify(current) : null;
  const mutations = await planRestoreMutations(backup, false, read);
  assert.equal(mutations.at(-1)!.key, FENCING_JOB_STORAGE_KEY);
  assert.equal(mutations.find(v => v.key === shelfKey(current.id))!.after, JSON.stringify(current));
  assert.ok(!mutations.some(v => v.key === "xray.price-sheet.v1"));
  const h = harness(), operation: RestoreOperation = { ...h.saved(), phase: "prepared", plan: { mutations, recoveryBackupId: crypto.randomUUID(), targetId: target.id, targetName: target.name } };
  await validateRestorePlan(operation, backup);
  operation.plan!.mutations.push({ storage: "local", key: "credentials", label: "Injected", before: null, after: "bad" });
  await assert.rejects(validateRestorePlan(operation, backup), /allowed storage/);
});

test("industry restore distinguishes missing snapshots from explicit absence and exact saved inputs", async () => {
  const job = createDefaultJob(), key = `xray.industry-drafts.v1:${job.id}`;
  const incoming = JSON.stringify({ format: "xray.industry-drafts/1", projectId: job.id, revision: 1, drafts: {} });
  const backup: ProjectBackup = { format: BACKUP_FORMAT, createdAt: new Date().toISOString(), name: "Drafts", job, records: emptyBackupRecords(), assets: [] };
  const read = async (_storage: string, address: string) => address === FENCING_JOB_STORAGE_KEY ? JSON.stringify(job) : address === key ? "previous draft" : null;
  delete backup.records.industryDrafts;
  assert.equal((await planRestoreMutations(backup, false, read)).some(item => item.key === key), false);
  backup.records.industryDrafts = null;
  const absent = (await planRestoreMutations(backup, false, read)).find(item => item.key === key)!;
  assert.equal(absent.before, "previous draft");
  assert.deepEqual(JSON.parse(absent.after!).drafts, {});
  assert.match(JSON.parse(absent.after!).generation, /^[a-f0-9-]{36}$/);
  backup.records.industryDrafts = incoming;
  const restored = JSON.parse((await planRestoreMutations(backup, false, read)).find(item => item.key === key)!.after!);
  assert.deepEqual(restored.drafts, JSON.parse(incoming).drafts);
  assert.notEqual(restored.generation, JSON.parse(absent.after!).generation);
});

test("restore generation invalidates delayed saves and survives journal verification", async () => {
  const { updateIndustryDraft } = await import("./industries/draftStorage.ts");
  const job = createDefaultJob(), key = `xray.industry-drafts.v1:${job.id}`;
  const prior = JSON.stringify(updateIndustryDraft(null, job.id, "hvac", 0, { note: "Before" }, null));
  const backup: ProjectBackup = { format: BACKUP_FORMAT, createdAt: new Date().toISOString(), name: "Draft restore", job,
    records: { ...emptyBackupRecords(), industryDrafts: prior }, assets: [] };
  const read = async (_storage: string, address: string) => address === FENCING_JOB_STORAGE_KEY ? JSON.stringify(job) : address === key ? prior : null;
  const mutations = await planRestoreMutations(backup, false, read);
  const restored = mutations.find(item => item.key === key)!.after!;
  assert.throws(() => updateIndustryDraft(restored, job.id, "hvac", 1, { note: "Delayed" }, null), /restored or replaced/);
  const operation: RestoreOperation = { ...harness().saved(), phase: "prepared", backup: JSON.stringify(backup),
    plan: { mutations, recoveryBackupId: crypto.randomUUID(), targetId: job.id, targetName: job.name } };
  await validateRestorePlan(operation, backup);
  const changed = structuredClone(operation);
  const row = changed.plan!.mutations.find(item => item.key === key)!;
  row.after = prior;
  await assert.rejects(validateRestorePlan(changed, backup), /generation/);
});
