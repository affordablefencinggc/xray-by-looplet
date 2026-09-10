import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyWorkflow, nextToolStep, recordWorkflowResult, completionStep, type RoutingContext, type WorkflowState } from './workflowRouting.ts';
import { WORKBENCH_STRUCTURE } from './workbenchStructure.ts';
import { architectDrawSchema, architectEditSchema } from './architectBridge.ts';
const c: RoutingContext = { projectId: 'p', projectRevision: 1, designRevision: 1, sourceKey: 'doc/rev1', sheet: 0, architectReady: false, pane: 'sheets', renderedSceneSha256: null };
const ok = (data: unknown) => ({ content: [{ type: 'text', text: JSON.stringify(data) }] });
const selected = (workflow: 'architecture' | 'inspect' | 'discussion' | 'takeoff' | 'render' | 'export' = 'architecture') => ({ ...emptyWorkflow(), selected: workflow });
const contextRead = (s: WorkflowState, ctx = c) => recordWorkflowResult(s, 'read_project_context', {}, ok({ projectId: ctx.projectId, projectRevision: ctx.projectRevision }), ctx, ctx);
const readDesign = (s: WorkflowState, ctx = c) => recordWorkflowResult(s, 'read_architect_design', {}, ok({ project: { id: ctx.projectId, revision: ctx.designRevision }, pendingDraft: false }), ctx, ctx);
const image = (target = 'source-building') => ({ content: [{ type: 'text', text: JSON.stringify({ target, frame: 4 }) }, { type: 'image', data: 'real-tool-image', mimeType: 'image/png' }] });

test('architecture is routed through selection, context, mount and current design before execution', () => {
  assert.equal(nextToolStep(emptyWorkflow(), 'draw_architect_elements', {}, c)?.tool, 'read_workflow_route');
  assert.equal(nextToolStep(selected(), 'draw_architect_elements', {}, c)?.tool, 'read_project_context');
  const s = contextRead(selected());
  assert.equal(nextToolStep(s, 'draw_architect_elements', {}, c)?.tool, 'navigate_workspace');
  const mounted = { ...c, architectReady: true, pane: 'sketch' };
  assert.equal(nextToolStep(s, 'draw_architect_elements', {}, mounted)?.tool, 'read_architect_design');
  assert.equal(nextToolStep(readDesign(s, mounted), 'draw_architect_elements', {}, mounted), null);
});

test('a failed, stale, foreign or pending-draft read cannot satisfy design prerequisites', () => {
  const ctx = { ...c, architectReady: true };
  for (const result of [
    { ...ok({ project: { id: 'p', revision: 1 } }), isError: true },
    ok({ project: { id: 'other', revision: 1 } }), ok({ project: { id: 'p', revision: 2 } }),
    ok({ project: { id: 'p', revision: 1 }, pendingDraft: true }), ok({ project: { id: 'p', revision: 1 }, blocked: true }),
  ]) {
    const s = recordWorkflowResult(contextRead(selected()), 'read_architect_design', {}, result, ctx, ctx);
    assert.equal(nextToolStep(s, 'draw_architect_elements', {}, ctx)?.tool, 'read_architect_design');
  }
});

