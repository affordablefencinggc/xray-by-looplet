import fs from 'node:fs';
const dir='proof/growth/2026-09-07-pricing/';
const old=JSON.parse(fs.readFileSync(dir+'detail-proof.json','utf8'));
const last=old.slice(old.findIndex(c=>Array.isArray(c)&&c[0]==='wait'&&c[2].includes("dataset.priceImportState==='ready'")));
const flow=JSON.parse(fs.readFileSync(dir+'malformed-csv-mobile.json','utf8'));
const start=flow.findIndex((c,i)=>i>16&&c.includes('Import price sheet'));
const end=flow.findIndex((c,i)=>i>start&&c[0]==='set');
fs.writeFileSync(dir+'detail-proof.json',JSON.stringify([['find','role','button','click','--name','Cost','--exact'],...flow.slice(start,end),['set','viewport','390','844'],...last],null,2));
