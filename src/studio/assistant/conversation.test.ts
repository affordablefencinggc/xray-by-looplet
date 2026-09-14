import { DEFAULT_EXECUTION_BUDGET } from './executionBudget.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { appendChatEvent, runConversation, type ChatEvent } from './conversation.ts';
import type { AssistantContent, AssistantRequest, AssistantResponse } from './contract.ts';
const declaration = { name: 'draw', description: 'Draw fixture', parametersJsonSchema: { type: 'object' } };
const initial: AssistantContent[] = [{ role: 'user', parts: [{ text: 'Draw a wall' }] }];
const response = (request: AssistantRequest, parts: AssistantResponse['content']['parts']): AssistantResponse => ({ requestId: request.requestId, content: { role: 'model', parts }, model: 'gemini-test', sources: [] });

test('app preflight executes a required safe read through the caller and records honest origin before a consolidated answer', async () => {
  const events: ChatEvent[] = [];
  let calls = 0, rounds = 0, history: AssistantContent[] = [];
  await runConversation({ contents: [{ role: 'user', parts: [{ text: 'Read current project context now.' }] }],
    declarations: [{ ...declaration, name: 'read_project_context' }], signal: new AbortController().signal,
    assertContext: () => {}, checkpoint: value => { history = structuredClone(value); }, emit: e => events.push(e),
    beforeFinal: async () => calls ? null : { instruction: 'Read the actual project state.', readOnlyPrerequisite: { tool: 'read_project_context', args: {} } },
    turn: async request => {
      if (++rounds === 1) return response(request, [{ text: 'I read the project already.' }]);
      const hostEntry = request.contents.find(entry => entry.parts.some(part => part.text?.startsWith('[xray:app-preflight]')));
      assert.equal(hostEntry?.parts[1].functionCall?.name, 'read_project_context');
      const receipt = request.contents.at(-1)?.parts[0].functionResponse;
      assert.equal(receipt?.response.executionOrigin, 'app-preflight');
      assert.equal(receipt?.response.text, 'Project job-a revision 3; source absent.');
      return response(request, [{ text: 'The app preflight read job-a revision 3; no source is loaded. Developer review: reported the app read, not a model-executed action.' }]);
    },
    call: async (name, args) => { calls++; assert.equal(name, 'read_project_context'); assert.deepEqual(args, {}); return { content: [{ type: 'text', text: 'Project job-a revision 3; source absent.' }] }; },
  });
  assert.equal(calls, 1);
  assert.equal(events.filter(e => e.kind === 'assistant').length, 1);
  const receipt = events.find(e => e.kind === 'tool' && !e.text.includes('Running'));
  assert.equal(receipt?.executionOrigin, 'app-preflight');
  assert.match(receipt?.text || '', /App preflight \(not a model call\)/);
  assert.match(history.at(-1)?.parts[0].text || '', /job-a revision 3/);
});

test('app preflight cannot execute mutations or undeclared tools', async () => {
  for (const tool of ['calibrate_source_sheet', 'generate_render_visualisation', 'export_design_file', 'read_project_context']) {
    let calls = 0;
    await assert.rejects(runConversation({ contents: initial, declarations: [{ ...declaration, name: 'calibrate_source_sheet' }], signal: new AbortController().signal,
      assertContext: () => {}, checkpoint: () => {}, emit: () => {},
      beforeFinal: async () => ({ instruction: 'Required.', readOnlyPrerequisite: { tool, args: {} } }),
      turn: async request => response(request, [{ text: 'Done.' }]), call: async () => { calls++; return { content: [] }; },
    }));
    assert.equal(calls, 0, tool);
  }
});

test('failed app preflight returns its real permission refusal and does not replay the read', async () => {
  let calls = 0, rounds = 0;
  const events: ChatEvent[] = [];
  await runConversation({ contents: initial, declarations: [{ ...declaration, name: 'read_project_context' }], signal: new AbortController().signal,
    assertContext: () => {}, checkpoint: () => {}, emit: e => events.push(e),
    beforeFinal: async () => calls ? null : { instruction: 'Read state.', readOnlyPrerequisite: { tool: 'read_project_context', args: {} } },
    turn: async request => {
      if (++rounds === 1) return response(request, [{ text: 'Read complete.' }]);
      assert.equal(request.contents.at(-1)?.parts[0].functionResponse?.response.isError, true);
      assert.match(String(request.contents.at(-1)?.parts[0].functionResponse?.response.text), /Permission refused/);
      return response(request, [{ text: 'The app preflight was refused. No project read completed.' }]);
    },
    call: async () => { calls++; return { isError: true, content: [{ type: 'text', text: 'Permission refused' }] }; },
  });
  assert.equal(calls, 1);
  assert.equal(events.find(e => e.executionOrigin === 'app-preflight' && e.failed)?.failed, true);
});

