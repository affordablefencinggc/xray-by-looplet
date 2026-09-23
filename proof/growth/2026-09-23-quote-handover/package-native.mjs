
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const files=['src-tauri/Cargo.toml','src-tauri/Cargo.lock','src-tauri/build.rs','src-tauri/tauri.conf.json','engine/cad/Converter.cs','engine/cad/THIRD-PARTY-NOTICES.txt'];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){
 if(/^(target|bin|packages|__pycache__|\.git|\.env(?:\..*)?|\.venv|venv)$/.test(e.name))continue;
 const p=dir+'/'+e.name;if(e.isSymbolicLink())throw Error('Symlink in native source');if(e.isDirectory())walk(p);else if(e.isFile())files.push(p);
}}
for(const dir of ['src-tauri/src','src-tauri/capabilities','src-tauri/icons','src-tauri/resources','engine/host','engine/python','engine/fixtures'])walk(dir);
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const entries=files.sort().map(p=>({path:p,sha256:hash(p)}));
fs.writeFileSync('proof/growth/2026-09-23-quote-handover/transfer/native-files.txt',files.join('\n')+'\n');
const file='proof/growth/2026-09-23-quote-handover/transfer/native-source.tar';
const result=spawnSync('tar',['-cf',file,'-T','proof/growth/2026-09-23-quote-handover/transfer/native-files.txt'],{stdio:'inherit',windowsHide:true});if(result.status!==0)throw Error('Native archive failed');
for(const e of entries)if(hash(e.path)!==e.sha256)throw Error('Native source changed during transfer');
const manifest={createdAt:new Date().toISOString(),archiveSha256:hash(file),entries};
fs.writeFileSync('proof/growth/2026-09-23-quote-handover/transfer/native-manifest.json',JSON.stringify(manifest,null,2));
fs.writeFileSync('proof/growth/2026-09-23-quote-handover/native-transfer.json',JSON.stringify(manifest,null,2));
console.log(JSON.stringify({files:files.length,bytes:fs.statSync(file).size,sha256:manifest.archiveSha256}));


