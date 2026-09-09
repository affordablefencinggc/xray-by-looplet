import test from "node:test";
import assert from "node:assert/strict";
import { captureTurn, proposeProfileUpdate, type CapturedEntry } from "./contextCapture.ts";
import type { ContextLogEntry } from "./contextLog.ts";

const NOW = "2026-09-09T04:15:00.000Z";

/** A recording append, so a test can read exactly what capture tried to store. */
function recorder() {
  const written: Array<{ jobId: string; entry: ContextLogEntry }> = [];
  return { written, append: async (jobId: string, entry: ContextLogEntry) => { written.push({ jobId, entry }); } };
}

const tool = (toolName: string, text: string, failed?: boolean): CapturedEntry => ({ kind: "tool", text, toolName, failed });

test("a turn with tool receipts records measured evidence and the tool names in order", async () => {
  const store = recorder();
  const stored = await captureTurn({
    jobId: "job-1",
    userText: "Trace the north boundary",
    entries: [
      { kind: "user", text: "Trace the north boundary" },
      tool("trace_takeoff_run", JSON.stringify({ lengthM: 12.48, locked: true })),
      tool("save_project", JSON.stringify({ saved: true, projectRevision: 7 })),
      { kind: "assistant", text: "Done." },
    ],
    append: store.append,
    now: NOW,
  });
  assert.ok(stored);
  assert.equal(stored.evidence, "tool-receipt");
  assert.deepEqual(stored.tools, ["trace_takeoff_run", "save_project"]);
  assert.match(stored.summary, /12\.480 m/);
  assert.equal(store.written.length, 1);
  assert.equal(store.written[0]!.jobId, "job-1");
  assert.deepEqual(store.written[0]!.entry, stored);
});

test("a failed tool is still a receipt and its failure is counted in the summary", async () => {
  const store = recorder();
  const stored = await captureTurn({
    jobId: "job-1",
    userText: "Export everything",
    entries: [
      tool("export_design_file", JSON.stringify({ fileName: "site.dxf", byteLength: 43008 })),
      tool("export_design_file", "The IFC export failed: no design is loaded.", true),
    ],
    append: store.append,
    now: NOW,
  });
  assert.ok(stored);
  assert.equal(stored.evidence, "tool-receipt");
  assert.match(stored.summary, /1 tool failed\./);
});

