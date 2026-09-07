import fs from 'node:fs';
const dir='proof/growth/2026-09-07-sheets/';
const scenario=JSON.parse(fs.readFileSync(dir+'production-tablet.json','utf8')).map(command=>command.map(text=>text
 .replaceAll('Release drainage detail','Drainage junction')
 .replaceAll('production-tablet-','stage05-dev-tablet-')
 .replaceAll("r.left<0||r.right>innerWidth||r.top<0||r.bottom>innerHeight||!b.contains(hit)","r.width<44||r.height<44||r.left<0||r.right>innerWidth||r.top<0||r.bottom>innerHeight||!b.contains(hit)")
 .replaceAll("document.querySelector('.sheet-manager-list>li')?.dataset.originalPage==='2'","document.querySelector('.sheet-manager-list>li')?.dataset.originalPage==='3'")
));
fs.writeFileSync(dir+'stage05-dev-tablet.json',JSON.stringify(scenario,null,2));
