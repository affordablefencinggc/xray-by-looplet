import { z } from "zod";
import { fencingJobSchema, type FencingJob } from "./domain.ts";
import { validateProject } from "./architect/model.ts";
import { bomStateEnvelopeSchema } from "./bomState.ts";
import { componentInventorySchema } from "./construction/inventory.ts";
import { projectMaterialsSchema } from "./construction/projectMaterials.ts";
import { takeoffSchema } from "./construction/altitudeTakeoff.ts";
import { trialSchema } from "./construction/connectionTrial.ts";
import { loadFencingRecipeSet } from "./fencingRecipePersistence.ts";
import { inspectPlanBytes } from "./documents.ts";
import { verifyPhotoContent, type StoredPhotoContent } from "./evidence.ts";
import type { StoredPlanContent } from "./documentContract.ts";
import { validateJobSheetMetadata } from "./sheetLifecycle.ts";
import { parseIndustryDraftLibrary } from "./industries/draftStorage.ts";
import { parsePriceBookLibrary } from "./pricing/priceBooks.ts";

export const BACKUP_FORMAT = "xray.workspace-backup/v2";
export const BACKUP_LEGACY_FORMAT = "xray.workspace-backup/v1";
export const MAX_BACKUP_BYTES = 200 * 1024 * 1024;
export const BACKUP_EXCLUSIONS = [
  "Assistant conversations and tool history (existing conversations stay on this device)",
  "Separate construction-runtime jobs and their history",
  "Source-model location notes, camera views and appearance settings",
  "Unsaved form edits, undo history, accounts and credentials",
] as const;
const text = z.string().min(1).max(300);
const raw = z.string().max(30 * 1024 * 1024).nullable();
export const backupRecordsSchema = z.object({
  architecture: raw, bom: raw, components: raw, recipes: raw,
  sourceTakeoff: raw, connectionReview: raw, materials: raw, referenceRates: raw,
  sheetMetadata: raw.optional(), priceBooks: raw.optional(), industryDrafts: raw.optional(),
}).strict();
export type BackupRecords = z.infer<typeof backupRecordsSchema>;
const assetSchema = z.object({
  id: text, kind: z.enum(["plan", "photo"]), name: text, mimeType: text,
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  bytesBase64: z.string().min(4).max(Math.ceil(100 * 1024 * 1024 / 3) * 4),
}).strict();
const payloadSchema = z.object({
  format: z.enum([BACKUP_FORMAT, BACKUP_LEGACY_FORMAT]), createdAt: z.string().datetime({ offset: true }),
  name: z.string().trim().min(1).max(120), job: fencingJobSchema,
  records: backupRecordsSchema, assets: z.array(assetSchema).max(2000),
}).strict();
export type ProjectBackup = z.infer<typeof payloadSchema>;
export type BackupAsset = z.infer<typeof assetSchema>;
export const emptyBackupRecords = (): BackupRecords => ({
  architecture: null, bom: null, components: null, recipes: null,
  sourceTakeoff: null, connectionReview: null, materials: null, referenceRates: null,
  sheetMetadata: null, priceBooks: null, industryDrafts: null,
});
export function backupPhotos(job: FencingJob): FencingJob["photos"] {
  const photos = new Map<string, FencingJob["photos"][number]>();
  for (const photo of [...job.photos, ...Object.values(job.documentWorkspaces ?? {}).flatMap(w => w.photos)]) {
    const previous = photos.get(photo.id);
    if (previous && (previous.sha256 !== photo.sha256 || previous.name !== photo.name ||
      previous.sizeBytes !== photo.sizeBytes || previous.mimeType !== photo.mimeType))
      throw Error("A photo identity refers to conflicting originals across document workspaces.");
    photos.set(photo.id, photo);
  }
  return [...photos.values()];
}
export async function backupDigest(value: string | ArrayBuffer): Promise<string> {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map(n => n.toString(16).padStart(2, "0")).join("");
}
export function encodeBackupBytes(bytes: ArrayBuffer): string {
  const array = new Uint8Array(bytes);
  let binary = "";
  for (let offset = 0; offset < array.length; offset += 16384)
    binary += String.fromCharCode(...array.subarray(offset, offset + 16384));
  return btoa(binary);
}
function decodeBackupAlphabet(value: string): Uint8Array<ArrayBuffer> {
  if (value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value))
    throw Error("Original file contains invalid base64.");
  const bufferApi = (globalThis as { Buffer?: { from(value: string, encoding: "base64"): Uint8Array } }).Buffer;
  if (bufferApi) return new Uint8Array(bufferApi.from(value, "base64"));
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
export function decodeBackupBytes(value: string): ArrayBuffer {
  const bytes = decodeBackupAlphabet(value);
  if (encodeBackupBytes(bytes.buffer) !== value) throw Error("Original file encoding is not canonical.");
  return bytes.buffer;
}
function sameId(actual: string, expected: string, label: string) {
  if (actual !== expected) throw Error(`${label} belongs to a different project.`);
}
export async function validateBackupRecords(records: BackupRecords, jobId: string) {
  const parse = (s: string) => JSON.parse(s);
  if (records.industryDrafts != null) parseIndustryDraftLibrary(records.industryDrafts, jobId);
  if (records.architecture !== null) sameId(validateProject(parse(records.architecture)).id, jobId, "Design");
  if (records.bom !== null) sameId(bomStateEnvelopeSchema.parse(parse(records.bom)).jobId, jobId, "BOM");
  if (records.components !== null) componentInventorySchema.parse(parse(records.components));
  if (records.materials !== null) sameId(projectMaterialsSchema.parse(parse(records.materials)).projectId, jobId, "Materials");
  if (records.sourceTakeoff !== null) sameId(takeoffSchema.parse(parse(records.sourceTakeoff)).projectId, jobId, "Takeoff");
  if (records.connectionReview !== null) sameId(trialSchema.parse(parse(records.connectionReview)).projectId, jobId, "Connection review");
  if (records.recipes !== null) {
    const result = await loadFencingRecipeSet(jobId, { getItem: () => records.recipes, setItem: () => { throw Error("Read only"); } });
    if (!result.ok) throw Error(`Saved recipes failed verification (${result.reason}).`);
  }
  if (records.referenceRates !== null) z.object({
    currency: z.enum(["AUD", "NZD", "USD", "GBP", "EUR"]),
    rows: z.array(z.object({ id: text, description: text, unit: text,
      rate: z.string().trim().min(1).max(100).refine(s => Number.isFinite(Number(s)) && Number(s) >= 0),
    }).strict()).max(1000),
  }).strict().parse(parse(records.referenceRates));
}
export async function validateProjectBackup(input: unknown): Promise<ProjectBackup> {
  const value = payloadSchema.parse(input);
  if (value.format === BACKUP_LEGACY_FORMAT && (value.records.sheetMetadata !== undefined || value.records.priceBooks !== undefined || value.records.industryDrafts !== undefined))
    throw Error("Sheet, price book and industry draft records require backup format v2.");
  await validateBackupRecords(value.records, value.job.id);
  validateJobSheetMetadata(value.records.sheetMetadata ?? null, value.job);
  if (value.records.priceBooks != null) parsePriceBookLibrary(value.records.priceBooks, value.job.id);
  const originals = value.job.documents.filter(d => d.source !== "sample");
  const photos = backupPhotos(value.job);
  if (new Set(value.assets.map(a => `${a.kind}:${a.id}`)).size !== value.assets.length)
    throw Error("Duplicate original file identities.");
  if (value.assets.length !== originals.length + photos.length)
    throw Error("Backup must include exactly every referenced original plan and photo.");
  for (const asset of value.assets) {
    const bytes = decodeBackupAlphabet(asset.bytesBase64).buffer;
    if (asset.kind === "plan") {
      const document = originals.find(d => d.id === asset.id);
      if (!document || !["pdf", "dxf", "svg", "dwg"].includes(document.kind)) throw Error("Unreferenced or unsupported original plan.");
      if (asset.name !== document.name) throw Error("Original plan name does not match its document.");
      const inspected = await inspectPlanBytes({ name: asset.name, bytes: new Uint8Array(bytes), source: "web" });
      if (inspected.binary.sha256 !== asset.sha256 || asset.sha256 !== document.sha256 ||
        inspected.binary.kind !== document.kind || inspected.binary.mimeType !== asset.mimeType || inspected.revision.pageCount !== document.pageCount)
        throw Error(`Original plan “${asset.name}” failed metadata or SHA-256 verification.`);
    } else {
      const photo = photos.find(p => p.id === asset.id);
      if (!photo) throw Error("Unreferenced original photo.");
      const result = await verifyPhotoContent({ id: asset.id, name: asset.name,
        mimeType: asset.mimeType as StoredPhotoContent["mimeType"], sha256: asset.sha256, bytes }, photo);
      if (result.status !== "ready") throw Error(result.message);
    }
  }
  // Material evidence may reference an original removed from the main document set.
  // Reject incomplete packages instead of silently calling them recoverable.
  if (value.records.materials !== null) {
    const materials = projectMaterialsSchema.parse(JSON.parse(value.records.materials));
    for (const source of materials.sources)
      if (!originals.some(d => d.sha256 === source.sha256))
        throw Error(`Material source “${source.name}” is missing from the project plans. Import that original before backing up.`);
  }
  return value;
}
export async function parseProjectBackup(serialized: string): Promise<ProjectBackup> {
  if (serialized.length > MAX_BACKUP_BYTES || new Blob([serialized]).size > MAX_BACKUP_BYTES) throw Error("Backup exceeds the 200 MB package limit.");
  return validateProjectBackup(JSON.parse(serialized));
}
export function backupContents(value: ProjectBackup) {
  return { plans: value.assets.filter(a => a.kind === "plan").length,
    photos: value.assets.filter(a => a.kind === "photo").length,
    records: Object.entries(value.records).filter(([, v]) => v != null).map(([key]) => key),
    jobRevision: value.job.revision, jobName: value.job.name };
}
export type BackupCapturePort = {
  records(jobId: string, job: FencingJob): Promise<BackupRecords>;
  plan(id: string): Promise<StoredPlanContent | null>;
  photo(id: string): Promise<StoredPhotoContent | null>;
  currentJob(): FencingJob;
};
export async function captureProjectBackup(job: FencingJob, name: string, port: BackupCapturePort): Promise<ProjectBackup> {
  const jobText = JSON.stringify(job), capturedJob = fencingJobSchema.parse(JSON.parse(jobText));
  const records = structuredClone(await port.records(capturedJob.id, capturedJob));
  const assets: BackupAsset[] = [];
  let total = jobText.length + JSON.stringify(records).length;
  for (const doc of capturedJob.documents.filter(d => d.source !== "sample")) {
    const content = await port.plan(doc.id);
    if (!content) throw Error(`Original plan “${doc.name}” is missing. No backup was saved.`);
    if (content.documentId !== doc.id || content.kind !== doc.kind || !(content.bytes instanceof ArrayBuffer) || content.sizeBytes !== content.bytes.byteLength)
      throw Error(`Original plan “${doc.name}” failed metadata or identity verification. No backup was saved.`);
    total += Math.ceil(content.bytes.byteLength / 3) * 4;
    if (total > MAX_BACKUP_BYTES) throw Error("Backup exceeds the 200 MB package limit.");
    assets.push({ id: doc.id, kind: "plan", name: content.name, mimeType: content.mimeType,
      sha256: content.sha256, bytesBase64: encodeBackupBytes(content.bytes) });
  }
  for (const photo of backupPhotos(capturedJob)) {
    const content = await port.photo(photo.id);
    if (!content) throw Error(`Original photo “${photo.name}” is missing. No backup was saved.`);
    if (content.id !== photo.id) throw Error(`Original photo “${photo.name}” failed identity verification. No backup was saved.`);
    total += Math.ceil(content.bytes.byteLength / 3) * 4;
    if (total > MAX_BACKUP_BYTES) throw Error("Backup exceeds the 200 MB package limit.");
    assets.push({ id: photo.id, kind: "photo", name: content.name, mimeType: content.mimeType,
      sha256: content.sha256, bytesBase64: encodeBackupBytes(content.bytes) });
  }
  const result = await validateProjectBackup({ format: BACKUP_FORMAT, name, job: capturedJob,
    createdAt: new Date().toISOString(), records, assets });
  // Re-read originals as well as module records: an unchanged job can still refer
  // to bytes removed or replaced by another window during asynchronous capture.
  // These checks detect observed races; they are not an exclusive write lease.
  for (const asset of result.assets) {
    const content = asset.kind === "plan" ? await port.plan(asset.id) : await port.photo(asset.id);
    const plan = asset.kind === "plan" ? content as StoredPlanContent | null : null;
    const photo = asset.kind === "photo" ? content as StoredPhotoContent | null : null;
    if (!content || !(content.bytes instanceof ArrayBuffer) || content.name !== asset.name ||
      content.mimeType !== asset.mimeType || content.sha256 !== asset.sha256 ||
      (plan && (plan.documentId !== asset.id || plan.kind !== capturedJob.documents.find(d => d.id === asset.id)!.kind || plan.sizeBytes !== plan.bytes.byteLength)) ||
      (photo && photo.id !== asset.id) || await backupDigest(content.bytes) !== asset.sha256)
      throw Error("Project originals changed while the backup was being prepared. Save again to capture a consistent version.");
  }
  const finalRecords = await port.records(capturedJob.id, capturedJob);
  // Read the live job after the final await, not before it: a late completed
  // import/edit must not escape the consistency check while records are read.
  if (JSON.stringify(port.currentJob()) !== jobText || JSON.stringify(finalRecords) !== JSON.stringify(records))
    throw Error("Project changed while the backup was being prepared. Save again to capture a consistent version.");
  if (new Blob([JSON.stringify(result)]).size > MAX_BACKUP_BYTES) throw Error("Backup exceeds the 200 MB package limit.");
  return result;
}
