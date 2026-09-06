import fs from 'node:fs';import {spawnSync} from 'node:child_process';import crypto from 'node:crypto';
const dir='proof/audit/IW-CONNECTION-COUNT';
const pairs=[['before/Studio.tsx','src/studio/Studio.tsx'],['before/styles.css','src/styles.css'],['before/package.json','package.json'],[null,'src/studio/ConnectionTrialPanel.tsx'],[null,'src/studio/construction/connectionTrial.ts'],[null,'src/studio/construction/connectionTrial.test.ts']];
let diff='';for(const [before,after]of pairs){const r=spawnSync('git',['diff','--no-index','--',before?`${dir}/${before}`:'/dev/null',after],{encoding:'utf8'});if(![0,1].includes(r.status))throw Error(r.stderr);diff+=r.stdout;}
fs.writeFileSync(`${dir}/code.diff`,diff);
const assets=['structural.pdf','plan.png','schedule.png','detail.png'].map(n=>'public/sources/thornton-connection-trial/'+n);
const files=[...pairs.map(p=>p[1]),...assets].map(file=>{const b=fs.readFileSync(file);return {file,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')}});
fs.writeFileSync(`${dir}/changed-files.json`,JSON.stringify(files,null,2));
for(const mode of ['dev','built','native','installed']){const r=JSON.parse(fs.readFileSync(`screenshots/connection-count/${mode}/report.json`));if(!r.ok||r.errors.length)throw Error(mode+' QA failed');}
console.log('Task diff, asset hashes and all four UI proof reports verified.');
