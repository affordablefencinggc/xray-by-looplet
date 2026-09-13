import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyQuantities, type ClassificationInput } from './classification.ts';
import { classificationPath, csvCell, filterQuantityReport, quantityReportCsv } from './report.ts';

export function reportFixture() {
  return classifyQuantities({ hierarchyId: 'User schedule', hierarchyRevision: 'B',
    nodes: [{ id: 'Building', label: 'Whole building', parentId: null }, { id: 'Walls', label: 'Wall finish', parentId: 'Building' }],
    items: [
      { id: 'a', quantity: '0.1', unit: 'm2', evidence: 'unverified', source: null },
      { id: 'b', quantity: '0.2', unit: 'm2', evidence: 'unverified', source: null },
      { id: 'c', quantity: '3', unit: 'lm', evidence: 'sample', source: null },
      { id: 'd', quantity: '4', unit: 'm2', evidence: 'inferred', source: null },
    ], assignments: [{ itemId: 'a', nodeId: 'Building' }, { itemId: 'b', nodeId: 'Walls' }, { itemId: 'c', nodeId: 'Walls' }],
  });
}

test('branch totals count actual parent-direct and child items once, with exact unit/evidence separation', () => {
  const full = reportFixture(), before = structuredClone(full);
  const branch = filterQuantityReport(full, { assignment: 'all', nodeId: 'Building' });
  assert.deepEqual(branch.rows.map(row => row.id), ['a', 'b', 'c']);
  assert.deepEqual(branch.totals.map(row => [row.unit, row.evidence, row.quantity]), [['m2', 'unverified', '0.3'], ['lm', 'sample', '3']]);
  assert.equal(branch.nodes[0].rollup[0].quantity, '0.3');
  assert.equal(branch.nodes[0].direct[0].quantity, '0.1');
  assert.equal(branch.nodes[1].rollup[0].quantity, '0.2');
  assert.deepEqual(classificationPath(full, 'Walls'), ['Building', 'Walls']);
  assert.deepEqual(full, before);
  assert.equal(branch.verifiedQuoteEligible, false);
});

test('assignment and descendant filters conserve the whole draft and handle zero matches', () => {
  const full = reportFixture();
  assert.deepEqual(filterQuantityReport(full, { assignment: 'unassigned', nodeId: '' }).rows.map(row => row.id), ['d']);
  const child = filterQuantityReport(full, { assignment: 'classified', nodeId: 'Walls' });
  assert.deepEqual(child.rows.map(row => row.id), ['b', 'c']);
  const empty = filterQuantityReport(full, { assignment: 'unassigned', nodeId: 'Building' });
  assert.deepEqual(empty.rows, []); assert.deepEqual(empty.totals, []);
  assert.equal(full.rows.length, 4); assert.equal(full.totals[0].quantity, '0.3');
  assert.throws(() => filterQuantityReport(full, { assignment: 'all', nodeId: 'missing' }), /unavailable/);
});

// CSV reader used to inspect exported records, including embedded newlines/quotes.
function parseCsv(csv: string): string[][] {
  const records: string[][] = []; let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (c === '"') { if (quoted && csv[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (c === ',' && !quoted) { row.push(cell); cell = ''; }
    else if (c === '\r' && csv[i + 1] === '\n' && !quoted) { row.push(cell); records.push(row); row = []; cell = ''; i++; }
    else cell += c;
  }
  assert.equal(quoted, false); return records;
}

test('CSV exports each filtered item once, no rollups, and preserves explicit unavailable source state', () => {
  const full = reportFixture(), records = parseCsv(quantityReportCsv(full));
  assert.equal(records.length, 5);
  assert.deepEqual(records.slice(1).map(row => row[2]), ['a', 'b', 'c', 'd']);
  assert.deepEqual(records[2].slice(3, 10), ['0.2', 'm2', 'unverified', 'Classified', 'Walls', '["Building","Walls"]', 'Unavailable']);
  assert.deepEqual(records[4].slice(6, 10), ['Unassigned', '', '[]', 'Unavailable']);
  assert.ok(records.slice(1).every(row => row[17] === 'false' && row[16] === 'draft-classification'));
  const subset = parseCsv(quantityReportCsv(filterQuantityReport(full, { assignment: 'unassigned', nodeId: '' })));
  assert.equal(subset.length, 2); assert.equal(subset[1][2], 'd');
});

test('CSV retains actual supplied source references, quoting labels and multiline cells safely', () => {
  const source = { documentId: '=document', sha256: 'a'.repeat(64), revision: 'R"2\ncontinued', sheet: 3, regionId: '@region', calibrationId: '-calibration' };
  const input: ClassificationInput = { hierarchyId: '+Hierarchy', hierarchyRevision: '1', nodes: [],
    items: [{ id: 'Item,"quoted"\nsecond line', quantity: '0.123456789012345678901', unit: 'm2', evidence: 'measured', source }], assignments: [] };
  const records = parseCsv(quantityReportCsv(classifyQuantities(input)));
  const row = records[1];
  assert.equal(records.length, 2); assert.equal(row[0], "'+Hierarchy");
  assert.equal(row[2], input.items[0].id); assert.equal(row[3], input.items[0].quantity);
  assert.deepEqual(row.slice(10, 16), ["'=document", source.sha256, source.revision, '3', "'@region", "'-calibration"]);
  assert.equal(row[5], 'measured'); assert.equal(row[9], 'Supplied reference; not independently verified');
  assert.equal(row[17], 'false');
});

test('spreadsheet formula prefixes are neutralised after whitespace, tabs and controls', () => {
  for (const prefix of ['', ' ', '\t', '\r\n', '\u0001', '\u007f', '\u00a0']) {
    for (const operator of ['=', '+', '-', '@']) assert.equal(csvCell(prefix + operator + 'cmd'), `"'${prefix}${operator}cmd"`);
  }
  assert.equal(csvCell('a,"b"\nc'), '"a,""b""\nc"');
  assert.equal(csvCell('0.1'), '"0.1"');
});

test('malformed provenance or broken classifications refuse export instead of silently dropping references', () => {
  const report = reportFixture();
  report.rows[0].nodeId = 'missing';
  assert.throws(() => quantityReportCsv(report), /Unknown classification/);
  const badSource = reportFixture();
  (badSource.rows[0] as unknown as { source: unknown }).source = { documentId: 'incomplete' };
  assert.throws(() => quantityReportCsv(badSource));
});
