// Authorized local read-only check. No private source values are written into Git.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { parseFencingJob } from '../../../src/studio/domain.ts';
import { createCandidateFencingRecipeSet } from '../../../src/studio/fencingRecipes.ts';
import { compileBomRequest } from '../../../src/studio/bomCompiler.ts';
if (process.env.COMPUTERNAME?.toLowerCase() !== 'daniel') throw Error('Authorized DANIEL campaign only');
const root = 'C:/Users/danie/XRayPrivateProof/v1-boundaries';
const read = p => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
const hash = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const source = `${root}/boundaries-readonly-plan.json`;
const before = hash(source);
assert.equal(before, 'db89900883df6d0c0cc5f2f38c8d438abe1616707c251308dc9400ac73b3326e');
const job = read(`${root}/draft02/draft-job.json`);
parseFencingJob(job);
assert.equal(job.runs.length, 6);
assert.equal(job.gates.length, 2);
assert(job.calibrations.every(c => c.source === 'unverified' && !c.locked && c.knownDistanceM === null));
assert(job.runs.every(r => r.lengthM === 0));
assert(job.runs.every(r => r.specification.slope === 'unselected' && r.specification.ground === 'unselected'));
assert(job.runs.filter(r => r.specification.system === 'colorbond').every(r => r.specification.heightM === null));
assert(job.runs.filter(r => r.specification.system === 'timber-paling').every(r => r.specification.heightM === 1.8));
const recipes = await createCandidateFencingRecipeSet();
const result = await compileBomRequest({ job, recipeSet: recipes, runtimeAssets: { document: { state: 'ready', message: null }, photos: {} }, hydrationSettled: true, requestId: 'local-confirmed-unknowns' });
assert.equal(result.ok, false);
assert.equal(job.bom.length, 0);
assert.equal(job.quoteDraft, null);
assert.equal(hash(source), before);
const scenario = read(`${root}/draft02/scenario.json`);
scenario.unshift(['expect-cancelled-fetch', '{{ORIGIN}}/api/pricing-research', 8, 'PricingResearchPanel aborts its provider-status request on unmount (source lines 55–64); no asset or search failure is exempted.']);
const scenarioPath = `${root}/local-unknowns-scenario.json`;
fs.writeFileSync(scenarioPath, JSON.stringify(scenario, null, 2) + '\n', { flag: 'wx' });
fs.writeFileSync('proof/growth/2026-09-24-local-closeout/private-unknowns.json', JSON.stringify({
  host: process.env.COMPUTERNAME, at: new Date().toISOString(), decision: 'Keep missing measurements unknown',
  sourceSha256: before, sourceUnchanged: true, runs: job.runs.length, gates: job.gates.length,
  calibrationCount: job.calibrations.length, verifiedCalibrations: 0, allSlopesUnknown: true,
  colorbondHeightsUnknown: true, sourceTimberHeightsPreserved: true, bomAccepted: result.ok, blockerCount: result.issues.length,
  quote: null, scenarioPath, scenarioSha256: hash(scenarioPath),
  scriptSha256: hash(new URL(import.meta.url)),
}, null, 2) + '\n', { flag: 'wx' });
console.log(`PASS: source unchanged; six unverified runs, two gates, ${result.issues.length} compiler blockers; no BOM or quote`);
