import test from "node:test";
import assert from "node:assert/strict";
import { blockText, headingIcon, parseInlines, parseMindMap, parseReply, quoteForReply, tidyReplyText } from "./replyMarkdown.ts";

const sample = [
  "In this project (**New project**, ID: `job-45a825b1-d5d5-471d-8e1c-134eb76f9760`, revision 2), I can assist with:",
  "",
  "### 1. Workspace Navigation & Project Inspection",
  "* Navigate between panes (`overview`, `sheets`, `measure`).",
  "* Check project hydration, recovery, and revision status.",
  "",
  "### 2. Roof options",
  "1. Hipped roof — 22.5° on all edges",
  "2. Skillion roof — 5° to the south",
  "",
  "Wall `d01c4698-aee6-4cfd-a865-9201464c04cf` was updated; see https://example.com/spec and [the sheet](https://example.com/sheet).",
  "",
  "```mindmap",
  "Riverside Lab",
  "  Ground",
  "    Labs 1-4",
  "    Workshop",
  "  Level 1",
  "  Roof",
  "```",
  "",
  "| Item | Count |",
  "|---|---|",
  "| Walls | 66 |",
  "| Doors | 31 |",
  "",
  "> Note: sample data is not verified 😀",
  "",
  "---",
  "Done ✅ 🏗️",
].join("\n");

test("headings, lists, paragraphs, tables, quotes, rules and fences become blocks with no raw markers", () => {
  const blocks = parseReply(sample);
  const kinds = blocks.map(block => block.kind);
  assert.deepEqual(kinds, ["paragraph", "heading", "list", "heading", "list", "paragraph", "mindmap", "table", "quote", "rule", "paragraph"]);
  const heading = blocks[1];
  assert.equal(heading.kind === "heading" && heading.level, 3);
  assert.equal(heading.kind === "heading" && heading.text, "1. Workspace Navigation & Project Inspection");
  assert.equal(heading.kind === "heading" && heading.icon, "project");
  const roof = blocks[3];
  assert.equal(roof.kind === "heading" && roof.icon, "roof");
  const list = blocks[2];
  assert.equal(list.kind === "list" && list.ordered, false);
  assert.equal(list.kind === "list" && list.items.length, 2);
  const ordered = blocks[4];
  assert.equal(ordered.kind === "list" && ordered.ordered, true);
  assert.equal(ordered.kind === "list" && ordered.items[1].text, "Skillion roof — 5° to the south");
  for (const block of blocks) assert.equal(/^#{1,6}\s|\*\*/.test(blockText(block)), false, blockText(block));
});

test("inline parsing keeps bold, code, links and turns entity IDs into chips", () => {
  const inlines = parseInlines("Wall `d01c4698-aee6-4cfd-a865-9201464c04cf` was **updated**; see https://example.com/spec and [the sheet](https://example.com/sheet) and `job-1` and _soft_.");
  assert.deepEqual(inlines.map(inline => inline.kind), ["text", "id", "text", "bold", "text", "link", "text", "link", "text", "code", "text", "italic", "text"]);
  const id = inlines[1];
  assert.equal(id.kind === "id" && id.id, "d01c4698-aee6-4cfd-a865-9201464c04cf");
  const link = inlines[7];
  assert.equal(link.kind === "link" && link.href, "https://example.com/sheet");
  assert.equal(link.kind === "link" && link.text, "the sheet");
  // Only http(s) links survive; javascript: never becomes a link.
  assert.deepEqual(parseInlines("[x](javascript:alert(1))").map(inline => inline.kind), ["text"]);
  // A bare UUID outside backticks is a chip too.
  assert.equal(parseInlines("id 2d094904-b46f-4016-99d9-20594159c905 moved")[1].kind, "id");
});

test("mind maps parse indented outlines and bullets into a tree with the first line as the root", () => {
  const root = parseMindMap("Riverside Lab\n  Ground\n    Labs 1-4\n    Workshop\n  Level 1\n  Roof");
  assert.equal(root?.label, "Riverside Lab");
  assert.deepEqual(root?.children.map(child => child.label), ["Ground", "Level 1", "Roof"]);
  assert.deepEqual(root?.children[0].children.map(child => child.label), ["Labs 1-4", "Workshop"]);
  const bullets = parseMindMap("Panes\n- Sheets\n  - Register\n- Measure");
  assert.deepEqual(bullets?.children.map(child => child.label), ["Sheets", "Measure"]);
  assert.deepEqual(bullets?.children[0].children.map(child => child.label), ["Register"]);
  assert.equal(parseMindMap("   \n"), null);
  const block = parseReply("```mindmap\nA\n  B\n```")[0];
  assert.equal(block.kind, "mindmap");
});

test("tidying removes faces but keeps architectural emoji, and unwraps LaTeX-style maths", () => {
  assert.equal(tidyReplyText("Done 😀 🏗️ 👍 ✅"), "Done  🏗️  ✅");
  assert.equal(tidyReplyText("End point $b$ moved to $(9400, 0)\\text{ mm}$"), "End point b moved to (9400, 0) mm");
  const blocks = parseReply(sample);
  const last = blocks[blocks.length - 1];
  assert.equal(last.kind === "paragraph" && last.text, "Done ✅ 🏗️");
});

test("heading icons map architectural words; unknown headings get none; warnings win", () => {
  assert.equal(headingIcon("Roof options"), "roof");
  assert.equal(headingIcon("Sheets & Takeoff Evidence"), "sheet");
  assert.equal(headingIcon("Cost & Price Books"), "cost");
  assert.equal(headingIcon("Limitations of the roof export"), "warning");
  assert.equal(headingIcon("Lorem ipsum"), "none");
});

test("quoteForReply produces a bounded Markdown quote", () => {
  assert.equal(quoteForReply("Walls  updated\nto 9400 mm"), "> Walls updated to 9400 mm\n");
  const long = quoteForReply("x".repeat(500));
  assert.ok(long.length <= 284 && long.endsWith("…\n"));
});

test("plain text without markdown is one paragraph; the eight-step pause text stays intact", () => {
  const blocks = parseReply("DONE");
  assert.deepEqual(blocks, [{ kind: "paragraph", text: "DONE", inlines: [{ kind: "text", text: "DONE" }] }]);
  assert.equal(parseReply("").length, 0);
});
