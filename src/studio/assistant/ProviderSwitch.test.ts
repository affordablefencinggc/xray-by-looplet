import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(resolve('node_modules/.cache'), { recursive: true });
const dir = mkdtempSync(resolve('node_modules/.cache/provider-ui-'));
for (const name of ['ProviderSwitch.tsx', 'provider.ts']) {
  const source = readFileSync(join(here, name), 'utf8').replace('import "./providerSwitch.css";', '');
  writeFileSync(join(dir, name === 'provider.ts' ? 'provider.js' : 'ProviderSwitch.cjs'), ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }, fileName: name,
  }).outputText);
}
writeFileSync(join(dir, 'package.json'), '{"type":"commonjs"}');
const require = createRequire(import.meta.url);
const { ProviderOptions, ProviderSwitch } = require(join(dir, 'ProviderSwitch.cjs')) as typeof import('./ProviderSwitch');
const { useAssistantProvider } = require(join(dir, 'provider.js')) as typeof import('./provider');
after(() => rmSync(dir, { recursive: true, force: true }));

function options(native: boolean, provider: 'minimax' | 'gemini', disabled = false) {
  const chosen: string[] = [];
  const tree = ProviderOptions({ native, provider, disabled, onChoose: value => chosen.push(value) });
  const buttons = tree.props.children as React.ReactElement<{ disabled: boolean; onClick: () => void; 'aria-checked': boolean }>[];
  return { chosen, buttons, markup: renderToStaticMarkup(tree) };
}

test('native unsupported selection stays checked and cannot call a fallback provider', () => {
  const { buttons, chosen, markup } = options(true, 'minimax');
  assert.equal(buttons[0].props.disabled, true);
  assert.equal(buttons[0].props['aria-checked'], true);
  assert.equal(buttons[1].props['aria-checked'], false);
  buttons[0].props.onClick();
  assert.deepEqual(chosen, []);
  assert.match(markup, /Unavailable on desktop/);
  assert.match(markup, /selection is preserved/);
  buttons[1].props.onClick();
  assert.deepEqual(chosen, ['gemini'], 'only explicit supported selection changes provider');
});

test('web choices remain available and describe the actual capture scope', () => {
  const { buttons, chosen, markup } = options(false, 'gemini');
  assert.ok(buttons.every(button => !button.props.disabled));
  buttons[0].props.onClick();
  assert.deepEqual(chosen, ['minimax']);
  assert.match(markup, /visible 3D canvas captures, not full-screen screenshots/);
  assert.match(markup, /Choose a provider/);
});

test('an already open menu cannot change provider during a running turn', () => {
  const { buttons, chosen } = options(false, 'minimax', true);
  for (const button of buttons) { assert.equal(button.props.disabled, true); button.props.onClick(); }
  assert.deepEqual(chosen, []);
});

test('collapsed native control explains unavailable selected provider without changing stored choice', () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { value: { __TAURI_INTERNALS__: {} }, configurable: true });
  useAssistantProvider.setState({ provider: 'minimax' });
  try {
    const markup = renderToStaticMarkup(React.createElement(ProviderSwitch));
    assert.match(markup, /Provider: MiniMax\. Unavailable in this desktop build\. Change provider/);
    assert.match(markup, />Unavailable<\/span>/);
    assert.equal(useAssistantProvider.getState().provider, 'minimax');
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
