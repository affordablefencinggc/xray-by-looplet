import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_EXECUTION_BUDGET as defaults, executionBudgetSchema, readExecutionBudget } from './executionBudget.ts';
import { runConversation } from './conversation.ts';
import { assistantRequestSchema, type AssistantContent } from './contract.ts';
import { emptyProject } from '../architect/model.ts';
import { prepareArchitectElements, architectDrawSchema } from './architectBridge.ts';

test('settings persist, reject invalid budgets and recover unavailable storage', () => {
  const custom = { ...defaults, maxRounds: 128, maxToolCalls: 1024, maxOutputTokens: 65536, timeoutMs: 600000, contextTokens: 900000 };
  assert.deepEqual(readExecutionBudget({ getItem: () => JSON.stringify(custom) }), custom);
  assert.deepEqual(readExecutionBudget({ getItem: () => { throw Error('Denied'); } }), defaults);
  for (const maxRounds of [0, -1, 513, Infinity, 1.5]) assert.equal(executionBudgetSchema.safeParse({ ...defaults, maxRounds }).success, false);
  assert.deepEqual(readExecutionBudget({ getItem: () => '{broken' }), defaults);
});

test('a 120-tool workflow crosses the former round, tool and 38-entry ceilings with every receipt intact', async () => {
  let turns = 0, calls = 0; let history: AssistantContent[] = [];
  await runConversation({ execution: { ...defaults, maxRounds: 128 }, contents: [{ role: 'user', parts: [{ text: 'Run the fixture' }] }],
    declarations: [{ name: 'inspect', description: 'Fixture', parametersJsonSchema: { type: 'object' } }],
    signal: new AbortController().signal, assertContext: () => {}, emit: () => {}, checkpoint: c => { history = structuredClone(c); },
    turn: async request => {
      assert.ok(assistantRequestSchema.safeParse(request).success);
      turns++;
      return { requestId: request.requestId, model: 'gemini-test', sources: [], content: { role: 'model', parts: turns <= 120
        ? [{ functionCall: { name: 'inspect', args: {}, id: `call-${turns}` }, thoughtSignature: `signature-${turns}` }]
        : [{ text: 'Complete' }] } };
    },
    call: async () => { calls++; return { content: [{ type: 'text', text: `receipt-${calls}` }] }; },
  });
  assert.equal(calls, 120); assert.equal(turns, 121);
  for (let i = 1; i <= 120; i++) {
    assert.equal(history[2 * i - 1].parts[0].thoughtSignature, `signature-${i}`);
    assert.equal(history[2 * i].parts[0].functionResponse?.response.text, `receipt-${i}`);
  }
});

test('200 real drawing operations validate atomically; 201 rejects without changing the project', () => {
  const project = emptyProject('batch-proof');
  const before = JSON.stringify(project);
  const operations = Array.from({ length: 200 }, (_, i) => ({ kind: 'line', levelId: project.levels[0].id, a: [i * 100, 0], b: [i * 100, 5000] }));
  const args = { expectedJobId: project.id, expectedRevision: project.revision, operations };
  const result = prepareArchitectElements(project, architectDrawSchema.parse(args));
  assert.equal(result.created.length, 200);
  assert.equal(JSON.stringify(project), before);
  assert.equal(architectDrawSchema.safeParse({ ...args, operations: [...operations, operations[0]] }).success, false);
});
