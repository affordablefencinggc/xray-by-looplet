import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, delimiter } from 'node:path';
import { bomBuildRequestSchema, computeBomInputDigest, type BomBuildRequest } from './bomContract.ts';
import { buildBom, deriveBomFacts } from './bomRules.ts';
import { changeRecipeBayLayout, createCandidateFencingRecipeSet, acceptRecipeAssumption, verifyRecipeSetDigest } from './fencingRecipes.ts';
import { saveFencingRecipeSet, loadFencingRecipeSet } from './fencingRecipePersistence.ts';

const original = () => bomBuildRequestSchema.parse(JSON.parse(readFileSync(new URL('../../engine/fixtures/bom-contract/colorbond.request.json', import.meta.url), 'utf8')));
async function request(length: number, gateWidth = 0) {
  const r = original();
  r.recipeSet.recipes[0].bayLayout = 'full-bays-terminal-cut';
  r.runs[0].segments[0].lengthMm = length;
  r.runs[0].storedLengths = { grossMm: length, gateDeductionMm: gateWidth, netMm: length - gateWidth };
  if (!gateWidth) r.gates = [];
  else {
    r.gates[0].widthMm = gateWidth;
    r.recipeSet.recipes[0].gateHardwareModels[0].widthMm = gateWidth;
  }
  r.inputDigest = await computeBomInputDigest(r);
  return r;
}
function python(r: BomBuildRequest) {
  const p = spawnSync(process.env.XRAY_PYTHON || (process.platform === 'win32' ? 'python.exe' : 'python3'), ['-c', 'import json,sys;from xray.job_bom import build_bom;json.dump(build_bom(json.load(sys.stdin)),sys.stdout)'], {
    input: JSON.stringify(r), encoding: 'utf8', timeout: 10000, windowsHide: true,
    env: { ...process.env, PYTHONPATH: [resolve('engine/python'), process.env.PYTHONPATH].filter(Boolean).join(delimiter), PYTHONIOENCODING: 'utf-8' },
  });
  assert.equal(p.status, 0, p.stderr || p.error?.message);
  return JSON.parse(p.stdout);
}
for (const [length, gate, expected] of [
  [5000, 0, [2400, 2400, 200]],
  [4800, 0, [2400, 2400]],
  [100, 0, [100]],
  [10000, 2000, [2400, 600, 2400, 2400, 200]],
  [10000, 2001, [2400, 599.5, 2400, 2400, 199.5]],
] as const) {
  test(`modular set-out ${length}mm, gate ${gate}mm: conserved lengths and Python parity`, async () => {
    const r = await request(length, gate);
    const facts = deriveBomFacts(r).get(r.recipeSet.recipes[0].id)!;
    assert.deepEqual(facts.bayLengthsMm, expected);
    assert.equal(facts.bayLengthsMm.reduce((a,b) => a+b, 0), length - gate);
    assert.ok(facts.bayLengthsMm.every(x => x > 0 && x <= 2400));
    const result = await buildBom(r);
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.bom.ruleset.version, 1);
    assert.deepEqual(python(r), result);
  });
}
test('legacy recipe omits layout and retains its frozen golden result', async () => {
  const r = original();
  assert.equal(r.recipeSet.recipes[0].bayLayout, undefined);
  const result = await buildBom(r);
  assert.deepEqual(result, JSON.parse(readFileSync(new URL('../../engine/fixtures/bom-contract/colorbond.response.json', import.meta.url), 'utf8')));
  assert.deepEqual(python(r), result);
});
test('corners terminate modular spans and share one physical corner post', async () => {
  const r = await request(5000);
  r.runs[0].segments = [{ index:0, lengthMm:2500 }, { index:1, lengthMm:2500 }];
  r.runs[0].vertices = [r.runs[0].vertices[0],
    { index:1, topologyNodeId:'sheet:0:x:2.5:y:0', cornerTreatment:'standard', postOverride:null },
    { ...r.runs[0].vertices[1], index:2, topologyNodeId:'sheet:0:x:2.5:y:2.5' }];
  r.inputDigest = await computeBomInputDigest(r);
  const facts = deriveBomFacts(r).get(r.recipeSet.recipes[0].id)!;
  assert.deepEqual(facts.bayLengthsMm, [2400,100,2400,100]);
  assert.equal(facts.postRoles.corner, 1);
  assert.equal(Object.values(facts.postRoles).reduce((a,b) => a+b,0), 5);
  assert.deepEqual(python(r), await buildBom(r));
});
test('unknown layout fails closed in both kernels', async () => {
  const r = await request(5000);
  Object.assign(r.recipeSet.recipes[0], { bayLayout: 'guess' });
  r.inputDigest = await computeBomInputDigest(r);
  assert.equal((await buildBom(r)).ok, false);
  assert.equal(python(r).ok, false);
});
test('switching layout preserves old recipe, clears approvals, changes digest and survives storage', async () => {
  let previous = await createCandidateFencingRecipeSet();
  assert.equal(previous.recipes[0].bayLayout, 'full-bays-terminal-cut');
  assert.equal(previous.recipes[1].bayLayout ?? 'equal', 'equal');
  previous = (await acceptRecipeAssumption(previous, { recipeId: previous.recipes[0].id, assumptionId: 'cb-spacing', expectedSetRevision: previous.revision, expectedRecipeRevision: previous.recipes[0].revision, actor: 'QA estimator', at: '2026-09-13T06:00:00Z' })).recipeSet;
  const frozen = structuredClone(previous);
  const input = { recipeId: previous.recipes[0].id, expectedSetRevision: previous.revision, expectedRecipeRevision: previous.recipes[0].revision, actor: 'QA estimator', at: '2026-09-13T06:01:00Z', layout: 'equal' as const };
  const next = await changeRecipeBayLayout(previous, input);
  assert.deepEqual(previous, frozen);
  assert.equal(next.revision, previous.revision + 1);
  assert.equal(next.recipes[0].revision, previous.recipes[0].revision + 1);
  assert.ok(next.recipes[0].assumptions.every(a => a.status === 'unresolved' && a.acceptedBy === null));
  assert.notEqual(next.digest, previous.digest);
  assert.equal(await verifyRecipeSetDigest(next), true);
  const data = new Map<string,string>();
  const storage = { getItem: (key:string) => data.get(key) ?? null, setItem: (key:string,value:string) => { data.set(key,value); } };
  assert.deepEqual(await saveFencingRecipeSet('qa-bays', next, storage), { ok:true });
  assert.deepEqual(await loadFencingRecipeSet('qa-bays', storage), { ok:true, recipeSet:next });
  await assert.rejects(changeRecipeBayLayout(next, input), /changed/);
  await assert.rejects(changeRecipeBayLayout(previous, {...input,actor:''}), /named estimator/);
});
