import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const inputs=['scripts/industry-ledger.mjs','scripts/industry-ledger.test.mjs','planning/control/dashboard.css','proof/audit/IW-VERIFY-01/gallery.test.mjs'];
const hashes=()=>Object.fromEntries(inputs.map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')]));
const suffix=process.argv[2]??'';
const before=hashes(),results=[];
for(const [name,args] of [['tests',['--test','--test-reporter=tap','proof/audit/IW-VERIFY-01/gallery.test.mjs','scripts/industry-ledger.test.mjs']],['adversarial',['--experimental-strip-types','--test','--test-reporter=tap','proof/audit/IW-VERIFY-01/adversarial.test.mjs']],['validate',['scripts/industry-ledger.mjs','validate']],['render',['scripts/industry-ledger.mjs','render']]]){const r=spawnSync(process.execPath,args,{encoding:'utf8',windowsHide:true,timeout:60000});writeFileSync(`proof/audit/IW-VERIFY-01/gallery-${name}${suffix}.log`,(r.stdout??'')+(r.stderr??''));results.push({name,command:['node',...args],exitCode:r.status});}
const after=hashes();writeFileSync(`proof/audit/IW-VERIFY-01/gallery-gates${suffix}.json`,JSON.stringify({at:new Date().toISOString(),owner:'audit_engine_release',independentlyReviewed:false,before,after,unchanged:JSON.stringify(before)===JSON.stringify(after),results},null,2));console.log(JSON.stringify(results));process.exitCode=results.every(r=>r.exitCode===0)?0:1;
