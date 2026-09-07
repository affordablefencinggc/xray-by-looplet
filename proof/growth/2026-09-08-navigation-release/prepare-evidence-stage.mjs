import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const found=new Set();
const allowed=new Set(['.md','.json','.html','.png','.log','.mjs','.ps1','.diff','.txt','.ts','.tsx','.css']);
function walk(file){
 if(!fs.existsSync(file))return;
 const s=fs.lstatSync(file);if(s.isSymbolicLink())throw Error('Symlink in evidence');
 if(s.isDirectory()) { if(path.basename(file)==='artifacts'||path.basename(file)==='staged-push')return;for(const name of fs.readdirSync(file))walk(file+'/'+name);return; }
 if(!allowed.has(path.extname(file))||file.endsWith('/production-backup-package.json'))return;
 if(s.size>25*1024*1024)throw Error('Unexpected large evidence file '+file);
 found.add(file);
}
for(const name of fs.readdirSync('proof/growth'))if(name.startsWith('2026-09-08-'))walk('proof/growth/'+name);
for(const name of fs.readdirSync('screenshots/growth'))if(name.startsWith('2026-09-08-')||name.startsWith('nav-'))walk('screenshots/growth/'+name);
for(const name of fs.readdirSync('proof/growth/runner'))if(name.includes('-growth-navigation-')||/^2026-09-07T14-.*-growth-report/.test(name))walk('proof/growth/runner/'+name);
for(const name of ['.gitignore','proof/growth/index.html','proof/growth/PROGRESS.md','NAVIGATION-RESUME-TODO.md','GROWTH-TODO.md','COMPLETE-CHECKLIST.md','LOOPLET_BRANCH_RELEASE_LEDGER.md','PROFESSIONAL-A-Z-CHECKLIST.md'])found.add(name);
const entries=[...found].sort().map(file=>{const bytes=fs.readFileSync(file);return {path:file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}});
// This file is a reviewable explicit allowlist, never a whole-worktree stage.
fs.mkdirSync('proof/growth/staged-push',{recursive:true});
fs.writeFileSync('proof/growth/staged-push/navigation-evidence-files.txt',entries.map(e=>e.path).join('\n')+'\n');
fs.writeFileSync('proof/growth/staged-push/navigation-evidence-manifest.json',JSON.stringify({createdAt:new Date().toISOString(),destination:'origin/feat/architect-cad-engine',entries},null,2));
console.log({files:entries.length,bytes:entries.reduce((sum,e)=>sum+e.bytes,0),extensions:[...new Set(entries.map(e=>path.extname(e.path)))],manifest:'proof/growth/staged-push/navigation-evidence-manifest.json'});
