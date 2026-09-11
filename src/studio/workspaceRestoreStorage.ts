import { backupDigest, captureProjectBackup, decodeBackupBytes, parseProjectBackup, type ProjectBackup } from "./projectBackup.ts";
import { readBackupRecords, readProjectBackup, storeProjectBackup } from "./projectBackupStorage.ts";
import { assessBackupRestore } from "./backupRestorePreflight.ts";
import { planRestoreMutations, validateRestorePlan } from "./workspaceRestorePlan.ts";
import { restoreOperationSchema, type RestoreMutation, type RestoreOperation, type RestorePorts } from "./workspaceRestore.ts";
import { loadFencingJob } from "./persistence.ts";
import { createBrowserPlanStore } from "./documents.ts";
import { createBrowserPhotoStore, PHOTO_CONTENT_DB, PHOTO_CONTENT_STORE } from "./evidence.ts";
import { PLAN_CONTENT_DB, PLAN_CONTENT_STORE } from "./documentContract.ts";
import { MATERIALS_DB, restoreMaterialDatabase } from "./projectMaterialsPersistence.ts";

export const RESTORE_DATABASE = "xray-workspace-restore-v1";
const JOURNAL_STORE = "journal";
type Envelope = { serialized: string; sha256: string };

async function transaction<T>(database: string, storeName: string, keyPath: string | undefined, mode: IDBTransactionMode,
  issue: (store: IDBObjectStore, done: (v: T) => void, fail: (e: Error) => void) => void): Promise<T> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(database, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName, keyPath ? { keyPath } : undefined);
    request.onerror = () => reject(request.error ?? Error("Workspace storage could not be opened."));
    request.onblocked = () => reject(Error("Another X-Ray window is blocking workspace storage."));
    request.onsuccess = () => resolve(request.result);
  });
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(storeName, mode); let result: T, failure: Error | undefined;
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(failure ?? tx.error ?? Error("Workspace storage transaction failed."));
      tx.onerror = () => {};
      const fail = (e: Error) => { failure = e; tx.abort(); };
      try { issue(tx.objectStore(storeName), v => { result = v; }, fail); } catch (e) { fail(e instanceof Error ? e : Error(String(e))); }
    });
  } finally { db.close(); }
}
const journalTransaction = <T>(mode: IDBTransactionMode, issue: Parameters<typeof transaction<T>>[4]) => transaction(RESTORE_DATABASE, JOURNAL_STORE, undefined, mode, issue);
async function decodeEnvelope(value: unknown): Promise<RestoreOperation> {
  const envelope = value as Envelope | undefined;
  if (!envelope || typeof envelope.serialized !== "string" || await backupDigest(envelope.serialized) !== envelope.sha256)
    throw Error("Restore journal failed integrity checks. Editing is paused; stored data is preserved.");
  const operation = restoreOperationSchema.parse(JSON.parse(envelope.serialized));
  const backup = await parseProjectBackup(operation.backup);
  await validateRestorePlan(operation, backup);
  return operation;
}
export async function readPendingRestore(): Promise<RestoreOperation | null> {
  const value = await journalTransaction<unknown>("readonly", (store, done, fail) => {
    const pointer = store.get("active");
    pointer.onsuccess = () => {
      if (pointer.result === undefined) { done(null); return; }
      if (typeof pointer.result !== "string") { fail(Error("Restore journal pointer is unreadable.")); return; }
      const record = store.get(pointer.result); record.onsuccess = () => {
        if (!record.result) { fail(Error("Pending restore journal is missing. Editing remains paused.")); return; }
        done(record.result);
      };
    };
  });
  return value === null ? null : decodeEnvelope(value);
}
async function writeJournal(next: RestoreOperation, previous: RestoreOperation | null) {
  const serialized = JSON.stringify(restoreOperationSchema.parse(next));
  const envelope: Envelope = { serialized, sha256: await backupDigest(serialized) };
  await journalTransaction<void>("readwrite", (store, done, fail) => {
    const pointer = store.get("active"); pointer.onsuccess = () => {
      if (!previous) {
        if (pointer.result !== undefined) { fail(Error("A restore is already pending. Reload to review it.")); return; }
        store.add(envelope, next.id); store.put(next.id, "active"); done(); return;
      }
      if (pointer.result !== previous.id) { fail(Error("Pending restore changed in another window.")); return; }
      const record = store.get(previous.id); record.onsuccess = () => {
        if (record.result?.serialized !== JSON.stringify(previous)) { fail(Error("Restore journal changed. Reload to recover its latest saved state.")); return; }
        store.put(envelope, next.id); done();
      };
    };
  });
}
export async function stageWorkspaceRestore(backup: ProjectBackup, expectedFingerprint: string, restoreReferenceRates: boolean) {
  if (!navigator.locks) throw Error("This browser cannot protect a restore across open windows.");
  const serialized = JSON.stringify(await parseProjectBackup(JSON.stringify(backup)));
  const review = await assessBackupRestore(serialized, browserReadPorts(), { expectedFingerprint, restoreReferenceRates });
  if (review.blockingIssues.length) throw Error(review.blockingIssues.join(" "));
  // Validate compatibility before staging. Preparation repeats this under the exclusive startup lease.
  await planRestoreMutations(backup, restoreReferenceRates, readRecord);
  const operation = restoreOperationSchema.parse({ schema: "xray.restore/v1", id: crypto.randomUUID(), revision: 1,
    createdAt: new Date().toISOString(), phase: "requested", backup: serialized, expectedFingerprint,
    restoreReferenceRates, progress: 0, message: "Restore requested. Close other X-Ray tabs before continuing." });
  await writeJournal(operation, null);
}
export async function finishPendingRestore(previous: RestoreOperation) {
  if (!["requested", "verified", "rolled-back"].includes(previous.phase)) throw Error("Recovery must finish before editing can resume.");
  await journalTransaction<void>("readwrite", (store, done, fail) => {
    const pointer = store.get("active"); pointer.onsuccess = () => {
      if (pointer.result !== previous.id) { fail(Error("Pending restore changed.")); return; }
      const record = store.get(previous.id); record.onsuccess = () => {
        if (record.result?.serialized !== JSON.stringify(previous)) { fail(Error("Restore journal changed. Reload before continuing.")); return; }
        store.delete("active"); done(); // Retain the immutable operation history and recovery package.
      };
    };
  });
}
function currentJob() {
  const result = loadFencingJob();
  if (result.error || !result.job) throw Error(result.error ?? "Save the current workspace before restoring.");
  return result.job;
}
function browserReadPorts() {
  const plans = createBrowserPlanStore(), photos = createBrowserPhotoStore();
  return { currentJob, readLocal: (key: string) => localStorage.getItem(key),
    readMaterials: async (id: string) => {
      const result = await restoreMaterialDatabase(id);
      if (result.blocked || result.error) throw Error(result.error ?? "Materials cannot be read.");
      return result.raw;
    }, plan: (id: string) => plans.get(id), photo: (id: string) => photos.get(id) };
}
async function readRecord(storage: RestoreMutation["storage"], key: string): Promise<string | null> {
  if (storage === "local") return localStorage.getItem(key);
  return transaction(MATERIALS_DB, "inventories", undefined, "readonly", (store, done, fail) => {
    const req = store.get(key); req.onsuccess = () => {
      if (req.result !== undefined && typeof req.result !== "string") { fail(Error("Materials storage is unreadable.")); return; }
      done(req.result ?? null);
    };
  });
}
async function compareWrite(item: RestoreMutation, expected: string | null, value: string | null) {
  if (item.storage === "local") {
    if (localStorage.getItem(item.key) !== expected) throw Error(`${item.label} changed before restoration.`);
    if (value === null) localStorage.removeItem(item.key); else localStorage.setItem(item.key, value);
    return;
  }
  await transaction<void>(MATERIALS_DB, "inventories", undefined, "readwrite", (store, done, fail) => {
    const req = store.get(item.key); req.onsuccess = () => {
      if ((req.result ?? null) !== expected) { fail(Error("Materials changed before restoration.")); return; }
      if (value === null) store.delete(item.key); else store.put(value, item.key); done();
    };
  });
}
async function originals(serialized: string, insert: boolean) {
  const backup = await parseProjectBackup(serialized);
  for (const asset of backup.assets) {
    const bytes = decodeBackupBytes(asset.bytesBase64), plan = asset.kind === "plan";
    const wanted = plan ? { documentId: asset.id, name: asset.name, kind: backup.job.documents.find(d => d.id === asset.id)!.kind,
      mimeType: asset.mimeType, sizeBytes: bytes.byteLength, sha256: asset.sha256, bytes } :
      { id: asset.id, name: asset.name, mimeType: asset.mimeType, sha256: asset.sha256, bytes };
    await transaction<void>(plan ? PLAN_CONTENT_DB : PHOTO_CONTENT_DB, plan ? PLAN_CONTENT_STORE : PHOTO_CONTENT_STORE,
      plan ? "documentId" : "id", insert ? "readwrite" : "readonly", (store, done, fail) => {
        const req = store.get(asset.id); req.onsuccess = () => {
          const existing = req.result;
          if (existing === undefined && insert) { store.add(wanted); done(); return; }
          const existingBytes = existing?.bytes instanceof ArrayBuffer ? new Uint8Array(existing.bytes) : null;
          if (!existing || !(existing.bytes instanceof ArrayBuffer) || existing.bytes.byteLength !== bytes.byteLength ||
            Object.entries(wanted).some(([key, value]) => key !== "bytes" && existing[key] !== value) ||
            !existingBytes || !new Uint8Array(bytes).every((v, i) => existingBytes[i] === v)) {
            fail(Error(`Original file “${asset.name}” is missing or conflicts. Its stored bytes were not overwritten.`)); return;
          }
          done();
        };
      });
  }
}
export function browserRestorePorts(): RestorePorts {
  return {
    async prepare(operation) {
      const backup = await parseProjectBackup(operation.backup), ports = browserReadPorts();
      const review = await assessBackupRestore(backup, ports, { expectedFingerprint: operation.expectedFingerprint, restoreReferenceRates: operation.restoreReferenceRates });
      if (review.blockingIssues.length) throw Error(review.blockingIssues.join(" "));
      const mutations = await planRestoreMutations(backup, operation.restoreReferenceRates, readRecord);
      const previous = currentJob();
      const recovery = await captureProjectBackup(previous, `Before restore — ${previous.name}`.slice(0, 120), { ...ports, records: readBackupRecords });
      const saved = await storeProjectBackup(recovery); await readProjectBackup(saved.id);
      return { mutations, recoveryBackupId: saved.id, targetId: backup.job.id, targetName: backup.job.name };
    },
    read: item => readRecord(item.storage, item.key), compareWrite,
    ensureAssets: serialized => originals(serialized, true), verifyAssets: serialized => originals(serialized, false),
    async journal(next, expectedRevision) {
      const previous = await readPendingRestore();
      if (!previous || previous.id !== next.id || previous.revision !== expectedRevision) throw Error("Restore journal revision changed.");
      await writeJournal(next, previous);
    },
  };
}
