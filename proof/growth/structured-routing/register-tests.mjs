import fs from 'node:fs';
const path='package.json', raw=fs.readFileSync(path,'utf8');
const old='src/studio/assistant/actionOutcome.test.ts src/studio/assistant/workPacket.test.ts';
if(!raw.includes(old)) throw Error('Test script changed; inspect before updating.');
fs.writeFileSync(path,raw.replace(old,'src/studio/assistant/actionOutcome.test.ts src/studio/assistant/workflowRouting.test.ts src/studio/assistant/workPacket.test.ts'));
