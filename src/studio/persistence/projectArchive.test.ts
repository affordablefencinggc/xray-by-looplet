import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { unzipSync, zipSync } from "fflate";
import { createDefaultJob } from "../domain.ts";
import { demonstration } from "../architect/model.ts";
import { inspectPlanBytes } from "../documents.ts";
import { backupDigest, captureProjectBackup, decodeBackupBytes, emptyBackupRecords } from "../projectBackup.ts";
import { archiveSealInput, canonicalJson } from "./portableArchive.ts";
import { createProjectArchive, parseProjectArchive } from "./projectArchive.ts";

const encoder = new TextEncoder(), decoder = new TextDecoder();
async function fixture(withDrawing = true) {
  const original = encoder.encode('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0L120 0L120 90Z"/></svg>');
  const plan = await inspectPlanBytes({ name: "Untouched source.svg", bytes: original, source: "web" });
  const job = { ...createDefaultJob(), documents: withDrawing ? [plan.revision] : [], activeDocumentId: withDrawing ? plan.revision.id : null };
  const records = emptyBackupRecords(); records.architecture = JSON.stringify(demonstration(job.id));
  const backup = await captureProjectBackup(job, "Portable issue", {
    currentJob: () => job, records: async () => records, photo: async () => null,
    plan: async () => ({ ...plan.binary, bytes: Uint8Array.from(original).buffer }),
  });
  return { backup, original, archive: await createProjectArchive(backup, "Declared client") };
}
async function reseal(files: Record<string, Uint8Array>) {
  const manifest = JSON.parse(decoder.decode(files["manifest.json"]));
  for (const entry of manifest.entries) if (files[entry.path]) {
    entry.sizeBytes = files[entry.path].length;
    entry.sha256 = await backupDigest(Uint8Array.from(files[entry.path]).buffer);
  }
  manifest.totalBytes = manifest.entries.reduce((n: number, e: { sizeBytes: number }) => n + e.sizeBytes, 0);
  manifest.sealSha256 = await backupDigest(archiveSealInput(manifest));
  files["manifest.json"] = encoder.encode(canonicalJson(manifest));
  return zipSync(files, { level: 0 });
}

describe("SC-15 portable ZIP container", () => {
  it("stores original drawing bytes without base64 and round-trips all captured records", async () => {
    const { backup, original, archive } = await fixture();
    const files = unzipSync(archive.bytes);
    assert.deepEqual(Object.keys(files).sort(), ["data/workspace.json", "drawings/0.svg", "manifest.json"]);
    assert.deepEqual(files["drawings/0.svg"], original);
    assert.equal(decoder.decode(files["data/workspace.json"]).includes("bytesBase64"), false);
    const parsed = await parseProjectArchive(archive.bytes);
    assert.deepEqual(parsed.backup, backup);
    assert.equal(parsed.manifest.client, "Declared client");
    assert.deepEqual(new Uint8Array(decodeBackupBytes(parsed.backup.assets[0].bytesBase64)), original);
  });
  it("preserves a project with no original drawing instead of inventing an asset", async () => {
    const { archive, backup } = await fixture(false);
    assert.equal(archive.manifest.entries.length, 1);
    assert.deepEqual((await parseProjectArchive(archive.bytes)).backup, backup);
  });
  it("preserves legal project-name whitespace and normalizes client input before sealing", async () => {
    const { backup } = await fixture(false);
    backup.job.name = " " + "Long project name ".repeat(10) + " ";
    const archive = await createProjectArchive(backup, "  Declared client  ");
    const restored = await parseProjectArchive(archive.bytes);
    assert.equal(restored.backup.job.name, backup.job.name);
    assert.equal(restored.manifest.client, "Declared client");
  });
  it("rejects independently tampered manifest and drawing bytes", async () => {
    const { archive } = await fixture();
    const files = unzipSync(archive.bytes), manifest = JSON.parse(decoder.decode(files["manifest.json"]));
    manifest.jobName = "Changed without seal";
    files["manifest.json"] = encoder.encode(canonicalJson(manifest));
    await assert.rejects(parseProjectArchive(zipSync(files)), /manifest failed SHA-256/);
    const corrupt = unzipSync(archive.bytes); corrupt["drawings/0.svg"][10] ^= 1;
    await assert.rejects(parseProjectArchive(zipSync(corrupt)), /file.*failed SHA-256/);
  });
  it("does not accept a resealed manifest that contradicts the workspace identity", async () => {
    const { archive } = await fixture(); const files = unzipSync(archive.bytes);
    const manifest = JSON.parse(decoder.decode(files["manifest.json"])); manifest.jobId = "another-project";
    files["manifest.json"] = encoder.encode(canonicalJson(manifest));
    await assert.rejects(parseProjectArchive(await reseal(files)), /workspace identity differ/);
  });
  it("rejects missing, unlisted and traversing files before returning a restore candidate", async () => {
    const { archive } = await fixture();
    const missing = unzipSync(archive.bytes); delete missing["drawings/0.svg"];
    await assert.rejects(parseProjectArchive(zipSync(missing)), /membership differs/);
    const extra = unzipSync(archive.bytes); extra["photos/1.bin"] = new Uint8Array([1]);
    await assert.rejects(parseProjectArchive(zipSync(extra)), /membership differs/);
    const traversal = unzipSync(archive.bytes); traversal["../source.svg"] = new Uint8Array([1]);
    await assert.rejects(parseProjectArchive(zipSync(traversal)), /Unsupported archive path/);
  });
  it("rejects a resealed asset path/identity substitution", async () => {
    const { archive } = await fixture(); const files = unzipSync(archive.bytes);
    const record = JSON.parse(decoder.decode(files["data/workspace.json"])); record.assets[0].id = "wrong-document";
    files["data/workspace.json"] = encoder.encode(canonicalJson(record));
    await assert.rejects(parseProjectArchive(await reseal(files)), /asset identity differs/);
  });
  it("accepts deflated entries but refuses overlapping ZIP metadata and oversized declarations", async () => {
    const { archive, backup } = await fixture();
    assert.deepEqual((await parseProjectArchive(zipSync(unzipSync(archive.bytes), { level: 9 }))).backup, backup);
    const corrupt = Uint8Array.from(archive.bytes), view = new DataView(corrupt.buffer);
    const central = view.getUint32(corrupt.length - 6, true);
    view.setUint32(central + 42, 1, true);
    await assert.rejects(parseProjectArchive(corrupt), /local metadata/);
    const huge = Uint8Array.from(archive.bytes), hugeView = new DataView(huge.buffer);
    hugeView.setUint32(central + 24, 101 * 1024 * 1024, true);
    await assert.rejects(parseProjectArchive(huge), /entry size/);
  });
  it("rejects noncanonical duplicate-key JSON even when its outer seal is recomputed", async () => {
    const { archive } = await fixture(); const files = unzipSync(archive.bytes);
    const raw = decoder.decode(files["data/workspace.json"]);
    files["data/workspace.json"] = encoder.encode('{"name":"ambiguous",' + raw.slice(1));
    await assert.rejects(parseProjectArchive(await reseal(files)), /not canonical|duplicate keys/);
  });
});
