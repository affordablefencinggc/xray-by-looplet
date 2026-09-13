import { industryDraftKey } from "./industries/draftStorage.ts";
import { z } from "zod";
import type { FencingJob } from "./domain.ts";
import { readJobSheetMetadata } from "./sheetLifecycle.ts";
import { priceBookKey } from "./pricing/priceBooks.ts";
import { architectKey } from "./architect/persistence.ts";
import { bomStorageKey } from "./bomPersistence.ts";
import { inventoryStorageKey } from "./construction/inventoryPersistence.ts";
import { fencingRecipeStorageKey } from "./fencingRecipePersistence.ts";
import { takeoffKey } from "./construction/altitudeTakeoff.ts";
import { trialKey } from "./construction/connectionTrial.ts";
import { restoreMaterialDatabase } from "./projectMaterialsPersistence.ts";
import { backupContents, backupDigest, parseProjectBackup, type BackupRecords, type ProjectBackup } from "./projectBackup.ts";

export const BACKUP_DATABASE = "xray-workspace-backups-v1";
const summarySchema = z.object({
  id: z.string().uuid(), name: z.string().trim().min(1).max(120),
  createdAt: z.string().datetime({ offset: true }), storedAt: z.string().datetime({ offset: true }),
  archived: z.boolean(), revision: z.number().int().positive(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/), sizeBytes: z.number().int().positive(),
  jobName: z.string(), jobId: z.string(), jobRevision: z.number().int().positive(),
  plans: z.number().int().nonnegative(), photos: z.number().int().nonnegative(),
  records: z.array(z.string()),
}).strict();
export type BackupSummary = z.infer<typeof summarySchema>;
export async function readBackupRecords(jobId: string, job: FencingJob): Promise<BackupRecords> {
  // Explicit allowlist. Never enumerate storage or include credentials, queues or other projects.
  const materials = await restoreMaterialDatabase(jobId);
  if (materials.blocked || materials.error) throw Error(materials.error ?? "Material inventory is not readable.");
  return {
    architecture: localStorage.getItem(architectKey(jobId)),
    bom: localStorage.getItem(bomStorageKey(jobId)),
    components: localStorage.getItem(inventoryStorageKey(jobId)),
    recipes: localStorage.getItem(fencingRecipeStorageKey(jobId)),
    sourceTakeoff: localStorage.getItem(takeoffKey(jobId)),
    connectionReview: localStorage.getItem(trialKey(jobId)),
    materials: materials.raw, referenceRates: localStorage.getItem("xray.price-sheet.v1"),
    sheetMetadata: readJobSheetMetadata(job, localStorage),
    priceBooks: localStorage.getItem(priceBookKey(jobId)),
    industryDrafts: localStorage.getItem(industryDraftKey(jobId)),
  };
}
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(BACKUP_DATABASE, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("summaries", { keyPath: "id" });
      request.result.createObjectStore("packages");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? Error("Backup storage is unavailable."));
    request.onblocked = () => reject(Error("Backup storage is blocked by another app window."));
  });
}
async function transact<T>(mode: IDBTransactionMode, issue: (tx: IDBTransaction, result: (value: T) => void, fail: (error: Error) => void) => void): Promise<T> {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(["summaries", "packages"], mode);
      let result: T, reason: Error | undefined;
      const fail = (error: Error) => { reason = error; tx.abort(); };
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(reason ?? tx.error ?? Error("Backup transaction did not complete. Previous backups are unchanged."));
      tx.onerror = () => { /* Transaction abort reports the failure. */ };
      try { issue(tx, value => { result = value; }, fail); }
      catch (error) { fail(error instanceof Error ? error : Error("Backup operation failed.")); }
    });
  } finally { db.close(); }
}
export async function listProjectBackups(): Promise<BackupSummary[]> {
  return transact("readonly", (tx, result, fail) => {
    const req = tx.objectStore("summaries").getAll();
    req.onsuccess = () => {
      try { result(z.array(summarySchema).parse(req.result).sort((a, b) => b.storedAt.localeCompare(a.storedAt))); }
      catch { fail(Error("The backup catalogue contains an unreadable entry. Stored data has been preserved.")); }
    };
  });
}
export async function storeProjectBackup(candidate: ProjectBackup): Promise<BackupSummary> {
  // Revalidate even callers that bypass the import preview.
  const serialized = JSON.stringify(candidate), value = await parseProjectBackup(serialized);
  const summary = summarySchema.parse({ id: crypto.randomUUID(), name: value.name,
    createdAt: value.createdAt, storedAt: new Date().toISOString(), archived: false, revision: 1,
    sha256: await backupDigest(serialized), sizeBytes: new Blob([serialized]).size,
    jobId: value.job.id, ...backupContents(value) });
  return transact("readwrite", (tx, result) => {
    tx.objectStore("packages").add(serialized, summary.id);
    tx.objectStore("summaries").add(summary);
    result(summary);
  });
}
export async function readProjectBackup(id: string): Promise<{ summary: BackupSummary; value: ProjectBackup; serialized: string }> {
  const { summary, serialized } = await transact<{ summary: BackupSummary; serialized: string }>("readonly", (tx, result, fail) => {
    const metadata = tx.objectStore("summaries").get(id), content = tx.objectStore("packages").get(id);
    let meta: BackupSummary | undefined, data: string | undefined;
    const finish = () => { if (meta && data !== undefined) result({ summary: meta, serialized: data }); };
    metadata.onsuccess = () => {
      try { meta = summarySchema.parse(metadata.result); finish(); }
      catch { fail(Error("Backup metadata is missing or invalid. Original stored data is preserved.")); }
    };
    content.onsuccess = () => {
      if (typeof content.result !== "string") { fail(Error("Backup package is missing. Nothing was restored.")); return; }
      data = content.result; finish();
    };
  });
  if (new Blob([serialized]).size !== summary.sizeBytes || await backupDigest(serialized) !== summary.sha256)
    throw Error("Backup failed SHA-256 verification. Stored bytes are preserved; download and import are blocked.");
  const value = await parseProjectBackup(serialized);
  if (value.job.id !== summary.jobId || value.createdAt !== summary.createdAt)
    throw Error("Backup identity does not match its catalogue entry.");
  return { summary, value, serialized };
}
export function updateBackupSummary(previous: BackupSummary, change: { name?: string; archived?: boolean }): Promise<BackupSummary> {
  const next = summarySchema.parse({ ...previous, ...change, revision: previous.revision + 1 });
  return transact("readwrite", (tx, result, fail) => {
    const store = tx.objectStore("summaries"), request = store.get(previous.id);
    request.onsuccess = () => {
      if (JSON.stringify(request.result) !== JSON.stringify(previous)) {
        fail(Error("This backup changed in another window. Refresh the library before trying again.")); return;
      }
      store.put(next); result(next);
    };
  });
}
