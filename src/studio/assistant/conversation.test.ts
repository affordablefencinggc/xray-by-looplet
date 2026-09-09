import { DEFAULT_EXECUTION_BUDGET } from './executionBudget.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { runConversation, type ChatEvent } from './conversation.ts';
import type { AssistantContent, AssistantRequest, AssistantResponse } from './contract.ts';
const declaration = { name: 'draw', description: 'Draw fixture', parametersJsonSchema: { type: 'object' } };
const initial: AssistantContent[] = [{ role: 'user', parts: [{ text: 'Draw a wall' }] }];
const response = (request: AssistantRequest, parts: AssistantResponse['content']['parts']): AssistantResponse => ({ requestId: request.requestId, content: { role: 'model', parts }, model: 'gemini-test', sources: [] });

test('routing suppresses premature final success and returns the required step to the model', async () => {
  let turns = 0, executed = false;
  const events: ChatEvent[] = [];
  await runConversation({ contents: initial, declarations: [declaration], signal: new AbortController().signal,
    assertContext: () => {}, checkpoint: () => {}, emit: e => events.push(e),
    beforeFinal: async () => executed ? null : 'Read back the actual design before reporting completion.',
    turn: async request => {
      turns++;
      if (turns === 1) return response(request, [{ text: 'Everything is complete, trust me.' }]);
      if (turns === 2) { assert.match(JSON.stringify(request.contents), /workflow-check.*Read back/); return response(request, [{ functionCall: { name: 'draw', args: {} } }]); }
      return response(request, [{ text: 'Actual result inspected.' }]);
    }, call: async () => { executed = true; return { content: [{ type: 'text', text: 'Readback receipt' }] }; },
  });
  assert.equal(events.some(e => e.text.includes('trust me')), false);
  assert.equal(events.at(-1)?.text, 'Actual result inspected.');
});

test('a model that ignores routing stops after two corrections without repeating mutations', async () => {
  let turns = 0, calls = 0; let saved: AssistantContent[] = [];
  await assert.rejects(runConversation({ contents: initial, declarations: [declaration], signal: new AbortController().signal,
    assertContext: () => {}, checkpoint: c => { saved = c; }, emit: () => {}, beforeFinal: async () => 'Capture the current revision.',
    turn: async request => { turns++; return response(request, [{ text: 'Done.' }]); },
    call: async () => { calls++; return { content: [] }; },
  }), /Workflow incomplete/);
  assert.equal(turns, 3); assert.equal(calls, 0);
  assert.match(JSON.stringify(saved.at(-1)), /Capture the current revision/);
});

