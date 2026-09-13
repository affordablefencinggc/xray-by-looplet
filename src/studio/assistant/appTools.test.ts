import { test } from "node:test";
import assert from "node:assert/strict";
import { createDefaultJob } from "../domain.ts";
import type { Pane } from "../store.ts";
import { emptyProject, demonstration, revise } from "../architect/model.ts";
import { changeAuthoredSheets } from "../architect/authoredSheetSet.ts";
import { createAppTools, captureCanvasImage, readCatalogSourceBuilding, type AppToolPort } from "./appTools.ts";
import { prepareArchitectElements, registerArchitectController, requestArchitectTool, hasArchitectController } from "./architectBridge.ts";
import { buildDesignedScene } from "../architect/designedScene.ts";
import type { SourceBuilding } from "../sourceBuilding.ts";

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

test('draft industry tools bind to the current project and preserve draft arithmetic without saving', async () => {
  const f = fixture();
  const before = structuredClone(f.state.job);
  const input = { planes: [{ id: 'qa-plane', grossPlanAreaM2: 80, measurementReference: 'User supplied synthetic 80m2',
    pitchDegrees: Math.atan(3 / 4) * 180 / Math.PI, pitchReference: 'User supplied 3:4 rise/run',
    openings: [{ id: 'qa-opening', planAreaM2: 4, measurementReference: 'User supplied synthetic 4m2' }] }] };
  const roof = JSON.parse(message(await f.execute('calculate_draft_roof_area', { expectedJobId: f.state.job.id, input })));
  assert.ok(Math.abs(roof.totals.netTrueAreaM2 - 95) < 1e-9);
  assert.equal(roof.projectId, f.state.job.id);
  assert.equal(roof.verifiedQuoteEligible, false);
  assert.equal(roof.status, 'draft-calculation');
  const operand = (value: number) => ({ value, sourceReference: 'Explicit synthetic user input' });
  const duct = JSON.parse(message(await f.execute('calculate_draft_duct_material', { expectedJobId: f.state.job.id,
    input: { sections: [{ id: 'qa-duct', shape: 'rectangular', lengthM: operand(10), widthM: operand(.5), heightM: operand(.3) }] } })));
  assert.equal(duct.developedAreaM2, 16);
  assert.equal(duct.sheetMassKg, null);
  assert.equal(duct.verifiedQuoteEligible, false);
  const classified = JSON.parse(message(await f.execute('classify_draft_quantities', { expectedJobId: f.state.job.id, input: {
    hierarchyId: 'qa', hierarchyRevision: '1', nodes: [{ id: 'roof', label: 'Roof', parentId: null }],
    items: [{ id: 'a', quantity: '0.1', unit: 'm2', evidence: 'sample', source: null }, { id: 'b', quantity: '0.2', unit: 'm2', evidence: 'sample', source: null }],
    assignments: [{ itemId: 'a', nodeId: 'roof' }],
  } })));
  assert.equal(classified.totals[0].quantity, '0.3');
  assert.deepEqual(classified.unclassifiedItemIds, ['b']);
  assert.equal(classified.verifiedQuoteEligible, false);
  assert.deepEqual(f.state.job, before);
  assert.equal(f.writes, 0);
  assert.equal((await f.execute('calculate_draft_roof_area', { expectedJobId: 'another-project', input })).isError, true);
  f.state.persistenceRecoveryBlocked = true;
  assert.equal((await f.execute('calculate_draft_roof_area', { expectedJobId: f.state.job.id, input })).isError, true);
});

