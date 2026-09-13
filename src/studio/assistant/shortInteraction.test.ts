import test from 'node:test';
import assert from 'node:assert/strict';
import { markWithheldCandidate, shortInteraction, WITHHELD_CANDIDATE_PREFIX } from './shortInteraction.ts';
import type { AssistantContent } from './contract.ts';

const user = (text: string): AssistantContent => ({ role: 'user', parts: [{ text }] });
const model = (text: string): AssistantContent => ({ role: 'model', parts: [{ text }] });

test('marked withheld candidates do not become prior answers even after correction entries are removed', () => {
  const raw = model('Fabricated tool result: 16 m².');
  const before = structuredClone(raw);
  const marked = markWithheldCandidate(raw);
  assert.match(marked.parts[0].text!, /^\[xray:withheld-candidate\]/);
  assert.match(marked.parts[0].text!, /Fabricated tool result: 16 m²/);
  const history = [user('Run this fixture.'), marked, model('Actual final: missing input.'), user('Run it again.')];
  const copy = structuredClone(history);
  assert.deepEqual(shortInteraction(history), [history[0], history[2], history[3]]);
  assert.deepEqual(raw, before);
  assert.deepEqual(history, copy);
});

test('legacy hidden candidates are recognized by their following correction; actual final answers survive', () => {
  const history = [user('Inspect project.'), model('Unverified success'), user('[xray:workflow-check] Read state.'), model('Another unsupported claim'), user('[xray:tool-claim-check] No invocation.'), model('No tool ran; please provide a source.')];
  assert.deepEqual(shortInteraction(history), [history[0], history[5]]);
});

test('tool exchanges and internal controls are excluded while delivered prose is retained', () => {
  const history: AssistantContent[] = [user('[xray:app-preflight] Host control'), user('Please calculate.'),
    { role: 'model', parts: [{ functionCall: { name: 'calculate', args: {} } }] },
    { role: 'user', parts: [{ functionResponse: { name: 'calculate', response: { value: 16 } } }] },
    model('Actual result is 16.'), user('Explain it.')];
  assert.deepEqual(shortInteraction(history), [history[1], history[4], history[5]]);
});

test('image-only candidate receives a marker without altering its raw payload', () => {
  const raw: AssistantContent = { role: 'model', parts: [{ inlineData: { mimeType: 'image/png', data: 'AAAA' } }] };
  const marked = markWithheldCandidate(raw);
  assert.ok(marked.parts[0].text?.startsWith(WITHHELD_CANDIDATE_PREFIX));
  assert.equal(raw.parts.length, 1);
  assert.deepEqual(marked.parts[1], raw.parts[0]);
  assert.deepEqual(shortInteraction([marked]), []);
});
