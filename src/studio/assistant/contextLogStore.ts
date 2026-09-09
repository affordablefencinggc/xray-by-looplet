import { z } from "zod";
import type { ContextLogEntry } from "./contextLog.ts";

/**
 * Persistence for the rolling compressed log. A separate database from the workspace backups
 * (projectBackupStorage.ts:14 BACKUP_DATABASE) so a log write can never touch a backup package.
 *
 * Failure posture follows projectBackupStorage.ts: a transaction that does not complete rejects
 * with a plain sentence, existing bytes are left as they were, and no error is swallowed. A caller
 * that sees a rejection knows the store is unchanged.
 *
 * The store is capped at MAX_ENTRIES_PER_PROJECT entries per project, oldest dropped first, so a
 * long-running project cannot grow the database without bound.
 */
export const CONTEXT_LOG_DATABASE = "xray-assistant-context-v1";
export const ENTRY_STORE = "entries";
export const PROFILE_STORE = "profile";
export const JOB_INDEX = "jobId";
/** Retention cap per project. The digest shows far fewer; the rest stay searchable. */
export const MAX_ENTRIES_PER_PROJECT = 500;

const entrySchema = z.object({
  id: z.string().min(1).max(120),
  at: z.string().datetime({ offset: true }),
  topic: z.string().min(1).max(60),
  summary: z.string().min(1).max(160),
  evidence: z.enum(["tool-receipt", "stated", "inferred"]),
  tools: z.array(z.string().min(1).max(120)).max(64),
}).strict();

const storedSchema = entrySchema.extend({ jobId: z.string().min(1).max(120) }).strict();
export type StoredContextLogEntry = z.infer<typeof storedSchema>;

const profileSchema = z.object({
  jobId: z.string().min(1).max(120),
  updatedAt: z.string().datetime({ offset: true }),
  /** Durable facts about how this project is worked on. Kept short; the digest carries the rest. */
  notes: z.array(z.string().min(1).max(400)).max(64),
}).strict();
export type ContextProfile = z.infer<typeof profileSchema>;

/**
 * The IndexedDB factory to open. Injectable so the module runs under bare Node in tests; in the
 * browser it defaults to globalThis.indexedDB.
 */
let factory: IDBFactory | null = null;
export function setContextLogFactory(value: IDBFactory | null): void { factory = value; }

function resolveFactory(): IDBFactory {
  const available = factory ?? (globalThis as { indexedDB?: IDBFactory }).indexedDB ?? null;
  if (!available) throw Error("Assistant context storage is unavailable in this browser. Nothing was written.");
  return available;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try { request = resolveFactory().open(CONTEXT_LOG_DATABASE, 1); }
    catch (error) { reject(error instanceof Error ? error : Error("Assistant context storage could not be opened.")); return; }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ENTRY_STORE)) {
        db.createObjectStore(ENTRY_STORE, { keyPath: "id" }).createIndex(JOB_INDEX, JOB_INDEX, { unique: false });
      }
      if (!db.objectStoreNames.contains(PROFILE_STORE)) db.createObjectStore(PROFILE_STORE, { keyPath: "jobId" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? Error("Assistant context storage is unavailable."));
    request.onblocked = () => reject(Error("Assistant context storage is blocked by another app window."));
  });
}

async function transact<T>(mode: IDBTransactionMode, issue: (tx: IDBTransaction, result: (value: T) => void, fail: (error: Error) => void) => void): Promise<T> {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction([ENTRY_STORE, PROFILE_STORE], mode);
      let result: T, reason: Error | undefined;
      const fail = (error: Error) => { reason = error; try { tx.abort(); } catch { /* Already aborting; onabort still reports. */ } };
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(reason ?? tx.error ?? Error("The context log transaction did not complete. Earlier entries are unchanged."));
      tx.onerror = () => { /* Transaction abort reports the failure. */ };
      try { issue(tx, value => { result = value; }, fail); }
      catch (error) { fail(error instanceof Error ? error : Error("The context log operation failed.")); }
    });
  } finally { db.close(); }
}

