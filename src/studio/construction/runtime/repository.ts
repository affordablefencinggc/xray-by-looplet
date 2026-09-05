import { z } from 'zod';
import { constructionJobSchema, sourceRevisionSchema, evidenceSchema, calibrationSchema, workPackageSchema, measurementSchema } from '../contract.ts';
import type { ConstructionJob } from '../contract.ts';
import { canonicalJson, validateJobTransition } from '../lifecycle.ts';
import type { ConstructionCommand, ConstructionCommandPort } from '../lifecycle.ts';

export const MAX_ORIGINAL_BYTES = 100 * 1024 * 1024;
const RECORD_SCHEMA = 'xray.construction-runtime/v1';
const STORES = ['heads', 'snapshots', 'assets', 'commands'] as const;
const identity = z.string().min(1).max(240).refine(s => s.trim() === s);
const attributionSchema = z.object({ commandId: identity, actor: identity, occurredAt: z.string().datetime({ offset: true }) }).strict();
const envelope = { ...attributionSchema.shape, jobId: identity, expectedJobRevision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER) };
const commandSchema = z.discriminatedUnion('kind', [
  z.object({ ...envelope, kind: z.literal('append-source'), source: sourceRevisionSchema }).strict(),
  z.object({ ...envelope, kind: z.literal('append-evidence'), evidence: evidenceSchema }).strict(),
  z.object({ ...envelope, kind: z.literal('append-calibration'), calibration: calibrationSchema }).strict(),
  z.object({ ...envelope, kind: z.literal('put-work-package'), workPackage: workPackageSchema }).strict(),
  z.object({ ...envelope, kind: z.literal('put-measurement'), measurement: measurementSchema }).strict(),
  z.object({ ...envelope, kind: z.literal('review-measurement'), measurementId: identity, expectedMeasurementRevision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), decision: z.enum(['approved','rejected']), note: z.string().max(2000) }).strict(),
]);
export type Attribution = z.infer<typeof attributionSchema>;
export type RuntimeFailureCode = 'conflict' | 'invalid' | 'storage' | 'missing' | 'corrupt' | 'archived';
export type RuntimeResult<T> = { ok: true; value: T } | { ok: false; code: RuntimeFailureCode; message: string };
export type OriginalAsset = { assetId: string; bytes: ArrayBuffer };
export type JobSummary = { id: string; name: string; revision: number; archived: boolean; updatedAt: string };
export type RuntimeOptions = {
  databaseName?: string;
  factory?: IDBFactory;
  /** Fault injection aborts the real transaction; never substitutes persistence or a result. */
  onWritesStaged?: () => 'abort' | void;
};
type Record = { schema: typeof RECORD_SCHEMA; job: ConstructionJob; archived: boolean; attribution: Attribution };
const runtimeRecordSchema = z.object({ schema: z.literal(RECORD_SCHEMA), job: constructionJobSchema, archived: z.boolean(), attribution: attributionSchema }).strict();
type AssetRecord = { jobId: string; assetId: string; sha256: string; bytes: ArrayBuffer };
class Failure extends Error { constructor(readonly code: RuntimeFailureCode, message: string) { super(message); } }
const fail = (code: RuntimeFailureCode, message: string): never => { throw new Failure(code, message); };
const request = <T>(req: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed.'));
});
const completed = (tx: IDBTransaction) => new Promise<void>((resolve, reject) => {
  tx.oncomplete = () => resolve();
  tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted.'));
  tx.onerror = () => { /* Abort is the transaction-level failure signal. */ };
});
function parseRecord(value: unknown): Record {
  if (!value || typeof value !== 'object') return fail('missing', 'Job or snapshot was not found.');
  const r = value as Record;
  if (r.schema !== RECORD_SCHEMA || typeof r.archived !== 'boolean') return fail('corrupt', 'Unknown or corrupt runtime record; preserved unchanged.');
  try { return runtimeRecordSchema.parse(r); }
  catch { return fail('corrupt', 'Invalid or future job schema; preserved unchanged.'); }
}
async function digest(bytes: ArrayBuffer) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('');
}
function copyBytes(bytes: ArrayBuffer): ArrayBuffer {
  if (!(bytes instanceof ArrayBuffer) || bytes.byteLength < 1 || bytes.byteLength > MAX_ORIGINAL_BYTES) return fail('invalid', 'Original bytes must contain 1 to 100 MiB.');
  return bytes.slice(0);
}
async function guard<T>(operation: () => Promise<T>): Promise<RuntimeResult<T>> {
  try { return { ok: true, value: await operation() }; }
  catch (error) {
    return { ok: false, code: error instanceof Failure ? error.code : error instanceof z.ZodError ? 'invalid' : 'storage', message: error instanceof Error ? error.message : 'Storage operation failed.' };
  }
}

