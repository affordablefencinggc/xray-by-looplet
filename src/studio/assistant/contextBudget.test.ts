import test from "node:test";
import assert from "node:assert/strict";
import {
  CONTEXT_LIMIT_TOKENS, CONTEXT_WARN_TOKENS, HANDOVER_MAX_CHARS, IMAGE_TOKENS,
  buildHandover, contextState, describeContext, estimateContextTokens, type HandoverEntry,
} from "./contextBudget.ts";
import type { AssistantContent } from "./contract.ts";

const image = { mimeType: "image/png" as const, data: "iVBORw0KGgo=" };

test("token estimate counts text at four characters per token and rounds up", () => {
  assert.equal(estimateContextTokens([]), 0);
  assert.equal(estimateContextTokens([{ role: "user", parts: [{ text: "abcd" }] }]), 1);
  assert.equal(estimateContextTokens([{ role: "user", parts: [{ text: "abcde" }] }]), 2);
  assert.equal(estimateContextTokens([{ role: "user", parts: [{ text: "a".repeat(400) }, { text: "b".repeat(401) }] }]), 100 + 101);
});

test("token estimate counts tool calls and results by their JSON length", () => {
  const functionCall = { name: "draw_architect_elements", args: { operations: [{ kind: "wall", a: [0, 0], b: [6000, 0] }] } };
  const functionResponse = { name: "draw_architect_elements", response: { isError: false, text: "Created W1 revision 2" } };
  const contents: AssistantContent[] = [
    { role: "model", parts: [{ functionCall }] },
    { role: "user", parts: [{ functionResponse }] },
  ];
  const expected = Math.ceil(JSON.stringify(functionCall).length / 4) + Math.ceil(JSON.stringify(functionResponse).length / 4);
  assert.equal(estimateContextTokens(contents), expected);
});

test("every inline image counts a fixed 1,000 tokens regardless of its size", () => {
  const big = { mimeType: "image/jpeg" as const, data: "/9j/".repeat(50000) };
  assert.equal(estimateContextTokens([{ role: "user", parts: [{ text: "look" }, { inlineData: image }, { inlineData: big }] }]), 1 + 2 * IMAGE_TOKENS);
  assert.equal(IMAGE_TOKENS, 1000);
});

test("thresholds: ok below 240,000, warn from 240,000, full from 300,000, percent capped at 100", () => {
  assert.equal(CONTEXT_LIMIT_TOKENS, 300_000);
  assert.equal(CONTEXT_WARN_TOKENS, 240_000);
  assert.deepEqual(contextState(0), { level: "ok", percent: 0, tokens: 0, limit: 300_000 });
  assert.equal(contextState(36_000).percent, 12);
  assert.equal(contextState(239_999).level, "ok");
  assert.deepEqual(contextState(240_000), { level: "warn", percent: 80, tokens: 240_000, limit: 300_000 });
  assert.equal(contextState(299_999).level, "warn");
  assert.equal(contextState(300_000).level, "full");
  assert.deepEqual(contextState(1_000_000), { level: "full", percent: 100, tokens: 1_000_000, limit: 300_000 });
  assert.equal(contextState(Number.NaN).level, "ok");
  assert.equal(contextState(-5).tokens, 0);
});

test("meter text reads as a percentage with a token tooltip", () => {
  const meter = describeContext(36_000);
  assert.equal(meter.label, "Context 12%");
  assert.equal(meter.title, "≈36,000 of 300,000 tokens");
  assert.equal(meter.state.level, "ok");
});

const entries: HandoverEntry[] = [
  { kind: "user", text: "  Draw a 6 by 4 metre room on Ground.  " },
  { kind: "tool", toolName: "read_architect_design", text: '{"levels":[{"id":"L1"}]}' },
  { kind: "tool", toolName: "draw_architect_elements", text: "Running draw_architect_elements…" },
  { kind: "tool", toolName: "draw_architect_elements", text: "Created 4 walls on level L1; revision 2.\nIDs: W1, W2, W3, W4." },
  { kind: "assistant", text: "Done. I drew four walls for the 6 × 4 m room." },
  { kind: "user", text: "Now add a door on the south wall" },
  { kind: "tool", toolName: "edit_architect_elements", text: "Wall not found", failed: true },
  { kind: "assistant", text: "Which wall is the south wall? 1. W1 2. W3" },
];

