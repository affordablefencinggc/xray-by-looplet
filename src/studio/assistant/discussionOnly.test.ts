import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isDiscussionOnlyObjective, prohibitsAllTools } from './discussionOnly.ts';
import { runConversation } from './conversation.ts';
import { completionStepForObjective } from './completionPreflight.ts';
import { emptyWorkflow } from './workflowRouting.ts';

export const correctionFixture = 'Correction only: do not call any tools or rerun the calculator. The successful classify_draft_quantities call call_1f4917677fbe45ce9d608b53 explicitly included parentId:null for walls and source:null for both a and b. These fields are required; omission is invalid. Your advice to omit parentId was incorrect. Its actual receipt was 0.3 m2 total, 0.3 m2 classified, no unclassified quantities, evidence unverified, draft-classification, verifiedQuoteEligible:false; project unchanged. Give one corrected consolidated answer using that receipt, then a concise Developer review assessing only the answer you deliver now. Do not speculate about historical attempts or claim another tool execution.';

test('explicit no-tool correction and supplied-evidence explanations are discussion only', () => {
  for (const text of [correctionFixture, 'No tools. Explain the supplied receipt.', "Do not use tools. Summarise this pasted explanation.", 'Review these supplied results without calling any tools.']) assert.equal(isDiscussionOnlyObjective(text), true, text);
});
test('action tasks, selective tool bans and ambiguous requests retain normal routing', () => {
  for (const text of ['Explain the project.', 'Do not call classify_draft_quantities; call read_project_context and explain it.', 'Do not call any tools, but run the calculator and explain the result.', 'No tools. Draw a wall and explain it.', 'No tools. Explain it, then inspect this project.', 'No tools. Review current values and save the project.', 'No tools. Check current project evidence and explain it.', 'Do not call any tools. Calculate the quantities.', 'No tools except read_project_context. Explain the result.', 'No tools. Explain it; I want you to draw a wall.', 'No tools. Could you inspect this project and explain it?', 'Review the recording.', 'Without editing, inspect the current project.']) assert.equal(isDiscussionOnlyObjective(text), false, text);
});

test('blanket prohibition remains binding for compound action requests without completing their route', () => {
  for (const text of ['No tools. Draw a wall and explain it.', 'Do not call any tools. Calculate the quantities.', 'No tools. Explain it, then inspect this project.']) {
    assert.equal(prohibitsAllTools(text), true);
    assert.equal(isDiscussionOnlyObjective(text), false);
    assert.ok(completionStepForObjective(emptyWorkflow(), { projectId: 'qa', projectRevision: 1, designRevision: 1, sourceKey: 'none', sheet: 0, architectReady: false, pane: 'sheets', renderedSceneSha256: null }, text));
  }
  for (const text of ['No tools except read_project_context.', 'No tools, other than read_project_context.', 'Do not use tools apart from read_project_context.', 'Do not call classify_draft_quantities.', 'Draw a wall.']) assert.equal(prohibitsAllTools(text), false, text);
});

test('chat boundary uses blanket prohibition and rejects a provider mutation even for contradictory action intent', async () => {
  const hook = readFileSync(new URL('./useAssistantChat.ts', import.meta.url), 'utf8');
  assert.match(hook, /const noTools = reviewOnly \|\| prohibitsAllTools\(text\)/);
  assert.match(hook, /declarations: noTools \? \[\]/);
  const text = 'No tools. Draw a wall and explain it.';
  let round = 0, executed = 0;
  await runConversation({ contents: [{ role: 'user', parts: [{ text }] }],
    declarations: prohibitsAllTools(text) ? [] : [{ name: 'draw_wall', description: 'Draw wall', parametersJsonSchema: { type: 'object' } }],
    signal: new AbortController().signal, assertContext() {}, checkpoint() {}, emit() {},
    call: async () => { executed++; return { content: [] }; },
    turn: async request => {
      assert.deepEqual(request.declarations, []);
      return { requestId: request.requestId, sources: [], model: 'MiniMax-M3', content: { role: 'model', parts: ++round === 1
        ? [{ functionCall: { name: 'draw_wall', args: {}, id: 'forbidden' } }]
        : [{ text: 'No drawing was executed; tools are prohibited.' }] } };
    },
  });
  assert.equal(executed, 0);
});
