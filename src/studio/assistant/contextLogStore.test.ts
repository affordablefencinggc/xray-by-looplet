import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { ContextLogEntry } from "./contextLog.ts";
import {
  CONTEXT_LOG_DATABASE, ENTRY_STORE, JOB_INDEX, MAX_ENTRIES_PER_PROJECT, PROFILE_STORE,
  appendContextLogEntry, clearContextLog, readContextLog, readContextProfile,
  setContextLogFactory, writeContextProfile,
} from "./contextLogStore.ts";

/**
 * A small IndexedDB shim. Bare Node has no indexedDB and the repo carries no fake, so the store
 * takes its factory by injection (setContextLogFactory) and this shim stands in. It models only what
 * the store uses: an upgrade that creates two stores and one index, keyPath keys, add/put/delete/get,
 * an index getAll and getAllKeys, and abort semantics that roll a transaction back.
 */
type Row = Record<string, unknown>;
type Snapshot = { entries: Map<string, Row>; profile: Map<string, Row> };

/** Requests resolve on a later microtask so callbacks are attached before they fire, as in a browser. */
const later = (run: () => void) => queueMicrotask(run);

let live: Snapshot;
/** Set to make the next write of that store throw, simulating a quota or corruption failure. */
let denyWrite: string | null = null;
/** Set to make opening the database fail outright. */
let denyOpen = false;
let opened = 0, closed = 0;

function makeRequest<T>(produce: () => T) {
  const request: Record<string, unknown> = { result: undefined, error: null, onsuccess: null, onerror: null };
  later(() => {
    try { request.result = produce(); (request.onsuccess as (() => void) | null)?.(); }
    catch (error) { request.error = error; (request.onerror as (() => void) | null)?.(); throw error; }
  });
  return request as unknown as IDBRequest<T>;
}

function makeStore(name: keyof Snapshot, working: Snapshot, keyPath: string, onFail: (error: Error) => void) {
  const map = working[name];
  const guard = <T>(run: () => T) => {
    if (denyWrite === name) throw Error(`Simulated ${name} write failure.`);
    return run();
  };
  const request = <T>(produce: () => T) => {
    const req: Record<string, unknown> = { result: undefined, error: null, onsuccess: null, onerror: null };
    later(() => {
      try { req.result = produce(); (req.onsuccess as (() => void) | null)?.(); }
      catch (error) { req.error = error; onFail(error instanceof Error ? error : Error(String(error))); }
    });
    return req as unknown as IDBRequest<T>;
  };
  const index = {
    getAll: (query: unknown) => request(() => [...map.values()].filter(row => row[JOB_INDEX] === query)),
    getAllKeys: (query: unknown) => request(() => [...map.values()].filter(row => row[JOB_INDEX] === query).map(row => row[keyPath])),
  };
  return {
    add: (value: Row) => request(() => guard(() => {
      const key = String(value[keyPath]);
      if (map.has(key)) throw Error("ConstraintError: key already exists.");
      map.set(key, structuredClone(value));
    })),
    put: (value: Row) => request(() => guard(() => { map.set(String(value[keyPath]), structuredClone(value)); })),
    delete: (key: IDBValidKey) => request(() => guard(() => { map.delete(String(key)); })),
    get: (key: IDBValidKey) => request(() => map.get(String(key))),
    getAll: () => request(() => [...map.values()]),
    index: (name: string) => { assert.equal(name, JOB_INDEX); return index; },
  };
}

function makeDatabase() {
  const objectStoreNames = { contains: () => true };
  return {
    objectStoreNames,
    close() { closed++; },
    transaction(names: string[], mode: string) {
      assert.deepEqual([...names].sort(), [ENTRY_STORE, PROFILE_STORE]);
      // Writes land on a copy; the copy is committed on complete and discarded on abort.
      const working: Snapshot = mode === "readwrite"
        ? { entries: new Map(live.entries), profile: new Map(live.profile) }
        : live;
      let settled = false;
      const tx: Record<string, unknown> = { error: null, oncomplete: null, onabort: null, onerror: null };
      const abort = (error: Error) => {
        if (settled) return;
        settled = true;
        tx.error = tx.error ?? error;
        later(() => (tx.onabort as (() => void) | null)?.());
      };
      tx.abort = () => abort(Error("AbortError"));
      tx.objectStore = (name: string) => makeStore(
        name as keyof Snapshot, working, name === ENTRY_STORE ? "id" : "jobId",
        error => { (tx as { onerror?: () => void }).onerror?.(); abort(error); },
      );
      // Commit once the issued requests have drained, mirroring the browser's auto-commit.
      later(() => later(() => later(() => later(() => {
        if (settled) return;
        settled = true;
        if (mode === "readwrite") live = working;
        (tx.oncomplete as (() => void) | null)?.();
      }))));
      return tx as unknown as IDBTransaction;
    },
  } as unknown as IDBDatabase;
}

