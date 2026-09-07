import fs from 'node:fs';
const file='proof/growth/2026-09-08-navigation-release/record-closeout.mjs';
const source=fs.readFileSync(file,'utf8');
const fixed=source.replace(/append\('([^']+)',`([\s\S]*?)`\);/g,(_all,file,text)=>'append('+JSON.stringify(file)+','+JSON.stringify(text)+');');
fs.writeFileSync(file,fixed);
