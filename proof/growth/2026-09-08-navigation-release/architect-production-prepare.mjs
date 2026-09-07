import fs from 'node:fs';
const base='proof/growth/2026-09-08-navigation-release/';
const button=name=>['find','role','button','click','--name',name,'--exact'];
const setup=[['open','http://127.0.0.1:8088/'],['wait','--fn',"document.querySelector('.workbench')?.dataset.hydrationStatus==='ready'"],['set','viewport','1440','1000'],button('Sketch'),button('Architectural workspace'),['wait','--fn',"!!document.querySelector('canvas[aria-label=\"Live architectural 3D model\"]')"],button('Load demonstration'),['wait','--fn',"document.querySelector('.architect-header')?.textContent.includes('Demonstration design loaded')"],['screenshot','screenshots/growth/nav-architect-production-setup.png'],['errors']];
fs.writeFileSync(base+'architect-production-setup.json',JSON.stringify(setup,null,2));
for(const name of ['fly','walk','denied','denied-walk']){
 const commands=JSON.parse(fs.readFileSync(base+`architect-dev-${name}.json`,'utf8'));
 for(const command of commands) if(command[0]==='screenshot')command[1]=command[1].replace('2026-09-08-architect-','nav-architect-production-');
 fs.writeFileSync(base+`architect-production-${name}.json`,JSON.stringify(commands,null,2));
}