const factory = {
  open(name: string, version: number) {
    assert.equal(name, CONTEXT_LOG_DATABASE);
    assert.equal(version, 1);
    if (denyOpen) throw Error("Simulated open failure.");
    opened++;
    const created: string[] = [], indexes: string[] = [];
    const db = makeDatabase();
    const upgradeDb = {
      objectStoreNames: { contains: (store: string) => created.includes(store) },
      createObjectStore(store: string, options: { keyPath: string }) {
        created.push(store);
        assert.equal(options.keyPath, store === ENTRY_STORE ? "id" : "jobId");
        return { createIndex: (indexName: string) => { indexes.push(indexName); } };
      },
    };
    const request: Record<string, unknown> = { result: db, error: null, onsuccess: null, onupgradeneeded: null, onerror: null, onblocked: null };
    later(() => {
      // Exercise the upgrade path on every open so store and index creation stay covered.
      request.result = upgradeDb;
      (request.onupgradeneeded as (() => void) | null)?.();
      assert.deepEqual(created, [ENTRY_STORE, PROFILE_STORE]);
      assert.deepEqual(indexes, [JOB_INDEX]);
      request.result = db;
      (request.onsuccess as (() => void) | null)?.();
    });
    return request as unknown as IDBOpenDBRequest;
  },
} as unknown as IDBFactory;

const entry = (id: string, at: string, over: Partial<ContextLogEntry> = {}): ContextLogEntry => ({
  id, at, topic: "Boundary run", summary: "Traced the northern boundary.", evidence: "tool-receipt", tools: ["trace_takeoff_run"], ...over,
});
const stamp = (minute: number) => `2026-09-01T00:${String(minute).padStart(2, "0")}:00.000Z`;

beforeEach(() => {
  live = { entries: new Map(), profile: new Map() };
  denyWrite = null; denyOpen = false; opened = 0; closed = 0;
  setContextLogFactory(factory);
});

test("the database name and stores match the declared contract", () => {
  assert.equal(CONTEXT_LOG_DATABASE, "xray-assistant-context-v1");
  assert.equal(ENTRY_STORE, "entries");
  assert.equal(PROFILE_STORE, "profile");
  assert.equal(JOB_INDEX, "jobId");
  assert.equal(MAX_ENTRIES_PER_PROJECT, 500);
});

test("an appended entry reads back for its own project and no other", async () => {
  const stored = await appendContextLogEntry("job-a", entry("e1", stamp(1)));
  assert.deepEqual(stored, { stored: entry("e1", stamp(1)), dropped: 0 });
  await appendContextLogEntry("job-b", entry("e2", stamp(2)));
  assert.deepEqual(await readContextLog("job-a"), [entry("e1", stamp(1))]);
  assert.deepEqual(await readContextLog("job-b"), [entry("e2", stamp(2))]);
  assert.deepEqual(await readContextLog("job-c"), []);
});

test("entries read back newest first regardless of the order they were written", async () => {
  for (const minute of [3, 1, 5, 2]) await appendContextLogEntry("job-a", entry(`e${minute}`, stamp(minute)));
  assert.deepEqual((await readContextLog("job-a")).map(row => row.id), ["e5", "e3", "e2", "e1"]);
});

test("the jobId used for the index is not leaked into the entry a caller reads back", async () => {
  await appendContextLogEntry("job-a", entry("e1", stamp(1)));
  const [row] = await readContextLog("job-a");
  assert.deepEqual(Object.keys(row!).sort(), ["at", "evidence", "id", "summary", "tools", "topic"]);
});

test("the store keeps at most 500 entries per project, dropping oldest first", async () => {
  for (let index = 0; index < MAX_ENTRIES_PER_PROJECT; index++) {
    await appendContextLogEntry("job-a", entry(`e${String(index).padStart(3, "0")}`, `2026-09-01T00:00:${String(index % 60).padStart(2, "0")}.${String(index).padStart(3, "0")}Z`));
  }
  assert.equal((await readContextLog("job-a")).length, MAX_ENTRIES_PER_PROJECT);
  const result = await appendContextLogEntry("job-a", entry("e999", "2026-09-02T00:00:00.000Z"));
  assert.equal(result.dropped, 1);
  const rows = await readContextLog("job-a");
  assert.equal(rows.length, MAX_ENTRIES_PER_PROJECT);
  assert.equal(rows[0]!.id, "e999");
  assert.ok(!rows.some(row => row.id === "e000"), "the oldest entry is the one dropped");
});

test("the cap counts each project separately", async () => {
  for (let index = 0; index < 3; index++) {
    await appendContextLogEntry("job-a", entry(`a${index}`, stamp(index)));
    await appendContextLogEntry("job-b", entry(`b${index}`, stamp(index)));
  }
  assert.equal((await readContextLog("job-a")).length, 3);
  assert.equal((await readContextLog("job-b")).length, 3);
});

test("a duplicate id is refused and the stored entry is left as it was", async () => {
  await appendContextLogEntry("job-a", entry("e1", stamp(1), { summary: "First summary." }));
  await assert.rejects(
    appendContextLogEntry("job-a", entry("e1", stamp(9), { summary: "Second summary." })),
    /already exists\. Nothing was overwritten/,
  );
  assert.deepEqual((await readContextLog("job-a")).map(row => row.summary), ["First summary."]);
});

