import assert from "node:assert/strict";
import test from "node:test";
import { parseCargoProof } from "./sc07-cargo-result.mjs";

const summary = (count, failed = 0) => `test result: ${failed ? "FAILED" : "ok"}. ${count} passed; ${failed} failed; 0 ignored`;

test("Cargo proof accepts passing groups with every required raw-status test", () => {
  const text = ["test raw_success ... ok", "test raw_nonzero ... ok", summary(37), summary(0), summary(4)].join("\r\n");
  assert.deepEqual(parseCargoProof(text, "host.log", ["raw_success", "raw_nonzero"]), {
    resultGroups: 3, executed: 41, failed: 0,
  });
});

test("Cargo proof rejects an old otherwise passing log missing required tests", () => {
  assert.throws(() => parseCargoProof(summary(34), "old.log", ["raw_success"]), /lacks current passing test: raw_success/);
});

test("Cargo proof rejects missing results and zero executed tests", () => {
  assert.throws(() => parseCargoProof("", "empty.log"), /not a passing Cargo/);
  assert.throws(() => parseCargoProof(summary(0), "zero.log"), /did not execute any tests/);
});

test("Cargo proof rejects an earlier failure even when the final group passes", () => {
  assert.throws(() => parseCargoProof(`${summary(1, 1)}\n${summary(54)}`, "mixed.log"), /not a passing Cargo/);
});

test("Cargo proof requires the exact passed test line rather than substring/source presence", () => {
  for (const line of ["raw_success", "test raw_success ... FAILED", "test raw_success_extra ... ok", "comment: test raw_success ... ok"]) {
    assert.throws(() => parseCargoProof(`${line}\n${summary(1)}`, "partial.log", ["raw_success"]), /lacks current passing test/);
  }
});