/** Read every stored row for one project, newest first. Unreadable rows fail loudly; bytes are kept. */
export async function readContextLog(jobId: string): Promise<ContextLogEntry[]> {
  const rows = await transact<StoredContextLogEntry[]>("readonly", (tx, result, fail) => {
    const request = tx.objectStore(ENTRY_STORE).index(JOB_INDEX).getAll(jobId);
    request.onsuccess = () => {
      try { result(z.array(storedSchema).parse(request.result)); }
      catch { fail(Error("The context log contains an unreadable entry. Stored data has been preserved.")); }
    };
  });
  return rows
    .sort((a, b) => (a.at === b.at ? b.id.localeCompare(a.id) : b.at.localeCompare(a.at)))
    .map(({ jobId: _jobId, ...entry }) => entry);
}

/**
 * Append one entry and enforce the retention cap in the same transaction. Either the entry lands and
 * the surplus is dropped, or nothing changes at all.
 */
export async function appendContextLogEntry(jobId: string, entry: ContextLogEntry): Promise<{ stored: ContextLogEntry; dropped: number }> {
  const row = storedSchema.parse({ ...entrySchema.parse(entry), jobId });
  return transact("readwrite", (tx, result, fail) => {
    const store = tx.objectStore(ENTRY_STORE), existing = store.index(JOB_INDEX).getAll(jobId);
    existing.onsuccess = () => {
      let rows: StoredContextLogEntry[];
      try { rows = z.array(storedSchema).parse(existing.result); }
      catch { fail(Error("The context log contains an unreadable entry. Nothing was appended and stored data is preserved.")); return; }
      if (rows.some(candidate => candidate.id === row.id)) {
        fail(Error(`A context log entry with id ${row.id} already exists. Nothing was overwritten.`)); return;
      }
      // Oldest first, so the surplus to drop sits at the front.
      const ordered = [...rows, row].sort((a, b) => (a.at === b.at ? a.id.localeCompare(b.id) : a.at.localeCompare(b.at)));
      const surplus = ordered.slice(0, Math.max(0, ordered.length - MAX_ENTRIES_PER_PROJECT));
      if (surplus.some(candidate => candidate.id === row.id)) {
        fail(Error("This entry is older than every retained entry and would be dropped immediately. Nothing was written.")); return;
      }
      store.add(row);
      for (const stale of surplus) store.delete(stale.id);
      result({ stored: entry, dropped: surplus.length });
    };
  });
}

/** Remove every entry for one project. The profile is left in place. */
export async function clearContextLog(jobId: string): Promise<number> {
  return transact("readwrite", (tx, result, fail) => {
    const store = tx.objectStore(ENTRY_STORE), request = store.index(JOB_INDEX).getAllKeys(jobId);
    request.onsuccess = () => {
      const keys = request.result;
      if (!Array.isArray(keys)) { fail(Error("The context log index is unreadable. Nothing was removed.")); return; }
      for (const key of keys) store.delete(key as IDBValidKey);
      result(keys.length);
    };
  });
}

/** The durable project profile, or null when none has been written. */
export async function readContextProfile(jobId: string): Promise<ContextProfile | null> {
  return transact("readonly", (tx, result, fail) => {
    const request = tx.objectStore(PROFILE_STORE).get(jobId);
    request.onsuccess = () => {
      if (request.result === undefined) { result(null); return; }
      try { result(profileSchema.parse(request.result)); }
      catch { fail(Error("The stored context profile is unreadable. Stored data has been preserved.")); }
    };
  });
}

/** Replace the profile for one project. A rejected write leaves the previous profile in place. */
export async function writeContextProfile(profile: ContextProfile): Promise<ContextProfile> {
  const next = profileSchema.parse(profile);
  return transact("readwrite", (tx, result) => {
    tx.objectStore(PROFILE_STORE).put(next);
    result(next);
  });
}
