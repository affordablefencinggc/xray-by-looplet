import fs from 'node:fs';
const dir='proof/audit/IW-REDBURN-ENCLOSURE';
const all=JSON.parse(fs.readFileSync(dir+'/native.json','utf8'));
const start=all.findIndex(c=>c.includes('Front'));
const end=all.findIndex(c=>c.includes('Backups'));
const commands=[['tab','t1'],['find','role','button','click','--name','Close Project backups','--exact'],['find','role','button','click','--name','Model','--exact'],['wait','--fn',"Number(document.querySelector('.building-canvas canvas')?.dataset.meshCount)===198"],...all.slice(start,end),['errors']];
fs.writeFileSync(dir+'/native-controls-final.json',JSON.stringify(commands,null,2));
