import fs from 'node:fs';
const d='proof/growth/gemini-capability-debate/';
const prompt=fs.readFileSync(d+'procedural-proposal.txt','utf8');
fs.writeFileSync(d+'proposal.json',JSON.stringify([['fill','#live-assistant-prompt',prompt],['find','role','button','click','--name','Send assistant message','--exact']],null,2));