test('unresolved identical app prerequisite is attempted at most once', async () => {
  let calls = 0;
  await assert.rejects(runConversation({ contents: initial, declarations: [{ ...declaration, name: 'read_project_context' }], signal: new AbortController().signal,
    assertContext: () => {}, checkpoint: () => {}, emit: () => {},
    beforeFinal: async () => ({ instruction: 'Still missing.', readOnlyPrerequisite: { tool: 'read_project_context', args: {} } }),
    turn: async request => response(request, [{ text: 'Done.' }]), call: async () => { calls++; return { content: [{ type: 'text', text: 'Read receipt' }] }; },
  }), /No repeated read/);
  assert.equal(calls, 1);
});

test('abort and project changes after required-read selection stop app preflight before execution', async () => {
  for (const failure of ['abort', 'project'] as const) {
    const controller = new AbortController(); let changed = false, calls = 0;
    await assert.rejects(runConversation({ contents: initial, declarations: [{ ...declaration, name: 'read_project_context' }], signal: controller.signal,
      assertContext: () => { if (changed) throw Error('Project changed'); }, checkpoint: () => {}, emit: () => {},
      beforeFinal: async () => { if (failure === 'abort') controller.abort(); else changed = true; return { instruction: 'Read state.', readOnlyPrerequisite: { tool: 'read_project_context', args: {} } }; },
      turn: async request => response(request, [{ text: 'Done.' }]), call: async () => { calls++; return { content: [] }; },
    }));
    assert.equal(calls, 0);
  }
});

test('app preflight consumes the existing tool budget and checkpoints its receipt before pausing', async () => {
  let calls = 0; let checkpoint: AssistantContent[] = [];
  await assert.rejects(runConversation({ contents: initial, declarations: [{ ...declaration, name: 'read_project_context' }], signal: new AbortController().signal,
    execution: { ...DEFAULT_EXECUTION_BUDGET, maxToolCalls: 1 },
    assertContext: () => {}, checkpoint: value => { checkpoint = structuredClone(value); }, emit: () => {},
    beforeFinal: async () => ({ instruction: 'Read state.', readOnlyPrerequisite: { tool: 'read_project_context', args: {} } }),
    turn: async request => response(request, [{ text: 'Done.' }]), call: async () => { calls++; return { content: [{ type: 'text', text: 'Actual project read' }] }; },
  }), /1-tool budget/);
  assert.equal(calls, 1);
  assert.equal(checkpoint.at(-1)?.parts[0].functionResponse?.response.text, 'Actual project read');
  assert.equal(checkpoint.at(-1)?.parts[0].functionResponse?.response.executionOrigin, 'app-preflight');
});

test('developer-only review reminder and observation-only finalisation perform no app preflight', async () => {
  for (const review of [false, true]) {
    let rounds = 0, reminded = false, calls = 0;
    await runConversation({ contents: [{ role: 'user', parts: [{ text: 'Explain this supplied recording.' }] }], declarations: [], signal: new AbortController().signal,
      assertContext: () => {}, checkpoint: () => {}, emit: () => {},
      beforeFinal: async () => { if (review && !reminded) { reminded = true; return '[xray:developer-review] Append a self-review.'; } return null; },
      turn: async request => { rounds++; return response(request, [{ text: 'The recording shows navigation. Developer review: described supplied events only.' }]); },
      call: async () => { calls++; return { content: [] }; },
    });
    assert.equal(calls, 0);
    assert.equal(rounds, review ? 2 : 1);
  }
});

