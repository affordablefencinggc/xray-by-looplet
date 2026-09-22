import { Unzip, UnzipInflate, zipSync } from "fflate";
import { z } from "zod";
import {
  backupDigest, encodeBackupBytes, parseProjectBackup,
  type ProjectBackup,
} from "../projectBackup.ts";
import {
  PORTABLE_ARCHIVE_SCHEMA, archiveManifestSchema, archiveSealInput, canonicalJson,
  type ArchiveEntry, type ArchiveManifest,
} from "./portableArchive.ts";

export const MAX_ARCHIVE_BYTES = 200 * 1024 * 1024;
const MAX_ENTRY_BYTES = 100 * 1024 * 1024;
const RECORDS = "data/workspace.json";
const encoder = new TextEncoder(), decoder = new TextDecoder("utf-8", { fatal: true });
const jsonBytes = (value: unknown) => encoder.encode(canonicalJson(value));
const digest = (bytes: Uint8Array) => backupDigest(Uint8Array.from(bytes).buffer);
const assetMetadata = z.object({
  id: z.string().min(1).max(300), kind: z.enum(["plan", "photo"]),
  name: z.string().min(1).max(300), mimeType: z.string().min(1).max(300),
  sha256: z.string().regex(/^[a-f0-9]{64}$/), path: z.string(),
}).strict();
const workspaceEnvelope = z.object({
  format: z.enum(["xray.workspace-backup/v1", "xray.workspace-backup/v2"]),
  createdAt: z.string(), name: z.string(), job: z.unknown(), records: z.unknown(),
  assets: z.array(assetMetadata).max(2000),
}).strict();
function readJson(bytes: Uint8Array): unknown {
  const text = decoder.decode(bytes), value: unknown = JSON.parse(text);
  if (canonicalJson(value) !== text) throw Error("Archive JSON is not canonical or contains duplicate keys.");
  return value;
}
function supportedPath(path: string) {
  return path === "manifest.json" || path === RECORDS || /^(drawings|photos)\/[0-9]{1,4}\.(pdf|dxf|svg|dwg|bin)$/.test(path);
}

/** ZIP directory and local headers must agree before any inflater sees bytes.
 * No descriptors, encryption, ZIP64, hidden data, duplicate names or traversal.
 * This container accepts stored or deflated entries and bounds actual inflation.
 */
