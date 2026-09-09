import fs from 'node:fs';
const dir='proof/growth/2026-09-08-local-assistant-tools/';
const commands=JSON.parse(fs.readFileSync(dir+'app-tools-dev-attempt2.json','utf8'));
fs.writeFileSync(dir+'app-tools-ui-entry-resume.json',JSON.stringify([['find','role','button','click','--name','Architectural workspace','--exact'],...commands.slice(5)],null,2),{flag:'wx'});