test("handover carries the project, every request in order, state-changing receipts and the last reply", () => {
  const text = buildHandover({ jobId: "job-42", entries, contents: [], reason: null });
  const lines = text.split("\n");
  assert.equal(lines[0], "Handover from the previous chat");
  assert.equal(lines[1], "Project: job-42");
  assert.ok(lines.indexOf("1. Draw a 6 by 4 metre room on Ground.") < lines.indexOf("2. Now add a door on the south wall"), "requests keep their order, newest last");
  assert.match(text, /^- draw_architect_elements: Created 4 walls on level L1; revision 2\. IDs: W1, W2, W3, W4\.$/m);
  assert.doesNotMatch(text, /read_architect_design/, "read-only tools are not changes");
  assert.doesNotMatch(text, /Running draw_architect_elements/, "progress notices are not receipts");
  assert.doesNotMatch(text, /Wall not found/, "failed tools changed nothing");
  assert.match(text, /Last assistant reply:\nWhich wall is the south wall\? 1\. W1 2\. W3$/);
  assert.doesNotMatch(text, /Outstanding:/);
  assert.equal(buildHandover({ jobId: "job-42", entries, reason: null }), text, "deterministic for the same input");
});

test("handover flags outstanding work after the eight-step pause or the context limit stop", () => {
  const paused = buildHandover({ jobId: "j", entries, reason: "Paused after eight assistant steps. Completed actions are retained; send another message to continue." });
  assert.match(paused, /\nOutstanding: .*Paused after eight assistant steps/);
  const full = buildHandover({ jobId: "j", entries, reason: "This chat reached its 300,000-token context limit. Continue in a new chat to carry your work over." });
  assert.match(full, /\nOutstanding: /);
  const stopped = buildHandover({ jobId: "j", entries, reason: "Assistant stopped. Completed tool actions remain in the project; review the activity below before retrying." });
  assert.doesNotMatch(stopped, /Outstanding:/);
});

test("handover trims each request to 300 characters, receipts to 200 and the last reply to 1,200", () => {
  const text = buildHandover({
    jobId: "j",
    entries: [
      { kind: "user", text: "r".repeat(1000) },
      { kind: "tool", toolName: "save_project", text: "s".repeat(1000) },
      { kind: "assistant", text: "a".repeat(5000) },
    ],
  });
  assert.match(text, new RegExp(`^1\\. r{299}…$`, "m"));
  assert.match(text, new RegExp(`^- save_project: s{199}…$`, "m"));
  assert.match(text, new RegExp(`\\na{1199}…$`));
  assert.ok(text.length <= HANDOVER_MAX_CHARS);
});

test("handover never exceeds 6,000 characters and keeps the newest requests when it must drop some", () => {
  const many: HandoverEntry[] = [];
  for (let index = 0; index < 120; index++) {
    many.push({ kind: "user", text: `Request number ${index} ${"x".repeat(250)}` });
    many.push({ kind: "tool", toolName: "draw_architect_elements", text: `Receipt ${index} ${"y".repeat(150)}` });
    many.push({ kind: "assistant", text: `Reply ${index}` });
  }
  const text = buildHandover({ jobId: "job-big", entries: many, reason: null });
  assert.ok(text.length <= HANDOVER_MAX_CHARS, `length ${text.length}`);
  assert.match(text, /Request number 119 /, "newest request survives");
  assert.doesNotMatch(text, /Request number 0 /, "oldest request dropped first");
  assert.match(text, /earlier omitted/);
  assert.match(text, /Last assistant reply:\nReply 119/);
  assert.ok(text.startsWith("Handover from the previous chat\nProject: job-big"));
});

test("a previous handover entry is context, not the last reply, and empty chats still produce a note", () => {
  const chained = buildHandover({
    jobId: "j",
    entries: [
      { kind: "assistant", text: "Continued from the previous chat.\nHandover from the previous chat\nProject: j" },
      { kind: "user", text: "Carry on" },
    ],
  });
  assert.match(chained, /Last assistant reply:\n\(none\)/);
  const empty = buildHandover({ jobId: "j", entries: [] });
  assert.match(empty, /Requests \(oldest first\):\n\(none\)/);
  assert.match(empty, /- \(no state-changing tools ran\)/);
});

test("QA context floor only raises the estimate, ignores junk and tolerates a throwing storage", async () => {
  const { readContextFloor, applyContextFloor, CONTEXT_FLOOR_KEY } = await import("./contextBudget.ts");
  const storage = (value: string | null) => ({ getItem: (key: string) => (key === CONTEXT_FLOOR_KEY ? value : null) });
  assert.equal(readContextFloor(storage("300000")), 300000);
  assert.equal(readContextFloor(storage("abc")), 0);
  assert.equal(readContextFloor(storage("-5")), 0);
  assert.equal(readContextFloor(storage("1.5")), 0);
  assert.equal(readContextFloor(storage(null)), 0);
  assert.equal(readContextFloor(null), 0);
  assert.equal(readContextFloor({ getItem: () => { throw new Error("blocked"); } }), 0);
  assert.equal(applyContextFloor(120, 300000), 300000);
  assert.equal(applyContextFloor(400000, 300000), 400000);
  assert.equal(applyContextFloor(NaN, 0), 0);
});