test("SDK-free tools expose strict schemas; project context reports real recovery and save state", async () => {
  const f = fixture();
  assert.deepEqual(f.tools.map(tool => tool.name), [
    "search_standards_library",
    "read_workflow_route",
    "read_assistant_file", "read_source_geometry", "prepare_source_room", "read_project_context", "navigate_workspace", "read_work_packet", "read_work_packet_event", "read_architect_design",
    "draw_architect_elements", "undo_architect_change", "capture_workspace_image",
    "save_project", "control_draftsman", "read_draftsman_status",
    "read_workbench_structure", "read_source_building",
    "read_source_sheets", "manage_source_sheet", "read_takeoff_evidence", "read_price_books", "capture_project_backup",
    "edit_architect_elements", "calibrate_source_sheet", "trace_takeoff_run", "review_takeoff_item", "remove_takeoff_trace", "import_price_book", "export_design_file", "generate_render_visualisation",
    "show_design_in_model", "hide_designed_model",
    'calculate_draft_roof_area', 'calculate_draft_duct_material', 'classify_draft_quantities',
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

test("Model mode mounts the design as an inferred designed scene, selects Model and can be hidden again", async () => {
  const f = fixture(), design = demonstration(f.state.job.id);
  let mounted: SourceBuilding | null | undefined;
  f.port.architectAvailable = () => true;
  f.port.architect = async (action, args) => { f.calls.push({ action, args }); return { ready: true, pendingDraft: false, project: structuredClone(design) }; };
  f.port.mountDesignedModel = scene => { mounted = scene; };
  const result = await f.execute("show_design_in_model", { expectedJobId: f.state.job.id, expectedRevision: design.revision });
  assert.equal(result.isError, undefined, message(result));
  const receipt = JSON.parse(message(result));
  assert.equal(receipt.mounted, true); assert.equal(receipt.origin, "designed"); assert.equal(receipt.evidence, "inferred"); assert.equal(receipt.building, "designed");
  assert.equal(receipt.designRevision, design.revision); assert.equal(receipt.walls, 5); assert.equal(receipt.openings, 3); assert.equal(receipt.storeys, 1);
  assert.equal(f.state.pane, "model");
  assert.ok(mounted);
  assert.equal(mounted.objects.length, receipt.objects);
  assert.equal(mounted.source.sha256, receipt.sceneSha256);
  assert.ok(mounted.objects.every(part => part.evidenceState === "inferred" && part.sourceRefs.every(ref => ref.evidenceState === "inferred")));
  assert.deepEqual(f.calls.map(call => call.action), ["read"]);
  const summary = await readCatalogSourceBuilding({ expectedJobId: f.state.job.id, building: "designed", category: "wall" }, () => mounted ?? null) as { origin: string; sample: boolean; title: string; matched: number; evidence: { inferred: number; traced: number } };
  assert.equal(summary.origin, "designed"); assert.equal(summary.sample, false); assert.equal(summary.title, "Designed model");
  assert.equal(summary.matched, summary.evidence.inferred); assert.equal(summary.evidence.traced, 0);
  const hidden = await f.execute("hide_designed_model", { expectedJobId: f.state.job.id });
  assert.equal(hidden.isError, undefined, message(hidden)); assert.equal(mounted, null); assert.equal(JSON.parse(message(hidden)).mounted, false);
  await assert.rejects(readCatalogSourceBuilding({ expectedJobId: f.state.job.id, building: "designed" }, () => null), /show_design_in_model/);
  assert.equal(f.state.pane, "model"); assert.equal(f.writes, 0);
});

for (const displayMode of ['wireframe', 'solid'] as const) {
  test(`Model display ${displayMode} is reported only after the viewer confirms it`, async () => {
    const f = fixture(), design = demonstration(f.state.job.id);
    let mounts = 0;
    f.port.architectAvailable = () => true;
    f.port.architect = async () => ({ ready: true, project: design });
    f.port.mountDesignedModel = () => { mounts++; };
    const args = { expectedJobId: design.id, expectedRevision: design.revision, displayMode };
    assert.equal((await f.execute('show_design_in_model', args)).isError, true);
    assert.equal(mounts, 0);
    f.port.setModelDisplay = async (projectId, revision, mode) => {
      assert.equal(projectId, design.id); assert.equal(revision, design.revision); assert.equal(mode, displayMode);
      assert.equal(f.state.pane, 'model');
    };
    const receipt = await f.execute('show_design_in_model', args);
    assert.equal(receipt.isError, undefined, message(receipt));
    assert.equal(JSON.parse(message(receipt)).displayMode, displayMode);
    f.port.setModelDisplay = async () => { throw Error('Viewer confirmation failed'); };
    assert.equal((await f.execute('show_design_in_model', args)).isError, true);
    f.port.setModelDisplay = async () => { f.state.job = { ...f.state.job, id: 'other-project' }; };
    assert.equal((await f.execute('show_design_in_model', args)).isError, true);
  });
}

test("Model mode refuses stale revisions, pending work, empty designs, changed projects and sessions without a viewer", async () => {
  const f = fixture(), design = demonstration(f.state.job.id), args = { expectedJobId: f.state.job.id, expectedRevision: design.revision };
  let mounted = 0;
  f.port.architectAvailable = () => true;
  f.port.architect = async () => ({ ready: true, pendingDraft: false, project: structuredClone(design) });
  assert.match(message(await f.execute("show_design_in_model", args)), /unavailable/);
  f.port.mountDesignedModel = () => { mounted++; };
  assert.match(message(await f.execute("show_design_in_model", { ...args, expectedRevision: design.revision + 1 })), /revision changed/);
  assert.equal((await f.execute("show_design_in_model", { ...args, extra: true })).isError, true);
  const getState = f.port.getState;
  f.port.getState = () => ({ ...f.state, pending: [{ x: 1, y: 2 }] });
  assert.match(message(await f.execute("show_design_in_model", args)), /pending trace/);
  f.port.getState = getState;
  f.port.architect = async () => ({ ready: true, pendingDraft: true, project: structuredClone(design) });
  assert.match(message(await f.execute("show_design_in_model", args)), /pending draft/);
  f.port.architect = async () => ({ ready: false, blocked: true, error: "Design recovery is still running", project: structuredClone(design) });
  assert.match(message(await f.execute("show_design_in_model", args)), /recovery is still running/);
  f.port.architect = async () => ({ ready: true, pendingDraft: false, project: emptyProject(f.state.job.id) });
  assert.match(message(await f.execute("show_design_in_model", { expectedJobId: f.state.job.id })), /no walls, slabs or roofs/);
  const previousId = f.state.job.id;
  f.port.architect = async () => { f.state.job = createDefaultJob(); return { ready: true, pendingDraft: false, project: structuredClone(design) }; };
  assert.equal((await f.execute("show_design_in_model", { expectedJobId: previousId, expectedRevision: design.revision })).isError, true);
  assert.equal(mounted, 0); assert.equal(f.state.pane, "sheets");
  assert.equal((await f.execute("hide_designed_model", { expectedJobId: previousId })).isError, true);
  f.state.persistenceRecoveryBlocked = true;
  assert.equal((await f.execute("hide_designed_model", { expectedJobId: f.state.job.id })).isError, true);
  assert.equal(f.writes, 0);
});

test("Model mode opens the Architectural workspace through the existing UI when its controller is not mounted", async () => {
  const f = fixture(), design = demonstration(f.state.job.id), panes: Pane[] = [];
  let opened: string | null = null, available = false, mounted: SourceBuilding | null = null;
  const setPane = f.state.setPane; f.state.setPane = pane => { panes.push(pane); setPane(pane); };
  f.port.architectAvailable = () => available;
  f.port.openArchitectWorkspace = async id => { opened = id; available = true; };
  f.port.architect = async () => { if (!available) throw Error("Open Sketch first"); return { ready: true, pendingDraft: false, project: structuredClone(design) }; };
  f.port.mountDesignedModel = scene => { mounted = scene; };
  const result = await f.execute("show_design_in_model", { expectedJobId: f.state.job.id });
  assert.equal(result.isError, undefined, message(result));
  assert.equal(opened, f.state.job.id); assert.deepEqual(panes, ["sketch", "model"]); assert.equal(f.state.pane, "model"); assert.ok(mounted);
  const g = fixture(); g.port.architectAvailable = () => false; g.port.mountDesignedModel = () => {};
  assert.match(message(await g.execute("show_design_in_model", { expectedJobId: g.state.job.id })), /Architectural workspace/);
  assert.equal(g.state.pane, "sheets");
});

test("designed scenes built for Model mode are the same pure geometry the scene builder produces", () => {
  const design = demonstration("job"), scene = buildDesignedScene(design);
  assert.equal(scene.summary.status, "designed"); assert.equal(scene.sourceSheets[0].role, "designed");
});
