import test from "node:test";
import assert from "node:assert/strict";
import { PROVIDERS, PROVIDER_KEY, isAssistantProvider, providerEndpoint, providerLabel, readProvider, providerSupportsTool, providerToolError } from "./provider.ts";

test('MiniMax cannot silently use Gemini-only tools', () => {
  for (const name of ['web_search', 'generate_render_visualisation']) {
    assert.equal(providerSupportsTool('minimax', name), false);
    assert.equal(providerSupportsTool('gemini', name), true);
    assert.match(providerToolError('minimax', name), /No Gemini request was sent/);
  }
  for (const name of ['draw_floor_plan', 'read_attachments', 'capture_model_view']) assert.equal(providerSupportsTool('minimax', name), true);
});

test("an unknown, missing or malformed stored value falls back to MiniMax", () => {
  for (const value of [null, undefined, "", "openai", "MINIMAX", "gemini-pro", "{}", "0"]) {
    assert.equal(readProvider(value as string | null), "minimax", `expected fallback for ${JSON.stringify(value)}`);
  }
  assert.equal(readProvider("minimax"), "minimax");
  assert.equal(readProvider("gemini"), "gemini");
});

test("the type guard accepts only the two shipped providers", () => {
  assert.equal(isAssistantProvider("gemini"), true);
  assert.equal(isAssistantProvider("minimax"), true);
  for (const value of ["openai", "", null, undefined, 1, {}]) assert.equal(isAssistantProvider(value), false);
});

test("each provider routes to its own endpoint and no two share one", () => {
  assert.equal(providerEndpoint("gemini"), "/api/assistant-ai");
  assert.equal(providerEndpoint("minimax"), "/api/minimax-ai");
  const endpoints = PROVIDERS.map(entry => entry.endpoint);
  assert.equal(new Set(endpoints).size, endpoints.length, "two providers sharing a route would silently send to the wrong one");
});

test("an unrecognised provider still resolves to a usable route rather than undefined", () => {
  // Defence in depth: a persisted value from a future build must not produce `fetch(undefined)`.
  assert.equal(providerEndpoint("openai" as never), "/api/minimax-ai");
  assert.equal(providerLabel("openai" as never), "MiniMax");
});

test("every provider carries a label and a hint that states its limits", () => {
  for (const entry of PROVIDERS) {
    assert.ok(entry.label.length > 0, `${entry.provider} needs a label`);
    assert.ok(entry.hint.length > 10, `${entry.provider} needs a hint`);
    assert.match(entry.endpoint, /^\/api\//, "an endpoint must be a same-origin app route");
  }
  const minimax = PROVIDERS.find(entry => entry.provider === "minimax")!;
  assert.match(minimax.hint, /no image input/i, "the image limitation must be stated before the user picks it");
  assert.match(minimax.hint, /no grounded web search/i, "the search limitation must be stated too");
});

test("the storage key is versioned so a later format cannot be misread", () => {
  assert.match(PROVIDER_KEY, /:v\d+$/);
});
