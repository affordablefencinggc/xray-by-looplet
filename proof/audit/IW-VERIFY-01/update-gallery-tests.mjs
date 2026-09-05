import {readFileSync,writeFileSync} from 'node:fs';
let s=readFileSync('scripts/industry-ledger.test.mjs','utf8');
s=s.replace("rejects(d=>d.tasks[0].status='verified',/missing patch evidence", "rejects(d=>{d.tasks[0].status='verified';d.tasks[0].evidence=[];d.tasks[0].review=null;},/missing patch evidence");
s=s.replace("assert.equal(validate(d).ok,true);t.review.inputDigest='old';", "const capture=structuredClone(d.tasks.find(t=>t.id==='IW-004').evidence.find(e=>e.kind==='execution-capture'));capture.revision=t.revision;capture.inputDigest=digest;t.evidence.push(capture);assert.equal(validate(d).ok,true,JSON.stringify(validate(d)));t.review.inputDigest='old';");
writeFileSync('scripts/industry-ledger.test.mjs',s);
