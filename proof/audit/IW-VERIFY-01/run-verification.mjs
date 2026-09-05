import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
const stamp=new Date().toISOString().replaceAll(':','-').replaceAll('.','-');
const root=process.cwd(),out=resolve(root,'proof/audit/IW-VERIFY-01',`run-${stamp}`);
mkdirSync(out,{recursive:true});
const inputs=['scripts/industry-ledger.mjs','scripts/industry-ledger.test.mjs','planning/control/ledger.json','planning/control/dashboard.css','planning/control/dashboard.js',...readdirSync('src/studio/construction').filter(f=>f.endsWith('.ts')).map(f=>`src/studio/construction/${f}`),...readdirSync('contracts/construction').map(f=>`contracts/construction/${f}`)];
const hashes=()=>Object.fromEntries(inputs.map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')]));
const before=hashes();
const commands=[
 ['adversarial',['--experimental-strip-types','--test','--test-reporter=tap','proof/audit/IW-VERIFY-01/adversarial.test.mjs']],
 ['tracker',['--test','--test-reporter=tap','scripts/industry-ledger.test.mjs']],
 ['construction',['--experimental-strip-types','--test','--test-reporter=tap','src/studio/construction/construction.test.ts']],
 ['schema-check',['--experimental-strip-types','contracts/construction/generate.mjs','--check']],
 ['typecheck',['node_modules/typescript/bin/tsc','--noEmit']],
];
const results=[];
for(const [name,args] of commands){
 const startedAt=new Date().toISOString();const execution=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',timeout:60000,windowsHide:true});
 writeFileSync(resolve(out,`${name}.stdout.log`),execution.stdout??'');writeFileSync(resolve(out,`${name}.stderr.log`),execution.stderr??'');
 results.push({name,command:[process.execPath,...args],startedAt,completedAt:new Date().toISOString(),exitCode:execution.status,error:execution.error?.message??null,passed:execution.status===0,log:`${name}.stdout.log`});
}
const after=hashes();const report={reviewer:'/root/audit_engine_release',task:'IW-VERIFY-01',implementationOwners:['/root/iw_sc01_tracker','/root/iw_sc02_contract'],reusedThread:true,generatedAt:new Date().toISOString(),node:process.version,sourceBefore:before,sourceAfter:after,sourcesUnchanged:JSON.stringify(before)===JSON.stringify(after),results};
writeFileSync(resolve(out,'results.json'),JSON.stringify(report,null,2));
writeFileSync('proof/audit/IW-VERIFY-01/latest-run.txt',out);
console.log(JSON.stringify({out,sourcesUnchanged:report.sourcesUnchanged,results},null,2));
process.exitCode=results.every(r=>r.passed)&&report.sourcesUnchanged?0:1;
