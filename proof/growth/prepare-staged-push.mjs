import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',windowsHide:true,maxBuffer:4e6});
const pending=[...new Set([...git('diff','--name-only','-z').split('\0'),...git('ls-files','--others','--exclude-standard','-z').split('\0')].filter(Boolean))];
const runtimeScripts=new Set(['scripts/build-redburn-model.mjs','scripts/industry-baseline-start.mjs','scripts/start-local-desktop.ps1','scripts/with-app-env.mjs','scripts/build-cad.mjs','scripts/build-resources.mjs']);
const application=pending.filter(p=>/^(src\/|src-tauri\/|engine\/cad\/|public\/|supabase\/)/.test(p)||['package.json','package-lock.json','vite.config.ts'].includes(p)||runtimeScripts.has(p));
const tooling=pending.filter(p=>p.startsWith('scripts/')&&!runtimeScripts.has(p));
const docs=pending.filter(p=>/^[^/]+\.md$/.test(p)||p.startsWith('planning/'));
const directory=path.resolve('proof/growth/staged-push');fs.mkdirSync(directory,{recursive:true});
for(const [id,files]of [['01-application',application],['02-tablet',['src/styles.css']],['03-tooling',tooling],['04-documents',docs]]){
 fs.writeFileSync(path.join(directory,id+'.paths'),files.join('\0')+'\0');
 fs.writeFileSync(path.join(directory,id+'.json'),JSON.stringify(files,null,2));
}
fs.writeFileSync(path.join(directory,'plan.json'),JSON.stringify({branch:git('branch','--show-current').trim(),baseline:git('rev-parse','HEAD').trim(),application,tooling,docs,tabletBefore:'proof/growth/2026-09-07-04-release-source/source/src/styles.css',note:'Stage01 index uses the verified pre-tablet CSS snapshot. Stage02 records only the tablet delta. Working files remain unchanged. Curated evidence paths are added after final report verification.'},null,2));
console.log(JSON.stringify({application:application.length,tablet:1,tooling:tooling.length,docs:docs.length}));
