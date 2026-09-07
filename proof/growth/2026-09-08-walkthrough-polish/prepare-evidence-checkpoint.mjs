import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const base='proof/growth/2026-09-08-walkthrough-polish/';
const roots=['proof/growth/2026-09-08-walk-boundaries',base.slice(0,-1),'proof/growth/2026-09-08-08-walk-boundaries','proof/growth/2026-09-08-08-walk-boundaries-source','proof/growth/2026-09-08-09-walkthrough-polish','proof/growth/2026-09-08-09-walkthrough-polish-source'];
const files=new Set(['PROFESSIONAL-A-Z-CHECKLIST.md','WALK-BOUNDARIES-TODO.md','GROWTH-TODO.md','COMPLETE-CHECKLIST.md','LOOPLET_BRANCH_RELEASE_LEDGER.md','proof/growth/PROGRESS.md','proof/growth/index.html']);
function collect(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory()){if(!['artifacts','web-artifacts','transfer','runtime','source-package'].includes(e.name))collect(p);}else if(/\.(md|json|mjs|mts|ts|tsx|css|diff|html|log|ps1|txt)$/.test(p)&&!p.includes('/asset-acquisition/')&&!/evidence-checkpoint-(?:paths|manifest)/.test(p))files.add(p);}}
for(const root of roots)collect(root);
for(const name of fs.readdirSync('proof/growth/runner'))if(name>='2026-09-07T15-23-00'&&name.startsWith('2026-09-07T')&&!name.includes('growth-arm-asset')&&/\.(json|log)$/.test(name))files.add('proof/growth/runner/'+name);
for(const p of [...files]){
  if(!p.endsWith('.json'))continue;
  let j;try{j=JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));}catch{continue;}
  const screenshotPaths=Array.isArray(j)?j.filter(a=>Array.isArray(a)&&a[0]==='screenshot').map(a=>a[1]):(j.images??[]).flatMap(i=>[i.file,i.archivedFile]);
  for(const image of screenshotPaths)if(typeof image==='string'&&image.startsWith('screenshots/growth/')&&!image.includes('..')&&fs.existsSync(image))files.add(image);
}
for(const stage of ['2026-09-08-08-walk-boundaries','2026-09-08-09-walkthrough-polish'])files.add('screenshots/growth/'+stage+'.png');
const entries=[...files].sort().map(p=>{const bytes=fs.readFileSync(p);return {path:p,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};});
const hits=[];
const patterns=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/\b(?:sk-proj-|sk-live-|ghp_|github_pat_)[A-Za-z0-9_-]{20,}/,/\bAKIA[A-Z0-9]{16}\b/];
for(const entry of entries)if(!entry.path.endsWith('.png')){const s=fs.readFileSync(entry.path,'utf8');for(let i=0;i<patterns.length;i++)if(patterns[i].test(s))hits.push({path:entry.path,pattern:i});}
const manifest={at:new Date().toISOString(),sourceCommit:'844e091',files:entries.length,bytes:entries.reduce((s,e)=>s+e.bytes,0),credentialPatternHits:hits,entries,note:'Explicit current-stage evidence only. Packaged binaries, transfer archives, raw downloaded assets, normal working data and unrelated audit files excluded. This is local archival; upload remains held.'};
fs.writeFileSync(base+'evidence-checkpoint-manifest.json',JSON.stringify(manifest,null,2));
if(hits.length)throw Error('Review credential-pattern hits before staging; values not printed');
files.add(base+'evidence-checkpoint-manifest.json');
fs.writeFileSync(base+'evidence-checkpoint-paths.txt',[...files].sort().join('\n')+'\n');
console.log(JSON.stringify({files:entries.length,bytes:manifest.bytes,credentialPatternHits:hits.length}));
