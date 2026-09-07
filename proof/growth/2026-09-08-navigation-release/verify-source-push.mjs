import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}).trim();
const manifest=JSON.parse(fs.readFileSync('proof/growth/2026-09-08-07-navigation-final-source/source-manifest.json','utf8'));
const staged=git('diff','--cached','--name-only').split('\n').filter(Boolean).sort();
const expected=manifest.entries.map(e=>e.path).sort();
if(JSON.stringify(staged)!==JSON.stringify(expected))throw Error('Index contains unexpected paths');
for(const e of manifest.entries){
 const bytes=fs.readFileSync(e.path);
 if(createHash('sha256').update(bytes).digest('hex')!==e.sha256)throw Error('Tested-source drift: '+e.path);
 const content=bytes.toString('utf8');
 if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|sk-(?:proj-)?[A-Za-z0-9_-]{35,}|https?:\/\/[^\s/:]+:[^\s/@]+@/.test(content))throw Error('Potential credential material; review required: '+e.path);
}
const destination=git('remote','get-url','origin'),branch=git('branch','--show-current');
if(destination!=='https://github.com/affordablefencinggc/xray-by-looplet.git'||branch!=='feat/architect-cad-engine')throw Error('Unexpected publication target');
const result={checkedAt:new Date().toISOString(),destination,branch,baseline:git('rev-parse','HEAD'),sourcePaths:staged,sourceMatchesTestedSnapshot:true,credentialPatternHits:0,normalUserDataIncluded:false,note:'Read-only payload check after automatic approval review rejection; no commit or upload.'};
fs.writeFileSync('proof/growth/staged-push/navigation-source-publication-review.json',JSON.stringify(result,null,2));
console.log(result);