test('stop during the final routing check suppresses the late answer', async () => {
  const controller = new AbortController(); const events: ChatEvent[] = [];
  await assert.rejects(runConversation({ contents: initial, declarations: [], signal: controller.signal,
    assertContext: () => {}, checkpoint: () => {}, emit: e => events.push(e),
    beforeFinal: async () => { controller.abort(); return null; },
    turn: async request => response(request, [{ text: 'Late answer' }]), call: async () => ({ content: [] }),
  }));
  assert.equal(events.length, 0);
});
test('tool loop preserves thought signatures, call identity and actual output before answering', async () => {
  const events: ChatEvent[] = []; const requests: AssistantRequest[] = []; let history: AssistantContent[] = []; let calls = 0;
  await runConversation({ contents: initial, declarations: [declaration], signal: new AbortController().signal, assertContext: () => {}, checkpoint: value => { history = value; }, emit: event => events.push(event),
    turn: async request => { requests.push(structuredClone(request)); return requests.length === 1 ? response(request, [{ functionCall: { name: 'draw', args: { length: 4000 }, id: 'call-1' }, thoughtSignature: 'opaque-signature' }]) : response(request, [{ text: 'Created wall W1.' }]); },
    call: async (name, args) => { calls++; assert.equal(name, 'draw'); assert.deepEqual(args, { length: 4000 }); return { content: [{ type: 'text', text: 'Created W1 revision 2' }] }; },
  });
  assert.equal(calls, 1); assert.equal(requests.length, 2);
  assert.equal(requests[1].contents[1].parts[0].thoughtSignature, 'opaque-signature');
  assert.equal(requests[1].contents[2].parts[0].functionResponse?.id, 'call-1');
  assert.match(JSON.stringify(requests[1]), /Created W1 revision 2/);
  assert.equal(history.length, 4); assert.equal(events.at(-1)?.text, 'Created wall W1.');
});
test('unknown tools cannot execute and failed tools are returned as errors to the model', async () => {
  let step = 0; let actualCalls = 0; const events: ChatEvent[] = [];
  await runConversation({ contents: initial, declarations: [declaration], signal: new AbortController().signal, assertContext: () => {}, checkpoint: () => {}, emit: event => events.push(event),
    turn: async request => ++step === 1 ? response(request, [{ functionCall: { name: 'delete_everything', args: {} } }]) : response(request, [{ text: 'The requested tool is unavailable.' }]),
    call: async () => { actualCalls++; throw Error('Must not run'); },
  });
  assert.equal(actualCalls, 0); assert.equal(events.find(event => event.failed)?.failed, true);
});
test('project changes after model response prevent every tool mutation', async () => {
  let checks = 0; let calls = 0;
  await assert.rejects(runConversation({ contents: initial, declarations: [declaration], signal: new AbortController().signal, assertContext: () => { if (++checks === 2) throw Error('Project changed'); }, checkpoint: () => {}, emit: () => {},
    turn: async request => response(request, [{ functionCall: { name: 'draw', args: {} } }]), call: async () => { calls++; return { content: [] }; },
  }), /Project changed/); assert.equal(calls, 0);
});
test('abort after provider response prevents tools and discards late model text', async () => {
  const controller = new AbortController(); let calls = 0; let events = 0;
  await assert.rejects(runConversation({ contents: initial, declarations: [declaration], signal: controller.signal, assertContext: () => {}, checkpoint: () => {}, emit: () => { events++; },
    turn: async request => { controller.abort(); return response(request, [{ functionCall: { name: 'draw', args: {} } }]); }, call: async () => { calls++; return { content: [] }; },
  })); assert.equal(calls, 0); assert.equal(events, 0);
});
test('user-selected twelve-step budget stops with completed results checkpointed', async () => {
  let turns = 0; let history: AssistantContent[] = [];
  await assert.rejects(runConversation({ contents: initial, declarations: [declaration], signal: new AbortController().signal, assertContext: () => {}, checkpoint: value => { history = value; }, emit: () => {}, execution: { ...DEFAULT_EXECUTION_BUDGET, maxRounds: 12 },
    turn: async request => { turns++; return response(request, [{ functionCall: { name: 'draw', args: {} } }]); }, call: async () => ({ content: [{ type: 'text', text: 'Done' }] }),
  }), /12 assistant steps/); assert.equal(turns, 12); assert.equal(history.length, 25);
});

test('an eight-tool workflow can inspect its result and give a final answer without a false blocked state', async () => {
  let turns = 0, calls = 0;
  const events: ChatEvent[] = [];
  await runConversation({ contents: initial, declarations: [declaration], signal: new AbortController().signal, assertContext: () => {}, checkpoint: () => {}, emit: event => events.push(event),
    turn: async request => ++turns <= 9 ? response(request, [{ functionCall: { name: 'draw', args: {}, id: `step-${turns}` } }]) : response(request, [{ text: 'Saved and inspected the model.' }]),
    call: async () => { calls++; return { content: [{ type: 'text', text: 'Confirmed' }] }; },
  });
  assert.equal(calls, 9); assert.equal(turns, 10);
  assert.equal(events.at(-1)?.text, 'Saved and inspected the model.');
});

