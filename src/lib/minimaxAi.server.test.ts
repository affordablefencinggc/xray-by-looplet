import { test } from "node:test";
import assert from "node:assert/strict";
import { minimaxAiTurn, minimaxAiStatus, stripReasoning, toChatMessages, toAssistantContent } from "./minimaxAi.server.ts";

/**
 * No live provider call is made anywhere in this file. Every request goes through an injected
 * fetcher, so these prove the contract, the translation and the failure paths only. Whether the
 * supplied MiniMax credential works is a separate, live question.
 */
const env = { MINIMAX_API_KEY: "private-unit-fixture-key-not-live", XRAY_AI_WEB_ENABLED: "true" };
const request = {
  schema: "xray.assistant-request/v1",
  requestId: "5c806de6-124e-4232-925b-0196c1258646",
  contents: [{ role: "user", parts: [{ text: "Inspect the project" }] }],
  declarations: [],
  webSearch: false,
};
const raw = (over: Record<string, unknown> = {}) => JSON.stringify({ ...request, ...over });
const reply = (message: unknown, extra: Record<string, unknown> = {}) =>
  Response.json({ choices: [{ finish_reason: "stop", message }], usage: { total_tokens: 42 }, ...extra });

test("status keeps the credential private and web access operator opt-in", () => {
  assert.equal(minimaxAiStatus({}).configured, false);
  assert.equal(minimaxAiStatus({ MINIMAX_API_KEY: env.MINIMAX_API_KEY }).available, false, "a key alone must not enable web access");
  assert.equal(minimaxAiStatus({ ...env, MINIMAX_MODEL: "../escape" }).configured, false, "a model id that could alter the request path is refused");
  assert.equal(minimaxAiStatus(env).available, true);
  assert.equal(JSON.stringify(minimaxAiStatus(env)).includes(env.MINIMAX_API_KEY), false, "the key must never appear in status");
});

test("an unconfigured provider refuses before any request is attempted", async () => {
  let called = false;
  await assert.rejects(
    () => minimaxAiTurn(raw(), { env: {}, fetcher: async () => { called = true; return reply({ content: "x" }); } }),
    /not configured/i,
  );
  assert.equal(called, false, "no request may be sent when the provider is not configured");
});

test("the request carries bearer auth, the model and the system instruction", async () => {
  await minimaxAiTurn(raw(), { env, fetcher: async (url, init) => {
    assert.match(String(url), /\/chat\/completions$/);
    assert.equal((init?.headers as Record<string, string>).Authorization, `Bearer ${env.MINIMAX_API_KEY}`);
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, "MiniMax-M2");
    assert.equal(body.messages[0].role, "system");
    assert.ok(body.messages[0].content.length > 100, "the safety manual must be sent as the system message");
    assert.equal(body.messages[1].content, "Inspect the project");
    return reply({ content: "Result" });
  } });
});

test("tool declarations become OpenAI-style function tools", async () => {
  const declarations = [{ name: "xray_read_design", description: "Read it", parametersJsonSchema: { type: "object" } }];
  await minimaxAiTurn(raw({ declarations }), { env, fetcher: async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.tools[0].type, "function");
    assert.equal(body.tools[0].function.name, "xray_read_design");
    assert.equal(body.tool_choice, "auto");
    return reply({ content: "Result" });
  } });
});

test("a returned tool call becomes a functionCall the app already understands", async () => {
  const declarations = [{ name: "xray_read_design", description: "Read it", parametersJsonSchema: { type: "object" } }];
  const result = await minimaxAiTurn(raw({ declarations }), { env, fetcher: async () =>
    reply({ content: "", tool_calls: [{ id: "call-1", type: "function", function: { name: "xray_read_design", arguments: '{"levelId":"L1"}' } }] }) });
  const call = result.content.parts.find(part => part.functionCall)?.functionCall;
  assert.equal(call?.name, "xray_read_design");
  assert.deepEqual(call?.args, { levelId: "L1" });
});

test("an undeclared tool call is refused rather than executed", async () => {
  await assert.rejects(
    () => minimaxAiTurn(raw(), { env, fetcher: async () =>
      reply({ content: "", tool_calls: [{ id: "c1", type: "function", function: { name: "not_a_real_tool", arguments: "{}" } }] }) }),
    /undeclared tool/i,
  );
});

test("unparseable tool arguments degrade to an empty object, not a thrown request", async () => {
  const declarations = [{ name: "xray_read_design", description: "Read it", parametersJsonSchema: { type: "object" } }];
  const result = await minimaxAiTurn(raw({ declarations }), { env, fetcher: async () =>
    reply({ content: "", tool_calls: [{ id: "c1", type: "function", function: { name: "xray_read_design", arguments: "{not json" } }] }) });
  assert.deepEqual(result.content.parts.find(p => p.functionCall)?.functionCall?.args, {},
    "the tool's own contract should refuse it with a readable message, rather than the transport throwing");
});

