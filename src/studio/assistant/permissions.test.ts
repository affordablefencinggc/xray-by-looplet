import test from "node:test";
import assert from "node:assert/strict";
import {
  DENIED_MESSAGE, READONLY_MESSAGE, STOPPED_MESSAGE, describeToolIntent, gateToolCall, permissionVerdict, readPermissionMode, usePermissions,
} from "./permissions.ts";

test("verdicts: read tools always run; edits depend on the mode and on chat grants", () => {
  const none = new Set<string>();
  assert.equal(permissionVerdict("read_project_context", "ask", none), "allowed");
  assert.equal(permissionVerdict("read_project_context", "readonly", none), "allowed");
  assert.equal(permissionVerdict("draw_architect_elements", "ask", none), "ask");
  assert.equal(permissionVerdict("draw_architect_elements", "auto", none), "allowed");
  assert.equal(permissionVerdict("draw_architect_elements", "readonly", none), "blocked");
  assert.equal(permissionVerdict("draw_architect_elements", "ask", new Set(["draw_architect_elements"])), "allowed");
  assert.equal(readPermissionMode("auto"), "auto");
  assert.equal(readPermissionMode("nonsense"), "ask");
  assert.equal(readPermissionMode(null), "ask");
});

test("intents are plain words from the arguments, never JSON", () => {
  const draw = describeToolIntent("draw_architect_elements", { expectedJobId: "job-1", expectedRevision: 3, operations: [{ kind: "wall" }, { kind: "wall" }, { kind: "door" }] });
  assert.equal(draw.title, "Draw design elements");
  assert.equal(draw.summary, "2 walls, 1 door · on design revision 3");
  const sheet = describeToolIntent("manage_source_sheet", { action: "archive", sheetIndex: 11, name: "Survey" });
  assert.equal(sheet.summary, "archive · sheet 12 · \"Survey\"");
  const review = describeToolIntent("review_takeoff_item", { decision: "approved", reviewer: "Daniel Sivyer" });
  assert.equal(review.summary, "decision: approved · for Daniel Sivyer");
  const exp = describeToolIntent("export_design_file", { kind: "dxf" });
  assert.equal(exp.summary, "DXF");
  assert.equal(describeToolIntent("save_project", {}).summary, "on the current project");
  assert.equal(describeToolIntent("future_tool", {}).title, "Future tool");
  assert.equal(/[{}[\]]|":/.test(draw.summary + sheet.summary), false);
});

test("the gate asks in ask mode and honours once / for-this-chat / deny / stop", async () => {
  const store = usePermissions;
  store.setState({ mode: "ask", grantedForChat: new Set(), pending: null });
  // once
  let gate = gateToolCall("edit_architect_elements", { operations: [{ kind: "move" }] });
  await new Promise(r => setTimeout(r, 0));
  assert.equal(store.getState().pending?.title, "Edit design elements");
  store.getState().decide(store.getState().pending!.id, "once");
  assert.equal(await gate, null);
  assert.equal(store.getState().pending, null);
  assert.equal(store.getState().grantedForChat.size, 0);
  // for this chat: the next call of the same tool does not ask
  gate = gateToolCall("edit_architect_elements", {});
  await new Promise(r => setTimeout(r, 0));
  store.getState().decide(store.getState().pending!.id, "chat");
  assert.equal(await gate, null);
  assert.equal(await gateToolCall("edit_architect_elements", {}), null);
  assert.equal(store.getState().pending, null);
  // deny
  gate = gateToolCall("save_project", {});
  await new Promise(r => setTimeout(r, 0));
  store.getState().decide(store.getState().pending!.id, "deny");
  assert.equal(await gate, DENIED_MESSAGE);
  // stop while pending
  const controller = new AbortController();
  gate = gateToolCall("import_price_book", { name: "x" }, controller.signal);
  await new Promise(r => setTimeout(r, 0));
  assert.ok(store.getState().pending);
  controller.abort();
  assert.equal(await gate, STOPPED_MESSAGE);
  assert.equal(store.getState().pending, null);
  // a decision for an unknown id is ignored
  store.getState().decide("nope", "once");
  // read-only blocks without asking; auto allows without asking
  store.getState().setMode("readonly");
  assert.equal(await gateToolCall("save_project", {}), READONLY_MESSAGE);
  assert.equal(await gateToolCall("read_project_context", {}), null);
  store.getState().setMode("auto");
  assert.equal(await gateToolCall("save_project", {}), null);
  store.getState().resetChatGrants();
  assert.equal(store.getState().grantedForChat.size, 0);
  store.getState().setMode("ask");
});