for (const interruption of ['stop', 'project change'] as const) {
  test(`${interruption} between tools preserves completed receipts and records skipped calls for retry`, async () => {
    const controller = new AbortController();
    let changed = false;
    let history: AssistantContent[] = [];
    const executed: string[] = [];
    const events: ChatEvent[] = [];
    await assert.rejects(runConversation({
      contents: initial, declarations: [declaration], signal: controller.signal,
      assertContext: () => { if (changed) throw Error('Project changed'); },
      checkpoint: value => { history = structuredClone(value); }, emit: event => events.push(event),
      turn: async request => response(request, [1, 2, 3].map(n => ({ functionCall: { name: 'draw', args: { n }, id: `call-${n}` } }))),
      call: async (_name, args) => {
        executed.push(`wall-${args.n}`);
        if (interruption === 'stop') controller.abort(); else changed = true;
        return { content: [{ type: 'text', text: 'Created wall-1 revision 2' }] };
      },
    }));
    assert.deepEqual(executed, ['wall-1']);
    const receipts = history.at(-1)?.parts.map(part => part.functionResponse);
    assert.equal(receipts?.length, 3);
    assert.deepEqual(receipts?.map(receipt => receipt?.id), ['call-1', 'call-2', 'call-3']);
    assert.equal(receipts?.[0]?.response.isError, false);
    assert.match(String(receipts?.[0]?.response.text), /Created wall-1 revision 2/);
    for (const receipt of receipts?.slice(1) || []) {
      assert.equal(receipt?.response.isError, true);
      assert.match(String(receipt?.response.text), /not executed/i);
    }
    assert.equal(events.filter(event => event.failed).length, 2);
    let retryCalls = 0;
    await runConversation({
      contents: [...history, { role: 'user', parts: [{ text: 'What was completed?' }] }],
      declarations: [declaration], signal: new AbortController().signal, assertContext: () => {},
      checkpoint: () => {}, emit: () => {},
      turn: async request => {
        assert.match(JSON.stringify(request.contents), /Created wall-1 revision 2/);
        return response(request, [{ text: 'Only wall-1 was created.' }]);
      },
      call: async () => { retryCalls++; return { content: [] }; },
    });
    assert.equal(retryCalls, 0);
  });
}

test('replayed call IDs cannot repeat actions within a reply or across conversation history', async () => {
  let executions = 0, round = 0;
  const events: ChatEvent[] = [];
  const history: AssistantContent[] = [...initial, { role: 'model', parts: [{ functionCall: { name: 'draw', args: {}, id: 'old' } }] }, { role: 'user', parts: [{ functionResponse: { name: 'draw', id: 'old', response: { isError: false } } }] }];
  await runConversation({ contents: history, declarations: [declaration], signal: new AbortController().signal, assertContext: () => {}, checkpoint: () => {}, emit: e => events.push(e),
    turn: async request => ++round === 1 ? response(request, ['old', 'fresh', 'fresh'].map(id => ({ functionCall: { name: 'draw', args: {}, id } }))) : response(request, [{ text: 'Reviewed receipts.' }]),
    call: async () => { executions++; return { content: [{ type: 'text', text: 'Actual action' }] }; },
  });
  assert.equal(executions, 1);
  assert.equal(events.filter(e => e.failed && /Duplicate/.test(e.text)).length, 2);
});

test('oversized tool batch executes at most 24 calls and checkpoints unexecuted receipts', async () => {
  let executions = 0; let saved: AssistantContent[] = [];
  await assert.rejects(runConversation({ contents: initial, declarations: [declaration], signal: new AbortController().signal, assertContext: () => {}, checkpoint: c => { saved = c; }, emit: () => {}, execution: { ...DEFAULT_EXECUTION_BUDGET, maxToolCalls: 24 },
    turn: async request => response(request, Array.from({ length: 30 }, (_, i) => ({ functionCall: { name: 'draw', args: {}, id: `id-${i}` } }))),
    call: async () => { executions++; return { content: [{ type: 'text', text: 'Done' }] }; },
  }), /24-tool budget/);
  assert.equal(executions, 24);
  assert.equal(saved.at(-1)?.parts.filter(p => p.functionResponse?.response.isError).length, 6);
});

test('wrong response identity and malformed actions cannot reach execution or chat output', async () => {
  for (const invalid of ['identity', 'arguments']) {
    let executions = 0, events = 0;
    await assert.rejects(runConversation({ contents: initial, declarations: [declaration], signal: new AbortController().signal, assertContext: () => {}, checkpoint: () => {}, emit: () => { events++; },
      turn: async request => invalid === 'identity' ? { ...response(request, [{ text: 'Wrong response' }]), requestId: crypto.randomUUID() } : response(request, [{ functionCall: { name: 'draw', args: { length: Infinity } } }]),
      call: async () => { executions++; return { content: [] }; },
    }));
    assert.equal(executions, 0); assert.equal(events, 0);
  }
});
