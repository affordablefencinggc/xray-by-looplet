import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_OPTIONS, OPTION_SEND_MAX, SELECT_SHAPE_SUGGESTION, USE_IMAGE_SUGGESTION,
  latestReplyImage, parseReplyOptions, suggestionsFor, hasCurrentReplyChoices,
} from "./richReply.ts";

const sends = (text: string) => parseReplyOptions(text).options.map(option => option.send);

test("an unrelated later question cannot promote earlier factual lists", () => {
  assert.deepEqual(sends("Current blockers:\n1. Missing source\n2. Unlocked calibration\n\nThe project is unchanged.\nWould you like more detail?"), []);
  assert.deepEqual(sends("## Tools / actions actually executed\n1. read_project_context\n2. read_takeoff_evidence\n\nWhich one should I explain?"), []);
  assert.deepEqual(sends("Observations:\n- No drawing\n- No measurements\n\nChoose one:\n1. Explain calibration\n2. Explain source import"), ["Explain calibration", "Explain source import"]);
});

test("choice cues apply only to adjacent list blocks in both directions", () => {
  assert.deepEqual(sends("Choose one:\n1. Ground\n2. First\n\nOther information:\n1. Project revision 1\n2. No source"), ["Ground", "First"]);
  assert.deepEqual(sends("1. Read context\n2. Read evidence\n\nThe reads finished.\n\n1. Ground\n2. First\nWhich one do you prefer?"), ["Ground", "First"]);
  assert.deepEqual(sends("- Ground\n- First\nWhich one do you prefer?"), ["Ground", "First"]);
  assert.deepEqual(sends("Choose one:\n\n**Available levels**\n1. Ground\n2. First"), []);
});

test('fallback suggestions yield to current choices, questions and reference cards, not history', () => {
  const choice = { kind: 'assistant', text: 'Choose one:\n1. Draw walls\n2. Add windows' };
  assert.equal(hasCurrentReplyChoices([choice]), true);
  assert.equal(hasCurrentReplyChoices([{ kind: 'assistant', text: 'Which floor?' }]), true);
  assert.equal(hasCurrentReplyChoices([{ kind: 'tool', text: '', selectableReference: true }, { kind: 'assistant', text: 'Found two references.' }]), true);
  assert.equal(hasCurrentReplyChoices([choice, { kind: 'user', text: 'Draw walls' }, { kind: 'assistant', text: 'Walls drawn.' }]), false);
  assert.equal(hasCurrentReplyChoices([choice, { kind: 'assistant', text: 'Task complete.' }]), false);
  assert.equal(hasCurrentReplyChoices([]), false);
});

test('developer self-assessment never becomes a choice or hides fallback suggestions', () => {
  const review = '\n\n### Developer review\n1. Outcome: offered options.\n2. Improvement: choose shorter explanations.\nWas that useful?';
  assert.deepEqual(parseReplyOptions('Task complete.' + review), { options: [], questions: [] });
  assert.deepEqual(sends('Choose one:\n1. Draw walls\n2. Add windows' + review), ['Draw walls', 'Add windows']);
  assert.equal(hasCurrentReplyChoices([{ kind: 'assistant', text: 'Task complete.' + review }]), false);
});

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

// Exact final assistant text captured on DANS1, 2026-09-13 (roofing QA).
const recordedRoofingReply = "The receipt stack is unambiguous and complete for a read-only inspection, so no further calls are needed.\n\n# Roofing QA — inspection read-out\n\n## Actual project state\n- Project: `New project`, revision 1, design revision 1, pane `sheets`.\n- Active document: `doc-sample` — *No source plan* (bundled sample), `sha256: null`, page count 1.\n- Source candidates: 1 sample entry, no governing sources, `informationStatus: unknown`.\n- Evidence on sheet 1: calibration **unlocked**, source `unverified`, confidence 0, no known distance, no traces, no located items, no annotations.\n- Attachments: none stored. Price books: none imported.\n- Save state: `savedProjectRevision = 1`, recovery not blocked, no save error.\n- Architectural controller: **not mounted** (Sketch/Architectural workspace would need `navigate_workspace pane: sketch` first, but no edits were requested).\n\n## Can a source-backed pitched-roof takeoff run *right now*?\n**No.** A source-backed takeoff requires all of the following, none of which are satisfied:\n\n1. A **governing source** — the only document is a sample placeholder with no SHA-256, so source identity cannot match.\n2. A **locked two-point calibration** on the target sheet — sheet 1 reports `locked: false`, `knownDistanceM: null`, `candidates: 0`.\n3. **Actual roof geometry to trace** — the read returned no traces, and the sample has no identified walls, ridges, eaves, hips or valleys to follow.\n4. **Stated dimensions from the user** — no user-supplied known distance or roof specification exists in this session.\n5. **Decision owner / professional authority** — `unverified`, so even if lengths were traced they could not be approved or issued here.\n\nThe blockers the evidence itself reports match exactly: *“Import or select a source document,”* *“Confirm and lock the drawing scale for sheet 1,”* and *“Trace at least one takeoff run.”*\n\n## What the available tools can do (read-only here)\n- `read_project_context` ✔ used — confirms identity and source list.\n- `read_source_sheets` ✔ used — sample sheets refused to organise, which is the expected firewall.\n- `read_takeoff_evidence` ✔ used — surfaces calibration, traces, items and blockers per sheet.\n- `read_assistant_file` ✔ used (listing) — no project files present.\n- `read_price_books` ✔ used — no rate books imported.\n- `read_workflow_route` ✔ used — `inspect` route selected, no permissions granted.\n\n## What is not available through tools\n- Importing a plan is UI-only; I cannot attach a real roof plan in this session.\n- No quote, bill-of-materials, areas or volumes are produced from a sample.\n- No editing, drawing, calibration, trace, approval or export was performed — by request, and because the prerequisites are absent.\n- `prepare_source_room` / `read_source_geometry` need a real attached source page; the active one is a sample placeholder.\n\n## Tools / actions actually executed\n1. `read_workflow_route` (inspect).\n2. `read_project_context`.\n3. `read_source_sheets`.\n4. `read_takeoff_evidence`.\n5. `read_assistant_file` (listing).\n6. `read_price_books`.\n\n## Conclusion\nThis session can deliver a **roofing-QA inspection report** (the read-out above), but it cannot deliver a *source-backed pitched-roof takeoff*. The first roof run would require, in order: attach a real PDF/DXF source with a known SHA-256, lock a two-point scale calibration on the target sheet with the user’s known distance, then trace each ridge/eave/hip/valley and rafter run before any length, area or count is quoted.\n\n# Developer review\n- **Outcome**: Honest inspection — stated that the sample source and unlocked calibration block any source-backed takeoff, without fabricating measurements.\n- **Friction**: None in execution; the user’s prerequisites (real source, user-stated scale, roof dimensions) genuinely cannot be supplied through tools, so further calls would only repeat evidence.\n- **Improvement**: Could open with a one-line yes/no before the detail block to let a busy reviewer decide at a glance; the rest was clear and correctly separated from the developer section.";

test('recorded roofing inspection does not turn blockers or executed tools into choices', () => {
  assert.deepEqual(sends(recordedRoofingReply), []);
  assert.deepEqual(sends(recordedRoofingReply + '\n\nWould you like more detail?'), []);
});
