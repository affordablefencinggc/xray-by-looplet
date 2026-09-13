import test from "node:test";
import assert from "node:assert/strict";
import { assembleTurn, chooseBase, readCarriedContext, type ContextReaders } from "./contextTurn.ts";
import { assistantRequestSchema, type AssistantContent } from "./contract.ts";
import { isPinnedUserEntry, PINNED_SENTINEL } from "./pinnedContext.ts";
import { DEFAULT_TRIGGER_AT } from "./compactTranscript.ts";
import type { ContextLogEntry } from "./contextLog.ts";
import { markWithheldCandidate, shortInteraction } from "./shortInteraction.ts";

/**
 * The send path in useAssistantChat.ts composes four pieces in a fixed order:
 *
 *     chooseBase -> shortInteraction -> readCarriedContext -> assembleTurn
 *
 * Each piece has its own suite. What was never covered is the composition itself, which is where
 * the SC-22 wiring lives and where a mistake is invisible: the transcript would still send, just
 * without the carried context or without its compaction persisting. These tests reproduce that
 * exact composition so a regression in the send path fails here rather than in a live chat.
 */

const userEntry = (text: string): AssistantContent => ({ role: "user", parts: [{ text }] });

const logEntry = (id: string): ContextLogEntry => ({
  id,
  at: "2026-01-01T00:00:00.000+10:00",
  topic: "Boundary fence",
  summary: "Traced the northern boundary and confirmed the setback.",
  evidence: "tool-receipt",
  tools: ["xray_read_design"],
});

/** A transcript long enough that the compactor actually cuts, mirroring a real chat. */
function longTranscript(rounds: number): AssistantContent[] {
  const contents: AssistantContent[] = [];
  for (let i = 0; i < rounds; i++) {
    contents.push(userEntry(`Request ${i}`));
    contents.push({ role: "model", parts: [{ functionCall: { id: `call-${i}`, name: "xray_read_design", args: {} } }] });
    contents.push({ role: "user", parts: [{ functionResponse: { id: `call-${i}`, name: "xray_read_design", response: { ok: true } } }] });
  }
  return contents;
}

/** Exactly what useAssistantChat.send does, so the test breaks when that composition changes. */
async function sendPath(
  stored: AssistantContent[],
  today: AssistantContent,
  readers: ContextReaders,
  jobId = "job-1",
) {
  const chosen = chooseBase(stored);
  const carried = await readCarriedContext(jobId, readers);
  const assembled = assembleTurn({
    base: shortInteraction(chosen.contents),
    carried,
    carriedCallIds: chosen.compaction.carriedCallIds,
    today,
  });
  return { chosen, carried, assembled };
}

const readers = (over: Partial<ContextReaders> = {}): ContextReaders => ({
  readProfile: async () => ({ notes: ["role: fencing contractor"] }),
  readLog: async () => [logEntry("e1")],
  ...over,
});

test("the send path carries the saved profile and digest as a pinned pair at index 0", async () => {
  const today = userEntry("Draw the eastern boundary.");
  const { assembled } = await sendPath([userEntry("Earlier question")], today, readers());

  assert.equal(assembled.pinned, true, "a stored profile and log entry must earn the pinned pair");
  assert.ok(isPinnedUserEntry(assembled.contents[0]), "the pinned pair must lead the transcript");
  const pinnedText = assembled.contents[0].parts.map(part => part.text ?? "").join("\n");
  assert.ok(pinnedText.startsWith(PINNED_SENTINEL), "the pair is found by its sentinel on the next turn");
  assert.ok(pinnedText.includes("fencing contractor"), "the carried profile must reach the model");
  assert.ok(pinnedText.includes("Boundary fence"), "the carried digest must reach the model");
});

test("the assembled request ends with the user entry and satisfies the provider contract", async () => {
  const today = userEntry("Draw the eastern boundary.");
  const { assembled } = await sendPath(longTranscript(DEFAULT_TRIGGER_AT), today, readers());

  const last = assembled.contents.at(-1);
  assert.equal(last?.role, "user", "the array must end with role 'user'");
  assert.equal(last?.parts[0]?.text, "Draw the eastern boundary.", "today's message must be last");
  // The full envelope, so the schema's own rule that a turn must end with user content is exercised
  // against what the wiring actually produces rather than against a fragment.
  assert.doesNotThrow(
    () => assistantRequestSchema.parse({
      schema: "xray.assistant-request/v1",
      requestId: "00000000-0000-4000-8000-000000000000",
      contents: assembled.contents,
      declarations: [],
      webSearch: false,
    }),
    "the wired composition must still satisfy the request schema",
  );
});

