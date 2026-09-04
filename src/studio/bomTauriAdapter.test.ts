import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { createTauriBomAdapter, type TauriInvoke } from "./bomTauriAdapter.ts";
import { runBomTransport } from "./bomTransport.ts";

const requestJson = JSON.stringify({ requestId: "request-1" });

describe("Tauri BOM adapter", () => {
  it("passes the exact inspected source bytes beside the request JSON", async () => {
    const calls: Array<{ command: string; args?: Record<string, unknown> }> = [];
    const invoke: TauriInvoke = async (command, args) => {
      calls.push({ command, args });
      return { ok: true };
    };
    const source = new Uint8Array([0, 1, 2, 127, 128, 255]);
    const adapter = createTauriBomAdapter(invoke, source);
    source.fill(9);
    await adapter.invoke(requestJson, { signal: new AbortController().signal, limits: { requestBytes: 1, responseBytes: 1, executionMs: 1 } });
    assert.deepEqual(calls, [{
      command: "xray_run_bom",
      args: { requestJson, sourceBytesBase64: "AAECf4D/" },
    }]);
  });

  it("uses the exact status command and fails before invoking when already aborted", async () => {
    const calls: string[] = [];
    const adapter = createTauriBomAdapter(async (command) => {
      calls.push(command);
      return { available: true };
    }, new Uint8Array([1]));
    assert.deepEqual(await adapter.status(), { available: true });
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(() => adapter.status(controller.signal), { name: "AbortError" });
    await assert.rejects(() => adapter.invoke(requestJson, { signal: controller.signal, limits: { requestBytes: 1, responseBytes: 1, executionMs: 1 } }), { name: "AbortError" });
    assert.deepEqual(calls, ["xray_bom_status", "xray_cancel_bom"]);
  });

  it("sends targeted cancellation while the matching invocation is pending", async () => {
    const calls: Array<{ command: string; args?: Record<string, unknown> }> = [];
    let release!: (value: unknown) => void;
    const pending = new Promise((resolve) => { release = resolve; });
    const adapter = createTauriBomAdapter(async (command, args) => {
      calls.push({ command, args });
      if (command === "xray_run_bom") return pending;
      return true;
    }, new Uint8Array([10, 20]));
    const controller = new AbortController();
    const invocation = adapter.invoke(requestJson, { signal: controller.signal, limits: { requestBytes: 1, responseBytes: 1, executionMs: 1 } });
    await Promise.resolve();
    controller.abort();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.deepEqual(calls[1], { command: "xray_cancel_bom", args: { requestId: "request-1" } });
    release({ ok: false });
    await invocation;
  });

  it("BR-012 BR-031 keeps concurrent cancellation keyed to only the matching request", async () => {
    const calls: Array<{ command: string; args?: Record<string, unknown> }> = [];
    const releases = new Map<string, (value: unknown) => void>();
    const adapter = createTauriBomAdapter(async (command, args) => {
      calls.push({ command, args });
      if (command !== "xray_run_bom") return true;
      const id = JSON.parse(String(args?.requestJson)).requestId as string;
      return new Promise((resolve) => { releases.set(id, resolve); });
    }, new Uint8Array([10, 20]));
    const firstAbort = new AbortController();
    const secondAbort = new AbortController();
    const firstJson = JSON.stringify({ requestId: "request-1" });
    const secondJson = JSON.stringify({ requestId: "request-2" });
    const first = adapter.invoke(firstJson, { signal: firstAbort.signal, limits: { requestBytes: 1, responseBytes: 1, executionMs: 1 } });
    const second = adapter.invoke(secondJson, { signal: secondAbort.signal, limits: { requestBytes: 1, responseBytes: 1, executionMs: 1 } });
    await Promise.resolve();
    firstAbort.abort();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(calls.filter(({ command }) => command === "xray_cancel_bom").length, 1);
    assert.deepEqual(calls.find(({ command }) => command === "xray_cancel_bom"), {
      command: "xray_cancel_bom",
      args: { requestId: "request-1" },
    });
    releases.get("request-1")?.({ ok: false });
    releases.get("request-2")?.({ ok: true });
    await Promise.all([first, second]);
    assert.equal(secondAbort.signal.aborted, false);
  });

  it("rejects an invalid request id without calling Tauri", async () => {
    let calls = 0;
    const adapter = createTauriBomAdapter(async () => { calls += 1; }, new Uint8Array());
    await assert.rejects(
      () => adapter.invoke("{}", { signal: new AbortController().signal, limits: { requestBytes: 1, responseBytes: 1, executionMs: 1 } }),
      /identifier is invalid/,
    );
    assert.equal(calls, 0);
  });

  it("BR-024 keeps BOM invocation on its own command and rejects null or absent results", async () => {
    const request = JSON.parse(await readFile(new URL("../../engine/fixtures/bom-contract/colorbond.request.json", import.meta.url), "utf8"));
    for (const [raw, expectedCode] of [[null, "response-contract"], [undefined, "missing-result"]] as const) {
      const commands: string[] = [];
      const adapter = createTauriBomAdapter(async (command) => {
        commands.push(command);
        return raw;
      }, new Uint8Array([1]));
      const result = await runBomTransport(request, adapter);
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.error.code, expectedCode);
      assert.deepEqual(commands, ["xray_run_bom"]);
      assert.equal(commands.includes("xray_import_plan"), false);
    }
  });
});