test("an invalid entry is refused before any transaction opens", async () => {
  await assert.rejects(appendContextLogEntry("job-a", entry("e1", "not a date")));
  await assert.rejects(appendContextLogEntry("job-a", { ...entry("e1", stamp(1)), evidence: "guessed" } as unknown as ContextLogEntry));
  await assert.rejects(appendContextLogEntry("job-a", entry("e1", stamp(1), { topic: "T".repeat(61) })));
  await assert.rejects(appendContextLogEntry("job-a", entry("e1", stamp(1), { summary: "S".repeat(161) })));
  assert.equal(opened, 0, "validation must reject before the database is opened");
  assert.deepEqual(await readContextLog("job-a"), []);
});

test("a failed write preserves every existing byte and surfaces the error", async () => {
  await appendContextLogEntry("job-a", entry("e1", stamp(1)));
  const before = await readContextLog("job-a");
  denyWrite = ENTRY_STORE;
  await assert.rejects(appendContextLogEntry("job-a", entry("e2", stamp(2))), (error: Error) => {
    assert.match(error.message, /Simulated entries write failure|did not complete/);
    return true;
  });
  denyWrite = null;
  assert.deepEqual(await readContextLog("job-a"), before, "the rejected append left the log unchanged");
});

test("a failed profile write leaves the previous profile in place", async () => {
  const first = { jobId: "job-a", updatedAt: stamp(1), notes: ["Uses metric millimetres."] };
  await writeContextProfile(first);
  denyWrite = PROFILE_STORE;
  await assert.rejects(writeContextProfile({ jobId: "job-a", updatedAt: stamp(2), notes: ["Replaced."] }));
  denyWrite = null;
  assert.deepEqual(await readContextProfile("job-a"), first);
});

test("an unavailable database rejects rather than reporting an empty log", async () => {
  denyOpen = true;
  await assert.rejects(readContextLog("job-a"), /Simulated open failure/);
  await assert.rejects(appendContextLogEntry("job-a", entry("e1", stamp(1))), /Simulated open failure/);
  denyOpen = false;
  setContextLogFactory(null);
  await assert.rejects(readContextLog("job-a"), /unavailable in this browser\. Nothing was written/);
});

test("an unreadable stored row fails loudly and preserves the stored bytes", async () => {
  await appendContextLogEntry("job-a", entry("e1", stamp(1)));
  live.entries.set("broken", { id: "broken", jobId: "job-a", at: stamp(2), topic: "", summary: "", evidence: "guessed", tools: [] });
  await assert.rejects(readContextLog("job-a"), /unreadable entry\. Stored data has been preserved/);
  await assert.rejects(appendContextLogEntry("job-a", entry("e3", stamp(3))), /Nothing was appended and stored data is preserved/);
  assert.equal(live.entries.size, 2, "the unreadable row and the good row are both still stored");
});

test("an unreadable profile fails loudly rather than reading as absent", async () => {
  assert.equal(await readContextProfile("job-a"), null);
  live.profile.set("job-a", { jobId: "job-a", updatedAt: "yesterday", notes: [] });
  await assert.rejects(readContextProfile("job-a"), /unreadable\. Stored data has been preserved/);
});

test("the profile round-trips and is keyed by project", async () => {
  await writeContextProfile({ jobId: "job-a", updatedAt: stamp(1), notes: ["Quotes in AUD.", "Boundary work only."] });
  await writeContextProfile({ jobId: "job-b", updatedAt: stamp(2), notes: ["Colour scheme is fixed."] });
  assert.deepEqual((await readContextProfile("job-a"))!.notes, ["Quotes in AUD.", "Boundary work only."]);
  assert.deepEqual((await readContextProfile("job-b"))!.notes, ["Colour scheme is fixed."]);
  await writeContextProfile({ jobId: "job-a", updatedAt: stamp(3), notes: ["Quotes in AUD."] });
  assert.deepEqual((await readContextProfile("job-a"))!.notes, ["Quotes in AUD."]);
});

test("clearing one project's log leaves the other project and both profiles alone", async () => {
  await appendContextLogEntry("job-a", entry("a1", stamp(1)));
  await appendContextLogEntry("job-a", entry("a2", stamp(2)));
  await appendContextLogEntry("job-b", entry("b1", stamp(3)));
  await writeContextProfile({ jobId: "job-a", updatedAt: stamp(1), notes: ["Kept."] });
  assert.equal(await clearContextLog("job-a"), 2);
  assert.deepEqual(await readContextLog("job-a"), []);
  assert.equal((await readContextLog("job-b")).length, 1);
  assert.deepEqual((await readContextProfile("job-a"))!.notes, ["Kept."]);
});

test("every opened database is closed again", async () => {
  await appendContextLogEntry("job-a", entry("e1", stamp(1)));
  await readContextLog("job-a");
  await writeContextProfile({ jobId: "job-a", updatedAt: stamp(1), notes: ["Note."] });
  assert.ok(opened > 0);
  assert.equal(closed, opened);
});
