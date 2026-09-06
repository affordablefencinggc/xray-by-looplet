import { test } from "node:test";
import assert from "node:assert/strict";
import { proposeArchitectAi } from "./architectAi.server.ts";
const env = { GEMINI_API_KEY: "fixture-secret-not-live", XRAY_AI_WEB_ENABLED: "true" },
  request = {
    schema: "xray.architect-ai-request/v1",
    requestId: crypto.randomUUID(),
    projectId: "j",
    designRevision: 1,
    levelId: "l",
    width: 9000,
    depth: 6000,
    height: 2700,
    brief: "A studio and workshop with access doors.",
  },
  result = {
    name: "Fixture",
    assumptions: [],
    walls: [
      { a: [0, 0], b: [9, 0] },
      { a: [9, 0], b: [9, 6] },
      { a: [9, 6], b: [0, 6] },
      { a: [0, 6], b: [0, 0] },
    ],
    openings: [],
    rooms: [{ name: "Room", point: [3, 3] }],
  };
test("layout provider emits the live-verified JSON MIME enum and bounded request; validates source binding", async () => {
  const raw = JSON.stringify(request);
  const run = await proposeArchitectAi(raw, {
    env,
    fetcher: async (url, options) => {
      assert.equal(
        url,
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
      );
      const b = JSON.parse(String(options?.body));
      assert.equal(b.generationConfig.responseFormat.text.mimeType, "APPLICATION_JSON");
      assert.equal(b.generationConfig.maxOutputTokens, 10000);
      assert.equal(b.contents[0].parts.length, 1);
      return Response.json({
        candidates: [
          { finishReason: "STOP", content: { parts: [{ text: JSON.stringify(result) }] } },
        ],
      });
    },
  });
  assert.equal(run.id, request.requestId);
  assert.equal(run.designRevision, 1);
  assert.ok(!JSON.stringify(run).includes(env.GEMINI_API_KEY));
});
test("layout provider rejects disabled, oversized, failed and incomplete responses", async () => {
  await assert.rejects(
    () => proposeArchitectAi(JSON.stringify(request), { env: {} }),
    /configured/,
  );
  await assert.rejects(() => proposeArchitectAi("x".repeat(12001), { env }), /limit/);
  await assert.rejects(
    () =>
      proposeArchitectAi(JSON.stringify(request), {
        env,
        fetcher: async () => new Response("", { status: 429 }),
      }),
    /429/,
  );
  await assert.rejects(
    () =>
      proposeArchitectAi(JSON.stringify(request), {
        env,
        fetcher: async () => Response.json({ candidates: [{ finishReason: "MAX_TOKENS" }] }),
      }),
    /incomplete/,
  );
});
