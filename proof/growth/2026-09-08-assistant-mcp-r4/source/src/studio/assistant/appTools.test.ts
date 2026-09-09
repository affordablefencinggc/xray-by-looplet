import { test } from "node:test";
import assert from "node:assert/strict";
import { createDefaultJob } from "../domain.ts";
import type { Pane } from "../store.ts";
import { emptyProject, demonstration, revise } from "../architect/model.ts";
import { changeAuthoredSheets } from "../architect/authoredSheetSet.ts";
import { createAppTools, captureCanvasImage, type AppToolPort } from "./appTools.ts";
import { prepareArchitectElements, registerArchitectController, requestArchitectTool, hasArchitectController } from "./architectBridge.ts";

function fixture() {
  const job = createDefaultJob();
  let writes = 0;
  const state = { job, pane: "sheets" as Pane, sheet: 0, hydrationStatus: "ready", persistenceHydrated: true, persistenceRecoveryBlocked: false, persistenceError: null as string | null, lastSavedJobRevision: job.revision as number | null,
    setPane(pane: Pane) { state.pane = pane; }, saveCurrentProject() { writes++; state.lastSavedJobRevision = job.revision; return { ok: true, error: null as string | null }; } };
  const calls: Array<{ action: string; args: unknown }> = [];
  const port: AppToolPort = {
    getState: () => state,
    architect: async (action, args) => { calls.push({ action, args }); return { pendingDraft: false, project: emptyProject(job.id) }; },
    architectAvailable: () => false,
    capture: async () => ({ content: [{ type: "image", mimeType: "image/png", data: "fixture" }] }),
    draftsman: async (action, args) => { calls.push({ action: "draftsman:" + action, args }); return { action, ok: true }; },
    draftsmanAvailable: () => true,
  };
  const tools = createAppTools(port);
  return { state, port, calls, tools, get writes() { return writes; }, execute: (name: string, args: unknown) => tools.find(tool => tool.name === name)!.execute(args) };
}
const message = (result: Awaited<ReturnType<ReturnType<typeof fixture>["execute"]>>) => result.content.filter(row => row.type === "text").map(row => row.text).join("\n");

test("nine SDK-free tools expose strict schemas; project context reports real recovery and save state", async () => {
  const f = fixture();
  assert.deepEqual(f.tools.map(tool => tool.name), [
    "read_project_context", "navigate_workspace", "read_architect_design",
    "draw_architect_elements", "undo_architect_change", "capture_workspace_image",
    "save_project", "control_draftsman", "read_draftsman_status"
  ]);
  for (const tool of f.tools) { assert.equal(tool.inputSchema.type, "object"); assert.equal(tool.inputSchema.additionalProperties, false); }
  f.state.hydrationStatus = "error"; f.state.persistenceRecoveryBlocked = true;
  const result = await f.execute("read_project_context", {}), value = JSON.parse(message(result));
  assert.equal(value.projectId, f.state.job.id); assert.equal(value.hydration, "error"); assert.equal(value.recoveryBlocked, true);
  assert.equal(f.writes, 0);
  assert.equal((await f.execute("read_project_context", { extra: true })).isError, true);
});


test("navigation selects only known panes and refuses changed or recovering projects", async () => {
  const f = fixture(), args = { expectedJobId: f.state.job.id, pane: "sketch" };
  assert.equal((await f.execute("navigate_workspace", args)).isError, undefined); assert.equal(f.state.pane, "sketch");
  assert.equal((await f.execute("navigate_workspace", { ...args, pane: "delete-all" })).isError, true);
  assert.equal((await f.execute("navigate_workspace", { ...args, expectedJobId: "other" })).isError, true);
  f.state.persistenceRecoveryBlocked = true;
  assert.equal((await f.execute("navigate_workspace", { ...args, pane: "model" })).isError, true);
  assert.equal(f.state.pane, "sketch"); assert.equal(f.writes, 0);
});

