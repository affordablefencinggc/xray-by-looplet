import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import type { QuantityForm } from './quantityForm.ts';

const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(resolve('node_modules/.cache'), { recursive: true });
const dir = mkdtempSync(resolve('node_modules/.cache/quantity-report-'));
for (const name of ['classification.ts', 'quantityForm.ts', 'report.ts', 'QuantityReportView.tsx', 'QuantityDraftPanel.tsx']) {
  const code = ts.transpileModule(readFileSync(join(here, name), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }, fileName: name,
  }).outputText.replace(/require\("\.\/(\w+)(?:\.ts)?"\)/g, 'require("./$1.cjs")');
  writeFileSync(join(dir, name.replace(/\.tsx?$/, '.cjs')), code);
}
const require = createRequire(import.meta.url);
const { QuantityDraftPanel } = require(join(dir, 'QuantityDraftPanel.cjs')) as typeof import('./QuantityDraftPanel');
after(() => rmSync(dir, { recursive: true, force: true }));
const form: QuantityForm = { hierarchyId: 'QA', hierarchyRevision: '1', calculated: true,
  nodes: [{ key: 'r', code: 'Building', label: 'Building work', parentKey: '' }, { key: 'w', code: 'Walls', label: 'Wall finishes', parentKey: 'r' }],
  items: [{ key: 'a', reference: 'Item A', quantity: '0.1', unit: 'm2', evidence: 'unverified', nodeKey: 'w' },
    { key: 'b', reference: 'Item B', quantity: '0.2', unit: 'm2', evidence: 'unverified', nodeKey: '' }] };
const render = (value: QuantityForm, disabled = false) => renderToStaticMarkup(React.createElement(QuantityDraftPanel, { value, disabled, onChange() {} }));

test('real worksheet renders separated report totals, item rows, filters and expandable hierarchy', () => {
  const html = render(form);
  assert.match(html, /Whole draft totals/); assert.match(html, /Shown item totals/);
  assert.match(html, /<td>0\.3<\/td><td>0\.1<\/td><td>0\.2<\/td>/);
  assert.match(html, /Show quantities<select/); assert.match(html, /Unassigned items/);
  assert.match(html, /Classification branch<select/);
  assert.match(html, /<details><summary>Explore classification hierarchy/);
  assert.match(html, /<details><summary>Building/); assert.match(html, /<details><summary>Walls/);
  assert.match(html, /Unavailable — manual entry/);
  assert.equal((html.match(/<th scope="row">Item [AB]<\/th>/g) ?? []).length, 2, 'actual report item rows are not duplicated by ancestors');
});

test('stale or invalid form never exposes a downloadable result', () => {
  assert.doesNotMatch(render({ ...form, calculated: false }), /Download shown item rows/);
  assert.doesNotMatch(render({ ...form, items: [{ ...form.items[0], quantity: 'bad' }] }), /Download shown item rows/);
});

test('locked worksheet cannot download while host writes are unavailable', () => {
  assert.match(render(form, true), /<button type="button" disabled="">Download shown item rows \(CSV\)<\/button>/);
});