test('explicit tool receipt fabrication is withheld after one correction; historical receipts do not satisfy the guard', async () => {
  const tool = 'classify_draft_quantities';
  const history: AssistantContent[] = [
    { role: 'user', parts: [{ functionResponse: { name: tool, response: { isError: false, text: 'Historical total 0.3' } } }] },
    { role: 'user', parts: [{ text: `Execute ${tool} now.` }] },
  ];
  let rounds = 0, calls = 0; let checkpoint: AssistantContent[] = [];
  const events: ChatEvent[] = [];
  await assert.rejects(runConversation({ contents: history, declarations: [{ ...declaration, name: tool }], signal: new AbortController().signal,
    assertContext: () => {}, checkpoint: value => { checkpoint = structuredClone(value); }, emit: event => events.push(event),
    turn: async request => { rounds++; return response(request, [{ text: `### Tool receipt (this turn)\n- Tool: ${tool}\n- Total: 0.3 m².` }]); },
    call: async () => { calls++; return { content: [] }; },
  }), /Requested tool classify_draft_quantities was not executed.*no successful result was verified/);
  assert.equal(rounds, 2);
  assert.equal(calls, 0);
  assert.equal(events.length, 0);
  assert.match(checkpoint.at(-1)?.parts[0].text || '', /xray:tool-claim-check/);
});

test('claim correction permits honest missing-input response without replaying tools or requiring a tool call', async () => {
  const tool = 'classify_draft_quantities'; let rounds = 0, calls = 0;
  const events: ChatEvent[] = [];
  await runConversation({ contents: [{ role: 'user', parts: [{ text: `Execute ${tool} now.` }] }], declarations: [{ ...declaration, name: tool }], signal: new AbortController().signal,
    assertContext: () => {}, checkpoint: () => {}, emit: event => events.push(event),
    turn: async request => {
      if (++rounds === 1) return response(request, [{ text: `${tool} returned 0.3 m².` }]);
      assert.match(request.contents.at(-1)?.parts[0].text || '', /Do not repeat completed mutations or tool calls already completed THIS turn/);
      return response(request, [{ text: `I have not executed ${tool}; please supply the quantity items and hierarchy. Developer review: identified missing inputs without claiming an execution.` }]);
    }, call: async () => { calls++; return { content: [] }; },
  });
  assert.equal(calls, 0);
  assert.equal(events.length, 1);
  assert.match(events[0].text, /have not executed/);
});

test('claim correction keeps a fresh pure-calculator request pending and marks raw candidate without altering provider response', async () => {
  const tool = 'classify_draft_quantities', objective = `Execute ${tool} now for supplied fixture A.`;
  let rounds = 0, calls = 0; let raw: AssistantResponse | undefined;
  const events: ChatEvent[] = [];
  let saved: AssistantContent[] = [];
  const declarations = [{ ...declaration, name: tool }, declaration, { ...declaration, name: 'read_project_context' }];
  await runConversation({ contents: [{ role: 'user', parts: [{ text: objective }] }], declarations, signal: new AbortController().signal,
    assertContext: () => {}, checkpoint: content => { saved = structuredClone(content); }, emit: event => events.push(event),
    turn: async request => {
      if (++rounds === 1) { raw = response(request, [{ text: `${tool} returned 0.3.` }]); return raw; }
      if (rounds === 2) {
        const correction = request.contents.at(-1)?.parts[0].text || '';
        assert.match(correction, /original user request below is still pending/);
        assert.match(correction, /pure arithmetic may be rerun/);
        assert.match(correction, /already completed THIS turn/);
        assert.ok(correction.includes(objective));
        assert.equal(request.contents.some(entry => entry.parts.some(part => part.text?.startsWith('[xray:withheld-candidate]'))), false);
        assert.ok(saved.some(entry => entry.parts.some(part => part.text?.startsWith('[xray:withheld-candidate]'))));
        assert.deepEqual(request.declarations.map(item => item.name), [tool, 'read_project_context']);
        assert.equal(raw?.content.parts[0].text, `${tool} returned 0.3.`);
        return response(request, [{ functionCall: { name: tool, args: {} } }]);
      }
      assert.deepEqual(request.declarations, declarations);
      return response(request, [{ text: `${tool} returned 0.3 after the requested fresh call.` }]);
    }, call: async () => { calls++; return { content: [{ type: 'text', text: 'Actual result 0.3' }] }; },
  });
  assert.equal(calls, 1);
  assert.equal(events.filter(event => event.kind === 'assistant').length, 1);
});

