import fs from 'node:fs';
const original=JSON.parse(fs.readFileSync('proof/audit/IW-REDBURN-ENCLOSURE/top-bottom-controls.json','utf8'));
const init=[['set','viewport','1600','1000'],['open','http://127.0.0.1:8085/'],['wait','--fn',"!!document.querySelector('[data-hydration-status=ready]')"],
  ['find','role','button','click','--name','Model','--exact'],['wait','--fn',"document.querySelector('.building-primary')?.disabled===false"],
  ['find','role','button','click','--name','Open Redburn BR250157 plan in 3D','--exact']];
const commands=[...init,...original.map(c=>c[0]==='screenshot'?['screenshot',c[1].replace('screenshots/redburn-enclosure/top-bottom-','screenshots/professional-next/final-production-controls-')]:c),['errors']];
fs.writeFileSync('proof/audit/IW-PROFESSIONAL-NEXT/final-production-controls.json',JSON.stringify(commands,null,2));
