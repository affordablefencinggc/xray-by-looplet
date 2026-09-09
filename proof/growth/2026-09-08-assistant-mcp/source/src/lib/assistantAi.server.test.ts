import { test } from "node:test";
import assert from "node:assert/strict";
import { assistantAiTurn, assistantAiStatus, allowAssistantRequest, assistantFailure, readAssistantBody } from "./assistantAi.server.ts";
import { assistantRequestSchema, ASSISTANT_LIMITS } from "../studio/assistant/contract.ts";

const env = { GEMINI_API_KEY: "private-unit-fixture-key-not-live", XRAY_AI_WEB_ENABLED: "true" };
const request = { schema: "xray.assistant-request/v1", requestId: "5c806de6-124e-4232-925b-0196c1258646", contents: [{ role: "user", parts: [{ text: "Inspect the project" }] }], declarations: [{ name: "project.inspect", description: "Read current project", parametersJsonSchema: { type: "object", properties: {} } }], webSearch: false };
const reply = (parts: unknown[] = [{ text: "Result" }], metadata?: unknown) => Response.json({ candidates: [{ finishReason: "STOP", content: { role: "model", parts }, groundingMetadata: metadata }] });
const raw = JSON.stringify(request);

test("status keeps credentials private and web access opt-in", () => {
  assert.equal(assistantAiStatus({}).available, false);
  assert.equal(assistantAiStatus({ GEMINI_API_KEY: env.GEMINI_API_KEY }).available, false);
  assert.equal(assistantAiStatus({ ...env, XRAY_AI_MODEL: "../invalid" }).available, false);
  assert.equal(JSON.stringify(assistantAiStatus(env)).includes(env.GEMINI_API_KEY), false);
});
test("same-origin check rejects missing evidence, cross-site and sibling origins", () => {
  const req = (headers: Record<string,string>) => new Request("https://xray.test/api/assistant-ai", { method: "POST", headers });
  assert.equal(allowAssistantRequest(req({})), false);
  assert.equal(allowAssistantRequest(req({ origin: "https://other.test" })), false);
  assert.equal(allowAssistantRequest(req({ origin: "https://xray.test", "sec-fetch-site": "cross-site" })), false);
  assert.equal(allowAssistantRequest(req({ origin: "https://xray.test" })), true);
});
test("function declarations and multimodal history reach fixed provider; signatures remain byte-identical", async () => {
  const signed = { functionCall: { name: "project.inspect", args: {}, id: "call-1" }, thoughtSignature: "opaque+/==" };
  const contents = [...request.contents, { role: "model", parts: [signed] }, { role: "user", parts: [{ functionResponse: { name: "project.inspect", id: "call-1", response: { name: "Fixture" } } }, { inlineData: { mimeType: "image/png", data: "iVBORw0KGgo=" } }] }];
  const result = await assistantAiTurn(JSON.stringify({ ...request, contents }), { env, fetcher: async (url, init) => {
    assert.match(String(url), /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-[\w.-]+:generateContent$/);
    assert.equal(init?.redirect, "error");
    const body = JSON.parse(String(init?.body));
    assert.deepEqual(body.contents, contents);
    assert.deepEqual(body.tools, [{ functionDeclarations: request.declarations }]);
    assert.equal(body.toolConfig.functionCallingConfig.mode, "AUTO");
    return reply([signed, { thoughtSignature: "another-opaque-signature" }]);
  } });
  assert.equal(result.requestId, request.requestId);
  assert.deepEqual(result.content.parts, [signed, { thoughtSignature: "another-opaque-signature" }]);
});
test("search mode is separate and sources are bounded, deduplicated and safe links", async () => {
  const result = await assistantAiTurn(JSON.stringify({ ...request, declarations: [], webSearch: true }), { env, fetcher: async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.deepEqual(body.tools, [{ google_search: {} }]); assert.equal(body.toolConfig, undefined);
    return reply([{ text: "Source-supported answer" }], { groundingChunks: [{ web: { title: "Supplier", uri: "https://supplier.test/item" } }, { web: { title: "Duplicate", uri: "https://supplier.test/item" } }, { web: { title: "Bad", uri: "javascript:alert(1)" } }, { web: { title: "Credentials", uri: "https://user:pass@host.test/" } }] });
  } });
  assert.deepEqual(result.sources, [{ title: "Supplier", url: "https://supplier.test/item" }]);
  assert.equal(assistantRequestSchema.safeParse({ ...request, webSearch: true }).success, false);
});
test("invalid envelopes, duplicate tools, malformed images and excessive JSON reject before network", async () => {
  let called = false; const fetcher: typeof fetch = async () => { called = true; return reply(); };
  const invalid = [{ ...request, endpoint: "https://elsewhere.test" }, { ...request, declarations: [request.declarations[0], request.declarations[0]] }, { ...request, contents: [{ role: "user", parts: [{ inlineData: { mimeType: "text/html", data: "abcd" } }] }] }, { ...request, contents: Array(41).fill(request.contents[0]) }];
  for (const r of invalid) await assert.rejects(assistantAiTurn(JSON.stringify(r), { env, fetcher }), /Invalid assistant/);
  let nested: unknown = {}; for (let i=0;i<18;i++) nested={ child:nested };
  assert.equal(assistantRequestSchema.safeParse({ ...request, declarations: [{ ...request.declarations[0], parametersJsonSchema: nested }] }).success,false);
  assert.equal(called,false);
});
test("missing credentials, pre-abort and oversized request make no provider call", async () => {
  let count=0; const fetcher: typeof fetch=async()=>{count++;return reply()};
  await assert.rejects(assistantAiTurn(raw,{env:{},fetcher}),/not configured/);
  await assert.rejects(assistantAiTurn(raw,{env,fetcher,signal:AbortSignal.abort()}),/cancelled/);
  await assert.rejects(assistantAiTurn(" ".repeat(ASSISTANT_LIMITS.requestBytes+1),{env,fetcher}),/12 MB/);
  assert.equal(count,0);
});
test("native parity rejects role misuse, image MIME mismatch, cycles and protected JSON keys",()=>{
  const invalid = [
    {...request,contents:[{role:"user",parts:[{functionCall:{name:"project.inspect",args:{}}}]}]},
    {...request,contents:[{role:"model",parts:[{text:"Model cannot be last"}]}]},
    {...request,contents:[{role:"user",parts:[{inlineData:{mimeType:"image/jpeg",data:"iVBORw0KGgo="}}]}]},
    {...request,declarations:[{...request.declarations[0],parametersJsonSchema:JSON.parse('{"__proto__":{"type":"string"}}')}]},
  ];
  for(const value of invalid)assert.equal(assistantRequestSchema.safeParse(value).success,false);
  const cycle:Record<string,unknown>={};cycle.child=cycle;
  assert.equal(assistantRequestSchema.safeParse({...request,declarations:[{...request.declarations[0],parametersJsonSchema:cycle}]}).success,false);
});
test("provider errors and thrown diagnostics never expose secret values", async () => {
  await assert.rejects(assistantAiTurn(raw,{env,fetcher:async()=>new Response(env.GEMINI_API_KEY,{status:429})}),/HTTP 429/);
  try {await assistantAiTurn(raw,{env,fetcher:async()=>{throw Error(env.GEMINI_API_KEY)}});assert.fail();}catch(e){assert.equal(assistantFailure(e).error.includes(env.GEMINI_API_KEY),false)}
  assert.equal(assistantFailure(Error(env.GEMINI_API_KEY)).error.includes(env.GEMINI_API_KEY),false);
  await assert.rejects(assistantAiTurn(raw,{env,fetcher:async()=>reply([{text:env.GEMINI_API_KEY}])}),/output validation/);
});
test("incomplete, malformed and undeclared function calls fail closed", async()=>{
  const responses=[()=>new Response("bad JSON"),()=>Response.json({candidates:[{finishReason:"MAX_TOKENS",content:{role:"model",parts:[{text:"truncated"}]}}]}),()=>reply([{functionCall:{name:"unlisted",args:{}}}]),()=>reply([{functionResponse:{name:"project.inspect",response:{}}}])];
  for(const make of responses)await assert.rejects(assistantAiTurn(raw,{env,fetcher:async()=>make()}));
});
test("response streaming cap cancels the reader and remains safe",async()=>{
  let cancelled=false;
  const stream=new ReadableStream<Uint8Array>({start(c){c.enqueue(new Uint8Array(ASSISTANT_LIMITS.responseBytes+1))},cancel(){cancelled=true}});
  await assert.rejects(assistantAiTurn(raw,{env,fetcher:async()=>new Response(stream)}),/size limit/);
  assert.equal(cancelled,true);
  await assert.rejects(readAssistantBody(new ReadableStream({start(c){c.enqueue(new Uint8Array([255]));c.close()}}),100));
});
test("cancellation discards late provider results and releases the single-flight guard",async()=>{
  const controller=new AbortController();let release!:()=>void;
  const pending=assistantAiTurn(raw,{env,signal:controller.signal,fetcher:async()=>{await new Promise<void>(r=>{release=r});return reply()}});
  await assert.rejects(assistantAiTurn(raw,{env,fetcher:async()=>reply()}),/already running/);
  controller.abort();release();await assert.rejects(pending,/cancelled/);
  assert.equal((await assistantAiTurn(raw,{env,fetcher:async()=>reply()})).content.parts[0].text,"Result");
});
