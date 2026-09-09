import test from "node:test";
import assert from "node:assert/strict";
import {
  CHECKPOINT_MARKER, DEFAULT_MAX_ENTRIES, DEFAULT_TRIGGER_AT, compactTranscript, isCutPoint } from "./compactTranscript.ts";
import type { AssistantContent } from "./contract.ts";

const image = { mimeType: "image/png" as const, data: "iVBORw0KGgo=" };

const userText = (text: string): AssistantContent => ({ role: "user", parts: [{ text }] });
const modelText = (text: string): AssistantContent => ({ role: "model", parts: [{ text }] });
const modelCall = (id: string, name = "read_architect_design"): AssistantContent =>
  ({ role: "model", parts: [{ functionCall: { name, args: {}, id } }] });
const toolReceipt = (id: string, text = "ok", name = "read_architect_design"): AssistantContent =>
  ({ role: "user", parts: [{ functionResponse: { name, response: { isError: false, text }, id } }] });

/** A repeating round shaped like conversation.ts: user text, model call, tool receipt. */
function transcript(rounds: number): AssistantContent[] {
  const contents: AssistantContent[] = [];
  for (let round = 0; round < rounds; round++) {
    contents.push(userText(`request ${round}`), modelCall(`c${round}`), toolReceipt(`c${round}`));
  }
  return contents;
}

test("below the trigger the same array reference comes back untouched", () => {
  const contents = transcript(5); // 15 entries, under the 18-entry trigger
  assert.ok(contents.length < DEFAULT_TRIGGER_AT);
  const result = compactTranscript(contents);
  assert.equal(result.compacted, false);
  assert.equal(result.contents, contents, "must be the same reference, not a copy");
  assert.equal(result.droppedEntries, 0);
  assert.equal(result.droppedImages, 0);
  assert.deepEqual(result.carriedCallIds, []);
  assert.match(result.reason, /trigger/);
  assert.equal(compactTranscript(contents, { triggerAt: 4 }).contents === contents, false);
});

test("images are replaced part-wise before any entry is cut, and no entry is left empty", () => {
  const contents = transcript(7);
  contents[0] = { role: "user", parts: [{ text: "look at this" }, { inlineData: image }] };
  contents[3] = { role: "user", parts: [{ inlineData: image }] }; // an image-only entry
  const result = compactTranscript(contents, { maxEntries: DEFAULT_MAX_ENTRIES });
  assert.equal(result.compacted, true);
  assert.equal(result.droppedImages, 2);
  assert.ok(result.contents.every(entry => entry.parts.length >= 1), "every entry keeps at least one part");
  assert.equal(result.contents.some(entry => entry.parts.some(part => part.inlineData)), false);
  assert.equal(contents[0].parts.length, 2, "the input array is not mutated");
  assert.ok(contents[0].parts[1].inlineData, "the input parts are not mutated");
});

test("images alone are dropped when no legal cut point sits inside the budget", () => {
  // 20 entries, all model turns except the trailing receipt: the only cut point is index 0.
  const contents: AssistantContent[] = [];
  for (let index = 0; index < 19; index++) contents.push(modelText(`step ${index}`));
  contents[2] = { role: "model", parts: [{ text: "here" }, { inlineData: image }] };
  contents.push(toolReceipt("solo"));
  contents.splice(1, 0, modelCall("solo"));
  const result = compactTranscript(contents);
  assert.equal(result.droppedImages, 1);
  assert.equal(result.droppedEntries, 0);
  assert.equal(result.compacted, true);
  assert.notEqual(result.contents, contents, "a compacted result is always a new array");
});

test("a cut never separates a tool call from its receipt", () => {
  const contents = transcript(12); // 36 entries
  const result = compactTranscript(contents, { keepUserMessages: 2 });
  assert.equal(result.compacted, true);
  const calls = new Set(result.contents.flatMap(entry => entry.parts.flatMap(p => (p.functionCall?.id ? [p.functionCall.id] : []))));
  const receipts = new Set(result.contents.flatMap(entry => entry.parts.flatMap(p => (p.functionResponse?.id ? [p.functionResponse.id] : []))));
  assert.deepEqual([...calls].sort(), [...receipts].sort(), "calls and receipts stay paired");
  // The first retained entry is a user entry carrying text, never a bare tool receipt.
  const first = result.contents[0];
  assert.equal(first.role, "user");
  assert.ok(first.parts.some(part => typeof part.text === "string"));
});

test("nothing at or after the last checkpoint receipt is dropped", () => {
  const contents = transcript(12);
  const marker = `${CHECKPOINT_MARKER} assistant stopped or project context changed before this action.`;
  const checkpointAt = 2; // very early, so the budget would otherwise cut far past it
  contents[checkpointAt] = { role: "user", parts: [{ functionResponse: { name: "draw_architect_elements", response: { isError: true, text: marker }, id: "c0" } }] };
  const result = compactTranscript(contents, { keepUserMessages: 1, maxEntries: 4 });
  assert.equal(result.droppedEntries <= checkpointAt, true, "the cut never reaches the checkpoint");
  assert.ok(result.contents.some(entry => entry.parts.some(part => part.functionResponse?.response?.text === marker)), "the checkpoint receipt survives");
  // A checkpoint at index 0 leaves nothing legal to drop at all.
  const guarded = [...contents];
  guarded[0] = guarded[checkpointAt];
  guarded[checkpointAt] = userText("request 0");
  const held = compactTranscript(guarded, { keepUserMessages: 1, maxEntries: 4 });
  assert.equal(held.droppedEntries, 0);
});