test("a long transcript is compacted before it is sent, and the stored base is the compacted one", async () => {
  const stored = longTranscript(DEFAULT_TRIGGER_AT);
  const { chosen, assembled } = await sendPath(stored, userEntry("Next"), readers());

  assert.equal(chosen.compaction.compacted, true, "a transcript past the trigger must compact");
  assert.ok(
    assembled.base.length < stored.length,
    `the stored base must shrink: ${assembled.base.length} entries from ${stored.length}`,
  );
  assert.ok(
    !assembled.base.includes(assembled.contents.at(-1)!),
    "the stored base must exclude today's entry so the next turn does not duplicate it",
  );
});

test("a failed profile read still sends the message and reports the loss", async () => {
  const { carried, assembled } = await sendPath(
    [userEntry("Earlier")],
    userEntry("Draw the eastern boundary."),
    readers({ readProfile: async () => { throw Error("IndexedDB unavailable"); } }),
  );

  assert.equal(carried.failed, true, "the failure must be reported, not swallowed");
  assert.match(carried.reason, /IndexedDB unavailable/, "the reason must survive for the notice");
  assert.equal(assembled.contents.at(-1)?.parts[0]?.text, "Draw the eastern boundary.",
    "the user's message must still be sent when carried context cannot be read");
});

test("both reads failing degrades to an unpinned send rather than blocking the user", async () => {
  const { carried, assembled } = await sendPath(
    [userEntry("Earlier")],
    userEntry("Still send this."),
    readers({
      readProfile: async () => { throw Error("profile store closed"); },
      readLog: async () => { throw Error("log store closed"); },
    }),
  );

  assert.equal(carried.failed, true);
  assert.equal(assembled.pinned, false, "nothing was carried, so no pair should occupy the budget");
  assert.equal(assembled.contents.at(-1)?.parts[0]?.text, "Still send this.");
});

test("an empty profile and empty log do not spend budget on an empty pair", async () => {
  const { assembled } = await sendPath(
    [userEntry("Earlier")],
    userEntry("Draw."),
    readers({ readProfile: async () => null, readLog: async () => [] }),
  );

  assert.equal(assembled.pinned, false, "an empty pair tells the model nothing and must be skipped");
  assert.ok(!isPinnedUserEntry(assembled.contents[0]));
});

test("the composed send path excludes withheld candidates while retaining delivered context and the current request", async () => {
  const stored: AssistantContent[] = [
    userEntry("Run the explicit fixture."),
    markWithheldCandidate({ role: "model", parts: [{ text: "Unsupported candidate result: 16." }] }),
    userEntry("[xray:tool-claim-check] No current invocation supports that result."),
    { role: "model", parts: [{ text: "Delivered answer: the required input is missing." }] },
  ];
  const before = structuredClone(stored);
  const today = userEntry("Here is the missing input; continue.");
  const { assembled } = await sendPath(stored, today, readers());
  const text = assembled.contents.flatMap(entry => entry.parts.map(part => part.text ?? "")).join("\n");
  assert.ok(isPinnedUserEntry(assembled.contents[0]));
  assert.ok(text.includes("Run the explicit fixture."));
  assert.ok(text.includes("Delivered answer: the required input is missing."));
  assert.ok(!text.includes("Unsupported candidate result"));
  assert.ok(!text.includes("[xray:tool-claim-check]"));
  assert.deepEqual(assembled.contents.at(-1), today);
  assert.deepEqual(stored, before, "the original audit transcript must remain unchanged");
});

test("a second turn upserts onto the same pinned pair instead of growing a new one", async () => {
  const first = await sendPath([userEntry("Earlier")], userEntry("First"), readers());
  // The next turn starts from what the first turn stored, exactly as the record does.
  const second = await sendPath(first.assembled.base, userEntry("Second"), readers());

  const pairs = second.assembled.contents.filter(entry => isPinnedUserEntry(entry)).length;
  assert.equal(pairs, 1, "the pinned pair must be replaced, never appended twice");
});
