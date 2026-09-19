import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Execute the actual exported handler from the component. DOM focus, layout and
// native modal behaviour are additionally exercised by the DANS1 raw-CDP proof.
const source = readFileSync(new URL("./QSWorksheet.tsx", import.meta.url), "utf8");
const tree = ts.createSourceFile("QSWorksheet.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declaration = tree.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === "keepQsComparisonFocus");
assert.ok(declaration, "comparison keyboard handler must remain present");
const javascript = ts.transpileModule(declaration.getText(tree), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const scope = { exports: {} as Record<string, (event: unknown) => void> };
runInNewContext(javascript, scope);
const handle = scope.exports.keepQsComparisonFocus;

type Control = {
  name: string; tabIndex: number; disabled: boolean; hidden: boolean; inert: boolean; ariaHidden: boolean;
  visibleRect: boolean; visibility: string; ownerDocument: DocumentStub;
  matches(selector: string): boolean; closest(selector: string): unknown;
  getClientRects(): unknown[]; focus(): void;
};
type DocumentStub = { activeElement: unknown; defaultView: { getComputedStyle(element: Control): { visibility: string } } };

function fixture() {
  const document: DocumentStub = { activeElement: null, defaultView: { getComputedStyle: element => ({ visibility: element.visibility }) } };
  const controls: Control[] = [];
  const add = (name: string, changes: Partial<Control> = {}) => {
    const element: Control = { name, tabIndex: 0, disabled: false, hidden: false, inert: false, ariaHidden: false, visibleRect: true, visibility: "visible", ownerDocument: document,
      matches: selector => selector === ":disabled" && element.disabled,
      closest: () => element.hidden || element.inert || element.ariaHidden ? {} : null,
      getClientRects: () => element.visibleRect ? [{}] : [], focus: () => { document.activeElement = element; }, ...changes };
    controls.push(element);
    return element;
  };
  const dialog = { open: true, ownerDocument: document,
    querySelectorAll: (selector: string) => { assert.match(selector, /\[tabindex\]/, "read-only scroll regions stay keyboard reachable"); return controls; },
    contains: (element: unknown) => element === dialog || controls.includes(element as Control) };
  const key = (changes: Record<string, unknown> = {}) => {
    const event = { currentTarget: dialog, key: "Tab", shiftKey: false, altKey: false, ctrlKey: false, metaKey: false, defaultPrevented: false,
      preventDefault() { event.defaultPrevented = true; }, ...changes };
    handle(event);
    return event;
  };
  return { document, controls, add, dialog, key };
}

test("SC10 focus: forward Tab wraps from the read-only change table to Close", () => {
  const f = fixture(), close = f.add("Close"); f.add("Earlier revision"); f.add("Later revision");
  const table = f.add("Read-only scroll region"); f.document.activeElement = table;
  assert.equal(f.key().defaultPrevented, true);
  assert.equal(f.document.activeElement, close);
});

test("SC10 focus: reverse Tab wraps first control to the last reachable region", () => {
  const f = fixture(), close = f.add("Close"), table = f.add("Read-only scroll region");
  f.document.activeElement = close;
  assert.equal(f.key({ shiftKey: true }).defaultPrevented, true);
  assert.equal(f.document.activeElement, table);
});

test("SC10 focus: hidden, disabled, inert and negative tabindex controls are not boundaries", () => {
  const f = fixture();
  f.add("disabled first", { disabled: true }); f.add("negative", { tabIndex: -1 });
  f.add("hidden ancestor", { hidden: true }); f.add("inert ancestor", { inert: true }); f.add("aria-hidden ancestor", { ariaHidden: true });
  f.add("no layout", { visibleRect: false }); f.add("visibility hidden", { visibility: "hidden" }); f.add("visibility collapse", { visibility: "collapse" });
  const close = f.add("Close"), table = f.add("Read-only scroll region"); f.add("disabled last", { disabled: true });
  f.document.activeElement = table; assert.equal(f.key().defaultPrevented, true); assert.equal(f.document.activeElement, close);
  f.document.activeElement = close; assert.equal(f.key({ shiftKey: true }).defaultPrevented, true); assert.equal(f.document.activeElement, table);
});

test("SC10 focus: interior Tab keeps native order and positive tabindex stays ahead of normal controls", () => {
  const f = fixture(), close = f.add("Close"), later = f.add("Later");
  const second = f.add("second", { tabIndex: 2 }), first = f.add("first", { tabIndex: 1 });
  f.document.activeElement = close; assert.equal(f.key().defaultPrevented, false); assert.equal(f.document.activeElement, close);
  f.document.activeElement = later; assert.equal(f.key().defaultPrevented, true); assert.equal(f.document.activeElement, first);
  f.document.activeElement = second; assert.equal(f.key({ shiftKey: true }).defaultPrevented, false);
});

test("SC10 focus: a single control stays reachable in either direction", () => {
  const f = fixture(), close = f.add("Close");
  f.document.activeElement = close;
  assert.equal(f.key().defaultPrevented, true); assert.equal(f.document.activeElement, close);
  assert.equal(f.key({ shiftKey: true }).defaultPrevented, true); assert.equal(f.document.activeElement, close);
});

test("SC10 focus: Escape, modified Tab, cancelled events and closed dialogs are never trapped", () => {
  const f = fixture(), close = f.add("Close"); f.document.activeElement = close;
  for (const changes of [{ key: "Escape" }, { key: "ArrowDown" }, { altKey: true }, { ctrlKey: true }, { metaKey: true }])
    assert.equal(f.key(changes).defaultPrevented, false);
  const cancelled = f.key({ defaultPrevented: true }); assert.equal(cancelled.defaultPrevented, true); assert.equal(f.document.activeElement, close);
  f.dialog.open = false; assert.equal(f.key().defaultPrevented, false);
});

test("SC10 focus: open modal fallback does not let Tab leave if its controls disappear", () => {
  const f = fixture(); f.document.activeElement = f.dialog;
  assert.equal(f.key().defaultPrevented, true);
  const close = f.add("Close"); f.document.activeElement = f.dialog;
  assert.equal(f.key().defaultPrevented, true); assert.equal(f.document.activeElement, close);
});

test("SC10 focus: handler is wired to this dialog and native cancel/close restoration is retained", () => {
  assert.match(source, /<dialog[^>]*onKeyDown=\{keepQsComparisonFocus\}/);
  assert.match(source, /onCancel=\{event => \{ event\.preventDefault\(\); setComparisonOpen\(false\); \}\}/);
  assert.match(source, /onClose=\{\(\) => \{ setComparisonOpen\(false\); comparisonTrigger\.current\?\.focus\(\); \}\}/);
});
