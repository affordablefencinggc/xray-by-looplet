import { test } from "node:test";
import assert from "node:assert/strict";
import { captureConsole, createDiagnosticBuffer, diagnosticText } from "./diagnosticsBuffer.ts";

test("diagnostics bound entries and message bytes without retaining source objects", () => {
  const buffer = createDiagnosticBuffer(3), source = { value: "original" };
  buffer.append("info", "workspace", [source]); source.value = "changed";
  assert.match(buffer.snapshot()[0].message, /original/);
  for (let index = 0; index < 10; index++) buffer.append("log", "console", ["x".repeat(9000)]);
  assert.equal(buffer.snapshot().length, 3); assert.equal(buffer.snapshot()[0].message.length, 2000);
  buffer.clear(); assert.deepEqual(buffer.snapshot(), []);
  assert.throws(() => createDiagnosticBuffer(0)); assert.throws(() => createDiagnosticBuffer(201));
});
test("serialization does not execute getters or toJSON and handles cycles", () => {
  let calls = 0; const input: Record<string, unknown> = { toJSON() { calls++; } };
  Object.defineProperty(input, "secret", { enumerable: true, get() { calls++; throw Error("getter"); } });
  input.self = input; const result = diagnosticText([input]);
  assert.equal(calls, 0); assert.match(result, /Accessor/); assert.match(result, /Circular/);
  assert.match(diagnosticText([new Error("real failure")]), /real failure/);
});
test("console forwarding, nested capture and restoration preserve other wrappers", () => {
  const originalCalls: unknown[][] = [], captured: unknown[] = [];
  const original = (...args: unknown[]) => { originalCalls.push(args); };
  const target = { log: original, info: original, warn: original, error: original };
  const stop = captureConsole(target, (level, args) => { captured.push([level, ...args]); });
  target.error("actual error"); assert.deepEqual(originalCalls, [["actual error"]]); assert.equal(captured.length, 1);
  const own = target.log, later = (...args: unknown[]) => own(...args); target.log = later;
  stop(); assert.equal(target.log, later); assert.equal(target.error, original);
  target.log("after cleanup"); assert.equal(captured.length, 1); assert.equal(originalCalls.length, 2);
});
test("diagnostic recording cannot swallow original console exceptions", () => {
  const failure = Error("console failure"); const original = () => { throw failure; };
  const target = { log: original, info: original, warn: original, error: original };
  const stop = captureConsole(target, () => { throw Error("observer failure"); });
  assert.throws(() => target.log(), error => error === failure); stop();
});
test("a recorder logging again cannot recursively capture itself", () => {
  let forwarded = 0, captured = 0; const original = () => { forwarded++; };
  const target = { log: original, info: original, warn: original, error: original };
  const stop = captureConsole(target, () => { captured++; target.info(); });
  target.warn(); assert.equal(captured, 1); assert.equal(forwarded, 2); stop();
});