test("pending architectural gesture prevents navigation away", async () => {
  const f = fixture(); f.state.pane = "sketch"; f.port.architectAvailable = () => true;
  f.port.architect = async () => ({ pendingDraft: true });
  const result = await f.execute("navigate_workspace", { expectedJobId: f.state.job.id, pane: "model" });
  assert.equal(result.isError, true); assert.match(message(result), /Finish or cancel/); assert.equal(f.state.pane, "sketch");
});

test("pending source trace or calibration is preserved instead of navigating", async () => {
  const f = fixture();
  for (const pending of [{ pending: [{ x: 1, y: 2 }] }, { calibrationCapture: { points: [{ x: 1, y: 2 }] } }]) {
    f.port.getState = () => ({ ...f.state, ...pending });
    const result = await f.execute("navigate_workspace", { expectedJobId: f.state.job.id, pane: "sketch" });
    assert.equal(result.isError, true); assert.equal(f.state.pane, "sheets");
  }
});

test("save tool checks main revision and reports only confirmed readback success", async () => {
  const f = fixture(), args = { expectedJobId: f.state.job.id, expectedRevision: f.state.job.revision };
  assert.equal((await f.execute("save_project", { ...args, expectedRevision: args.expectedRevision + 1 })).isError, true); assert.equal(f.writes, 0);
  assert.equal((await f.execute("save_project", args)).isError, undefined); assert.equal(f.writes, 1);
  f.state.saveCurrentProject = () => ({ ok: false, error: "Quota refused" });
  assert.match(message(await f.execute("save_project", args)), /Quota refused/);
  f.state.lastSavedJobRevision = null;
  f.state.saveCurrentProject = () => ({ ok: true, error: null });
  assert.equal((await f.execute("save_project", args)).isError, true);
});

test("project switch during pending navigation inspection prevents any pane mutation", async () => {
  const f = fixture(), previousId = f.state.job.id; f.state.pane = "sketch";
  f.port.architectAvailable = () => true;
  f.port.architect = async () => { f.state.job = createDefaultJob(); return { pendingDraft: false }; };
  const result = await f.execute("navigate_workspace", { expectedJobId: previousId, pane: "model" });
  assert.equal(result.isError, true); assert.equal(f.state.pane, "sketch");
});

test("drawing and undo validation block malformed arguments before reaching the UI controller", async () => {
  const f = fixture(), args = { expectedJobId: f.state.job.id, expectedRevision: 1 };
  assert.equal((await f.execute("draw_architect_elements", { ...args, operations: [{ kind: "delete", id: "a" }] })).isError, true);
  assert.equal((await f.execute("undo_architect_change", { ...args, expectedRevision: 0 })).isError, true);
  assert.equal((await f.execute("read_architect_design", { expectedJobId: "wrong" })).isError, true);
  assert.equal(f.calls.length, 0);
  f.port.architect = async () => { throw Error("Saved design changed in another window"); };
  const result = await f.execute("undo_architect_change", args);
  assert.equal(result.isError, true); assert.match(message(result), /another window/);
});

test("capture does not return an image if the project changes while waiting for a rendered frame", async () => {
  const f = fixture(), previousId = f.state.job.id;
  f.port.capture = async () => { f.state.job = createDefaultJob(); return { content: [{ type: "image", mimeType: "image/png", data: "must-not-return" }] }; };
  const result = await f.execute("capture_workspace_image", { expectedJobId: previousId, target: "architect" });
  assert.equal(result.isError, true); assert.ok(result.content.every(part => part.type === "text"));
});