function directory(bytes: Uint8Array): Map<string, number> {
  if (bytes.length < 22 || bytes.length > MAX_ARCHIVE_BYTES) throw Error("Unsupported portable archive size.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), end = bytes.length - 22;
  const u16 = (at: number) => view.getUint16(at, true), u32 = (at: number) => view.getUint32(at, true);
  const count = u16(end + 10);
  if (u32(end) !== 0x06054b50 || u16(end + 20) !== 0 || u16(end + 4) !== 0 || u16(end + 6) !== 0 ||
      u16(end + 8) !== count || count < 2 || count > 2002) throw Error("Unsupported portable ZIP directory.");
  let offset = u32(end + 16), total = 0; const start = offset;
  if (start + u32(end + 12) !== end) throw Error("Invalid portable ZIP directory bounds.");
  const entries = new Map<string, number>(), ranges: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || u32(offset) !== 0x02014b50) throw Error("Invalid portable ZIP entry.");
    const flags = u16(offset + 8), method = u16(offset + 10), compressed = u32(offset + 20), size = u32(offset + 24);
    const nameLength = u16(offset + 28), extra = u16(offset + 30), comment = u16(offset + 32), local = u32(offset + 42);
    if (offset + 46 + nameLength + extra + comment > end) throw Error("Invalid portable ZIP entry bounds.");
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    total += size;
    if (!supportedPath(name) || entries.has(name) || (flags & ~0x800) !== 0 || ![0, 8].includes(method) ||
        size > MAX_ENTRY_BYTES || total > MAX_ARCHIVE_BYTES) throw Error("Unsupported archive path, duplicate or entry size.");
    if (local + 30 > start || u32(local) !== 0x04034b50 || u16(local + 6) !== flags || u16(local + 8) !== method ||
        u32(local + 14) !== u32(offset + 16) || u32(local + 18) !== compressed || u32(local + 22) !== size || u16(local + 26) !== nameLength)
      throw Error("Portable ZIP local metadata differs from its directory.");
    const data = local + 30 + nameLength + u16(local + 28), finish = data + compressed;
    if (finish > start || decoder.decode(bytes.subarray(local + 30, local + 30 + nameLength)) !== name)
      throw Error("Portable ZIP data is out of bounds.");
    entries.set(name, size); ranges.push([local, finish]); offset += 46 + nameLength + extra + comment;
  }
  if (offset !== end) throw Error("Unexpected portable ZIP directory data.");
  ranges.sort((a, b) => a[0] - b[0]);
  if (ranges[0][0] !== 0 || ranges.some((r, i) => r[1] !== (ranges[i + 1]?.[0] ?? start)))
    throw Error("Portable ZIP contains hidden or overlapping data.");
  return entries;
}
function unpack(bytes: Uint8Array): Record<string, Uint8Array> {
  const expected = directory(bytes), files: Record<string, Uint8Array> = Object.create(null), seen = new Set<string>();
  let total = 0;
  const unzip = new Unzip(file => {
    if (!expected.has(file.name) || seen.has(file.name)) throw Error("Unexpected portable ZIP stream entry.");
    seen.add(file.name);
    const chunks: Uint8Array[] = []; let size = 0;
    file.ondata = (error, chunk, final) => {
      if (error) throw error;
      size += chunk.length; total += chunk.length;
      if (size > expected.get(file.name)! || size > MAX_ENTRY_BYTES || total > MAX_ARCHIVE_BYTES) {
        file.terminate(); throw Error("Portable archive inflated beyond its declared size.");
      }
      chunks.push(chunk);
      if (final) {
        if (size !== expected.get(file.name)) throw Error("Portable ZIP entry size differs from its directory.");
        const combined = new Uint8Array(size); let at = 0;
        for (const part of chunks) { combined.set(part, at); at += part.length; }
        files[file.name] = combined;
      }
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  for (let at = 0; at < bytes.length; at += 1024) unzip.push(bytes.subarray(at, at + 1024), at + 1024 >= bytes.length);
  if (Object.keys(files).length !== expected.size || !files["manifest.json"] || !files[RECORDS])
    throw Error("Portable archive is incomplete.");
  return files;
}

/** Base64 is the JSON backup envelope. The ZIP stores the original bytes, so this decode
 * does not re-encode them to prove canonicity. SHA-256 against the asset record does that. */
function rawAssetBytes(value: string): Uint8Array {
  if (value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value))
    throw Error("Original file contains invalid base64.");
  const bufferApi = (globalThis as { Buffer?: { from(value: string, encoding: "base64"): Uint8Array } }).Buffer;
  if (bufferApi) return new Uint8Array(bufferApi.from(value, "base64"));
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/** Pure container step. Capture/restore owns storage and concurrency; this writes no workspace data.
 * Plan and photo bytes are copied out of the backup envelope once and stored verbatim. */
export async function createProjectArchive(input: ProjectBackup, client: string | null = null) {
  const files: Record<string, Uint8Array> = Object.create(null), entries: ArchiveEntry[] = [];
  const assets = input.assets.map((asset, index) => {
    const { bytesBase64, ...metadata } = asset;
    const kind = input.job.documents.find(d => d.id === asset.id)?.kind;
    const extension = asset.kind === "plan" && kind && ["pdf", "dxf", "svg", "dwg"].includes(kind) ? kind : "bin";
    const path = `${asset.kind === "plan" ? "drawings" : "photos"}/${index}.${extension}`;
    const bytes = rawAssetBytes(bytesBase64);
    files[path] = bytes;
    entries.push({ path, kind: asset.kind, id: asset.id, sha256: asset.sha256, sizeBytes: bytes.length });
    return { ...metadata, path };
  });
  for (const entry of entries) {
    if (await digest(files[entry.path]) !== entry.sha256)
      throw Error(`Original file ${entry.path} failed SHA-256 verification.`);
  }
  const backup = input;
  files[RECORDS] = jsonBytes({ ...backup, assets });
  entries.push({ path: RECORDS, kind: "record", id: "workspace", sha256: await digest(files[RECORDS]), sizeBytes: files[RECORDS].length });
  const base = { format: PORTABLE_ARCHIVE_SCHEMA, createdAt: backup.createdAt, jobId: backup.job.id,
    jobName: backup.job.name, jobRevision: backup.job.revision, client: client?.trim() ?? null, sourceFormat: backup.format,
    recordsPath: RECORDS, entries, entryCount: entries.length, totalBytes: entries.reduce((sum, e) => sum + e.sizeBytes, 0) };
  const manifest = archiveManifestSchema.parse({ ...base, sealSha256: await backupDigest(canonicalJson(base)) });
  if (entries.some(e => e.sizeBytes > MAX_ENTRY_BYTES) || manifest.totalBytes > MAX_ARCHIVE_BYTES) throw Error("Project exceeds the portable archive size limit.");
  files["manifest.json"] = jsonBytes(manifest);
  const bytes = zipSync(files, { level: 0, mtime: new Date("2000-01-01T00:00:00Z") });
  if (bytes.length > MAX_ARCHIVE_BYTES) throw Error("Project exceeds the portable archive size limit.");
  return { bytes, manifest };
}

/** No storage callback is accepted: all bytes and semantic references verify before the caller can restore. */
export async function parseProjectArchive(input: Uint8Array): Promise<{ backup: ProjectBackup; manifest: ArchiveManifest }> {
  if (input.length > MAX_ARCHIVE_BYTES) throw Error("Unsupported portable archive size.");
  const files = unpack(Uint8Array.from(input)), manifest = archiveManifestSchema.parse(readJson(files["manifest.json"]));
  if (await backupDigest(archiveSealInput(manifest)) !== manifest.sealSha256) throw Error("Portable archive manifest failed SHA-256 verification.");
  if (manifest.recordsPath !== RECORDS || Object.keys(files).length !== manifest.entries.length + 1 ||
      manifest.entries.some(e => e.path === "manifest.json" || !files[e.path])) throw Error("Portable archive membership differs from its manifest.");
  for (const entry of manifest.entries) {
    if (files[entry.path].length !== entry.sizeBytes || await digest(files[entry.path]) !== entry.sha256)
      throw Error(`Portable file ${entry.path} failed SHA-256 verification.`);
  }
  const raw = workspaceEnvelope.parse(readJson(files[RECORDS]));
  if (raw.assets.length + 1 !== manifest.entries.length || new Set(raw.assets.map(a => a.path)).size !== raw.assets.length)
    throw Error("Portable asset membership is inconsistent.");
  const assets = raw.assets.map(({ path, ...asset }) => {
    const entry = manifest.entries.find(e => e.path === path);
    if (!entry || entry.kind !== asset.kind || entry.id !== asset.id || entry.sha256 !== asset.sha256)
      throw Error("Portable asset identity differs from its manifest.");
    return { ...asset, bytesBase64: encodeBackupBytes(Uint8Array.from(files[path]).buffer) };
  });
  const backup = await parseProjectBackup(JSON.stringify({ ...raw, assets }));
  if (manifest.jobId !== backup.job.id || manifest.jobName !== backup.job.name || manifest.jobRevision !== backup.job.revision ||
      manifest.createdAt !== backup.createdAt || manifest.sourceFormat !== backup.format)
    throw Error("Portable manifest and workspace identity differ.");
  return { backup, manifest };
}
