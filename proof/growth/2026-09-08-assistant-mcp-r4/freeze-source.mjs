import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
const base='proof/growth/2026-09-08-assistant-mcp-r4',out=base+'/source-manifest.json';
if(fs.existsSync(out))throw Error('Existing freeze preserved');
const git=args=>execFileSync('git',args,{encoding:'utf8',maxBuffer:16e6}).trim();
const scope=['src','scripts','src-tauri/src','package.json','package-lock.json'];
const names=[git(['diff','--name-only','HEAD','--',...scope]),git(['ls-files','--others','--exclude-standard','--',...scope])].join('\n').split(/\r?\n/).filter(Boolean);
const files=[...new Set([...names,'package.json','package-lock.json','src-tauri/src/assistant_ai.rs','src-tauri/src/material_ai.rs','src-tauri/src/lib.rs'])].sort();
const hash=b=>createHash('sha256').update(b).digest('hex');
const entries=files.map(file=>{if(!/^(src\/|scripts\/|src-tauri\/src\/|package(?:-lock)?\.json$)/.test(file)||file.includes('..'))throw Error(file);const b=fs.readFileSync(file),dest=path.join(base,'source',file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,b);return {path:file,sha256:hash(b),bytes:b.length};});
const m={branch:git(['branch','--show-current']),baseline:git(['rev-parse','HEAD']),capturedAt:new Date().toISOString(),scopeSha256:hash(JSON.stringify(entries)),entries};
fs.writeFileSync(out,JSON.stringify(m,null,2),{flag:'wx'});
let diff=git(['diff','HEAD','--',...files]);
for(const file of files){try{git(['ls-files','--error-unmatch','--',file]);}catch{const lines=fs.readFileSync(file,'utf8').trimEnd().split(/\r?\n/);diff+='\ndiff --git a/'+file+' b/'+file+'\nnew file mode 100644\n--- /dev/null\n+++ b/'+file+'\n@@ -0,0 +1,'+lines.length+' @@\n'+lines.map(l=>'+'+l).join('\n')+'\n';}}
fs.writeFileSync(base+'/code.diff',diff);
console.log(JSON.stringify({files:files.length,scopeSha256:m.scopeSha256}));