test("append batch creates real hosted geometry and retains existing authored sheet layouts", () => {
  const p = changeAuthoredSheets(emptyProject("tools"), { type: "add" }), before = structuredClone(p), levelId = p.levels[0].id;
  const result = prepareArchitectElements(p, { expectedJobId: p.id, expectedRevision: p.revision, operations: [
    { kind: "wall", ref: "north", levelId, a: [0, 0], b: [8000, 0], heightMm: 3000, name: "North wall" },
    { kind: "door", ref: "entry", wallRef: "north", offsetMm: 1500, widthMm: 900, heightMm: 2100, tag: "D-01", hinge: "left", swing: "in" },
    { kind: "window", wallRef: "north", offsetMm: 4500, widthMm: 1800, heightMm: 1200, sillMm: 900, tag: "W-01", hinge: "right", swing: "out" },
    { kind: "line", levelId, a: [0, 3000], b: [8000, 3000] },
    { kind: "room", levelId, point: [4000, 1500], name: "Workroom" },
  ] });
  assert.equal(result.draft.walls.length, 1); assert.equal(result.draft.openings.length, 2);
  assert.equal(result.draft.openings[0].wallId, result.draft.walls[0].id);
  assert.equal(result.created.find(row => row.ref === "entry")!.id, result.draft.openings[0].id);
  assert.equal(result.draft.lines.length, 1); assert.equal(result.draft.roomTags.length, 1);
  assert.equal(result.notices.length, 1); assert.ok(result.draft.walls[0].layers.every(layer => layer.rateM2 === null));
  assert.deepEqual(result.draft.sheetSet, p.sheetSet); assert.deepEqual(p, before);
  assert.equal(revise(p, result.draft).revision, p.revision + 1);
});

test("invalid hosted opening rejects the whole append batch without modifying the project", () => {
  const p = emptyProject("tools"), before = JSON.stringify(p);
  const args = { expectedJobId: p.id, expectedRevision: p.revision, operations: [
    { kind: "wall", ref: "short", levelId: p.levels[0].id, a: [0, 0], b: [1000, 0] },
    { kind: "door", wallRef: "short", offsetMm: 500, widthMm: 2000, heightMm: 2100, tag: "D-01", hinge: "left", swing: "in" },
  ] };
  assert.throws(() => prepareArchitectElements(p, args), /fit within/);
  assert.equal(JSON.stringify(p), before);
  assert.throws(() => prepareArchitectElements(p, { ...args, expectedRevision: 99 }), /revision changed/);
  assert.throws(() => prepareArchitectElements(p, { ...args, expectedJobId: "other" }), /project changed/);
  assert.throws(() => prepareArchitectElements(p, { ...args, operations: [args.operations[0], args.operations[0]] }), /references must be unique/);
});

test("wall template copies reviewed layer properties with independent layer identities", () => {
  const p = demonstration("tools"), wall = p.walls[0];
  wall.layers[0].rateM2 = 42; wall.layers[0].supplierReference = "Reviewed fixture"; wall.layers[0].rateRevision = "2026-09";
  const result = prepareArchitectElements(p, { expectedJobId: p.id, expectedRevision: p.revision, operations: [{ kind: "wall", levelId: p.levels[0].id, a: [12000, 0], b: [16000, 0], templateWallId: wall.id }] });
  const added = result.draft.walls.at(-1)!;
  assert.equal(added.layers[0].rateM2, 42); assert.equal(added.layers[0].supplierReference, "Reviewed fixture");
  assert.notEqual(added.layers[0].id, wall.layers[0].id); assert.deepEqual(result.notices, []);
});

test("active controller registration is lifecycle-safe and unmounted tools fail honestly", async () => {
  const old = registerArchitectController({ read: () => "old", draw: () => "old", undo: () => "old" });
  const newer = registerArchitectController({ read: () => "current", draw: () => { throw Error("Pending drawing"); }, undo: () => { throw Error("No history"); } });
  old(); assert.equal(hasArchitectController(), true);
  assert.equal(await requestArchitectTool("read", { expectedJobId: "tools" }), "current");
  await assert.rejects(requestArchitectTool("undo", { expectedJobId: "tools", expectedRevision: 1 }), /No history/);
  newer(); assert.equal(hasArchitectController(), false);
  await assert.rejects(requestArchitectTool("read", { expectedJobId: "tools" }), /Open Sketch/);
});

