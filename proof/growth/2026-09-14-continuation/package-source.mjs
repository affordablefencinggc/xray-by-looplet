import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root=process.cwd(), destination=path.resolve('proof/growth/2026-09-14-continuation/build-input');
fs.mkdirSync(destination,{recursive:true});
const directories=['src','scripts','server','migrations','contracts','public'];
const files=['package.json','package-lock.json','tsconfig.json','vite.config.ts','vite.config.spa.ts','index.html'];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function walk(relative) {
  for(const entry of fs.readdirSync(path.join(root,relative),{withFileTypes:true})) {
    const name=relative+'/'+entry.name;
    if(entry.isSymbolicLink()) throw Error('Source snapshot cannot include symlinks: '+name);
    if(/^(?:\.env(?:\..*)?|node_modules|target|\.git|\.temp|\.cache|__pycache__)$/.test(entry.name)) continue;
    if(entry.isDirectory()) walk(name); else if(entry.isFile()) files.push(name);
  }
}
for(const dir of directories) walk(dir);
const lock=JSON.parse(fs.readFileSync('package-lock.json','utf8'));
for(const value of Object.values(lock.packages??{})) {
  if(value.resolved?.startsWith('http')) { const url=new URL(value.resolved);if(url.username||url.password)throw Error('Dependency URL contains credentials; transfer blocked.'); }
}
const entries=files.sort().map(file=>({path:file,sha256:hash(fs.readFileSync(file))}));
fs.writeFileSync(path.join(destination,'files.txt'),files.join('\n')+'\n');
fs.writeFileSync(path.join(destination,'source-manifest.json'),JSON.stringify({createdAt:new Date().toISOString(),entries},null,2));
const archive=path.join(destination,'source.tar');
const result=spawnSync('tar',['-cf',archive,'-T',path.join(destination,'files.txt')],{stdio:'inherit',windowsHide:true});
if(result.status!==0)throw Error('Source archive failed.');
// Detect edits made by another session while the archive was being prepared.
for(const entry of entries)if(hash(fs.readFileSync(entry.path))!==entry.sha256)throw Error('Source changed during packaging: '+entry.path);

console.log(JSON.stringify({sourceHash:hash(fs.readFileSync(archive)),files:entries.length,archive}));
