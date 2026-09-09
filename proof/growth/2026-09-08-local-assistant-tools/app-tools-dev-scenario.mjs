import fs from 'node:fs';
const dir='proof/growth/2026-09-08-local-assistant-tools/';
const commands=JSON.parse(fs.readFileSync(dir+'app-tools-dev.json','utf8'));
for(const command of commands) if(command[0]==='eval'&&command[1].includes('await ')) command[1]='(async()=>{'+command[1]+'})()';
fs.writeFileSync(dir+'app-tools-dev-attempt2.json',JSON.stringify(commands,null,2),{flag:'wx'});
