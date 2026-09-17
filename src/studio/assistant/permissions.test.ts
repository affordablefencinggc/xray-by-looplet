import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultJob } from "../domain.ts";
import type { Pane } from "../store.ts";
import { createAppTools, type AppToolPort } from "./appTools.ts";
import { isAssistantEffectfulTool, isAssistantGatedTool } from "./skills.ts";
import {
  DENIED_MESSAGE, INTENT_KEYS, READONLY_MESSAGE, STOPPED_MESSAGE, TOOL_TITLES, describeToolIntent, gateToolCall, permissionVerdict,
  readPermissionMode, usePermissions,
} from "./permissions.ts";

/** The five tools that change live workspace state or spend a render without editing the project (defects D5 and D8). */
const EFFECTFUL = ["navigate_workspace", "show_design_in_model", "hide_designed_model", "control_draftsman", "generate_render_visualisation"];

test("verdicts: read tools always run; edits and effectful non-edits depend on the mode and on chat grants", () => {
  const none = new Set<string>();
  assert.equal(permissionVerdict("read_project_context", "ask", none), "allowed");
  assert.equal(permissionVerdict("read_project_context", "readonly", none), "allowed");
  assert.equal(permissionVerdict("draw_architect_elements", "ask", none), "ask");
  assert.equal(permissionVerdict("draw_architect_elements", "auto", none), "allowed");
  assert.equal(permissionVerdict("draw_architect_elements", "readonly", none), "blocked");
  assert.equal(permissionVerdict("draw_architect_elements", "ask", new Set(["draw_architect_elements"])), "allowed");
  // D8's unnamed half: the four device/viewer mutators and the render were admitted as reads in every
  // mode. They are not project edits, but the mode still governs them.
  for (const name of EFFECTFUL) {
    assert.equal(isAssistantEffectfulTool(name), true, name);
    assert.equal(permissionVerdict(name, "ask", none), "ask", name);
    assert.equal(permissionVerdict(name, "auto", none), "allowed", name);
    assert.equal(permissionVerdict(name, "readonly", none), "blocked", name);
    assert.equal(permissionVerdict(name, "ask", new Set([name])), "allowed", name);
  }
  // A pure read and an unknown tool are still admitted on the read rule, so the gate fails open only
  // where it is supposed to: a tool that does not exist is refused later by the declaration filter.
  assert.equal(permissionVerdict("capture_workspace_image", "readonly", none), "allowed");
  assert.equal(permissionVerdict("read_source_sheets", "readonly", none), "allowed");
  assert.equal(readPermissionMode("auto"), "auto");
  assert.equal(readPermissionMode("nonsense"), "ask");
  assert.equal(readPermissionMode(null), "ask");
});