test('a focused calculator retry cannot execute an unrelated original mutation declaration', async () => {
  const tool = 'calculate_draft_roof_area'; let rounds = 0, calls = 0;
  const events: ChatEvent[] = [];
  await runConversation({ contents: [{ role: 'user', parts: [{ text: `Call ${tool} now with supplied operands.` }] }],
    declarations: [{ ...declaration, name: tool }, declaration], signal: new AbortController().signal,
    assertContext: () => {}, checkpoint: () => {}, emit: event => events.push(event),
    turn: async request => {
      if (++rounds === 1) return response(request, [{ text: `${tool} returned 95.` }]);
      if (rounds === 2) return response(request, [{ functionCall: { name: 'draw', args: { wall: 'invented' } } }]);
      assert.equal(request.contents.at(-1)?.parts[0].functionResponse?.response.isError, true);
      return response(request, [{ text: 'The requested calculator was not executed. No project edit was performed.' }]);
    }, call: async () => { calls++; return { content: [] }; },
  });
  assert.equal(calls, 0);
  assert.match(events.find(event => event.kind === 'tool' && event.failed)?.text || '', /unpermitted tool in this request/);
});

test('explicit calculator requests start focused, retain scope across context reads and restore normal declarations after execution', async () => {
  const tool = 'calculate_draft_roof_area', read = 'read_project_context';
  const declarations = [declaration, { ...declaration, name: tool }, { ...declaration, name: read }];
  const initial: AssistantContent[] = [{ role: 'user', parts: [{ text: `Call ${tool} with the supplied 100 gross and 5 opening fixture.` }] }];
  const original = structuredClone(initial), calls: string[] = [];
  let round = 0;
  await runConversation({ contents: initial, declarations, signal: new AbortController().signal,
    assertContext: () => {}, checkpoint: () => {}, emit: () => {},
    turn: async request => {
      if (++round <= 2) {
        assert.deepEqual(request.declarations.map(item => item.name), [tool, read]);
        assert.ok(request.contents.at(-1)?.parts.some(part => part.text?.includes('[xray:explicit-calculator]')));
        return response(request, [{ functionCall: { name: round === 1 ? read : tool, args: round === 1 ? {} : { gross: 100, opening: 5 } } }]);
      }
      assert.deepEqual(request.declarations, declarations);
      assert.equal(request.contents.at(-1)?.parts.length, 1);
      return response(request, [{ text: `${tool} returned 95.` }]);
    },
    call: async (name, args) => { calls.push(name); if (name === tool) assert.deepEqual(args, { gross: 100, opening: 5 }); return { content: [{ type: 'text', text: name === tool ? '95' : 'job-a' }] }; },
  });
  assert.deepEqual(calls, [read, tool]);
  assert.deepEqual(initial, original);
});

test('failed requested tool cannot be reported successful and is not replayed by the claim guard', async () => {
  const tool = 'classify_draft_quantities'; let rounds = 0, calls = 0;
  const events: ChatEvent[] = [];
  await assert.rejects(runConversation({ contents: [{ role: 'user', parts: [{ text: `Execute ${tool} now.` }] }], declarations: [{ ...declaration, name: tool }], signal: new AbortController().signal,
    assertContext: () => {}, checkpoint: () => {}, emit: event => events.push(event),
    turn: async request => ++rounds === 1 ? response(request, [{ functionCall: { name: tool, args: {} } }]) : response(request, [{ text: `${tool} successfully completed.` }]),
    call: async () => { calls++; return { isError: true, content: [{ type: 'text', text: 'Missing hierarchy inputs.' }] }; },
  }), /requested calculation failed.*no successful result was verified/);
  assert.equal(calls, 1);
  assert.equal(events.filter(event => event.kind === 'assistant').length, 0);
  assert.equal(events.filter(event => event.failed).length, 1);
});

test('failed calculator withholds speculative report details and preserves failures and candidate for audit', async () => {
  const tool = 'classify_draft_quantities';
  // Regression from the archived MiniMax turn: admitting failure did not prevent
  // an invented export rule from being published as the final answer.
  const candidate = 'Neither attempt produced a successful receipt. What the tool would compute once accepted: Unassigned item d is not exported.';
  const events: ChatEvent[] = []; let history: AssistantContent[] = [], rounds = 0, calls = 0, reviews = 0;
  const past: AssistantContent[] = [
    { role: 'model', parts: [{ functionCall: { name: tool, args: {}, id: 'historical' } }] },
    { role: 'user', parts: [{ functionResponse: { name: tool, id: 'historical', response: { isError: false, text: 'Historical receipt' } } }] },
    { role: 'user', parts: [{ text: `Execute ${tool} with the supplied input.` }] },
  ];
  await assert.rejects(runConversation({ contents: past, declarations: [{ ...declaration, name: tool }], signal: new AbortController().signal,
    assertContext: () => {}, checkpoint: value => { history = structuredClone(value); }, emit: event => events.push(event),
    beforeFinal: async () => { reviews++; return null; },
    turn: async request => ++rounds <= 2 ? response(request, [{ functionCall: { name: tool, args: {}, id: `attempt-${rounds}` } }])
      : response(request, [{ text: candidate }]),
    call: async () => { calls++; return { isError: true, content: [{ type: 'text', text: 'Invalid source. Supply explicit null when no source is available.' }] }; },
  }), /requested calculation failed/);
  assert.equal(calls, 2); assert.equal(rounds, 3); assert.equal(reviews, 0);
  assert.equal(events.filter(e => e.kind === 'assistant').length, 0);
  assert.equal(events.filter(e => e.failed).length, 2);
  assert.ok(history.at(-1)?.parts[0].text?.startsWith('[xray:withheld-candidate]'));
  assert.ok(history.at(-1)?.parts[0].text?.includes(candidate));
  assert.equal(history.flatMap(e => e.parts).filter(p => p.functionResponse?.response.isError).length, 2);
});

