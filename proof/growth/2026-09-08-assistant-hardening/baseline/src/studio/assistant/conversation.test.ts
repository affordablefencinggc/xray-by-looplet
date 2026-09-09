import test from 'node:test';
import assert from 'node:assert/strict';
import { runConversation, type ChatEvent } from './conversation.ts';
import type { AssistantContent, AssistantRequest, AssistantResponse } from './contract.ts';
const declaration = { name: 'draw', description: 'Draw fixture', parametersJsonSchema: { type: 'object' } };
const initial: AssistantContent[] = [{ role: 'user', parts: [{ text: 'Draw a wall' }] }];
const response = (request: AssistantRequest, parts: AssistantResponse['content']['parts']): AssistantResponse => ({ requestId: request.requestId, content: { role: 'model', parts }, model: 'gemini-test', sources: [] });
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
test('repeated function calls stop after eight steps with completed results checkpointed', async () => {
  let turns = 0; let history: AssistantContent[] = [];
  await assert.rejects(runConversation({ contents: initial, declarations: [declaration], signal: new AbortController().signal, assertContext: () => {}, checkpoint: value => { history = value; }, emit: () => {},
    turn: async request => { turns++; return response(request, [{ functionCall: { name: 'draw', args: {} } }]); }, call: async () => ({ content: [{ type: 'text', text: 'Done' }] }),
  }), /eight/); assert.equal(turns, 8); assert.equal(history.length, 17);
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
