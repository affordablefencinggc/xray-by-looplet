/**
 * One real MiniMax request, to answer a question the unit tests cannot: does this credential work?
 *
 * Reads .env.local directly so nothing has to be exported into the shell. Prints the model's reply
 * and the HTTP/base_resp status only. The key itself is never printed, and the response is scanned
 * to make sure it does not echo the key back.
 *
 * Run: node proof/growth/2026-09-10-provider-switch/probe-minimax.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../../..');
const env = {};
for (const line of fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (match) env[match[1]] = match[2];
}

const key = env.MINIMAX_API_KEY;
const model = env.MINIMAX_MODEL || 'MiniMax-M2';
const base = (env.MINIMAX_BASE_URL || 'https://api.minimax.io/v1').replace(/\/+$/, '');
if (!key) { console.log(JSON.stringify({ ok: false, reason: 'MINIMAX_API_KEY missing' })); process.exit(1); }

const started = Date.now();
let response, text;
try {
  response = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'Reply with the single word READY and nothing else.' }],
      max_tokens: 2048,
    }),
    signal: AbortSignal.timeout(60000),
  });
  text = await response.text();
} catch (error) {
  console.log(JSON.stringify({ ok: false, endpoint: base, model, reason: String(error?.message ?? error) }, null, 2));
  process.exit(1);
}

let body = null;
try { body = JSON.parse(text); } catch { /* reported below as unparseable */ }

const result = {
  ok: false,
  endpoint: `${base}/chat/completions`,
  model,
  httpStatus: response.status,
  seconds: Number(((Date.now() - started) / 1000).toFixed(2)),
  baseRespStatus: body?.base_resp?.status_code ?? null,
  baseRespMessage: body?.base_resp?.status_msg ?? null,
  reply: typeof body?.choices?.[0]?.message?.content === 'string' ? body.choices[0].message.content.slice(0, 200) : null,
  finishReason: body?.choices?.[0]?.finish_reason ?? null,
  totalTokens: body?.usage?.total_tokens ?? null,
  keyEchoedInResponse: text.includes(key),
  unparseable: body === null ? text.slice(0, 200) : undefined,
};
result.ok = response.ok && (result.baseRespStatus === 0 || result.baseRespStatus === null) && Boolean(result.reply);
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
