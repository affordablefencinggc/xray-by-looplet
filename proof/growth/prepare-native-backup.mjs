import fs from 'node:fs';
const base=JSON.parse(fs.readFileSync('proof/growth/2026-09-07-sheets/production-backup.json','utf8'));
const commands=[['tab','t1'],...base.slice(1,17).map(c=>c.map(v=>v.replaceAll('Production sheets and pricing','Native sheets and pricing').replaceAll('/production-','/native-'))),['errors']];
fs.writeFileSync('proof/growth/native-backup.json',JSON.stringify(commands,null,2));
