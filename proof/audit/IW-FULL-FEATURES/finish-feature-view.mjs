import {readFileSync,writeFileSync} from 'node:fs';
let code=readFileSync('scripts/industry-ledger.mjs','utf8');
const needle="${f.evidence.length?f.evidence.map(e=>link(e.path,'Fresh execution evidence')).join(' · '):'No fresh accepted proof.'}</p></article>";
if(!code.includes(needle))throw Error('Feature render anchor not found');
code=code.replace(needle,"${f.evidence.length?f.evidence.filter(e=>!e.screenshot).map(e=>link(e.path,'Fresh execution evidence')).join(' · '):'No fresh accepted proof.'}</p>${screenshotGallery({...data,tasks:[{id:f.id,evidence:f.evidence}]},f.id)}</article>");
writeFileSync('scripts/industry-ledger.mjs',code);
let js=readFileSync('planning/control/dashboard.js','utf8');js=js.replace("function statusOptions(){status.replaceChildren", "function statusOptions(){status.parentElement.firstChild.textContent=active==='features'?'Feature status':'Task status';status.replaceChildren");js=js.replace("'running','pass','fail'","'running','awaiting-review','pass','fail'");writeFileSync('planning/control/dashboard.js',js);
