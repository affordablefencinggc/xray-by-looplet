import fs from 'node:fs';
for(const file of ['ASSISTANT-MCP-TODO.md','LOOPLET_BRANCH_RELEASE_LEDGER.md']){const s=fs.readFileSync(file,'utf8'),i=s.lastIndexOf('`n## 2026-09-08 - One-floor');if(i>=0)fs.writeFileSync(file,s.slice(0,i)+s.slice(i).replaceAll('`n','\n'));}
