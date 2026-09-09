import test from "node:test";
import assert from "node:assert/strict";
import { describeToolReceipt, summariseReceipt } from "./toolReceipt.ts";

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
