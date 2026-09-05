import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readLedger,validate,render} from '../../../scripts/industry-ledger.mjs';
const original=readLedger();
test('current audit validates and feature evidence is embedded',()=>{assert.equal(validate(original).ok,true);assert.match(render(original),/id="audit-NEW-006"[\s\S]*?<img/);});
for(const [name,mutate]of [
 ['logs alone cannot pass',f=>{f.evidence=f.evidence.filter(e=>!e.screenshot);}],
 ['old capture cannot pass',f=>{f.evidence.find(e=>e.screenshot).screenshot.time='2020-01-01T00:00:00Z';}],
 ['wrong source hash cannot pass',f=>{f.evidence[0].inputDigest='0'.repeat(64);}],
 ['wrong run cannot pass',f=>{f.evidence[0].runId='previous-run';}],
 ['author cannot approve own feature',f=>{f.review.reviewer=f.owner;}],
 ['missing independent review cannot pass',f=>{delete f.review;}],
 ['missing required case cannot pass',f=>{f.requiredCaseIds.push('unexecuted');}],
 ['bad image dimensions cannot pass',f=>{f.evidence.find(e=>e.screenshot).screenshot.captureDimensions.width=1;}],
 ['inaccessible source report cannot pass',f=>{f.evidence.find(e=>e.screenshot).screenshot.reportPath='package.json';}],
 ['nonlocal image source metadata cannot pass',f=>{f.evidence.find(e=>e.screenshot).screenshot.url='javascript:alert(1)';}],
 ['template scenario cannot pass',f=>{f.scenarioTemplate=true;}],
 ['approval from previous revision cannot pass',f=>{f.review.revision=99;}],
 ['missing diff or tested baseline cannot pass',f=>{f.evidence=f.evidence.filter(e=>!['patch','tested-baseline'].includes(e.kind));}],
 ['missing proof classification cannot pass',f=>{delete f.proofClass;}],
 ['UI cannot pass with only backend report',f=>{f.proofClass='ui';}],
 ['generic screenshot cannot satisfy backend execution capture',f=>{delete f.evidence.find(e=>e.screenshot).screenshot.proofType;}],
 ])test(name,()=>{const d=structuredClone(original),f=d.fullFeatureAudit.features.find(f=>f.id==='NEW-006');mutate(f);assert.equal(validate(d).ok,false);});
test('exact feature ID preservation rejects substitution',()=>{const d=structuredClone(original);d.fullFeatureAudit.features[0].id='NEW-999';assert.equal(validate(d).ok,false);});
test('duplicate feature rejects even with unchanged count',()=>{const d=structuredClone(original);d.fullFeatureAudit.features[1].id=d.fullFeatureAudit.features[0].id;assert.equal(validate(d).ok,false);});
