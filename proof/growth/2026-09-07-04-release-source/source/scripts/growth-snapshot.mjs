import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..');
const spec=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
if(!/^[a-z0-9-]+$/.test(spec.id))throw Error('Invalid snapshot ID');
const out=path.join(root,'proof/growth',spec.id);
if(fs.existsSync(path.join(out,'source-manifest.json')))throw Error('Snapshot already exists; preserve it and choose another ID');
const files=[...new Set(spec.files)].sort();
const entries=files.map(file=>{
 if(!/^(src\/|scripts\/|package(?:-lock)?\.json$)/.test(file)||file.includes('..'))throw Error('Only explicit application source files allowed');
 const bytes=fs.readFileSync(path.join(root,file));
 const destination=path.join(out,'source',file);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,bytes);
 return {path:file,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length};
});
const branch=execFileSync('git',['branch','--show-current'],{encoding:'utf8',windowsHide:true}).trim();
const baseline=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim();
let diff=execFileSync('git',['diff','HEAD','--',...files],{encoding:'utf8',windowsHide:true,maxBuffer:8e6});
for(const file of files){
 try{execFileSync('git',['ls-files','--error-unmatch','--',file],{stdio:'pipe',windowsHide:true});}
 catch{const content=fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');const lines=content.trimEnd().split('\n');diff+=`\ndiff --git a/${file} b/${file}\nnew file mode 100644\n--- /dev/null\n+++ b/${file}\n@@ -0,0 +1,${lines.length} @@\n${lines.map(l=>'+'+l).join('\n')}\n`;}
}
const digest=createHash('sha256').update(JSON.stringify(entries)).digest('hex');
fs.writeFileSync(path.join(out,'code.diff'),diff);
fs.writeFileSync(path.join(out,'source-manifest.json'),JSON.stringify({branch,baseline,capturedAt:new Date().toISOString(),scopeSha256:digest,entries,note:'Diff includes preserved earlier edits in shared files; exact tested snapshot is identified by these source hashes.'},null,2));
console.log(JSON.stringify({out,files:entries.length,scopeSha256:digest}));
