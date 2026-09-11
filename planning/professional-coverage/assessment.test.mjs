import test from 'node:test';
import assert from 'node:assert/strict';
import { readAssessment } from './assessment.mjs';
const row='- [x] **B-07 Archive projects** — Restore intact. State: verified. Code: src/studio/projectArchive.ts. Proof: proof/growth/library/README.md.';
test('report keeps exact reviewed state, tick and evidence references',()=>{
  const value=readAssessment(row,['B-07']).rows.get('B-07');
  assert.equal(value.state,'verified');assert.equal(value.checked,true);
  assert.deepEqual(value.code,['src/studio/projectArchive.ts']);assert.deepEqual(value.evidence,['proof/growth/library/README.md']);
});
test('missing, duplicate, unknown and falsely checked requirements fail closed',()=>{
  for(const [text,ids] of [[row,[]],[row,['B-07','B-08']],[row+'\n'+row,['B-07']],[row.replace('verified','partial'),['B-07']],[row.replace('verified','invented'),['B-07']]])assert.throws(()=>readAssessment(text,ids));
});
test('an unchecked recorded assessment is never promoted to checked',()=>{
  assert.equal(readAssessment(row.replace('[x]','[ ]'),['B-07']).rows.get('B-07').checked,false);
});
