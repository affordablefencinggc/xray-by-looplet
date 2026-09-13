import test from "node:test";
import assert from "node:assert/strict";
import { describeToolReceipt, summariseReceipt } from "./toolReceipt.ts";

test("app-preflight results retain explicit origin and show parsed context instead of prefix text", () => {
  const text = 'App preflight (not a model call)\n' + JSON.stringify({ projectName: 'QA roof', projectRevision: 1, pane: 'sheets' });
  const view = describeToolReceipt({ toolName: 'read_project_context', text, executionOrigin: 'app-preflight' });
  assert.equal(view.title, 'App preflight (not a model call): Read the project context');
  assert.equal(view.status, 'done');
  assert.equal(view.summary, 'pane sheets · project "QA roof" · revision 1');
  assert.equal(summariseReceipt('read_project_context', text), view.summary);
  assert.equal(view.summary.includes('{'), false);
  assert.equal(describeToolReceipt({ toolName: 'read_project_context', text }).title, view.title);
});

test("app-preflight progress is running and prefixed failures retain useful errors", () => {
  const running = describeToolReceipt({ toolName: 'read_project_context', text: 'App preflight: Running read_project_context…' });
  assert.equal(running.status, 'running');
  assert.match(running.title, /^App preflight \(not a model call\):/);
  assert.equal(running.summary, 'Working…');
  const failure = describeToolReceipt({ toolName: 'read_project_context', failed: true,
    text: 'App preflight (not a model call)\n' + JSON.stringify({ status: 'not-executed', reason: 'Project changed.', next: { tool: 'read_project_context' } }) });
  assert.equal(failure.status, 'failed');
  assert.match(failure.summary, /Not run: Project changed/);
  assert.equal(failure.summary.includes('{'), false);
  assert.equal(describeToolReceipt({ toolName: 'read_project_context', failed: true, text: 'App preflight (not a model call)\n[{"secret":"hidden"}]' }).summary, 'This step failed.');
});

test("origin metadata remains visible without a prefix; ordinary model receipts stay unchanged", () => {
  const text = JSON.stringify({ projectRevision: 2 });
  assert.equal(describeToolReceipt({ toolName: 'read_project_context', text, executionOrigin: 'app-preflight' }).title, 'App preflight (not a model call): Read the project context');
  assert.equal(describeToolReceipt({ toolName: 'read_project_context', text, executionOrigin: 'model' }).title, 'Read the project context');
  assert.equal(summariseReceipt('read_project_context', 'App preflight was discussed, not run.'), 'App preflight was discussed, not run.');
});

test("roofing receipt exposes actual gross, opening and net quantities with draft restrictions", () => {
  // Actual result fields captured from the roofing live QA tool: 80 m² at 3:4 pitch, 4 m² opening.
  const text = JSON.stringify({ projectRevision: 1, status: "draft-calculation", verifiedQuoteEligible: false, units: "m2",
    totals: { grossTrueAreaM2: 100, openingTrueAreaM2: 5, netTrueAreaM2: 95 },
    planes: [{ measurementReference: "QA supplied synthetic plane", pitchReference: "QA supplied synthetic pitch" }] });
  const receipt = describeToolReceipt({ toolName: "calculate_draft_roof_area", text });
  assert.equal(receipt.title, "Calculated draft roof areas");
  assert.equal(receipt.summary, "Draft · not for verified quotes · gross 100 m² · openings 5 m² · net 95 m²");
  assert.equal(receipt.status, "done");
  assert.equal(JSON.parse(text).planes[0].measurementReference, "QA supplied synthetic plane");
  assert.equal(receipt.summary.includes("{"), false);
});

