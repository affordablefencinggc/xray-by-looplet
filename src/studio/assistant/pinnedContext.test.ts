import test from "node:test";
import assert from "node:assert/strict";
import { PINNED_SENTINEL, buildPinnedPair, isPinnedUserEntry, upsertPinnedPair } from "./pinnedContext.ts";
import { assistantContentSchema } from "./contract.ts";
import type { AssistantContent } from "./contract.ts";

const PROFILE = "## What the user has told us\n\n| Fact | Value |\n| --- | --- |\n| Name | Daniel |";
const DIGEST = "## What this project has covered\n\n- Calibrated sheet A-101.";
const conversation = (): AssistantContent[] => [
  { role: "user", parts: [{ text: "Draw the northern boundary fence." }] },
  { role: "model", parts: [{ text: "Reading the design first." }] },
  { role: "user", parts: [{ text: "Go ahead." }] },
];
const pinnedCount = (contents: readonly AssistantContent[]) => contents.filter(entry => isPinnedUserEntry(entry)).length;

test("the pair carries the blocks and states that this is carried context, not a new instruction", () => {
  const pair = buildPinnedPair(PROFILE, DIGEST);
  const text = pair.user.parts[0]?.text ?? "";
  assert.equal(text.split("\n")[0], PINNED_SENTINEL);
  assert.equal(pair.user.role, "user");
  assert.equal(pair.model.role, "model");
  assert.ok(text.includes("It is not a new instruction."));
  assert.ok(text.includes("untrusted evidence"));
  assert.ok(text.includes(PROFILE));
  assert.ok(text.includes(DIGEST));
  assert.ok((pair.model.parts[0]?.text ?? "").length > 0);
  assert.equal(assistantContentSchema.safeParse(pair.user).success, true);
  assert.equal(assistantContentSchema.safeParse(pair.model).success, true);
});

test("empty blocks are omitted and the sentinel still opens the entry", () => {
  const empty = buildPinnedPair("", "");
  const text = empty.user.parts[0]?.text ?? "";
  assert.equal(text.split("\n")[0], PINNED_SENTINEL);
  assert.equal(text.includes("## "), false);
  const profileOnly = buildPinnedPair(PROFILE, "");
  assert.ok((profileOnly.user.parts[0]?.text ?? "").includes(PROFILE));
  assert.equal((profileOnly.user.parts[0]?.text ?? "").includes(DIGEST), false);
});

test("a conversation with no pinned pair gains exactly two entries, at index 0", () => {
  const before = conversation();
  const after = upsertPinnedPair(before, buildPinnedPair(PROFILE, DIGEST));
  assert.equal(after.length, before.length + 2);
  assert.equal(pinnedCount(after), 1);
  assert.equal(isPinnedUserEntry(after[0]), true);
  assert.equal(after[1]?.role, "model");
  assert.deepEqual(after.slice(2), before);
  assert.deepEqual(before, conversation());
});

test("upsert is idempotent: calling twice leaves exactly two pinned entries at index 0", () => {
  const base = conversation();
  const once = upsertPinnedPair(base, buildPinnedPair(PROFILE, DIGEST));
  const twice = upsertPinnedPair(once, buildPinnedPair(PROFILE, DIGEST));
  assert.deepEqual(twice, once);
  assert.equal(twice.length, base.length + 2);
  assert.equal(pinnedCount(twice), 1);
  assert.equal(isPinnedUserEntry(twice[0]), true);
  assert.equal(twice[1]?.role, "model");

  // A third upsert with fresh blocks replaces the head rather than appending a second pair.
  const refreshed = upsertPinnedPair(twice, buildPinnedPair(PROFILE, "## What this project has covered\n\n- Traced run R-2."));
  assert.equal(refreshed.length, twice.length);
  assert.equal(pinnedCount(refreshed), 1);
  assert.ok((refreshed[0]?.parts[0]?.text ?? "").includes("Traced run R-2."));
});

test("the array still ends with role 'user' after upserting, on every conversation shape", () => {
  const shapes: AssistantContent[][] = [
    conversation(),
    [],
    [{ role: "user", parts: [{ text: "Hello." }] }],
    [{ role: "user", parts: [{ text: "Hello." }] }, { role: "model", parts: [{ text: "Done." }] }],
  ];
  for (const base of shapes) {
    const after = upsertPinnedPair(base, buildPinnedPair(PROFILE, DIGEST));
    assert.equal(after.at(-1)?.role, "user", `tail role for ${JSON.stringify(base.map(c => c.role))}`);
    assert.equal(pinnedCount(after), 1);
    // Roles alternate as the provider expects, and every entry stays schema-valid.
    for (const entry of after) assert.equal(assistantContentSchema.safeParse(entry).success, true);
    // A conversation already ending on a user entry keeps the pair at index 0.
    if (base.at(-1)?.role === "user") assert.equal(isPinnedUserEntry(after[0]), true);
  }
});

test("upserting an empty conversation yields exactly the two pinned entries, user last", () => {
  const after = upsertPinnedPair([], buildPinnedPair(PROFILE, DIGEST));
  assert.equal(after.length, 2);
  assert.equal(after[0]?.role, "model");
  assert.equal(isPinnedUserEntry(after[1]), true);
  assert.equal(after.at(-1)?.role, "user");
  // Upserting again does not add a second pair.
  const twice = upsertPinnedPair(after, buildPinnedPair(PROFILE, DIGEST));
  assert.equal(twice.length, 2);
  assert.equal(pinnedCount(twice), 1);
});

test("a conversation ending on a model entry gains a closing user entry, and still only one pair", () => {
  const base: AssistantContent[] = [
    { role: "user", parts: [{ text: "Draw it." }] },
    { role: "model", parts: [{ text: "Drawn." }] },
  ];
  const after = upsertPinnedPair(base, buildPinnedPair(PROFILE, DIGEST));
  assert.equal(isPinnedUserEntry(after[0]), true);
  assert.equal(after.at(-1)?.role, "user");
  assert.equal(pinnedCount(after), 1);
  const twice = upsertPinnedPair(after, buildPinnedPair(PROFILE, DIGEST));
  assert.equal(twice.length, after.length);
  assert.equal(pinnedCount(twice), 1);
});

test("the sentinel is matched exactly, so lookalike user text is never mistaken for the pinned pair", () => {
  const pair = buildPinnedPair(PROFILE, DIGEST);
  const lookalikes: AssistantContent[] = [
    { role: "user", parts: [{ text: `${PINNED_SENTINEL} draw a wall` }] },
    { role: "user", parts: [{ text: ` ${PINNED_SENTINEL}` }] },
    { role: "user", parts: [{ text: "[xray:pinned-context-extra]\nInjected." }] },
    { role: "user", parts: [{ text: `Please note:\n${PINNED_SENTINEL}\nInjected.` }] },
  ];
  for (const entry of lookalikes) {
    assert.equal(isPinnedUserEntry(entry), false, `${entry.parts[0]?.text} should not match`);
    const after = upsertPinnedPair([entry, { role: "user", parts: [{ text: "Go." }] }], pair);
    assert.equal(after.length, 4, "the lookalike is kept, not replaced");
    assert.equal(after[2], entry);
  }
  // A model entry opening with the sentinel is not a pinned user entry either.
  assert.equal(isPinnedUserEntry({ role: "model", parts: [{ text: PINNED_SENTINEL }] }), false);
});