test('each mutation invalidates old readback, model and capture receipts; only current real pixels complete it', () => {
  const start = { ...c, architectReady: true, pane: 'sketch' }, changed = { ...start, designRevision: 2 };
  let s = recordWorkflowResult(readDesign(contextRead(selected()), start), 'draw_architect_elements', {}, ok({ saved: true }), start, changed);
  assert.equal(nextToolStep(s, 'edit_architect_elements', {}, changed)?.tool, 'read_architect_design');
  assert.equal(completionStep(s, changed)?.tool, 'read_architect_design');
  s = readDesign(s, changed);
  assert.equal(completionStep(s, changed)?.tool, 'show_design_in_model');
  const model = { ...changed, pane: 'model', renderedSceneSha256: 'scene-2' };
  s = recordWorkflowResult(s, 'show_design_in_model', {}, ok({ mounted: true, designRevision: 2, sceneSha256: 'scene-2' }), changed, model);
  assert.equal(completionStep(s, model)?.tool, 'capture_workspace_image');
  const noPixels = recordWorkflowResult(s, 'capture_workspace_image', { target: 'source-building' }, ok({ target: 'source-building', frame: 4 }), model, model);
  assert.equal(completionStep(noPixels, model)?.tool, 'capture_workspace_image');
  s = recordWorkflowResult(s, 'capture_workspace_image', { target: 'source-building' }, image(), model, model);
  assert.equal(completionStep(s, model), null);
  assert.equal(completionStep(s, { ...model, renderedSceneSha256: 'catalog' })?.tool, 'show_design_in_model');
  assert.equal(completionStep(s, { ...model, designRevision: 3 })?.tool, 'read_architect_design');
});

test('route switches cannot discard outstanding authored verification', () => {
  const s = { ...contextRead(selected()), designChanged: true, mutationCount: 1 };
  const switched = recordWorkflowResult(s, 'read_workflow_route', { expectedJobId: 'p', workflow: 'discussion' }, ok({}), c, c);
  assert.equal(completionStep(switched, c)?.tool, 'navigate_workspace');
});

test('context/source revision changes invalidate source and target-sheet takeoff prerequisites', () => {
  let s = contextRead(selected('takeoff'));
  assert.equal(nextToolStep(s, 'trace_takeoff_run', { sheet: 2 }, c)?.tool, 'read_source_sheets');
  s = recordWorkflowResult(s, 'read_source_sheets', {}, ok({}), c, c);
  assert.deepEqual(nextToolStep(s, 'trace_takeoff_run', { sheet: 2 }, c)?.args, { expectedJobId: 'p', sheet: 2 });
  s = recordWorkflowResult(s, 'read_takeoff_evidence', { sheet: 1 }, ok({}), c, c);
  assert.equal(nextToolStep(s, 'trace_takeoff_run', { sheet: 2 }, c)?.tool, 'read_takeoff_evidence');
  s = recordWorkflowResult(s, 'read_takeoff_evidence', { sheet: 2 }, ok({}), c, c);
  assert.equal(nextToolStep(s, 'trace_takeoff_run', { sheet: 2 }, c), null);
  assert.equal(nextToolStep(s, 'trace_takeoff_run', { sheet: 2 }, { ...c, sourceKey: 'doc/rev2' })?.tool, 'read_project_context');
  assert.equal(nextToolStep(s, 'trace_takeoff_run', { sheet: 2 }, { ...c, sheet: 2 })?.tool, 'read_project_context');
  s = recordWorkflowResult(s, 'trace_takeoff_run', { sheet: 2 }, ok({}), c, c);
  assert.equal(completionStep(s, c)?.tool, 'read_takeoff_evidence');
});

test('rendering requires pixels of the requested view and does not certify geometry', () => {
  let s = contextRead(selected('render'));
  assert.equal(nextToolStep(s, 'generate_render_visualisation', { view: 'architect' }, c)?.tool, 'capture_workspace_image');
  s = recordWorkflowResult(s, 'capture_workspace_image', { target: 'architect' }, image('architect'), c, c);
  assert.equal(nextToolStep(s, 'generate_render_visualisation', { view: 'architect' }, c), null);
  assert.equal(nextToolStep(s, 'generate_render_visualisation', { view: 'source-building' }, c)?.tool, 'capture_workspace_image');
  s = recordWorkflowResult(s, 'control_draftsman', {}, ok({}), c, c);
  assert.equal(nextToolStep(s, 'generate_render_visualisation', { view: 'architect' }, c)?.tool, 'capture_workspace_image');
});