/** Isolated local database. Never reads, changes or deletes existing fencing/app storage. */
export class ConstructionRepository implements ConstructionCommandPort {
  private database: Promise<IDBDatabase> | undefined;
  private readonly options: RuntimeOptions;
  constructor(options: RuntimeOptions = {}) { this.options = options; }
  private connect(): Promise<IDBDatabase> {
    if (this.database) return this.database;
    this.database = new Promise((resolve, reject) => {
      const factory = this.options.factory ?? globalThis.indexedDB;
      if (!factory) { reject(new Failure('storage', 'IndexedDB is unavailable.')); return; }
      const opening = factory.open(this.options.databaseName ?? 'xray-construction-runtime-v1', 1);
      opening.onupgradeneeded = () => {
        const db = opening.result;
        db.createObjectStore('heads', { keyPath: 'job.id' });
        db.createObjectStore('snapshots', { keyPath: ['job.id', 'job.revision'] });
        db.createObjectStore('assets', { keyPath: ['jobId', 'assetId'] });
        db.createObjectStore('commands', { keyPath: ['jobId', 'commandId'] });
      };
      opening.onsuccess = () => {
        const db = opening.result;
        db.onversionchange = () => { db.close(); this.database = undefined; };
        resolve(db);
      };
      opening.onerror = () => { this.database = undefined; reject(opening.error); };
      opening.onblocked = () => { this.database = undefined; reject(new Failure('storage', 'Database upgrade blocked by another tab.')); };
    });
    return this.database;
  }
  async close(): Promise<void> { if (this.database) (await this.database).close(); this.database = undefined; }
  private async read(id: string, revision?: number): Promise<{ record: Record; assets: AssetRecord[] }> {
    identity.parse(id);
    const db = await this.connect(), tx = db.transaction(['heads', 'snapshots', 'assets'], 'readonly');
    const done = completed(tx); void done.catch(() => {});
    try {
      const raw = await request(tx.objectStore(revision === undefined ? 'heads' : 'snapshots').get(revision === undefined ? id : [id, revision]));
      const record = parseRecord(raw);
      const assets = await Promise.all(record.job.sources.map(source => request<AssetRecord | undefined>(tx.objectStore('assets').get([id, source.assetId]))));
      await done;
      if (assets.some(a => !a)) return fail('corrupt', 'Original source asset missing; job preserved unchanged.');
      await this.verifyAssets(record.job, assets as AssetRecord[]);
      return { record, assets: assets as AssetRecord[] };
    } catch (error) { try { tx.abort(); } catch { /* Read transaction may already be complete. */ } throw error; }
  }
  private async verifyAssets(job: ConstructionJob, assets: AssetRecord[]) {
    const cache = new Map<string, string>();
    for (const source of job.sources) {
      const asset = assets.find(a => a.assetId === source.assetId);
      if (!asset || asset.jobId !== job.id || asset.sha256 !== source.sha256) return fail('corrupt', 'Missing or mismatched original source record.');
      if (!cache.has(asset.assetId)) {
        try { cache.set(asset.assetId, await digest(copyBytes(asset.bytes))); }
        catch { return fail('corrupt', 'Original source bytes are corrupt or outside the supported size.'); }
      }
      if (cache.get(asset.assetId) !== source.sha256) return fail('corrupt', 'Original source SHA-256 mismatch; job preserved unchanged.');
    }
    for (const asset of job.extensions.legacyFencing?.preservedAssets ?? []) {
      if (asset.bytesBase64.length > Math.ceil(MAX_ORIGINAL_BYTES / 3) * 4) return fail('corrupt', 'Preserved legacy asset exceeds 100 MiB.');
      const binary = atob(asset.bytesBase64), bytes = Uint8Array.from(binary, c => c.charCodeAt(0)).buffer;
      if (await digest(copyBytes(bytes)) !== asset.sha256) return fail('corrupt', 'Preserved legacy asset hash mismatch.');
    }
  }
  private async prepareAssets(job: ConstructionJob, originals: OriginalAsset[], existing: AssetRecord[] = []): Promise<AssetRecord[]> {
    if (!Array.isArray(originals) || new Set(originals.map(a => a.assetId)).size !== originals.length) return fail('invalid', 'Duplicate or invalid supplied asset collection.');
    const prepared: AssetRecord[] = [];
    for (const original of originals) {
      identity.parse(original.assetId);
      if (!job.sources.some(s => s.assetId === original.assetId)) return fail('invalid', 'Unreferenced original asset rejected.');
      const bytes = copyBytes(original.bytes), sha256 = await digest(bytes);
      const retained = existing.find(a => a.assetId === original.assetId);
      if (retained && retained.sha256 !== sha256) return fail('invalid', 'Original assets are immutable; use a new asset identity.');
      prepared.push({ jobId: job.id, assetId: original.assetId, sha256, bytes });
    }
    const combined = [...existing.filter(a => !prepared.some(p => p.assetId === a.assetId)), ...prepared];
    await this.verifyAssets(job, combined);
    return combined;
  }
  private async commit(previous: Record | undefined, next: Record, assets: AssetRecord[]) {
    const db = await this.connect(), tx = db.transaction([...STORES], 'readwrite'), done = completed(tx); void done.catch(() => {});
    try {
      const actual = await request(tx.objectStore('heads').get(next.job.id));
      if (previous ? !actual || canonicalJson(actual) !== canonicalJson(previous) : actual !== undefined) return fail('conflict', 'Another tab changed this job; reopen before retrying.');
      if (previous) {
        const snapshot = await request(tx.objectStore('snapshots').get([previous.job.id, previous.job.revision]));
        if (!snapshot || canonicalJson(snapshot) !== canonicalJson(previous)) return fail('corrupt', 'Previous immutable snapshot is missing or corrupt; no writes accepted.');
      }
      if (await request(tx.objectStore('commands').get([next.job.id, next.attribution.commandId]))) return fail('conflict', 'Command identity already used; provide a new command ID.');
      const storedAssets = await Promise.all(assets.map(a => request<AssetRecord | undefined>(tx.objectStore('assets').get([a.jobId, a.assetId]))));
      for (let i = 0; i < assets.length; i++) {
        const a = assets[i], stored = storedAssets[i];
        if (!stored && previous?.job.sources.some(s => s.assetId === a.assetId)) return fail('corrupt', 'Original asset disappeared during commit; no automatic repair attempted.');
        // Content was rehashed outside the transaction. Compare exact bytes here to detect same-revision corruption/races.
        const expectedBytes = new Uint8Array(a.bytes);
        if (stored && (stored.sha256 !== a.sha256 || !(stored.bytes instanceof ArrayBuffer) || stored.bytes.byteLength !== a.bytes.byteLength || !new Uint8Array(stored.bytes).every((v, j) => v === expectedBytes[j]))) return fail('corrupt', 'Original bytes changed during commit; no writes accepted.');
        if (!stored) tx.objectStore('assets').add(a);
      }
      tx.objectStore('snapshots').add(next);
      tx.objectStore('heads').put(next);
      tx.objectStore('commands').add({ jobId: next.job.id, ...next.attribution, revision: next.job.revision });
      if (this.options.onWritesStaged?.() === 'abort') tx.abort();
      await done;
    } catch (error) { try { tx.abort(); } catch { /* Already aborted/complete. */ } throw error; }
  }
  create(input: unknown, originals: OriginalAsset[], attribution: Attribution): Promise<RuntimeResult<ConstructionJob>> {
    return guard(async () => {
      const job = constructionJobSchema.parse(input), actor = attributionSchema.parse(attribution);
      if (job.revision !== 1 || job.createdAt !== actor.occurredAt || job.updatedAt !== actor.occurredAt) return fail('invalid', 'New jobs start at revision one with the supplied creation time.');
      if (job.measurements.some(m => m.review.status !== 'draft')) return fail('invalid', 'Imported measurements must begin in draft; approve through an attributed review command.');
      const assets = await this.prepareAssets(job, originals);
      await this.commit(undefined, { schema: RECORD_SCHEMA, job, archived: false, attribution: actor }, assets);
      return job;
    });
  }
  open(id: string): Promise<RuntimeResult<ConstructionJob>> { return guard(async () => (await this.read(id)).record.job); }
  original(id: string, assetId: string): Promise<RuntimeResult<ArrayBuffer>> {
    return guard(async () => { identity.parse(assetId); const { assets } = await this.read(id); const asset = assets.find(a => a.assetId === assetId); if (!asset) return fail('missing', 'Original asset is not referenced by this job.'); return asset.bytes.slice(0); });
  }
  snapshot(id: string, revision: number): Promise<RuntimeResult<ConstructionJob>> {
    return guard(async () => { if (!Number.isSafeInteger(revision) || revision < 1) return fail('invalid', 'Snapshot revision must be positive.'); return (await this.read(id, revision)).record.job; });
  }
  list(includeArchived = false): Promise<RuntimeResult<JobSummary[]>> {
    return guard(async () => {
      const db = await this.connect(), tx = db.transaction('heads', 'readonly'), done = completed(tx);
      const records = await request<unknown[]>(tx.objectStore('heads').getAll()); await done;
      return records.map(parseRecord).filter(r => includeArchived || !r.archived).map(r => ({ id: r.job.id, name: r.job.name, revision: r.job.revision, archived: r.archived, updatedAt: r.job.updatedAt })).sort((a, b) => a.id.localeCompare(b.id));
    });
  }
  archive(id: string, expectedRevision: number, attribution: Attribution): Promise<RuntimeResult<ConstructionJob>> {
    return guard(async () => {
      const { record, assets } = await this.read(id), actor = attributionSchema.parse(attribution);
      if (record.archived) return fail('archived', 'Job is already archived.');
      if (record.job.revision !== expectedRevision) return fail('conflict', 'Expected revision does not match the job.');
      let job: ConstructionJob;
      try { job = validateJobTransition(record.job, { ...record.job, revision: record.job.revision + 1, updatedAt: actor.occurredAt }); }
      catch (error) { return fail('invalid', error instanceof Error ? error.message : 'Invalid archival transition.'); }
      await this.commit(record, { schema: RECORD_SCHEMA, job, archived: true, attribution: actor }, assets); return job;
    });
  }
  async execute(input: ConstructionCommand, originals: OriginalAsset[] = []): ReturnType<ConstructionCommandPort['execute']> {
    const result = await guard(async () => {
      const command = commandSchema.parse(input);
      const actor = attributionSchema.parse({ commandId: command.commandId, actor: command.actor, occurredAt: command.occurredAt });
      if (!Number.isSafeInteger(command.expectedJobRevision) || command.expectedJobRevision < 1) return fail('invalid', 'Expected job revision must be positive.');
      const { record, assets } = await this.read(command.jobId);
      if (record.archived) return fail('archived', 'Archived jobs cannot receive commands.');
      if (record.job.revision !== command.expectedJobRevision) return fail('conflict', 'Expected revision does not match the job.');
      const next = structuredClone(record.job); next.revision++; next.updatedAt = actor.occurredAt;
      switch (command.kind) {
        case 'append-source': if (command.source.importedAt !== actor.occurredAt) return fail('invalid', 'Source import time must match command attribution.'); next.sources.push(command.source); break;
        case 'append-evidence': next.evidence.push(command.evidence); break;
        case 'append-calibration': if (command.calibration.verifiedBy !== actor.actor || command.calibration.verifiedAt !== actor.occurredAt) return fail('invalid', 'Calibration attribution must match the local actor.'); next.calibrations.push(command.calibration); break;
        case 'put-work-package': {
          const i = next.workPackages.findIndex(p => p.id === command.workPackage.id);
          if (i < 0) next.workPackages.push(command.workPackage); else { next.workPackages[i] = command.workPackage; if (canonicalJson(record.job.workPackages[i]) !== canonicalJson(command.workPackage)) for (const m of next.measurements.filter(m => m.workPackageId === command.workPackage.id)) m.review = { status: 'draft' }; }
          break;
        }
        case 'put-measurement': {
          if (command.measurement.review.status !== 'draft') return fail('invalid', 'Use an attributed review command to approve/reject a measurement.');
          const i = next.measurements.findIndex(m => m.id === command.measurement.id); if (i < 0) next.measurements.push(command.measurement); else next.measurements[i] = command.measurement; break;
        }
        case 'review-measurement': {
          const m = next.measurements.find(m => m.id === command.measurementId);
          if (!m || m.revision !== command.expectedMeasurementRevision) return fail('conflict', 'Measurement revision no longer matches.');
          m.review = { status: command.decision, measurementRevision: m.revision, decidedBy: actor.actor, decidedAt: actor.occurredAt, note: command.note }; break;
        }
        default: return fail('invalid', 'Unsupported construction command; no data discarded.');
      }
      let job: ConstructionJob;
      try { job = validateJobTransition(record.job, next); } catch (error) { return fail('invalid', error instanceof Error ? error.message : 'Invalid transition.'); }
      const prepared = await this.prepareAssets(job, originals, assets);
      await this.commit(record, { schema: RECORD_SCHEMA, job, archived: false, attribution: actor }, prepared); return job;
    });
    return result.ok ? { ok: true, job: result.value } : { ok: false, code: ['invalid', 'corrupt', 'missing', 'archived'].includes(result.code) ? 'invalid' : result.code as 'conflict' | 'storage', message: result.message };
  }
}