test('calculator can correct failed inputs and deliver a successful current-turn result', async () => {
  const tool = 'classify_draft_quantities'; let calls = 0, rounds = 0;
  const events: ChatEvent[] = [];
  await runConversation({ contents: [{ role: 'user', parts: [{ text: `Execute ${tool}.` }] }],
    declarations: [{ ...declaration, name: tool }], signal: new AbortController().signal,
    assertContext: () => {}, checkpoint: () => {}, emit: event => events.push(event),
    turn: async request => ++rounds <= 2 ? response(request, [{ functionCall: { name: tool, args: {}, id: `attempt-${rounds}` } }])
      : response(request, [{ text: 'The current result retains unassigned item d.' }]),
    call: async () => ++calls === 1 ? { isError: true, content: [{ type: 'text', text: 'Invalid source' }] }
      : { content: [{ type: 'text', text: 'Actual receipt including item d' }] },
  });
  assert.equal(calls, 2);
  assert.equal(events.filter(e => e.kind === 'assistant').at(-1)?.text, 'The current result retains unassigned item d.');
});

test('calculator with missing inputs can still ask a question without an attempted call', async () => {
  const events: ChatEvent[] = [];
  await runConversation({ contents: [{ role: 'user', parts: [{ text: 'Execute classify_draft_quantities.' }] }],
    declarations: [{ ...declaration, name: 'classify_draft_quantities' }], signal: new AbortController().signal,
    assertContext: () => {}, checkpoint: () => {}, emit: event => events.push(event),
    turn: async request => response(request, [{ text: 'Please supply the hierarchy and quantities.' }]),
    call: async () => { throw Error('Unexpected call'); },
  });
  assert.equal(events.at(-1)?.text, 'Please supply the hierarchy and quantities.');
});

test('repeated tool calls replace their own progress row, including a failed call', async () => {
  let entries: (ChatEvent & { id: string })[] = [], turns = 0, calls = 0;
  const runningIds: string[] = [];
  await runConversation({ contents: initial, declarations: [declaration], signal: new AbortController().signal,
    assertContext: () => {}, checkpoint: () => {},
    emit: event => {
      const id = crypto.randomUUID();
      if (event.text.startsWith('Running ')) runningIds.push(id);
      entries = appendChatEvent(entries, { ...event, id });
    },
    turn: async request => ++turns === 1
      ? response(request, [1, 2].map(() => ({ functionCall: { name: 'draw', args: {} } })))
      : response(request, [{ text: 'One completed, one refused.' }]),
    call: async () => ({ isError: ++calls === 2, content: [{ type: 'text', text: calls === 1 ? 'Saved' : 'Stale revision' }] }),
  });
  const rows = entries.filter(e => e.kind === 'tool');
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(e => e.id), runningIds);
  assert.notEqual(rows[0].toolCallId, rows[1].toolCallId);
  assert.deepEqual(rows.map(e => [e.text, e.failed]), [['Saved', false], ['Stale revision', true]]);
  assert.equal(entries.some(e => e.text.startsWith('Running ')), false);
});

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