test("an HTTP error names the provider and maps 429 to 429", async () => {
  await assert.rejects(
    () => minimaxAiTurn(raw(), { env, fetcher: async () => new Response("nope", { status: 429 }) }),
    (error: Error & { status?: number }) => /MiniMax rejected/.test(error.message) && error.status === 429,
  );
  await assert.rejects(
    () => minimaxAiTurn(raw(), { env, fetcher: async () => new Response("nope", { status: 500 }) }),
    (error: Error & { status?: number }) => error.status === 502,
  );
});

test("a failure reported inside a 200 response is not treated as success", async () => {
  // MiniMax can return HTTP 200 with a non-zero base_resp status, notably for balance problems.
  await assert.rejects(
    () => minimaxAiTurn(raw(), { env, fetcher: async () =>
      Response.json({ base_resp: { status_code: 1008, status_msg: "insufficient balance" }, choices: [{ finish_reason: "stop", message: { content: "looks fine" } }] }) }),
    /1008: insufficient balance/,
  );
});

test("a truncated reply is refused with a message that says nothing was executed", async () => {
  await assert.rejects(
    () => minimaxAiTurn(raw(), { env, fetcher: async () => Response.json({ choices: [{ finish_reason: "length", message: { content: "half a" } }] }) }),
    /length limit[\s\S]*not executed/i,
  );
});

test("grounded web search is refused rather than answered without sources", async () => {
  let called = false;
  await assert.rejects(
    () => minimaxAiTurn(raw({ webSearch: true }), { env, fetcher: async () => { called = true; return reply({ content: "x" }); } }),
    /not available on MiniMax/,
  );
  assert.equal(called, false);
});

test("overlapping turns are refused so provider quota is not doubled", async () => {
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  const first = minimaxAiTurn(raw(), { env, fetcher: async () => { await gate; return reply({ content: "Result" }); } });
  await assert.rejects(() => minimaxAiTurn(raw(), { env, fetcher: async () => reply({ content: "second" }) }), /already running/);
  release();
  await first;
});

test("an aborted request never reaches the provider", async () => {
  let called = false;
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    () => minimaxAiTurn(raw(), { env, signal: controller.signal, fetcher: async () => { called = true; return reply({ content: "x" }); } }),
    /cancelled/i,
  );
  assert.equal(called, false);
});

test("images are marked as unsent rather than silently dropped", () => {
  const messages = toChatMessages([
    { role: "user", parts: [{ text: "What is this?" }, { inlineData: { mimeType: "image/png", data: "AAAA" } }] },
  ]);
  assert.match(messages[0].content, /cannot read images/, "a dropped attachment must be visible to the model, not silent");
});

test("tool calls and their results pair up even when the contract carries no id", () => {
  const messages = toChatMessages([
    { role: "model", parts: [{ functionCall: { name: "xray_read_design", args: {} } }] },
    { role: "user", parts: [{ functionResponse: { name: "xray_read_design", response: { ok: true } } }] },
  ]);
  const call = (messages[0] as { tool_calls: Array<{ id: string }> }).tool_calls[0];
  const result = messages[1] as { tool_call_id: string };
  assert.equal(result.tool_call_id, call.id, "an unnamed call and its result must still line up");
});

test("an empty reply still produces valid content rather than an invalid part", () => {
  const content = toAssistantContent({});
  assert.equal(content.role, "model");
  assert.equal(content.parts.length, 1, "the response contract requires at least one part");
});

/**
 * MiniMax M2 returns its reasoning inline as <think>…</think>, verified against the live API on
 * 2026-09-10. These cover what the user must never see.
 */
test("reasoning blocks are removed so the user never reads the model thinking aloud", () => {
  assert.equal(stripReasoning("<think>Let me consider.</think>READY"), "READY");
  assert.equal(stripReasoning("<think>one</think>A<think>two</think>B"), "AB");
  assert.equal(stripReasoning("<THINK>upper</THINK>Answer"), "Answer", "the tag match must not be case-sensitive");
  assert.equal(stripReasoning("Plain answer"), "Plain answer", "content without reasoning is untouched");
});

test("a reply cut off inside its own reasoning yields no answer rather than leaking the thought", () => {
  // Observed live: with a small token budget the reply ended mid-<think> and never reached an answer.
  assert.equal(stripReasoning("<think>The user wants READY. I should"), "");
  const content = toAssistantContent({ content: "<think>still deliberating" });
  assert.equal(content.parts.length, 1);
  assert.match(content.parts[0].text ?? "", /spent the response budget on reasoning/,
    "the user must be told what happened, not shown the raw thought or an empty bubble");
});

test("a tool call still arrives when the text was only reasoning", () => {
  const content = toAssistantContent({
    content: "<think>I should read the design first.</think>",
    tool_calls: [{ id: "c1", type: "function", function: { name: "xray_read_design", arguments: "{}" } }],
  });
  assert.equal(content.parts.some(part => part.functionCall), true, "the tool call must survive reasoning removal");
  assert.equal(content.parts.some(part => typeof part.text === "string" && part.text.includes("<think>")), false);
});