test("intents are plain words from the arguments, never JSON", () => {
  const draw = describeToolIntent("draw_architect_elements", { expectedJobId: "job-1", expectedRevision: 3, operations: [{ kind: "wall" }, { kind: "wall" }, { kind: "door" }] });
  assert.equal(draw.title, "Draw design elements");
  assert.equal(draw.summary, "2 walls, 1 door · on design revision 3");
  // D4: every one of these keys is the one the tool actually declares. `sheetIndex`, `page`,
  // `reviewer`, `decidedBy` and `knownDistanceM` are read by no tool, so each old branch was dead.
  const sheet = describeToolIntent("manage_source_sheet", { action: "archive", pageIndex: 11, name: "Survey" });
  assert.equal(sheet.summary, "archive · page 12 · \"Survey\"");
  const review = describeToolIntent("review_takeoff_item", { kind: "run", decision: "approve", actor: "Daniel Sivyer" });
  assert.equal(review.summary, "RUN · decision: approve · for Daniel Sivyer");
  const exp = describeToolIntent("export_design_file", { format: "dxf" });
  assert.equal(exp.summary, "DXF");
  const calibrate = describeToolIntent("calibrate_source_sheet", { sheet: 2, knownDistance: { value: 3.5, unit: "m" } });
  assert.equal(calibrate.summary, "sheet 3 · 3.5 m known distance");
  const trace = describeToolIntent("trace_takeoff_run", { sheet: 0, points: [{ x: 1 }, { x: 2 }, { x: 3 }] });
  assert.equal(trace.summary, "sheet 1 · 3 points");
  const book = describeToolIntent("import_price_book", { bookName: "Supplier 2026" });
  assert.equal(book.summary, "\"Supplier 2026\"");
  assert.equal(describeToolIntent("save_project", {}).summary, "on the current project");
  assert.equal(describeToolIntent("future_tool", {}).title, "Future tool");
  assert.equal(/[{}[\]]|":/.test(draw.summary + sheet.summary), false);
  // A run identity is a UUID; putting it in the prompt would be noise, not a plainer description.
  assert.equal(/[0-9a-f]{8}-[0-9a-f]{4}-/.test(describeToolIntent("remove_takeoff_trace", { runId: "6f9c1e2a-1111-4222-8333-444455556666", expectedRevision: 4 }).summary), false);
});

test("the prompt reads only keys a gated tool declares, and names every gated tool", () => {
  const job = createDefaultJob();
  const state = { job, pane: "sheets" as Pane, sheet: 0, hydrationStatus: "ready", persistenceHydrated: true, persistenceRecoveryBlocked: false,
    persistenceError: null as string | null, lastSavedJobRevision: job.revision as number | null,
    setPane() {}, saveCurrentProject() { return { ok: true, error: null as string | null }; } };
  const port: AppToolPort = {
    getState: () => state,
    architect: async () => ({ pendingDraft: false, project: null }),
    architectAvailable: () => false,
    capture: async () => ({ content: [{ type: "image", mimeType: "image/png", data: "fixture" }] }),
    draftsman: async () => ({ ok: true }),
    draftsmanAvailable: () => true,
  };
  const tools = createAppTools(port);
  const gated = tools.filter(tool => isAssistantGatedTool(tool.name)).map(tool => tool.name);
  const properties = (name: string) => Object.keys((tools.find(tool => tool.name === name)!.inputSchema as { properties?: Record<string, unknown> }).properties ?? {});
  // The set is a named list, not a rule: assert the catalogue actually holds every member, so a
  // rename can never silently shrink what the permission mode governs.
  for (const name of EFFECTFUL) assert.ok(gated.includes(name), `${name} is no longer in the catalogue`);
  const declared = new Set(gated.flatMap(properties));
  for (const key of INTENT_KEYS) assert.ok(declared.has(key), `describeToolIntent reads "${key}" and no gated tool declares it`);
  for (const name of gated) assert.ok(TOOL_TITLES[name], `${name} reaches the prompt with no plain-word title`);
  for (const name of Object.keys(TOOL_TITLES)) assert.ok(isAssistantGatedTool(name), `${name} has a prompt title but never prompts`);
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
  // The gate, not just the verdict: an effectful non-edit prompts in ask mode and is refused in
  // read-only mode without asking (D5/D8).
  gate = gateToolCall("navigate_workspace", { pane: "sketch" });
  await new Promise(r => setTimeout(r, 0));
  assert.equal(store.getState().pending?.title, "Move the workspace");
  store.getState().decide(store.getState().pending!.id, "once");
  assert.equal(await gate, null);
  // read-only blocks without asking; auto allows without asking
  store.getState().setMode("readonly");
  assert.equal(await gateToolCall("save_project", {}), READONLY_MESSAGE);
  assert.equal(await gateToolCall("navigate_workspace", { pane: "sketch" }), READONLY_MESSAGE);
  assert.equal(await gateToolCall("generate_render_visualisation", {}), READONLY_MESSAGE);
  assert.equal(await gateToolCall("read_project_context", {}), null);
  store.getState().setMode("auto");
  assert.equal(await gateToolCall("save_project", {}), null);
  store.getState().resetChatGrants();
  assert.equal(store.getState().grantedForChat.size, 0);
  store.getState().setMode("ask");
});

test("a chat grant is scoped to its project, so a switch does not answer for a chat that never gave it", async () => {
  const store = usePermissions;
  store.setState({ mode: "ask", grantedForChat: new Set(), grantedProjectId: null, pending: null });
  store.getState().scopeChatGrants("project-a");
  // In project A's chat the user allows navigation for the rest of that chat.
  let gate = gateToolCall("navigate_workspace", { pane: "sketch" });
  await new Promise(r => setTimeout(r, 0));
  store.getState().decide(store.getState().pending!.id, "chat");
  assert.equal(await gate, null);
  assert.equal(await gateToolCall("navigate_workspace", { pane: "sketch" }), null);
  // Re-scoping to the project already in scope must not drop it: the assistant hook re-runs this on
  // the same job id, and re-prompting there would silently revoke a decision the user did make.
  store.getState().scopeChatGrants("project-a");
  assert.equal(await gateToolCall("navigate_workspace", { pane: "sketch" }), null);
  // Another project is another chat. The grant Set is one process-global object, so before this the
  // grant was decisive here and the prompt was skipped in a conversation that never gave it.
  store.getState().scopeChatGrants("project-b");
  assert.equal(permissionVerdict("navigate_workspace", "ask", store.getState().grantedForChat), "ask");
  gate = gateToolCall("navigate_workspace", { pane: "sketch" });
  await new Promise(r => setTimeout(r, 0));
  assert.equal(store.getState().pending?.title, "Move the workspace");
  store.getState().decide(store.getState().pending!.id, "deny");
  assert.equal(await gate, DENIED_MESSAGE);
  // Clearing a chat drops its grants but keeps the project scope: the next message is the same chat.
  store.getState().resetChatGrants();
  assert.equal(store.getState().grantedForChat.size, 0);
  assert.equal(store.getState().grantedProjectId, "project-b");
  store.setState({ mode: "ask", grantedForChat: new Set(), grantedProjectId: null, pending: null });
});
