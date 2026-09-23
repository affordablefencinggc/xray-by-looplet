import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import assert from 'node:assert/strict';
if(process.env.COMPUTERNAME?.toLowerCase()!=='dans1')throw Error('DANS1 only');
const base='proof/growth/2026-09-23-fencing-cutting';
const read=path=>readFileSync(path,'utf8');
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const sources=JSON.parse(read(base+'/source-hashes-05.json'));
for(const row of sources)assert.equal(hash(row.path),row.sha256,row.path);
const result=JSON.parse(read(base+'/fencing-checks-04/result.json'));
for(const key of ['tests','typecheck','lint','fixture'])assert.equal(result[key],0,key);
const log=read(base+'/fencing-checks-04/source-tests.log');
const passed=[...log.matchAll(/^(?:#|ℹ) pass (\d+)\s*$/gm)].reduce((sum,m)=>sum+Number(m[1]),0);
const failed=[...log.matchAll(/^(?:#|ℹ) fail (\d+)\s*$/gm)].reduce((sum,m)=>sum+Number(m[1]),0);
assert.equal(passed,1964); assert.equal(failed,0);
const browser=JSON.parse(read(base+'/v1-stock-dev05/browser-results.json'));
assert.equal(browser.completedOperations,157);assert.equal(browser.verdict,'PASS');assert.equal(browser.browserErrors.length,0);
for(const image of browser.screenshots)assert.equal(hash(base+'/v1-stock-dev05/'+image.file),image.sha256);
const exports=JSON.parse(read(base+'/exports/export-verdict.json'));
assert.equal(exports.verdict,'PASS');for(const file of exports.files)assert.equal(hash(base+'/exports/'+file.name),file.sha256);
let links=0;
for(const name of ['README.md','steps/SC-07-stock-cutting.md','steps/SC-09-pricing-coverage.md']) {
 const file=base+'/'+name;
 for(const match of read(file).matchAll(/\]\(([^)]+)\)/g)) {
  if(/^https?:/.test(match[1]))continue;
  const target=resolve(dirname(file),match[1]);
  if(target!==resolve(base,'checkpoint-audit.json'))assert.ok(existsSync(target),match[1]);
  links++;
 }
}
const ledger=read('V1-INDUSTRY-FENCING-TODO.md');
const open=ledger.split(/\r?\n/).filter(line=>line.startsWith('- [ ]'));
assert.equal(open.length,13);assert.ok(open.every(line=>/\[section 0[23]\]/.test(line)));
assert.match(read(base+'/source.diff'),/new file mode/);
assert.match(read(base+'/ledger.diff'),/SC-07/);
assert.match(read(base+'/proof-tools.diff'),/verify-exports.mjs/);
writeFileSync(base+'/checkpoint-audit.json',JSON.stringify({host:process.env.COMPUTERNAME,at:new Date().toISOString(),verdict:'PASS',sourceHashes:sources.length,tests:{passed,failed},browserOperations:157,screenshotHashes:browser.screenshots.length,exportHashes:exports.files.length,proofLinks:links,openTaggedSlices:open.length,limits:'Source/development proof only; final build/native, slopes and real-job acceptance remain open.'},null,2)+'\n');
console.log('Checkpoint audit PASS');
