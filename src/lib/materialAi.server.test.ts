import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  interpretMaterialAi,
  materialAiStatus,
  allowMaterialAiRequest,
} from "./materialAi.server.ts";
const fixture = JSON.parse(readFileSync("proof/audit/IW-AI-MATERIALS/fixture-result.json", "utf8"));
const env = { GEMINI_API_KEY: "unit-test-credential-not-live", XRAY_AI_WEB_ENABLED: "true" };
const bytes = Buffer.from([255, 216, 255, 217]);
const request = {
  schema: "xray.ai-materials/v1",
  requestId: "5c806de6-124e-4232-925b-0196c1258646",
  projectId: "QA",
  inventoryRevision: 2,
  sourceSha256: "a".repeat(64),
  page: 1,
  sourceName: "QA only.pdf",
  focus: "all materials",
  images: [
    {
      label: "Full page",
      box: { x: 0, y: 0, width: 1, height: 1 },
      sha256: createHash("sha256").update(bytes).digest("hex"),
      jpegBase64: bytes.toString("base64"),
    },
  ],
};
const raw = JSON.stringify(request),
  response = (result = fixture, finishReason = "STOP") =>
    Response.json({
      candidates: [{ finishReason, content: { parts: [{ text: JSON.stringify(result) }] } }],
    });
test("provider status exposes no credential and requires explicit web enable", () => {
  assert.equal(materialAiStatus({}).available, false);
  assert.equal(materialAiStatus({ GEMINI_API_KEY: env.GEMINI_API_KEY }).available, false);
  assert.equal(JSON.stringify(materialAiStatus(env)).includes(env.GEMINI_API_KEY), false);
  assert.equal(
    materialAiStatus({ ...env, XRAY_AI_MODEL: "https://evil.invalid" }).available,
    false,
  );
});
test("real adapter builds fixed-host image request and binds validated fixture result to source", async () => {
  let called = false;
  const r = await interpretMaterialAi(raw, {
    env,
    fetcher: async (url, init) => {
      called = true;
      assert.match(
        String(url),
        /^https:\/\/generativelanguage.googleapis.com\/v1beta\/models\/gemini-/,
      );
      assert.equal(init?.redirect, "error");
      const payload = JSON.parse(String(init?.body));
      assert.equal(payload.contents[0].parts[2].inlineData.mimeType, "image/jpeg");
      assert.equal(payload.generationConfig.responseFormat.text.mimeType, "APPLICATION_JSON");
      assert.match(payload.contents[0].parts[0].text, /untrusted/);
      return response();
    },
  });
  assert.equal(called, true);
  assert.equal(r.requestDigest, createHash("sha256").update(raw).digest("hex"));
  assert.equal(r.result.proposals.length, 2);
  assert.equal(JSON.stringify(r).includes(env.GEMINI_API_KEY), false);
});
test("absent credentials and altered image bytes fail before any network request", async () => {
  let called = false;
  const fetcher: typeof fetch = async () => {
    called = true;
    return response();
  };
  await assert.rejects(interpretMaterialAi(raw, { env: {}, fetcher }), /not configured/);
  await assert.rejects(
    interpretMaterialAi(
      JSON.stringify({ ...request, images: [{ ...request.images[0], sha256: "f".repeat(64) }] }),
      { env, fetcher },
    ),
    /integrity/,
  );
  assert.equal(called, false);
});
test("provider rejection, truncation and invalid numeric proposals never produce a run", async () => {
  await assert.rejects(
    interpretMaterialAi(raw, {
      env,
      fetcher: async () => new Response("private provider details", { status: 401 }),
    }),
    /HTTP 401/,
  );
  await assert.rejects(
    interpretMaterialAi(raw, { env, fetcher: async () => response(fixture, "MAX_TOKENS") }),
    /incomplete/,
  );
  await assert.rejects(
    interpretMaterialAi(raw, {
      env,
      fetcher: async () =>
        response({ ...fixture, proposals: [{ ...fixture.proposals[0], quantity: -2 }] }),
    }),
  );
});
test("single-flight prevents duplicate provider requests and releases after cancellation", async () => {
  const controller = new AbortController();
  let started!: () => void;
  const ready = new Promise<void>((r) => (started = r));
  const pending = interpretMaterialAi(raw, {
    env,
    signal: controller.signal,
    fetcher: async (_, init) => {
      started();
      return new Promise((_, reject) =>
        init?.signal?.addEventListener("abort", () => reject(Error("cancelled"))),
      );
    },
  });
  await ready;
  await assert.rejects(
    interpretMaterialAi(raw, { env, fetcher: async () => response() }),
    /already running/,
  );
  controller.abort();
  await assert.rejects(pending, /cancelled/);
  assert.equal(
    (await interpretMaterialAi(raw, { env, fetcher: async () => response() })).result.proposals
      .length,
    2,
  );
});
test("cross-site browser requests are rejected", () => {
  assert.equal(
    allowMaterialAiRequest(
      new Request("https://app.invalid/api/material-ai", {
        headers: { origin: "https://other.invalid" },
      }),
    ),
    false,
  );
  assert.equal(
    allowMaterialAiRequest(
      new Request("https://app.invalid/api/material-ai", {
        headers: { origin: "https://app.invalid", "sec-fetch-site": "same-origin" },
      }),
    ),
    true,
  );
});
