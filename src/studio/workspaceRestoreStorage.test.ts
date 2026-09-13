import { test } from "node:test";
import assert from "node:assert/strict";
import { compareWriteLocalRestore } from "./workspaceRestoreStorage.ts";

test("draft restore CAS runs inside the same key lock as queued autosaves", async () => {
  let value: string | null = "old";
  const key = "xray.industry-drafts.v1:project", calls: string[] = [];
  const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: () => { calls.push("read"); return value; }, setItem: (_key: string, next: string) => { value = next; }, removeItem: () => { value = null; },
  } });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { locks: { request: async (address: string, options: unknown, callback: () => void) => {
    assert.equal(address, key); assert.deepEqual(options, { mode: "exclusive" }); calls.push("lock"); value = "concurrent save"; callback();
  } } } });
  try {
    await assert.rejects(compareWriteLocalRestore({ storage: "local", key, label: "Industry drafts", before: "old", after: "backup" }, "old", "backup"), /changed before/);
    assert.deepEqual(calls, ["lock", "read"]); assert.equal(value, "concurrent save");
  } finally {
    if (storageDescriptor) Object.defineProperty(globalThis, "localStorage", storageDescriptor); else Reflect.deleteProperty(globalThis, "localStorage");
    if (navigatorDescriptor) Object.defineProperty(globalThis, "navigator", navigatorDescriptor); else Reflect.deleteProperty(globalThis, "navigator");
  }
});
