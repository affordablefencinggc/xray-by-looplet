import fs from 'node:fs';
const base='proof/audit/IW-WORKSPACE-PANELS/';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
for(const p of ['native-qa.json','installed-qa.json']){const r=read(base+p);if(!r.ok)throw Error(p+' failed');}
for(const mode of ['dev','built']){if(!read('screenshots/workspace-panels/'+mode+'/report.json').ok)throw Error(mode+' failed');}
let todo=fs.readFileSync('WORKSPACE-PANELS-TODO.md','utf8');todo=todo.replace(/- \[ \] SC-(0[1-9]|1[0-2]|1[4-8])/g,'- [x] SC-$1');fs.writeFileSync('WORKSPACE-PANELS-TODO.md',todo+'\nProof: [completion report](proof/audit/IW-WORKSPACE-PANELS/completion.md). SC-13 remains pending the account-service choice and connection; no fake login.\n');
