import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_OPTIONS, OPTION_SEND_MAX, SELECT_SHAPE_SUGGESTION, USE_IMAGE_SUGGESTION,
  latestReplyImage, parseReplyOptions, suggestionsFor,
} from "./richReply.ts";

const sends = (text: string) => parseReplyOptions(text).options.map(option => option.send);

test("numbered lists become options without their markers", () => {
  const reply = "I can do this two ways:\n\n1. Draw the walls first, then add openings.\n\n2. Draw the whole footprint as one extrusion.\nWhich do you prefer?";
  const parsed = parseReplyOptions(reply);
  assert.deepEqual(parsed.options.map(option => option.send), ["Draw the walls first, then add openings.", "Draw the whole footprint as one extrusion."]);
  assert.deepEqual(parsed.questions, ["Which do you prefer?"]);
});

test("every supported marker style is recognised when the reply asks for a choice", () => {
  const ask = (text: string) => "Which one do you want?\n" + text;
  assert.deepEqual(sends(ask("1) Alpha\n2) Beta")), ["Alpha", "Beta"]);
  assert.deepEqual(sends(ask("(a) Alpha\n(b) Beta")), ["Alpha", "Beta"]);
  assert.deepEqual(sends(ask("a. Alpha\nb. Beta")), ["Alpha", "Beta"]);
  assert.deepEqual(sends(ask("Option A: Alpha\nOption B — Beta")), ["Alpha", "Beta"]);
  assert.deepEqual(sends(ask("- A) Alpha\n- B) Beta")), ["Alpha", "Beta"]);
  assert.deepEqual(sends(ask("* 1. Alpha\n* 2. Beta")), ["Alpha", "Beta"]);
  // The cue may follow the list.
  assert.deepEqual(sends("1. Alpha\n2. Beta\nWhich one do you want?"), ["Alpha", "Beta"]);
});

test("numbered recaps, receipts and handover-style notes without a question never become pills", () => {
  assert.deepEqual(sends("Steps taken:\n1. Read the design\n2. Removed wall W3\n3. Saved revision 3"), []);
  assert.deepEqual(sends("### 1. DXF Export\n* **File Name:** architect-design.dxf\n### 2. IFC Export"), []);
  assert.deepEqual(sends("Handover from the previous chat\nRequests (oldest first):\n1. Draw a 6 by 4 metre room on Ground.\n2. Delete wall W3\nChanges made (tool receipts):\n- edit_architect_elements: {\"changed\":1}\n- draw_architect_elements: {\"created\":4}"), []);
  assert.deepEqual(sends("W1: 6000 mm\nW2: 4000 mm"), []);
});

test("bullet lists count only after a question or a choose/options/would-you-like cue", () => {
  assert.deepEqual(sends("Which level would you like?\n- Ground\n- First"), ["Ground", "First"]);
  assert.deepEqual(sends("Here are your options:\n• Ground\n• First"), ["Ground", "First"]);
  assert.deepEqual(sends("Choose one of these.\n- Ground\n- First"), ["Ground", "First"]);
  assert.deepEqual(sends("The design has the following levels.\n- Ground\n- First"), []);
});

test("markdown emphasis is stripped, labels are short and sends are capped at 160 characters", () => {
  const long = "x".repeat(400);
  const parsed = parseReplyOptions(`Choose one:\n1. **Draw walls** — the quick route\n2. ${long}`);
  assert.equal(parsed.options[0].send, "Draw walls — the quick route");
  assert.equal(parsed.options[0].label, "Draw walls — the quick route");
  assert.equal(parsed.options[1].send.length, OPTION_SEND_MAX);
  assert.ok(parsed.options[1].label.length <= 72 && parsed.options[1].label.endsWith("…"));
});

test("lists longer than eight items, receipts and JSON lines are ignored", () => {
  const nine = "Pick one:\n" + Array.from({ length: 9 }, (_, index) => `${index + 1}. Item ${index + 1}`).join("\n");
  assert.deepEqual(sends(nine), []);
  const eight = "Pick one:\n" + Array.from({ length: 8 }, (_, index) => `${index + 1}. Item ${index + 1}`).join("\n");
  assert.equal(sends(eight).length, MAX_OPTIONS);
  assert.deepEqual(sends('Would you like:\n- {"kind":"wall"}\n- "levels": []\n- Running draw_architect_elements…\n- Tool completed.\n- A real choice'), ["A real choice"]);
  assert.deepEqual(sends("Which?\n1. {\"a\":1}\n2. Real"), ["Real"]);
});

test("questions are collected even when there are no options, and duplicates collapse", () => {
  const parsed = parseReplyOptions("Which wall is the south wall?\nAnd what height should it be?\nWhich wall is the south wall?");
  assert.deepEqual(parsed.questions, ["Which wall is the south wall?", "And what height should it be?"]);
  assert.deepEqual(parsed.options, []);
  assert.deepEqual(parseReplyOptions("").options, []);
  assert.deepEqual(sends("Which?\n1. Same\n1. Same"), ["Same"]);
});

test("suggestions after a drawing offer 3D, DXF, undo and the select-a-shape pill", () => {
  const list = suggestionsFor({ pane: "sketch", lastReplyText: "Done. I drew four walls on Ground.", hasDesign: true, native: false, hasImages: false });
  assert.ok(list.includes(SELECT_SHAPE_SUGGESTION));
  assert.ok(list.includes("Show all levels in 3D"));
  assert.ok(list.includes("Export as DXF"));
  assert.ok(list.length >= 3 && list.length <= 4, `got ${list.length}`);
  assert.equal(new Set(list).size, list.length);
});

test("model pane suggests describing the part and a real-life view on the web only", () => {
  const web = suggestionsFor({ pane: "model", lastReplyText: "", hasDesign: false, native: false, hasImages: false });
  assert.ok(web.includes(SELECT_SHAPE_SUGGESTION));
  assert.ok(web.includes("Describe the selected part"));
  assert.ok(web.includes("Generate a real-life view"));
  const native = suggestionsFor({ pane: "model", lastReplyText: "", hasDesign: false, native: true, hasImages: false });
  assert.ok(!native.includes("Generate a real-life view"));
  assert.ok(native.includes("Describe the selected part"));
  assert.ok(native.length >= 3 && native.length <= 4);
});

test("images offer a reference pill and no canvas means no select-a-shape pill", () => {
  const withImage = suggestionsFor({ pane: "sheets", lastReplyText: "Here is the rendered view.", hasDesign: false, native: false, hasImages: true });
  assert.equal(withImage[0], USE_IMAGE_SUGGESTION);
  assert.ok(!withImage.includes(SELECT_SHAPE_SUGGESTION));
  for (const pane of ["overview", "sheets", "measure", "cost", "proof", "review"]) {
    const list = suggestionsFor({ pane, lastReplyText: "", hasDesign: false, native: true, hasImages: false });
    assert.ok(list.length >= 3 && list.length <= 4, `${pane}: ${list.length}`);
    assert.equal(new Set(list).size, list.length);
  }
});

test("latest reply image comes from the trailing non-user entries only", () => {
  const png = { mimeType: "image/png" as const, data: "iVBORw0KGgo=" };
  assert.equal(latestReplyImage([]), null);
  assert.equal(latestReplyImage([{ kind: "tool", images: [png] }, { kind: "user" }]), null);
  assert.equal(latestReplyImage([{ kind: "user" }, { kind: "tool", images: [png] }, { kind: "assistant", text: "Here you go." }]), png);
});