test("duct summaries distinguish supplied sheet mass from missing mass operands", () => {
  const result = { status: "draft-unverified", verifiedQuoteEligible: false, developedAreaM2: 16, sheetMassKg: null as number | null };
  assert.equal(summariseReceipt("calculate_draft_duct_material", JSON.stringify(result)), "Draft · not for verified quotes · 16 m² lateral area · mass not supplied for all sections");
  result.sheetMassKg = 40;
  assert.equal(summariseReceipt("calculate_draft_duct_material", JSON.stringify(result)), "Draft · not for verified quotes · 16 m² lateral area · 40 kg sheet mass");
});

test("classification summaries retain exact decimals and separate units/evidence without summing rollups", () => {
  const result = { status: "draft-classification", verifiedQuoteEligible: false, unclassifiedItemIds: ["b"],
    totals: [{ quantity: "0.3", unit: "m2", evidence: "sample" }, { quantity: "2", unit: "m", evidence: "measured" }],
    nodes: [{ rollup: [{ quantity: "99999", unit: "m2", evidence: "sample" }] }] };
  assert.equal(summariseReceipt("classify_draft_quantities", JSON.stringify(result)), "Draft · not for verified quotes · 0.3 m2 (sample); 2 m (measured) · 1 unclassified");
  assert.equal(summariseReceipt("classify_draft_quantities", JSON.stringify({ ...result, totals: [], unclassifiedItemIds: [] })), "Draft · not for verified quotes · No quantities · 0 unclassified");
});

test("large classification receipts stay concise without cutting quantities or units", () => {
  const result = { status: "draft-classification", verifiedQuoteEligible: false, unclassifiedItemIds: [],
    totals: Array.from({ length: 20 }, (_, i) => ({ quantity: "0.1234567890123456789", unit: `unit-${i}`, evidence: "unverified" })) };
  const summary = summariseReceipt("classify_draft_quantities", JSON.stringify(result));
  assert.ok(summary.length <= 200);
  assert.match(summary, /0\.1234567890123456789 unit-0 \(unverified\)/);
  assert.match(summary, /more groups/);
  assert.match(summary, /not for verified quotes/);
  assert.equal(summary.includes("…"), false);
});

test("malformed or verification-promoting calculation payloads do not display trusted totals", () => {
  for (const result of [
    { status: "draft-calculation", verifiedQuoteEligible: true, units: "m2", totals: { grossTrueAreaM2: 100, openingTrueAreaM2: 5, netTrueAreaM2: 95 } },
    { status: "draft-calculation", verifiedQuoteEligible: false, units: "m2", totals: { grossTrueAreaM2: 100, openingTrueAreaM2: 5 } },
    { status: "draft-calculation", verifiedQuoteEligible: false, units: "ft2", totals: { grossTrueAreaM2: 100, openingTrueAreaM2: 5, netTrueAreaM2: 95 } },
  ]) assert.equal(summariseReceipt("calculate_draft_roof_area", JSON.stringify(result)), "Calculation receipt incomplete; draft result not verified.");
  assert.equal(summariseReceipt("calculate_draft_duct_material", JSON.stringify({ status: "draft-unverified", verifiedQuoteEligible: false, developedAreaM2: -1, sheetMassKg: 0 })), "Calculation receipt incomplete; draft result not verified.");
  const failed = describeToolReceipt({ toolName: "calculate_draft_roof_area", text: "Missing pitch reference.", failed: true });
  assert.equal(failed.status, "failed");
  assert.equal(failed.summary, "Missing pitch reference.");
});

