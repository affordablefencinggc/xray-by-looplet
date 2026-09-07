import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { categories, sources } from '../../../planning/professional-coverage/catalogue.mjs';
import { industries } from '../../../planning/professional-coverage/industries.mjs';

const root = 'proof/audit/IW-PROFESSIONAL-NEXT';
const file = 'planning/professional-coverage/next-wave-audit.md';
const audit = readFileSync(file, 'utf8');
const validIds = new Set(categories.flatMap(c => c.items.map(i => i.id)));
const referencedIds = [...new Set(audit.match(/\b[A-Z]-\d{2}\b/g) ?? [])];
const invalidIds = referencedIds.filter(id => !validIds.has(id));
assert.deepEqual(invalidIds, [], 'Audit references unknown requirement IDs');
assert.equal(categories.length, 26);
assert.equal(validIds.size, 364);
assert.equal(industries.length, 68);
for (const category of categories) {
  assert(audit.includes(`| ${category.id}: ${category.id}-`), `Missing category ${category.id} depth gate`);
}
assert(!audit.includes('[x]'), 'Research must not mark product requirements complete');
const links = [...audit.matchAll(/\]\((https:\/\/[^)]+)\)/g)].map(m => m[1]);
const officialHosts = new Set([
  'docs.firecrawl.dev', 'help.aconex.com', 'support.bluebeam.com',
  'www.bentley.com', 'doc.esri.com', 'www.siemens.com', 'www.rib-software.com',
]);
for (const link of links) assert(officialHosts.has(new URL(link).hostname), `Unexpected source host: ${link}`);
assert(links.length >= 15);
const git = args => {
  const r = spawnSync('git', args, { encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
};
const result = {
  status: 'pass', checkedAt: new Date().toISOString(),
  branch: git(['branch', '--show-current']), baseline: git(['rev-parse', 'HEAD']),
  requirements: validIds.size, categories: categories.length, industryProfiles: industries.length,
  existingBenchmarkSources: sources.length, mappedRequirements: referencedIds.length,
  officialLinkedPages: new Set(links).size, categoryDepthGates: categories.length,
  productRowsCompleted: 0, liveProviderRequests: 0, externalMessages: 0,
  files: [file, `${root}/README.md`, `${root}/verify-audit.mjs`].map(path => ({
    path, sha256: createHash('sha256').update(readFileSync(path)).digest('hex'),
  })),
};
writeFileSync(`${root}/validation.json`, `${JSON.stringify(result, null, 2)}\n`);
const diff = spawnSync('git', ['diff', '--no-index', '--', 'NUL', file], {
  encoding: 'utf8', windowsHide: true, maxBuffer: 2e6,
});
assert([0, 1].includes(diff.status), diff.stderr);
writeFileSync(`${root}/audit.diff`, diff.stdout);
console.log(JSON.stringify(result, null, 2));
