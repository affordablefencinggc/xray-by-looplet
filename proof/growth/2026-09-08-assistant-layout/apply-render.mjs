import fs from 'node:fs';
const file='src/studio/LiveAssistant.tsx',s=fs.readFileSync(file,'utf8'),i=s.lastIndexOf('  return (');if(i<0)throw Error('Render boundary missing');fs.writeFileSync(file,s.slice(0,i)+fs.readFileSync('proof/growth/2026-09-08-assistant-layout/panel-render.txt','utf8'));
