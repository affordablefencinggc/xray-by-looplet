import { test } from "node:test";
import assert from "node:assert/strict";
import { cadBase64, cadBytes, convertCad, CAD_LIMIT } from "./cadTransport.ts";
test("binary CAD transport preserves bytes, including NUL and non-UTF8 data", () => {
  const bytes = Uint8Array.from({ length: 17000 }, (_, i) => i % 256);
  assert.deepEqual(cadBytes(cadBase64(bytes)), bytes);
});
test("CAD transport rejects empty, malformed and oversized payloads", () => {
  assert.throws(() => cadBase64(new Uint8Array()));
  assert.throws(() => cadBase64(new Uint8Array(CAD_LIMIT + 1)));
  assert.throws(() => cadBytes("not-base64!"));
  assert.throws(() => cadBytes("A".repeat(16000004)));
});
test("web conversion fails before any remote request", async () => {
  await assert.rejects(
    () => convertCad("to-dxf", new Uint8Array([1]), new AbortController().signal),
    /Windows desktop/,
  );
});
