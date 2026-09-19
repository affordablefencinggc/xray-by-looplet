import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createContext, runInContext, runInNewContext } from "node:vm";
import ts from "typescript";
import { BOOT_GUARD_SOURCE } from "./boot-guard.ts";

type ElementStub = {
  tagName: string; attributes: Record<string, string>; children: ElementStub[];
  textContent: string; style: { cssText: string }; readonly firstChild: ElementStub | null;
  setAttribute(name: string, value: string): void;
  appendChild(child: ElementStub): void; removeChild(child: ElementStub): void;
};
function element(tagName = "div"): ElementStub {
  return {
    tagName, attributes: {}, children: [], textContent: "", style: { cssText: "" },
    get firstChild() { return this.children[0] ?? null; },
    setAttribute(name, value) { this.attributes[name] = value; },
    appendChild(child) { this.children.push(child); },
    removeChild(child) { this.children.splice(this.children.indexOf(child), 1); },
  };
}
function execute(prelude = "", hostKind: "root" | "marked" | "body" | "none" = "root") {
  const host = element(), skeleton = element(); skeleton.textContent = "Opening your workspace"; host.appendChild(skeleton);
  const document = {
    getElementById: (id: string) => hostKind === "root" && id === "root" ? host : null,
    querySelector: (selector: string) => hostKind === "marked" && selector === "[data-boot-host]" ? host : null,
    body: hostKind === "none" ? null : host, createElement: element,
  };
  const context = createContext({ document });
  if (prelude) runInContext(prelude, context);
  runInContext(BOOT_GUARD_SOURCE, context);
  return { host, skeleton, context };
}
function panelText(host: ElementStub) { return host.children.flatMap(child => child.children).map(child => child.textContent).join(" "); }

test("BOOT-01 emitted inline script is byte-identical under different server/client compilation targets", () => {
  const moduleSource = readFileSync(new URL("./boot-guard.ts", import.meta.url), "utf8");
  const emitted = [ts.ScriptTarget.ES5, ts.ScriptTarget.ES2018, ts.ScriptTarget.ES2022].map(target => {
    const output = ts.transpileModule(moduleSource, { compilerOptions: { target, module: ts.ModuleKind.CommonJS, removeComments: target === ts.ScriptTarget.ES5 } }).outputText;
    const exports: { BOOT_GUARD_SOURCE?: string } = {};
    runInNewContext(output, { exports });
    return exports.BOOT_GUARD_SOURCE;
  });
  for (const source of emitted) assert.equal(source, BOOT_GUARD_SOURCE);
  assert.doesNotMatch(BOOT_GUARD_SOURCE, /<\/script/i);
});
test("BOOT-02 writable global leaves existing server content untouched", () => {
  const { host, skeleton, context } = execute();
  assert.deepEqual(host.children, [skeleton]); assert.equal(host.attributes["data-boot-failure"], undefined);
  assert.equal(runInContext("Object.getOwnPropertyDescriptor(Object.prototype, 'toString').writable", context), true);
});
test("BOOT-03 configurable read-only global is repaired before dependent code assigns to it", () => {
  const { host, context } = execute("Object.defineProperty(Object.prototype, 'toString', { writable: false, configurable: true });");
  assert.equal(host.attributes["data-boot-failure"], undefined);
  assert.equal(runInContext("Object.getOwnPropertyDescriptor(Object.prototype, 'toString').writable", context), true);
  assert.equal(runInContext("'use strict'; function Tree() {} Tree.prototype.toString = function () { return 'ready'; }; new Tree().toString();", context), "ready");
});
for (const hostKind of ["root", "marked", "body"] as const) {
  test(`BOOT-04 frozen global replaces the ${hostKind} startup host with an actionable failure`, () => {
    const { host, skeleton } = execute("Object.freeze(Object.prototype);", hostKind);
    assert.equal(host.attributes["data-boot-failure"], "globals"); assert.equal(host.children.length, 1);
    assert.ok(!host.children.includes(skeleton)); assert.equal(host.children[0].tagName, "main");
    assert.match(panelText(host), /X-Ray could not start/); assert.match(panelText(host), /not configurable/);
    assert.match(panelText(host), /Object\.prototype\.toString is writable/);
  });
}
test("BOOT-05 missing and non-function descriptor values paint the named failure", () => {
  for (const prelude of ["delete Object.prototype.toString;", "Object.defineProperty(Object.prototype, 'toString', { value: 7 });"]) {
    const { host } = execute(prelude); assert.equal(host.attributes["data-boot-failure"], "globals");
    assert.match(panelText(host), /missing or is not a method/);
  }
});
test("BOOT-06 descriptor inspection failure retains its diagnostic detail", () => {
  const { host } = execute("Object.getOwnPropertyDescriptor = function () { throw new Error('inspection denied'); };");
  assert.equal(host.attributes["data-boot-failure"], "globals"); assert.match(panelText(host), /inspection denied/);
});
test("BOOT-07 missing document hosts do not create a second uncaught error", () => {
  const { host } = execute("Object.freeze(Object.prototype);", "none");
  assert.equal(host.attributes["data-boot-failure"], undefined);
});
