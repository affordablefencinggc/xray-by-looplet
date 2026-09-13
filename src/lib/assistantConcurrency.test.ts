import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assistantAiTurn } from './assistantAi.server.ts';
import { minimaxAiTurn } from './minimaxAi.server.ts';

const env = { GEMINI_API_KEY: 'test-only-not-live', MINIMAX_API_KEY: 'test-only-not-live', XRAY_AI_WEB_ENABLED: 'true' };
const request = (number: number) => JSON.stringify({
  schema: 'xray.assistant-request/v1', requestId: `5c806de6-124e-4232-925b-${String(number).padStart(12, '0')}`,
  contents: [{ role: 'user', parts: [{ text: 'Read-only concurrent fixture' }] }], declarations: [], webSearch: false,
});
const response = (provider: 'gemini' | 'minimax', text: string) => provider === 'gemini'
  ? Response.json({ candidates: [{ finishReason: 'STOP', content: { role: 'model', parts: [{ text }] } }] })
  : Response.json({ choices: [{ finish_reason: 'stop', message: { content: text } }] });

test('three chats across providers run independently; duplicate and excess calls never reach provider', async () => {
  const release: (() => void)[] = [];
  let calls = 0;
  const jobs = [minimaxAiTurn, assistantAiTurn, minimaxAiTurn].map((turn, i) => turn(request(i + 1), {
    env, fetcher: async () => {
      calls++;
      await new Promise<void>(resolve => release.push(resolve));
      return response(i === 1 ? 'gemini' : 'minimax', `reply-${i}`);
    },
  }));
  try {
    assert.equal(calls, 3);
    await assert.rejects(minimaxAiTurn(request(1), { env, fetcher: async () => { throw Error('duplicate reached provider'); } }), /already running/);
    await assert.rejects(assistantAiTurn(request(4), { env, fetcher: async () => { throw Error('excess reached provider'); } }),
      (error: Error & { status?: number }) => error.status === 429 && /busy/i.test(error.message));
  } finally { release.forEach(resolve => resolve()); }
  const results = await Promise.all(jobs);
  assert.deepEqual(results.map(result => result.content.parts[0].text), ['reply-0', 'reply-1', 'reply-2']);
  assert.deepEqual(results.map(result => result.requestId), [1, 2, 3].map(n => JSON.parse(request(n)).requestId));
  const next = await assistantAiTurn(request(4), { env, fetcher: async () => response('gemini', 'free slot') });
  assert.equal(next.content.parts[0].text, 'free slot');
});

test('failed provider calls release their slots for later requests', async () => {
  await assert.rejects(minimaxAiTurn(request(5), { env, fetcher: async () => new Response('', { status: 503 }) }), /rejected/);
  assert.equal((await minimaxAiTurn(request(5), { env, fetcher: async () => response('minimax', 'retry') })).content.parts[0].text, 'retry');
});
