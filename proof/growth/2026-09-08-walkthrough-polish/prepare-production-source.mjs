import fs from 'node:fs';
const base='proof/growth/2026-09-08-walkthrough-polish/';
const input=JSON.parse(fs.readFileSync(base+'walkthrough-polish-candidate2-dev02-source.json','utf8'));
const setup=[['open','http://127.0.0.1:8091/'],['wait','--fn',"document.querySelector('.workbench')?.dataset.hydrationStatus==='ready'"],['set','viewport','1440','1000'],['find','role','button','click','--name','Model','--exact'],['wait','--fn',"document.querySelector('.building-primary')?.disabled===false"],['find','role','button','click','--name','Open Redburn BR250157 plan in 3D','--exact'],['wait','--fn',"document.querySelector('.building-canvas canvas')?.dataset.meshCount==='198'"],['errors']];
fs.writeFileSync(base+'production-source-setup.json',JSON.stringify(setup,null,2),{flag:'wx'});
fs.writeFileSync(base+'production-source-01.json',JSON.stringify(input,null,2).replaceAll('walkthrough-polish-candidate2-dev02-source','walkthrough-polish-production-source-01'),{flag:'wx'});
const native=fs.readFileSync(base+'walkthrough-polish-candidate2-dev02-native.json','utf8').replaceAll('walkthrough-polish-candidate2-dev02-native','walkthrough-polish-production-native-01');
fs.writeFileSync(base+'production-native-01.json',native,{flag:'wx'});