test("canvas capture exports real source draw pixels and refuses absent or transparent renders", async () => {
  let copied = false, alpha = 255;
  const source = { width: 2000, height: 1000, dataset: { frameCount: "12" }, getBoundingClientRect: () => ({ width: 500, height: 250 }) };
  const output = { width: 0, height: 0, getContext: () => ({ drawImage: (image: unknown) => { assert.equal(image, source); copied = true; }, getImageData: () => ({ data: new Uint8ClampedArray([10, 20, 30, alpha]) }) }), toDataURL: () => "data:image/png;base64,iVBORw0KGgo=" };
  const doc = { querySelector: () => source, createElement: () => output } as unknown as Document;
  const result = await captureCanvasImage("architect", doc);
  assert.equal(copied, true); assert.equal(output.width, 1536); assert.equal(output.height, 768);
  assert.equal(result.content[1].type, "image");
  alpha = 0; await assert.rejects(captureCanvasImage("architect", doc), /no visible pixels/);
  source.dataset.frameCount = "0"; await assert.rejects(captureCanvasImage("architect", doc), /render before capturing/);
  const absent = { querySelector: () => null } as unknown as Document;
  await assert.rejects(captureCanvasImage("source-building", absent), /not visible/);
});


test("draftsman controls require current ready project and mounted Model without navigation", async () => {
  const f=fixture(), args={expectedJobId:f.state.job.id,action:"play"};
  assert.equal((await f.execute("control_draftsman",args)).isError,true);
  assert.equal(f.state.pane,"sheets");assert.equal(f.calls.length,0);
  f.state.pane="model";
  assert.equal((await f.execute("control_draftsman",args)).isError,undefined);
  assert.equal(f.calls.at(-1)?.action,"draftsman:play");
  for(const input of [{...args,expectedJobId:"changed"},{...args,action:"seek"},{...args,action:"blueprint"},{...args,action:"section_cut"},{...args,action:"dimensions"},{...args,action:"plan_book"},{...args,action:"cancel"},{...args,action:"unknown"},{...args,action:"jump_storey",storey:-1}]) assert.equal((await f.execute("control_draftsman",input)).isError,true);
  assert.equal(f.calls.length,1);
  f.state.persistenceRecoveryBlocked=true;
  assert.equal((await f.execute("control_draftsman",args)).isError,true);assert.equal(f.calls.length,1);
  f.state.persistenceRecoveryBlocked=false;f.port.draftsmanAvailable=()=>false;
  assert.equal((await f.execute("control_draftsman",args)).isError,true);assert.equal(f.calls.length,1);
});
test("draftsman status validates inputs and exit is explicit animation cancellation",async()=>{
  const f=fixture();f.state.pane="model";
  assert.equal((await f.execute("read_draftsman_status",{expectedJobId:f.state.job.id})).isError,undefined);
  assert.equal(f.calls.at(-1)?.action,"draftsman:status");
  assert.equal((await f.execute("read_draftsman_status",{expectedJobId:f.state.job.id,extra:true})).isError,true);
  assert.equal((await f.execute("read_draftsman_status",{})).isError,true);
  assert.equal((await f.execute("control_draftsman",{expectedJobId:f.state.job.id,action:"exit"})).isError,undefined);
  assert.equal(f.calls.at(-1)?.action,"draftsman:exit");
});
test("draftsman async result is not credited to a switched project",async()=>{
  const f=fixture();f.state.pane="model";const id=f.state.job.id;
  f.port.draftsman=async()=>{f.state.job={...f.state.job,id:"changed"};return {active:true};};
  assert.equal((await f.execute("control_draftsman",{expectedJobId:id,action:"play"})).isError,true);
});
