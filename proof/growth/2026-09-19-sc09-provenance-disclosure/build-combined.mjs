/** Source-generation only. Execute the emitted, unweakened campaign on DANS1. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import provenance from './provenance-fragment.mjs';

const directory = dirname(fileURLToPath(import.meta.url));
const basePath = resolve(directory, '../2026-09-19-dashboard-refresh/qs-visual-audit.scenario.json');
const fragmentPath = resolve(directory, 'provenance-fragment.mjs');
const baseBytes = readFileSync(basePath);
const original = JSON.parse(baseBytes.toString('utf8'));
if (JSON.stringify(original.at(-1)) !== '["errors"]') {
  throw Error('Expected the existing visual campaign to end with its error assertion');
}
// Preserve every original assertion and add the touch disclosure/diagnostics
// checks immediately before the final browser error gate. No product mutation.
const combined = [...original.slice(0, -1), ...provenance, original.at(-1)];
const bytes = JSON.stringify(combined, null, 2) + '\n';
const hash = value => createHash('sha256').update(value).digest('hex');
writeFileSync(resolve(directory, 'combined.scenario.json'), bytes);
writeFileSync(resolve(directory, 'combined.source.json'), JSON.stringify({
  kind: 'source-generation-only-not-executed-proof',
  base: '../2026-09-19-dashboard-refresh/qs-visual-audit.scenario.json',
  baseSha256: hash(baseBytes),
  fragmentSha256: hash(readFileSync(fragmentPath)),
  scenarioSha256: hash(bytes),
  baseOperations: original.length,
  addedOperations: provenance.length,
  totalOperations: combined.length,
  captures: combined.filter(operation => operation[0] === 'screenshot').length,
  preservedOriginalAssertions: true,
}, null, 2) + '\n');
console.log(`Generated ${combined.length} operations; DANS1 execution remains required.`);
