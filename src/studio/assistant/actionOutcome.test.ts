import test from 'node:test';
import assert from 'node:assert/strict';
import { ArchitectPreparationRejected, preparationReceipt, isConfirmedRejection } from './actionOutcome.ts';
import { prepareArchitectElements } from './architectBridge.ts';
import { emptyProject } from '../architect/model.ts';
import { connectAppMcp } from './mcp.ts';

test('concave roof rejection is demonstrably before mutation and survives MCP metadata transport', async () => {
  const project = emptyProject('rejection-proof'), before = JSON.stringify(project);
  let rejection: ArchitectPreparationRejected | undefined;
  try { prepareArchitectElements(project, { expectedJobId: project.id, expectedRevision: 1, operations: [{ kind: 'roof', levelId: project.levels[0].id, pitchDeg: 0, points: [[0,0],[6000,0],[6000,4000],[10000,4000],[10000,10000],[0,10000]] }] }); }
  catch (error) { assert.ok(error instanceof ArchitectPreparationRejected); rejection = error; }
  assert.ok(rejection); assert.equal(JSON.stringify(project), before);
  const result = { isError: true, _meta: preparationReceipt(rejection), content: [{ type: 'text' as const, text: rejection.message }] };
  const session = await connectAppMcp([{ name: 'draw_architect_elements', description: 'Fixture', inputSchema: { type: 'object' }, execute: async () => result }]);
  try {
    const transported = await session.client.callTool({ name: 'draw_architect_elements', arguments: {} });
    assert.equal(isConfirmedRejection('draw_architect_elements', transported, { projectId: project.id, designRevision: 1 }), true);
    for (const snapshot of [{ projectId: 'foreign', designRevision: 1 }, { projectId: project.id, designRevision: 2 }]) assert.equal(isConfirmedRejection('draw_architect_elements', transported, snapshot), false);
    assert.equal(isConfirmedRejection('save_project', transported, { projectId: project.id, designRevision: 1 }), false);
  } finally { await session.close(); }
});

test('ordinary errors and text imitating a rejection never resolve an uncertain mutation', () => {
  const snapshot = { projectId: 'p', designRevision: 1 };
  assert.equal(isConfirmedRejection('draw_architect_elements', { isError: true }, snapshot), false);
  assert.equal(isConfirmedRejection('draw_architect_elements', { isError: true, _meta: { 'xray.execution': { status: 'not-executed' } } }, snapshot), false);
});