test("carriedCallIds holds exactly the receipt ids from the dropped entries", () => {
  const contents = transcript(12); // ids c0..c11
  const result = compactTranscript(contents, { keepUserMessages: 2 });
  assert.equal(result.compacted, true);
  const kept = new Set(result.contents.flatMap(entry => entry.parts.flatMap(p => (p.functionResponse?.id ? [p.functionResponse.id] : []))));
  const expected = ["c0", "c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8", "c9", "c10", "c11"].filter(id => !kept.has(id));
  assert.deepEqual([...result.carriedCallIds].sort(), [...expected].sort());
  assert.equal(result.carriedCallIds.length, result.droppedEntries / 3, "one receipt per dropped round");
  assert.equal(new Set(result.carriedCallIds).size, result.carriedCallIds.length, "ids are unique");
});

test("a postcondition failure returns the original array with compacted false", () => {
  // A stray receipt with no matching call anywhere: the pairing check must reject the result.
  const contents = transcript(12);
  const tail = contents[contents.length - 1];
  assert.equal(tail.role, "user");
  contents[contents.length - 1] = { role: "user", parts: [...tail.parts, { functionResponse: { name: "read_architect_design", response: { isError: false, text: "ok" }, id: "orphan" } }] };
  const result = compactTranscript(contents, { keepUserMessages: 2 });
  assert.equal(result.compacted, false);
  assert.equal(result.contents, contents, "the original array reference is returned");
  assert.equal(result.droppedEntries, 0);
  assert.equal(result.droppedImages, 0);
  assert.deepEqual(result.carriedCallIds, []);
  assert.match(result.reason, /postcondition failed: receipt orphan lost its tool call/);
});

test("the result always ends with a user entry", () => {
  for (const rounds of [7, 9, 12, 15]) {
    for (const keepUserMessages of [1, 2, 3, 5]) {
      const result = compactTranscript(transcript(rounds), { keepUserMessages });
      assert.equal(result.contents[result.contents.length - 1].role, "user", `rounds ${rounds}, keep ${keepUserMessages}`);
      assert.ok(result.contents.length >= 1);
    }
  }
});

test("keepUserMessages and maxEntries combine with min, never max", () => {
  const contents = transcript(12); // 36 entries
  // keepUserMessages 8 would retain 24 entries; maxEntries 6 is tighter, so 6 wins.
  const tight = compactTranscript(contents, { keepUserMessages: 8, maxEntries: 6 });
  assert.ok(tight.contents.length <= 6, `expected at most 6 entries, got ${tight.contents.length}`);
  // keepUserMessages 1 would retain 3 entries; maxEntries 30 is looser, so 3 wins — not 30.
  const few = compactTranscript(contents, { keepUserMessages: 1, maxEntries: 30 });
  assert.ok(few.contents.length <= 3, `expected at most 3 entries, got ${few.contents.length}`);
  assert.ok(few.contents.length < tight.contents.length + 6);
  // A max() implementation would have kept 24 and 30 respectively.
  assert.ok(tight.contents.length < 24 && few.contents.length < 30);
});

test("compaction always hands back a new array so the caller re-measures", () => {
  const contents = transcript(12);
  const result = compactTranscript(contents);
  assert.equal(result.compacted, true);
  assert.notEqual(result.contents, contents);
  assert.equal(contents.length, 36, "the input array is not mutated");
});

test("a tool receipt is never a legal cut point, even after rule 3 substitutes a text part", () => {
  // Rule 3 replaces a dropped inlineData part with a text marker. A receipt is then a user entry
  // that HAS text, which the loose test read as a legal cut point; cutting there would separate a
  // model functionCall turn from the receipt answering it, and the id-keyed postcondition cannot
  // see it when the call carries no id (conversation.ts allows calls without ids).
  const strippedReceipt: AssistantContent = {
    role: "user",
    parts: [
      { functionResponse: { name: "capture_workspace_image", response: { isError: false, text: "ok" } } },
      { text: "[image from step 2, dropped]" },
    ],
  };
  assert.equal(isCutPoint(strippedReceipt), false, "a receipt carrying a substituted text part must not be a cut point");
  assert.equal(isCutPoint({ role: "user", parts: [{ text: "a real request" }] }), true);
  assert.equal(isCutPoint({ role: "model", parts: [{ text: "a reply" }] }), false);
  assert.equal(
    isCutPoint({ role: "user", parts: [{ functionResponse: { name: "a", response: { isError: false, text: "ok" } } }] }),
    false,
  );
});

test("a checkpoint before the retained tail still allows compaction of the entries ahead of it", () => {
  // The checkpoint is a floor on what may be dropped, not a ceiling on where the scan may look.
  // Before the fix, a checkpoint early in the transcript disabled compaction completely.
  // Ten plain turns, then a checkpoint late in the transcript. Rule 2 protects the checkpoint and
  // everything after it; the early turns are still legally droppable, so compaction must happen.
  const contents: AssistantContent[] = [];
  for (let turn = 0; turn < 10; turn++) {
    contents.push({ role: "user", parts: [{ text: `later request ${turn}` }] });
    contents.push({ role: "model", parts: [{ text: `reply ${turn}` }] });
  }
  contents.push({ role: "model", parts: [{ functionCall: { name: "save_project", args: {} } }] });
  contents.push({
    role: "user",
    parts: [{ functionResponse: { name: "save_project", response: { isError: true, text: "Not executed: assistant stopped." } } }],
  });
  contents.push({ role: "user", parts: [{ text: "final request" }] });
  const result = compactTranscript(contents, { triggerAt: 6, keepUserMessages: 3, maxEntries: 10 });
  assert.equal(result.compacted, true, `expected compaction, got: ${result.reason}`);
  assert.ok(result.contents.length < contents.length, "nothing was dropped");
  assert.equal(result.contents.at(-1)?.role, "user");
});