test('export requires current design or source register, and a real delivery receipt', () => {
  const ctx = { ...c, architectReady: true };
  let s = contextRead(selected('export'));
  assert.equal(nextToolStep(s, 'export_design_file', { format: 'ifc' }, ctx)?.tool, 'read_architect_design');
  assert.equal(nextToolStep(s, 'export_design_file', { format: 'sheet-register' }, ctx)?.tool, 'read_source_sheets');
  assert.equal(completionStep(s, ctx)?.tool, 'export_design_file');
  s = recordWorkflowResult(s, 'export_design_file', {}, ok({ downloaded: false }), ctx, ctx);
  assert.equal(s.exported, false); assert.match(s.failure!, /did not confirm/);
});

test('actual errors stop completion nudges; a successful retry of that tool clears its failure', () => {
  let s = recordWorkflowResult(selected(), 'read_architect_design', {}, { ...ok({}), isError: true }, c, c);
  assert.equal(completionStep(s, c), null);
  s = contextRead(s);
  assert.ok(s.failure, 'unrelated inspection cannot clear the failed action');
  s = readDesign(s);
  assert.equal(s.failure, null);
});

test('discussion does not force geometry actions, while an architectural task cannot claim an edit without one', () => {
  assert.equal(completionStep(selected('discussion'), c), null);
  assert.equal(completionStep(contextRead(selected()), c)?.tool, 'read_architect_design');
});

test('capability reference derives the batch limit from the live draw schema', () => {
  const params = { expectedJobId: 'p', expectedRevision: 1 };
  const draw = { kind: 'line', levelId: 'l', a: [0, 0], b: [1, 0] }, edit = { kind: 'remove', id: 'wall' };
  for (const [schema, operation] of [[architectDrawSchema, draw], [architectEditSchema, edit]] as const) {
    assert.equal(schema.safeParse({ ...params, operations: Array(200).fill(operation) }).success, true);
    assert.equal(schema.safeParse({ ...params, operations: Array(201).fill(operation) }).success, false);
  }
  assert.match(WORKBENCH_STRUCTURE.architecturalDesign.wireframeOperations.limits, /≤200 operations/);
  assert.ok(WORKBENCH_STRUCTURE.workflowRouting.workflows.architecture.length > 3);
});

/**
 * Observed live 2026-09-10: a user attached an elevation drawing, asked about it, and the assistant
 * was refused with "Workflow prerequisite missing" for trying to read the file they had just handed
 * it. Gating a read that changes nothing only costs a round trip and shows a refusal the user cannot
 * act on.
 */
test('reading the user\'s own attachment needs no workflow selected first', () => {
  assert.equal(nextToolStep(emptyWorkflow(), 'read_assistant_file', {}, c), null,
    'the file the user just attached must be readable immediately');
});

test('inspection reads pass through, while every edit stays gated', () => {
  for (const tool of ['read_assistant_file', 'read_price_books', 'read_draftsman_status', 'read_source_building']) {
    assert.equal(nextToolStep(emptyWorkflow(), tool, {}, c), null, `${tool} changes nothing and must not be gated`);
  }
  // The safety property this router exists for is unchanged: a mutation still routes first.
  for (const tool of ['draw_architect_elements', 'edit_architect_elements', 'undo_architect_change', 'calibrate_source_sheet', 'trace_takeoff_run', 'remove_takeoff_trace']) {
    assert.equal(nextToolStep(emptyWorkflow(), tool, {}, c)?.tool, 'read_workflow_route', `${tool} must still be routed before it runs`);
  }
});

test('an ungated read does not let a later edit skip its own prerequisites', () => {
  // Reading an attachment must not be mistaken for having read the design.
  const afterFile = recordWorkflowResult(selected(), 'read_assistant_file', {}, ok({ fileId: 'f1', page: 1 }), c, c);
  assert.equal(nextToolStep(afterFile, 'draw_architect_elements', {}, c)?.tool, 'read_project_context',
    'a drawing edit must still establish project and design state for itself');
});
