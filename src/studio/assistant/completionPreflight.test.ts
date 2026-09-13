import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCompletionPreflight, requestsCurrentProjectInspection, completionStepForObjective } from './completionPreflight.ts';
import { emptyWorkflow, recordWorkflowResult, type RoutingContext } from './workflowRouting.ts';

test('only fully specified safe read prerequisites are accepted', () => {
  assert.deepEqual(parseCompletionPreflight({ tool: 'read_project_context', args: {} }), { tool: 'read_project_context', args: {} });
  assert.equal(parseCompletionPreflight({ tool: 'read_workflow_route', args: { expectedJobId: 'job-a', workflow: 'inspect' } }).tool, 'read_workflow_route');
  for (const tool of ['navigate_workspace', 'capture_workspace_image', 'generate_render_visualisation', 'export_design_file', 'calibrate_source_sheet', 'review_takeoff_item', 'draw_architect_elements', 'read_arbitrary_extension']) {
    assert.throws(() => parseCompletionPreflight({ tool, args: { expectedJobId: 'job-a' } }));
  }
  assert.throws(() => parseCompletionPreflight({ tool: 'read_workflow_route', args: { expectedJobId: 'job-a' } }));
  assert.throws(() => parseCompletionPreflight({ tool: 'read_workflow_route', args: { expectedJobId: 'job-a', workflow: 'architecture' } }));
  assert.throws(() => parseCompletionPreflight({ tool: 'read_takeoff_evidence', args: { expectedJobId: 'job-a', sheet: -1 } }));
  assert.throws(() => parseCompletionPreflight({ tool: 'read_project_context', args: { allowEdits: true } }));
});

test('inspection selection requires an explicit current-project objective, excluding explanations and review-only text', () => {
  for (const text of ['Read the actual project context now.', 'Inspect this project.', 'Check current project evidence.']) assert.equal(requestsCurrentProjectInspection(text), true, text);
  for (const text of ['Explain how the app works.', 'Review this recording: read current project context.', 'Explain this code that says read project context.', 'Do not read project context.', 'Write a developer review.', 'Discuss the project.']) assert.equal(requestsCurrentProjectInspection(text), false, text);
});

test('explicit read cannot be waived by discussion routing and a successful current receipt is not replayed', () => {
  const context: RoutingContext = { projectId: 'job-a', projectRevision: 2, designRevision: 1, sourceKey: 'source-a', sheet: 0, architectReady: false, pane: 'sheets', renderedSceneSha256: null };
  const objective = 'Read the actual project context now.';
  const selection = completionStepForObjective(emptyWorkflow(), context, objective)!;
  assert.deepEqual(selection.args, { expectedJobId: 'job-a', workflow: 'inspect' });
  assert.equal(parseCompletionPreflight({ tool: selection.tool, args: selection.args }).tool, 'read_workflow_route');
  const discussion = { ...emptyWorkflow(), selected: 'discussion' as const };
  assert.equal(completionStepForObjective(discussion, context, objective)?.tool, 'read_project_context');
  assert.equal(completionStepForObjective(discussion, context, 'Explain the workflow.'), null);
  const read = recordWorkflowResult(discussion, 'read_project_context', {}, { content: [{ type: 'text', text: '{"projectId":"job-a","projectRevision":2}' }] }, context, context);
  assert.equal(completionStepForObjective(read, context, objective), null);
  assert.equal(completionStepForObjective(read, { ...context, projectRevision: 3 }, objective)?.tool, 'read_project_context');
  assert.equal(completionStepForObjective({ ...discussion, failure: 'Permission refused' }, context, objective), null);
});

test('explicit no-tool correction needs no route tool but never erases actual mutation readbacks', () => {
  const context: RoutingContext = { projectId: 'job-a', projectRevision: 2, designRevision: 1, sourceKey: 'source-a', sheet: 0, architectReady: false, pane: 'sheets', renderedSceneSha256: null };
  const objective = 'Correction only: do not call any tools. Explain the supplied receipt and correct the prior answer.';
  assert.equal(completionStepForObjective(emptyWorkflow(), context, objective), null);
  assert.equal(completionStepForObjective({ ...emptyWorkflow(), selected: 'discussion', evidenceChanged: true, mutationCount: 1 }, context, objective)?.tool, 'read_takeoff_evidence');
  assert.equal(completionStepForObjective({ ...emptyWorkflow(), selected: 'discussion', designChanged: true, mutationCount: 1 }, context, objective)?.tool, 'read_project_context');
  assert.equal(completionStepForObjective(emptyWorkflow(), context, 'No tools. Explain it, then inspect this project.')?.tool, 'read_workflow_route');
});
