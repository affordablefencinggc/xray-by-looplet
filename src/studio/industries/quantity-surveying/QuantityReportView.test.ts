import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { INDUSTRY_SOURCE_BINDING_SCHEMA, createIndustrySourceBinding, type IndustrySourceState } from '../sourceBinding.ts';
import type { QuantityForm } from './quantityForm.ts';

const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(resolve('node_modules/.cache'), { recursive: true });
const dir = mkdtempSync(resolve('node_modules/.cache/quantity-report-'));
// The worksheet panel imports the shared source-binding contract from the parent directory, so that
// module is transpiled too and its relative require is rewritten alongside the same-directory ones.
for (const name of ['classification.ts', 'quantityForm.ts', 'report.ts', 'qsReportFormatter.ts', 'qsItemBinding.ts', 'QSItemBindingLedger.tsx', 'QSReportPanel.tsx', 'QuantityReportView.tsx', 'QuantityDraftPanel.tsx', '../sourceBinding.ts']) {
  const code = ts.transpileModule(readFileSync(join(here, name), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }, fileName: name,
  }).outputText.replace(/require\("(?:\.\/|\.\.\/)(\w+)(?:\.tsx?)?"\)/g, 'require("./$1.cjs")');
  writeFileSync(join(dir, basename(name).replace(/\.tsx?$/, '.cjs')), code);
}
const require = createRequire(import.meta.url);
const { QuantityDraftPanel } = require(join(dir, 'QuantityDraftPanel.cjs')) as typeof import('./QuantityDraftPanel');
after(() => rmSync(dir, { recursive: true, force: true }));
const form: QuantityForm = { hierarchyId: 'QA', hierarchyRevision: '1', calculated: true,
  nodes: [{ key: 'r', code: 'Building', label: 'Building work', parentKey: '' }, { key: 'w', code: 'Walls', label: 'Wall finishes', parentKey: 'r' }],
  items: [{ key: 'a', reference: 'Item A', quantity: '0.1', unit: 'm2', evidence: 'unverified', nodeKey: 'w' },
    { key: 'b', reference: 'Item B', quantity: '0.2', unit: 'm2', evidence: 'unverified', nodeKey: '' }] };
const render = (value: QuantityForm, disabled = false,
  source: IndustrySourceState = { projectId: 'p1', sourceRevision: null, calibrationId: null }) =>
  renderToStaticMarkup(React.createElement(QuantityDraftPanel, { value, disabled, source, onChange() {} }));

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

// --- QS-03: the source binding block ---

const SHA = 'a'.repeat(64);
const SOURCE: IndustrySourceState = { projectId: 'p1', sourceRevision: { id: 'rev-1', sha256: SHA }, calibrationId: 'cal-1' };
const BINDING = createIndustrySourceBinding({ schema: INDUSTRY_SOURCE_BINDING_SCHEMA, projectId: 'p1',
  sourceRevisionId: 'rev-1', sha256: SHA, sourceName: 'rev-1', locator: { kind: 'page', pageIndex: 2 },
  calibrationId: 'cal-1', units: 'm', evidenceClass: 'traced', reference: 'Sheet A-201 north plane', boundAt: '2026-09-16T02:00:00.000Z' });

test('a project with no current source revision disables binding with a readable explanation', () => {
  const html = render(form, false, { projectId: 'p1', sourceRevision: null, calibrationId: null });
  assert.match(html, /Source binding/);
  assert.match(html, /No project source revision is available to bind to/);
  assert.match(html, /<button type="button" disabled="">Bind to current project source<\/button>/);
});

test('an unbound worksheet shows explicit, unpopulated binding inputs from the live source', () => {
  const html = render(form, false, SOURCE);
  assert.match(html, /Source page index \(0-based\)<input inputMode="numeric" maxLength="12" value=""/);
  assert.match(html, /Choose length unit/);
  assert.match(html, /Choose evidence class/);
  assert.match(html, /<button type="button">Bind to current project source<\/button>/);
  assert.match(html, /Not bound to a project source/);
});

test('a bound worksheet shows its reference, evidence, source and current status', () => {
  const html = render({ ...form, binding: BINDING }, false, SOURCE);
  assert.match(html, /Reference: Sheet A-201 north plane/);
  assert.match(html, /Evidence class: traced/);
  assert.match(html, /Source-derived traced evidence/);
  assert.match(html, /Bound to the current source revision/);
  assert.match(html, /<button type="button">Clear binding<\/button>/);
});

test('a stale binding withholds the report and names the reason instead of showing totals', () => {
  const html = render({ ...form, binding: BINDING }, false, { projectId: 'p1', sourceRevision: null, calibrationId: null });
  assert.match(html, /Classification report withheld/);
  assert.match(html, /no longer in the project/);
  assert.doesNotMatch(html, /Download shown item rows/);
  assert.doesNotMatch(html, /Whole draft totals/);
});

test('an unbound worksheet still presents its unverified report exactly as before', () => {
  const html = render(form, false, SOURCE);
  assert.match(html, /Whole draft totals/);
  assert.match(html, /Draft classification · Not for verified quotes/);
});
