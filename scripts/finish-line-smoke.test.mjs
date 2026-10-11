import test from "node:test";
import assert from "node:assert/strict";
import { parseSmokeConfig, pollReady, previewEnvFromUrl } from "./finish-line-smoke.mjs";

test("parseSmokeConfig: defaults", () => {
  const config = parseSmokeConfig([], {});
  assert.equal(config.url, "http://127.0.0.1:8081/");
  assert.equal(config.startServer, true);
  assert.equal(config.timeoutMs, 90_000);
  assert.ok(config.outPng.endsWith("finish-line-smoke.png"));
});

test("parseSmokeConfig: env overrides and flags", () => {
  const fromEnv = parseSmokeConfig([], {
    BROWSER_SMOKE_URL: "http://127.0.0.1:9999/",
    BROWSER_SMOKE_NO_SERVER: "1",
    BROWSER_SMOKE_SERVER_TIMEOUT_MS: "1234",
  });
  assert.equal(fromEnv.url, "http://127.0.0.1:9999/");
  assert.equal(fromEnv.startServer, false);
  assert.equal(fromEnv.timeoutMs, 1234);

  const fromFlags = parseSmokeConfig(
    ["--url", "http://localhost:8081/", "--out-png", "shots/x.png", "--timeout-ms", "5"],
    {},
  );
  assert.equal(fromFlags.url, "http://localhost:8081/");
  assert.equal(fromFlags.outPng, "shots/x.png");
  assert.equal(fromFlags.timeoutMs, 5);
});

test("parseSmokeConfig: rejects unknown flags and missing values", () => {
  assert.match(parseSmokeConfig(["--wat"], {}).error, /unknown flag/);
  assert.match(parseSmokeConfig(["--url"], {}).error, /requires a value/);
});

test("pollReady: resolves once the server answers, retries while it does not", async () => {
  let calls = 0;
  const fakeFetch = async () => {
    calls += 1;
    if (calls < 3) throw new Error("connection refused");
    return { status: 200 };
  };
  const result = await pollReady("http://127.0.0.1:8081/", 2_000, fakeFetch, 1);
  assert.deepEqual(result, { ok: true, status: 200 });
  assert.equal(calls, 3);
});

test("pollReady: times out when nothing answers", async () => {
  const fakeFetch = async () => {
    throw new Error("connection refused");
  };
  const result = await pollReady("http://127.0.0.1:8081/", 5, fakeFetch, 1);
  assert.deepEqual(result, { ok: false });
});

test("previewEnvFromUrl: derives PREVIEW_HOST/PREVIEW_PORT for the SSR preview", () => {
  // The recovered preview (scripts/preview-built.mjs) reads env only — no CLI
  // flags — so a non-default --url must become the bind address it polls.
  assert.deepEqual(previewEnvFromUrl("http://127.0.0.1:9090/"), {
    PREVIEW_HOST: "127.0.0.1",
    PREVIEW_PORT: "9090",
  });
  assert.equal(previewEnvFromUrl("http://localhost:8081/", { CI: "1" }).CI, "1");
  assert.equal(previewEnvFromUrl("http://localhost:8081/").PREVIEW_HOST, "localhost");
  // No port in the URL falls back to the recovered preview's own default.
  assert.equal(previewEnvFromUrl("http://127.0.0.1/").PREVIEW_PORT, "8081");
  assert.equal(previewEnvFromUrl("http://127.0.0.1/").PREVIEW_HOST, "127.0.0.1");
});