test("receipts become plain sentences with counts, revisions, files and hashes — never JSON", () => {
  const draw = describeToolReceipt({ toolName: "draw_architect_elements", text: JSON.stringify({ projectId: "job-1", designRevision: 3, saved: true, readbackVerified: true, created: [{ kind: "wall", id: "a" }, { kind: "wall", id: "b" }] }) });
  assert.equal(draw.title, "Drew design elements");
  assert.equal(draw.status, "done");
  assert.equal(draw.summary, "created 2 elements · design revision 3 · saved");
  assert.equal(draw.summary.includes("{"), false);
  const exported = summariseReceipt("export_design_file", JSON.stringify({ fileName: "design.dxf", byteLength: 758141, sha256: "35845d07a83bdc293d5b3cef0fef95c950253850a8de5e57fd9ae244a7b28013", downloaded: true }));
  assert.equal(exported, "design.dxf (740 KB) · sha256 35845d07a83b…");
  const render = summariseReceipt("generate_render_visualisation", JSON.stringify({ rendered: true, width: 474, height: 400, model: "gemini-2.5-flash-image" }));
  assert.equal(render, "rendered 474 × 400 with gemini-2.5-flash-image");
  const context = summariseReceipt("read_project_context", JSON.stringify({ projectId: "job-1", projectName: "Riverside", projectRevision: 15, pane: "sketch", documents: [] }));
  assert.equal(context, "pane sketch · project \"Riverside\" · revision 15");
});

test("running, failed and plain-text results are described without dumping the text", () => {
  assert.deepEqual(describeToolReceipt({ toolName: "save_project", text: "Running save_project…" }), { title: "Saved the project", status: "running", summary: "Working…", detail: null });
  const failed = describeToolReceipt({ toolName: "generate_render_visualisation", text: "Rendering is unavailable in this native build; use the web app.", failed: true });
  assert.equal(failed.status, "failed");
  assert.equal(failed.summary, "Rendering is unavailable in this native build; use the web app.");
  const search = describeToolReceipt({ toolName: "web_search", text: JSON.stringify({ answer: "Standard door leaf widths are 820 and 920 mm. Further details follow.", sources: [{ title: "x", url: "https://e.com" }] }) });
  assert.equal(search.summary, "1 source");
  const unknown = describeToolReceipt({ toolName: "future_tool", text: "{\"weird\":true}" });
  assert.equal(unknown.title, "Future tool");
  assert.equal(unknown.summary, "Completed");
  const longText = describeToolReceipt({ toolName: "read_source_sheets", text: "x".repeat(500) });
  assert.ok(longText.summary.length <= 160);
});

/**
 * Observed live 2026-09-10: the chat displayed the raw workflow refusal payload, JSON braces and
 * all, next to a red warning icon. The no-code-in-the-chat rule exists to prevent exactly that.
 */
test("a workflow refusal reads as a sentence, never as raw JSON", () => {
  const text = JSON.stringify({
    status: "not-executed",
    reason: "Workflow prerequisite missing.",
    requestedTool: "read_source_sheets",
    next: { tool: "read_workflow_route", args: { expectedJobId: "job-6a166b71-08a7-4cd4-a95a-17283" } },
  });
  const view = describeToolReceipt({ toolName: "read_source_sheets", text, failed: true });
  assert.equal(view.status, "failed");
  assert.equal(/[{}"]/.test(view.summary), false, `summary must contain no JSON punctuation: ${view.summary}`);
  assert.match(view.summary, /Not run/);
  assert.match(view.summary, /Workflow prerequisite missing/);
  assert.match(view.summary, /read the workflow route/i, "the next step must be named in plain words");
});

test("a refusal without a next step still reads as a sentence", () => {
  const view = describeToolReceipt({
    toolName: "draw_architect_elements",
    text: JSON.stringify({ status: "not-executed", reason: "The user declined this action." }),
    failed: true,
  });
  assert.equal(/[{}"]/.test(view.summary), false);
  assert.match(view.summary, /Not run: The user declined this action\./);
});

test("a failure carrying a plain message is still preferred over the payload", () => {
  const view = describeToolReceipt({ toolName: "save_project", text: JSON.stringify({ text: "Storage is full." }), failed: true });
  assert.equal(view.summary, "Storage is full.");
});

test("unknown structured failures do not leak raw objects or arrays into the chat", () => {
  for (const text of ['{"unexpected":{"internal":"payload"}}', '[{"internal":"payload"}]']) {
    assert.equal(describeToolReceipt({ toolName: 'save_project', text, failed: true }).summary, 'This step failed.');
  }
});