test('workflow correction retains the user objective and fresh evidence for one consolidated final answer', async () => {
  const objective = 'Read current project ID, revision and whether a real source is loaded.';
  const candidate = 'Project current-job is revision 7; no real source is loaded.';
  const final = `${candidate} Developer review: inspected the current project; no edits.`;
  const history: AssistantContent[] = [
    { role: 'user', parts: [{ text: 'Inspect the old project.' }] },
    { role: 'user', parts: [{ functionResponse: { name: 'read_project_context', response: { text: 'historical-job revision 2' } } }] },
    { role: 'user', parts: [{ text: objective }] },
  ];
  const declarations = ['read_project_context', 'read_workflow_route'].map(name => ({ ...declaration, name }));
  let round = 0, routeRead = false;
  const executed: string[] = [], events: ChatEvent[] = [], checkpoints: AssistantContent[][] = [];
  await runConversation({ contents: history, declarations, signal: new AbortController().signal,
    assertContext: () => {}, emit: event => events.push(event), checkpoint: contents => checkpoints.push(structuredClone(contents)),
    beforeFinal: async () => routeRead ? null : 'Read the workflow route before finalising.',
    turn: async request => {
      round++;
      if (round === 1) return response(request, [{ functionCall: { name: 'read_project_context', args: {}, id: 'fresh-read' } }]);
      if (round === 2) return response(request, [{ text: candidate }]);
      if (round === 3) {
        const correction = request.contents.at(-1)?.parts[0].text || '';
        assert.match(correction, /complete, consolidated answer/);
        assert.match(correction, /Do not repeat completed actions/);
        const payload = JSON.parse(correction.slice(correction.lastIndexOf('\n') + 1));
        assert.equal(payload.originalUserRequest, objective);
        assert.equal(payload.withheldCandidateAnswer, candidate);
        assert.equal(payload.currentTurnToolOutcomes.length, 1);
        assert.equal(payload.currentTurnToolOutcomes[0].name, 'read_project_context');
        assert.equal(payload.currentTurnToolOutcomes[0].invoked, true);
        assert.match(payload.currentTurnToolOutcomes[0].text, /current-job/);
        assert.doesNotMatch(JSON.stringify(payload), /historical-job/);
        return response(request, [{ functionCall: { name: 'read_workflow_route', args: {}, id: 'fresh-route' } }]);
      }
      return response(request, [{ text: final }]);
    },
    call: async name => {
      executed.push(name);
      if (name === 'read_workflow_route') routeRead = true;
      return { content: [{ type: 'text', text: name === 'read_project_context' ? '{"projectId":"current-job","revision":7,"realSource":false}' : '{"workflow":"inspect"}' }] };
    },
  });
  assert.deepEqual(executed, ['read_project_context', 'read_workflow_route']);
  assert.deepEqual(events.filter(event => event.kind === 'assistant').map(event => event.text), [final]);
  assert.equal(checkpoints.at(-1)?.at(-1)?.parts[0].text, final);
  assert.ok(checkpoints.some(contents => contents.at(-1)?.parts[0].text?.startsWith('[xray:workflow-check]')));
  assert.equal(history.length, 3);
});

test('review-only correction uses this turn failed and unexecuted outcomes without another tool call', async () => {
  let round = 0, reminder = false, executions = 0;
  const events: ChatEvent[] = [];
  await runConversation({ contents: initial, declarations: [declaration], signal: new AbortController().signal,
    assertContext: () => {}, checkpoint: () => {}, emit: event => events.push(event),
    beforeFinal: async () => { if (reminder) return null; reminder = true; return '[xray:developer-review] Include an outcome, friction and improvement review.'; },
    turn: async request => {
      round++;
      if (round === 1) return response(request, [{ functionCall: { name: 'draw', args: {} } }, { functionCall: { name: 'unavailable', args: {} } }]);
      if (round === 2) return response(request, [{ text: 'Drawing was refused.' }]);
      const correction = request.contents.at(-1)?.parts[0].text || '';
      assert.match(correction, /review-only reminder requires no additional tool call/);
      const payload = JSON.parse(correction.slice(correction.lastIndexOf('\n') + 1));
      assert.deepEqual(payload.currentTurnToolOutcomes.map((outcome: { name: string; invoked: boolean; isError: boolean }) => [outcome.name, outcome.invoked, outcome.isError]), [['draw', true, true], ['unavailable', false, true]]);
      assert.match(payload.currentTurnToolOutcomes[0].text, /Stale revision/);
      return response(request, [{ text: 'Drawing was refused. Developer review: stale revision prevented the edit; the unavailable tool did not run.' }]);
    },
    call: async () => { executions++; return { isError: true, content: [{ type: 'text', text: 'Stale revision' }] }; },
  });
  assert.equal(executions, 1);
  assert.equal(round, 3);
  assert.equal(events.filter(event => event.kind === 'assistant').length, 1);
  assert.match(events.at(-1)?.text || '', /Developer review/);
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