test("a failed tool returning JSON never leaks the body into the digest summary", async () => {
  const store = recorder();
  const payload = JSON.stringify({ error: "boom", secretToken: "abc123", detail: "x".repeat(40) });
  const stored = await captureTurn({
    jobId: "job-1",
    userText: "Export everything",
    entries: [tool("export_design_file", payload, true)],
    append: store.append,
    now: NOW,
  });
  assert.ok(stored);
  // contextLog.ts renderDigest copies summary verbatim into the pinned digest, so no JSON shape may survive.
  assert.doesNotMatch(stored.summary, /[{}]/);
  assert.doesNotMatch(stored.summary, /"\s*:/);
  assert.doesNotMatch(stored.summary, /secretToken/);
  assert.doesNotMatch(stored.summary, /abc123/);
  // The failure itself is still counted; suppressing the blob must not suppress the warning.
  assert.match(stored.summary, /1 tool failed\./);
  assert.equal(stored.evidence, "tool-receipt");
});

test("a failed tool returning a JSON ARRAY leaks nothing either", async () => {
  // toolReceipt.ts parse() accepts only objects, so an array fell through to the plain-text branch
  // and its first line — the whole blob, since JSON.stringify emits one line — was copied verbatim
  // into the digest the model reads every turn. An MCP server is free to answer with an array, so
  // this arrives from outside the repo and can carry secret-shaped fields.
  const store = recorder();
  const payload = JSON.stringify([{ error: "boom", secretToken: "abc123", detail: "x".repeat(40) }]);
  const stored = await captureTurn({
    jobId: "job-1",
    userText: "Export everything",
    entries: [tool("export_design_file", payload, true)],
    append: store.append,
    now: NOW,
  });
  assert.ok(stored);
  assert.doesNotMatch(stored.summary, /[[\]{}]/);
  assert.doesNotMatch(stored.summary, /"\s*:/);
  assert.doesNotMatch(stored.summary, /secretToken/);
  assert.doesNotMatch(stored.summary, /abc123/);
  // The failure is still counted, so suppressing the blob does not suppress the warning.
  assert.match(stored.summary, /1 tool failed\./);
  assert.equal(stored.evidence, "tool-receipt");
});

test("a failed tool with a plain-text message keeps its sentence in the summary", async () => {
  const store = recorder();
  const stored = await captureTurn({
    jobId: "job-1",
    userText: "Export everything",
    entries: [tool("export_design_file", "The IFC export failed: no design is loaded.", true)],
    append: store.append,
    now: NOW,
  });
  assert.ok(stored);
  assert.match(stored.summary, /The IFC export failed: no design is loaded\./);
  assert.match(stored.summary, /1 tool failed\./);
});

test("a genuine result that opens with the word Running is not discarded as a placeholder", async () => {
  const store = recorder();
  const stored = await captureTurn({
    jobId: "job-1",
    userText: "Crunch the takeoff",
    entries: [tool("web_search", "Running the numbers…")],
    append: store.append,
    now: NOW,
  });
  // conversation.ts only ever emits `Running ${call.name}…` and a tool name carries no space.
  assert.ok(stored);
  assert.equal(stored.evidence, "tool-receipt");
  assert.deepEqual(stored.tools, ["web_search"]);
  assert.match(stored.summary, /Running the numbers/);
});

test("captured tool names stay inside the bounds contextLogStore entrySchema accepts", async () => {
  const store = recorder();
  const many = Array.from({ length: 100 }, (_, index) => tool(`tool_${index}`, JSON.stringify({ saved: true })));
  const stored = await captureTurn({ jobId: "job-1", userText: "Run a lot", entries: many, append: store.append, now: NOW });
  assert.ok(stored);
  // contextLogStore.ts:28 caps tools at 64 items of 120 chars and rejects the entry beyond that.
  assert.equal(stored.tools.length, 64);
  const long = await captureTurn({
    jobId: "job-1",
    userText: "Run one",
    entries: [tool("n".repeat(300), JSON.stringify({ saved: true }))],
    append: store.append,
    now: NOW,
  });
  assert.ok(long);
  assert.equal(long.tools[0]!.length, 120);
});

test("a placeholder for a tool that is still running is not read as a result", async () => {
  const store = recorder();
  const stored = await captureTurn({
    jobId: "job-1",
    userText: "Open the takeoff pane",
    entries: [tool("navigate_workspace", "Running navigate_workspace…")],
    append: store.append,
    now: NOW,
  });
  assert.ok(stored);
  assert.equal(stored.evidence, "stated");
  assert.deepEqual(stored.tools, []);
});

test("a turn with only user text records stated evidence", async () => {
  const store = recorder();
  const stored = await captureTurn({
    jobId: "job-2",
    userText: "The eastern fence is 1800 high",
    entries: [{ kind: "user", text: "The eastern fence is 1800 high" }, { kind: "assistant", text: "Noted." }],
    append: store.append,
    now: NOW,
  });
  assert.ok(stored);
  assert.equal(stored.evidence, "stated");
  assert.equal(stored.topic, "The eastern fence is 1800 high");
  assert.equal(stored.summary, "The eastern fence is 1800 high.");
  assert.deepEqual(stored.tools, []);
});

test("a storage failure is swallowed so a failed log write can never fail a send", async () => {
  const stored = await captureTurn({
    jobId: "job-3",
    userText: "Save the project",
    entries: [tool("save_project", JSON.stringify({ saved: true }))],
    append: async () => { throw Error("The context log transaction did not complete."); },
    now: NOW,
  });
  assert.equal(stored, null);
});

test("a synchronously throwing append is swallowed too", async () => {
  const stored = await captureTurn({
    jobId: "job-3",
    userText: "Save the project",
    entries: [],
    append: () => { throw Error("Assistant context storage is unavailable in this browser."); },
    now: NOW,
  });
  assert.equal(stored, null);
});

test("an empty turn records nothing and never reaches storage", async () => {
  const store = recorder();
  assert.equal(await captureTurn({ jobId: "job-4", userText: "   ", entries: [], append: store.append, now: NOW }), null);
  assert.equal(await captureTurn({ jobId: "job-4", userText: "", entries: [{ kind: "assistant", text: "Hello." }], append: store.append, now: NOW }), null);
  assert.equal(store.written.length, 0);
});

test("every entry carries a unique id and the injected instant", async () => {
  const store = recorder();
  const first = await captureTurn({ jobId: "job-5", userText: "Check the design", entries: [], append: store.append, now: NOW });
  const second = await captureTurn({ jobId: "job-5", userText: "Check the design", entries: [], append: store.append, now: NOW });
  assert.ok(first && second);
  assert.equal(first.at, NOW);
  assert.equal(second.at, NOW);
  assert.notEqual(first.id, second.id);
  assert.match(first.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
});

test("an explicit first-person statement proposes a profile slot", () => {
  const proposal = proposeProfileUpdate("I am a licensed architect based in Queensland");
  assert.ok(proposal);
  assert.equal(proposal.slot, "role");
  assert.equal(proposal.value, "licensed architect based in Queensland");
  assert.equal(proposal.quote, "I am a licensed architect based in Queensland");
});

test("anything that is not an explicit statement about the user proposes nothing", () => {
  assert.equal(proposeProfileUpdate("Am I an architect?"), null);
  assert.equal(proposeProfileUpdate("The client said he is an architect"), null);
  assert.equal(proposeProfileUpdate("Trace the north boundary"), null);
  assert.equal(proposeProfileUpdate(""), null);
  assert.equal(proposeProfileUpdate(undefined), null);
});
