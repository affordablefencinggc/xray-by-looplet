import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createDefaultJob } from "./domain.ts";
import { inspectPlanBytes } from "./documents.ts";
import { importPhotoFile } from "./evidence.ts";
import { FENCING_JOB_STORAGE_KEY } from "./persistence.ts";
import { architectKey } from "./architect/persistence.ts";
import { demonstration } from "./architect/model.ts";
import { createSheetLifecycle, sheetLifecycleStorageKey, sheetSourceIdentity } from "./sheetLifecycle.ts";
import { emptyPriceBookLibrary, priceBookKey } from "./pricing/priceBooks.ts";
import { BACKUP_FORMAT, backupDigest, encodeBackupBytes, emptyBackupRecords, type ProjectBackup } from "./projectBackup.ts";
import { assessBackupRestore, type BackupRestoreReadPorts } from "./backupRestorePreflight.ts";

async function fixture() {
  const plan = await inspectPlanBytes({ name: "Review.svg", bytes: new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0L10 0"/></svg>'), source: "web" });
  const photo = await importPhotoFile(new File([new Uint8Array([255,216,255,224,0,0,255,217])], "Review.jpg", { type: "image/jpeg" }), 0);
  const target = { ...createDefaultJob(), documents: [plan.revision], activeDocumentId: plan.revision.id, photos: [photo.record] };
  const current = createDefaultJob();
  const records = emptyBackupRecords(); records.architecture = JSON.stringify(demonstration(target.id));
  records.priceBooks = JSON.stringify(emptyPriceBookLibrary(target.id));
  records.sheetMetadata = JSON.stringify([createSheetLifecycle(sheetSourceIdentity(target.id, plan.revision)!)]);
  const backup: ProjectBackup = { format: BACKUP_FORMAT, name: "Recovery review", createdAt: new Date().toISOString(), job: target, records,
    assets: [{ id: plan.binary.documentId, kind: "plan", name: plan.binary.name, mimeType: plan.binary.mimeType, sha256: plan.binary.sha256, bytesBase64: encodeBackupBytes(plan.binary.bytes.slice().buffer) },
      { id: photo.content.id, kind: "photo", name: photo.content.name, mimeType: photo.content.mimeType, sha256: photo.content.sha256, bytesBase64: encodeBackupBytes(photo.content.bytes) }] };
  const raw = new Map<string, string>([[FENCING_JOB_STORAGE_KEY, JSON.stringify(current)], ["unrelated-secret-key", "must not be read"]]);
  const plans = new Map([[plan.binary.documentId, { ...plan.binary, bytes: plan.binary.bytes.slice().buffer }]]);
  const photos = new Map([[photo.content.id, photo.content]]);
  const reads: string[] = [];
  const ports: BackupRestoreReadPorts = { currentJob: () => structuredClone(current), readLocal: key => { reads.push(key); return raw.get(key) ?? null; },
    readMaterials: async () => null, plan: async id => plans.get(id) ?? null, photo: async id => photos.get(id) ?? null };
  return { backup, current, target, raw, plans, photos, ports, reads, plan, photo };
}
describe("read-only backup restore impact", () => {
  it("validates originals, inventories exact addresses and leaves every byte/record untouched", async () => {
    const f = await fixture(), before = JSON.stringify([...f.raw]), planHash = await backupDigest(f.plans.get(f.plan.revision.id)!.bytes);
    const result = await assessBackupRestore(f.backup, f.ports);
    assert.equal(result.canApply, false); assert.equal(result.project.sameProject, false); assert.deepEqual(result.blockingIssues, []);
    assert.equal(result.rows.find(r => r.key === architectKey(f.target.id))?.action, "add");
    assert.equal(result.rows.find(r => r.key === f.plan.revision.id)?.action, "unchanged");
    assert.equal(result.rows.find(r => r.key === FENCING_JOB_STORAGE_KEY)?.action, "replace");
    assert.equal(JSON.stringify([...f.raw]), before); assert.equal(await backupDigest(f.plans.get(f.plan.revision.id)!.bytes), planHash);
    assert(!f.reads.includes("unrelated-secret-key")); assert.match(result.fingerprint, /^[a-f0-9]{64}$/);
  });
  it("preserves global reference rates by default and identifies explicitly requested global removal", async () => {
    const f = await fixture(); f.raw.set("xray.price-sheet.v1", JSON.stringify({ currency: "AUD", rows: [] }));
    const keep = await assessBackupRestore(f.backup, f.ports);
    assert.equal(keep.rows.find(r => r.scope === "global")?.action, "preserve");
    const remove = await assessBackupRestore(f.backup, f.ports, { restoreReferenceRates: true });
    assert.equal(remove.rows.find(r => r.scope === "global")?.action, "remove");
    assert.notEqual(keep.fingerprint, remove.fingerprint); assert(f.raw.has("xray.price-sheet.v1"));
  });
  it("shows target collisions and null-record removal without changing unrelated current-project modules", async () => {
    const f = await fixture();
    f.raw.set(architectKey(f.target.id), JSON.stringify({ ...demonstration(f.target.id), name: "Current design" }));
    f.raw.set(architectKey(f.current.id), JSON.stringify(demonstration(f.current.id)));
    f.backup.records.priceBooks = null; f.raw.set(priceBookKey(f.target.id), JSON.stringify(emptyPriceBookLibrary(f.target.id)));
    const result = await assessBackupRestore(f.backup, f.ports);
    assert.equal(result.rows.find(r => r.key === architectKey(f.target.id))?.action, "replace");
    assert.equal(result.rows.find(r => r.key === architectKey(f.current.id))?.action, "preserve");
    assert.equal(result.rows.find(r => r.key === priceBookKey(f.target.id))?.action, "remove");
  });
  it("marks legacy omitted sheet/pricing records unsupported instead of assuming deletion", async () => {
    const f = await fixture(); f.backup.format = "xray.workspace-backup/v1";
    delete f.backup.records.sheetMetadata; delete f.backup.records.priceBooks;
    const result = await assessBackupRestore(f.backup, f.ports);
    assert.equal(result.rows.find(r => r.key === priceBookKey(f.target.id))?.action, "unsupported");
    assert.equal(result.rows.find(r => r.key === sheetLifecycleStorageKey(sheetSourceIdentity(f.target.id, f.plan.revision)!))?.action, "unsupported");
    assert(result.warnings.some(w => w.includes("did not capture sheet"))); assert(result.warnings.some(w => w.includes("did not capture supplier")));
  });
  it("rejects corrupt backup originals and modules before reading any destination", async () => {
    const f = await fixture(); f.backup.assets[0].sha256 = "0".repeat(64);
    await assert.rejects(assessBackupRestore(f.backup, f.ports), /verification/); assert.equal(f.reads.length, 0);
    f.backup.assets[0].sha256 = f.plan.binary.sha256; f.backup.records.architecture = "{broken";
    await assert.rejects(assessBackupRestore(f.backup, f.ports)); assert.equal(f.reads.length, 0);
  });
  it("blocks a plan ID reused for different valid bytes, even with a truthful new stored hash", async () => {
    const f = await fixture(), existing = f.plans.get(f.plan.revision.id)!;
    const bytes = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><circle r="4"/></svg>').buffer;
    f.plans.set(existing.documentId, { ...existing, bytes, sizeBytes: bytes.byteLength, sha256: await backupDigest(bytes) });
    const result = await assessBackupRestore(f.backup, f.ports);
    assert.equal(result.rows.find(r => r.key === existing.documentId)?.action, "conflict");
    assert(result.blockingIssues.some(e => e.includes("reused identity"))); assert.equal(f.plans.get(existing.documentId)!.bytes, bytes);
  });
  it("checks photo metadata as well as actual bytes; a claimed hash does not conceal corruption", async () => {
    const f = await fixture(); f.photos.set(f.photo.content.id, { ...f.photo.content, name: "Another photo.jpg" });
    const metadata = await assessBackupRestore(f.backup, f.ports);
    assert.equal(metadata.rows.find(r => r.key === f.photo.content.id)?.action, "conflict");
    f.photos.set(f.photo.content.id, { ...f.photo.content, bytes: new Uint8Array([0,1,2]).buffer });
    const bytes = await assessBackupRestore(f.backup, f.ports);
    assert.equal(bytes.rows.find(r => r.key === f.photo.content.id)?.action, "conflict");
  });
  it("reports absent destination originals as additions without inserting them", async () => {
    const f = await fixture(); f.plans.clear(); f.photos.clear();
    const result = await assessBackupRestore(f.backup, f.ports);
    assert.equal(result.rows.filter(r => r.id.startsWith("plan:") || r.id.startsWith("photo:")).every(r => r.action === "add"), true);
    assert.equal(f.plans.size, 0); assert.equal(f.photos.size, 0);
  });
  it("blocks missing originals referenced by the current job even when the incoming backup contains them", async () => {
    const f = await fixture(); Object.assign(f.current, f.target);
    f.raw.set(FENCING_JOB_STORAGE_KEY, JSON.stringify(f.current)); f.plans.clear(); f.photos.clear();
    const result = await assessBackupRestore(f.backup, f.ports);
    assert.equal(result.project.sameProject, true);
    assert.equal(result.rows.find(r => r.id === `plan:${f.plan.revision.id}`)?.action, "conflict");
    assert.equal(result.rows.find(r => r.id === `photo:${f.photo.content.id}`)?.action, "conflict");
    assert.equal(result.blockingIssues.filter(e => e.includes("is missing; a complete before-restore backup")).length, 2);
  });
  it("checks current-job original expectations separately from incoming expectations", async () => {
    const f = await fixture(); f.current.documents = [{ ...f.plan.revision, name: "Current conflicting.svg" }];
    f.current.activeDocumentId = f.plan.revision.id;
    f.current.photos = [{ ...f.photo.record, sizeBytes: f.photo.record.sizeBytes + 1 }];
    f.raw.set(FENCING_JOB_STORAGE_KEY, JSON.stringify(f.current));
    const result = await assessBackupRestore(f.backup, f.ports);
    assert.equal(result.rows.find(r => r.id === `plan:${f.plan.revision.id}`)?.action, "conflict");
    assert.equal(result.rows.find(r => r.id === `photo:${f.photo.content.id}`)?.action, "conflict");
    assert.equal(result.blockingIssues.filter(e => e.includes("open project's metadata")).length, 2);
  });
  it("blocks corrupt and wrong-owner destination modules while preserving their exact contents", async () => {
    const f = await fixture(); f.raw.set(architectKey(f.target.id), "{broken");
    f.raw.set(priceBookKey(f.target.id), JSON.stringify(emptyPriceBookLibrary(f.current.id)));
    const before = JSON.stringify([...f.raw]);
    const result = await assessBackupRestore(f.backup, f.ports);
    assert.equal(result.rows.find(r => r.key === architectKey(f.target.id))?.action, "conflict");
    assert.equal(result.rows.find(r => r.key === priceBookKey(f.target.id))?.action, "conflict");
    assert.equal(JSON.stringify([...f.raw]), before);
  });
  it("detects destination changes during asynchronous review", async () => {
    const f = await fixture(); let calls = 0;
    const result = await assessBackupRestore(f.backup, { ...f.ports, readMaterials: async id => id === f.target.id && ++calls > 1 ? '{"changed":true}' : null });
    assert(result.blockingIssues.some(e => e.includes("while this review")));
  });
  it("rejects an earlier fingerprint after a target value changes, and accepts an unchanged repeated review", async () => {
    const f = await fixture(); const first = await assessBackupRestore(f.backup, f.ports);
    const same = await assessBackupRestore(f.backup, f.ports, { expectedFingerprint: first.fingerprint });
    assert.equal(first.fingerprint, same.fingerprint); assert.deepEqual(same.blockingIssues, []);
    f.raw.set(priceBookKey(f.target.id), JSON.stringify({ ...emptyPriceBookLibrary(f.target.id), revision: 1 }));
    const stale = await assessBackupRestore(f.backup, f.ports, { expectedFingerprint: first.fingerprint });
    assert(stale.blockingIssues.some(e => e.includes("earlier review is stale")));
  });
  it("blocks a saved main job newer than the open workspace and storage-read failures", async () => {
    const f = await fixture(); f.raw.set(FENCING_JOB_STORAGE_KEY, JSON.stringify({ ...f.current, revision: f.current.revision + 1 }));
    const mismatch = await assessBackupRestore(f.backup, f.ports);
    assert(mismatch.blockingIssues.some(e => e.includes("differs from the saved")));
    const unreadable = await assessBackupRestore(f.backup, { ...f.ports, readMaterials: async () => { throw Error("database unavailable"); } });
    assert(unreadable.blockingIssues.some(e => e.includes("storage is unreadable")));
  });
});
