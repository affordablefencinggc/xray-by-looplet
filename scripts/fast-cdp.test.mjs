import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { matchesExpectedCancellation, waitForFunctionSource } from "./fast-cdp.mjs";

const request = { url: "http://127.0.0.1:8080/api/pricing-research", method: "GET" };
const event = { canceled: true, errorText: "net::ERR_ABORTED", type: "Fetch" };
const expectation = { url: request.url, observed: 0, maximum: 2 };
test("only the reviewed exact GET fetch cancellation is recognized", () => {
  assert.equal(matchesExpectedCancellation(event, request, expectation), true);
  for (const altered of [{ canceled: false }, { errorText: "net::ERR_FAILED" }, { type: "Script" }, { type: "Stylesheet" }, { type: "Document" }]) {
    assert.equal(matchesExpectedCancellation({ ...event, ...altered }, request, expectation), false);
  }
  assert.equal(matchesExpectedCancellation(event, { ...request, method: "POST" }, expectation), false);
  assert.equal(matchesExpectedCancellation(event, { ...request, url: request.url + "?search=1" }, expectation), false);
  assert.equal(matchesExpectedCancellation(event, undefined, expectation), false);
  assert.equal(matchesExpectedCancellation(event, request, { ...expectation, observed: 2 }), false);
});

function runWait(predicate, values = {}, timeout = 500) {
  return runInNewContext(waitForFunctionSource(predicate, timeout), {
    ...values, document: {}, setTimeout, clearTimeout,
    requestAnimationFrame: fn => setTimeout(fn, 1), cancelAnimationFrame: clearTimeout,
    MutationObserver: class { observe() {} disconnect() {} },
  });
}
test("DOM-object readiness returns a serializable boolean, never the element graph", async () => {
  const node = {}; node.parent = node;
  assert.equal(await runWait("node", { node }), true);
});
test("asynchronous false predicates keep waiting until actual readiness", async () => {
  const counter = { calls: 0 };
  assert.equal(await runWait("async () => ++counter.calls >= 3", { counter }), true);
  assert.equal(counter.calls, 3);
});
test("asynchronous predicate rejection and deadline fail closed", async () => {
  await assert.rejects(runWait("async () => { throw Error('predicate failed'); }"), /predicate failed/);
  await assert.rejects(runWait("async () => false", {}, 25), /deadline/);
});
