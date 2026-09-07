import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createDefaultJob, type FencingJob } from "./domain.ts";
import { inspectPlanBytes } from "./documents.ts";
import { importPhotoFile } from "./evidence.ts";
import { captureDocumentWorkspace, restoreDocumentWorkspace } from "./documentWorkspaces.ts";
import { demonstration } from "./architect/model.ts";
import { createSheetLifecycle, changeSheetLifecycle, sheetSourceIdentity } from "./sheetLifecycle.ts";
import { emptyPriceBookLibrary } from "./pricing/priceBooks.ts";
import { BACKUP_FORMAT, backupContents, backupDigest, captureProjectBackup, decodeBackupBytes, emptyBackupRecords, parseProjectBackup, validateProjectBackup, type BackupCapturePort } from "./projectBackup.ts";

async function fixture() {
  const first = await inspectPlanBytes({ name: "Site.svg", bytes: new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0L10 0"/></svg>'), source: "web" });
  const second = await inspectPlanBytes({ name: "Level.svg", bytes: new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>'), source: "web" });
  const photo = await importPhotoFile(new File([new Uint8Array([255,216,255,224,0,0,255,217])], "Site.jpg", { type: "image/jpeg" }), 0);
  let job: FencingJob = { ...createDefaultJob(), documents: [first.revision, second.revision], activeDocumentId: first.revision.id, photos: [photo.record] };
  job = restoreDocumentWorkspace(captureDocumentWorkspace(job, 0), second.revision);
  const records = emptyBackupRecords(); records.architecture = JSON.stringify(demonstration(job.id));
  const port: BackupCapturePort = { records: async () => structuredClone(records), currentJob: () => job,
    plan: async id => { const b = [first, second].find(p => p.binary.documentId === id)?.binary; return b ? { ...b, bytes: new Uint8Array(b.bytes).buffer } : null; },
    photo: async id => id === photo.content.id ? photo.content : null };
  const value = await captureProjectBackup(job, "Tender issue A", port);
  return { value, job, records, port, first, photo };
}
describe("portable main workspace backups", () => {
  it("keeps v1 packages readable and version-binds new sheet and pricing records", async () => {
    const { value } = await fixture();
    const legacy = structuredClone(value); legacy.format = "xray.workspace-backup/v1";
    delete legacy.records.sheetMetadata; delete legacy.records.priceBooks;
    assert.deepEqual(await parseProjectBackup(JSON.stringify(legacy)), legacy);
    await assert.rejects(validateProjectBackup({ ...legacy, records: { ...legacy.records, priceBooks: null } }), /require backup format v2/);
  });
  it("round-trips source-bound sheet organisation and job-bound pricing without accepting mismatched records", async () => {
    const { value, first } = await fixture();
    const identity = sheetSourceIdentity(value.job.id, first.revision)!;
    const sheets = changeSheetLifecycle(createSheetLifecycle(identity), { type: "rename", pageIndex: 0, name: "Tender cover" });
    value.records.sheetMetadata = JSON.stringify([sheets]);
    value.records.priceBooks = JSON.stringify(emptyPriceBookLibrary(value.job.id));
    assert.deepEqual(await parseProjectBackup(JSON.stringify(value)), value);
    assert.ok(backupContents(value).records.includes("sheetMetadata"));
    const wrongSheets = structuredClone(value);
    wrongSheets.records.sheetMetadata = JSON.stringify([{ ...sheets, identity: { ...identity, sha256: "0".repeat(64) } }]);
    await assert.rejects(validateProjectBackup(wrongSheets));
    const wrongPrices = structuredClone(value); wrongPrices.records.priceBooks = JSON.stringify(emptyPriceBookLibrary("other-job"));
    await assert.rejects(validateProjectBackup(wrongPrices));
  });
  it("round-trips two source documents, inactive-plan photo evidence and the full architectural design", async () => {
    const { value, first, photo } = await fixture();
    const restored = await parseProjectBackup(JSON.stringify(value));
    assert.deepEqual(restored, value);
    assert.equal(restored.job.photos.length, 0);
    assert.equal(backupContents(restored).plans, 2);
    assert.equal(backupContents(restored).photos, 1);
    assert.deepEqual(new Uint8Array(decodeBackupBytes(restored.assets.find(a => a.id === first.binary.documentId)!.bytesBase64)), first.binary.bytes);
    assert.equal(await backupDigest(decodeBackupBytes(restored.assets.find(a => a.id === photo.record.id)!.bytesBase64)), photo.record.sha256);
    assert.equal(JSON.parse(restored.records.architecture!).walls.length, 5);
  });
  it("refuses a missing inactive-plan photo instead of producing an incomplete backup", async () => {
    const { job, port } = await fixture();
    await assert.rejects(captureProjectBackup(job, "Incomplete", { ...port, photo: async () => null }), /Original photo.*missing/);
  });
  it("rejects missing plans, duplicate assets and unreferenced assets", async () => {
    const { value } = await fixture();
    await assert.rejects(validateProjectBackup({ ...value, assets: value.assets.slice(1) }), /exactly every/);
    await assert.rejects(validateProjectBackup({ ...value, assets: [...value.assets, value.assets[0]] }), /Duplicate/);
    const changed = structuredClone(value); changed.assets[0].id = "wrong-id";
    await assert.rejects(validateProjectBackup(changed), /Unreferenced/);
  });
  it("rejects modified source bytes, mismatched MIME types and page counts", async () => {
    const { value } = await fixture();
    const corrupt = structuredClone(value); corrupt.assets[0].sha256 = "0".repeat(64);
    await assert.rejects(validateProjectBackup(corrupt), /verification/);
    const mime = structuredClone(value); mime.assets[0].mimeType = "text/html";
    await assert.rejects(validateProjectBackup(mime), /verification/);
    const page = structuredClone(value); page.job.documents[0].pageCount = 2;
    await assert.rejects(validateProjectBackup(page), /verification/);
  });
  it("rejects invalid encoding, future formats and unexpected top-level data", async () => {
    const { value } = await fixture();
    assert.throws(() => decodeBackupBytes("abc!"), /base64/);
    assert.throws(() => decodeBackupBytes("Zh=="), /canonical/);
    await assert.rejects(validateProjectBackup({ ...value, format: "xray.workspace-backup/v99" }));
    await assert.rejects(validateProjectBackup({ ...value, accessToken: "must-not-be-accepted" }));
  });
  it("rejects another project's design and corrupt saved modules", async () => {
    const { value } = await fixture();
    const changed = structuredClone(value); changed.records.architecture = JSON.stringify(demonstration("other-job"));
    await assert.rejects(validateProjectBackup(changed), /different project/);
    changed.records.architecture = "{broken";
    await assert.rejects(validateProjectBackup(changed));
    changed.records.architecture = null; changed.records.components = "{}";
    await assert.rejects(validateProjectBackup(changed));
  });
  it("rejects changes to the job or another saved module during capture", async () => {
    const { job, port, records } = await fixture();
    await assert.rejects(captureProjectBackup(job, "Race", { ...port, currentJob: () => ({ ...job, name: "Changed" }) }), /changed while/);
    let count = 0;
    await assert.rejects(captureProjectBackup(job, "Race", { ...port, records: async () => ++count === 1 ? records : { ...records, architecture: null } }), /changed while/);
  });
  it("accepts an empty job with clear zero-original coverage and trims its backup label", async () => {
    const job = createDefaultJob();
    const value = await validateProjectBackup({ format: BACKUP_FORMAT, name: "  Empty study  ", job,
      createdAt: new Date().toISOString(), records: emptyBackupRecords(), assets: [] });
    assert.equal(value.name, "Empty study"); assert.equal(backupContents(value).plans, 0);
    await assert.rejects(validateProjectBackup({ ...value, name: " " }));
  });
});
