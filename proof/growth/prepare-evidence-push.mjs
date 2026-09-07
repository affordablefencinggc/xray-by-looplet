import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const paths=[],localOnly=[];
function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){
 const file=dir+'/'+item.name;
 if(item.isDirectory()){
  if(/\/(artifacts|transfer|node_modules|\.temp|EBWebView|Crashpad|staged-push)$/.test(file)){localOnly.push({path:file,reason:'Local runtime, transfer or staging bookkeeping'});continue;}
  walk(file);
 }else{
  const size=fs.statSync(file).size;
  if(size>20*1024*1024||/\.(exe|dll|tar|zip|msi|mp3|webm)$/i.test(file)||/backup-package\.json$/.test(file)){localOnly.push({path:file,reason:'Binary/build archive or local backup package',bytes:size});continue;}
  if(!/\.(md|mjs|json|log|txt|ps1|py|ts|tsx|css|html|png|tap|diff|patch|csv|xlsx)$/.test(file))continue;
  if(!/\.(png|xlsx)$/.test(file)){
   const text=fs.readFileSync(file,'utf8');
   if(/(?:sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{24,}|gh[pousr]_[A-Za-z0-9]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/.test(text)&&!file.endsWith('/projectBackup.test.ts')){localOnly.push({path:file,reason:'Credential-shaped text requires separate review'});continue;}
  }
  paths.push(file);
 }
}}
walk('proof/growth');walk('screenshots/growth');
for(const dir of ['proof/growth/2026-09-07-release/transfer','proof/growth/2026-09-07-tablet-release/transfer'])for(const file of ['source-manifest.json','native-manifest.json','files.txt','native-files.txt'])if(fs.existsSync(dir+'/'+file))paths.push(dir+'/'+file);
// Preserve historical test automation and logs, while keeping raw project dumps
// and generated runtime/build contents local.
const pending=execFileSync('git',['ls-files','--others','--exclude-standard','-z','--','proof/audit'],{encoding:'utf8',windowsHide:true}).split('\0').filter(Boolean);
pending.push(...execFileSync('git',['diff','--name-only','-z','--','proof/audit'],{encoding:'utf8',windowsHide:true}).split('\0').filter(Boolean));
for(const file of pending){
 if(!/\.(mjs|ps1|py|ts|log)$/.test(file)||/\/(artifacts|transfer[^/]*|source|[^/]*profile[^/]*|node_modules|packages)\//.test(file)||fs.statSync(file).size>2*1024*1024)continue;
 const text=fs.readFileSync(file,'utf8');
 if(/(?:sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{24,}|gh[pousr]_[A-Za-z0-9]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/.test(text)){localOnly.push({path:file,reason:'Credential-shaped text requires separate review'});continue;}
 paths.push(file);
}
// Prior completed waves retain their concise audit records and exact source diffs.
for(const item of fs.readdirSync('proof/audit',{withFileTypes:true}))if(item.isDirectory()){
 const dir='proof/audit/'+item.name;
 for(const file of ['completion.md','README.md','code.diff','implementation.diff','continuation.diff'])if(fs.existsSync(dir+'/'+file))paths.push(dir+'/'+file);
}
const files=[...new Set(paths)].sort();
const output='proof/growth/staged-push';fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(output+'/04-evidence.paths',files.join('\0')+'\0');
fs.writeFileSync(output+'/04-evidence.json',JSON.stringify(files,null,2));
fs.writeFileSync(output+'/local-only.json',JSON.stringify(localOnly,null,2));
console.log(JSON.stringify({files:files.length,bytes:files.reduce((s,p)=>s+fs.statSync(p).size,0),localOnly:localOnly.length,review:localOnly.filter(x=>x.reason.includes('Credential'))}));
