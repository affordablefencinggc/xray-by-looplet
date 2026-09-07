import fs from 'node:fs';
import {navigationMovementSegment,SOURCE_CANVAS} from '../2026-09-08-navigation-release/navigation-movement-scenarios.mjs';
const tag=process.argv[2],native=process.argv[3]==='native';if(!/^[a-z0-9-]+$/.test(tag??''))throw Error('Unique tag required');
const root='proof/growth/2026-09-08-walk-boundaries',c="document.querySelector('.building-canvas canvas')";
const click=name=>['find','role','button','click','--name',name,'--exact'],ev=s=>['eval',s],wait=s=>['wait','--fn',s];
const source=JSON.parse(fs.readFileSync(`${root}/walk-boundaries-built-01.json`,'utf8')).map(cmd=>cmd.map(v=>v.replaceAll('walk-boundaries-built-01',tag)));
const open=source.findIndex(cmd=>cmd[0]==='screenshot'&&cmd[1].endsWith('-slide-open.png'));
source.splice(open+1,0,
 click('Wireframe'),wait(`${c}.dataset.displayMode==='wireframe'`),
 ev(`if(${c}.dataset.navigation!=='walk'||!JSON.parse(${c}.dataset.walkDoors).find(d=>d.id==='lower-terrace-wall-opening-1')?.open)throw Error('Visual change closed door or exited Walk');'Door pose retained in Wireframe'`),
 ['screenshot',`screenshots/growth/${tag}-open-wireframe.png`],click('Solid'),click('Roof on'),
 ev(`if(${c}.dataset.navigation!=='walk'||!JSON.parse(${c}.dataset.walkDoors).find(d=>d.id==='lower-terrace-wall-opening-1')?.open)throw Error('Roof visibility reset door');'Door pose retained with roof hidden'`),click('Roof off'));
let prefix=[];
if(native)prefix=JSON.parse(fs.readFileSync('proof/growth/2026-09-08-navigation-release/nav-windows-final-release.json','utf8')).slice(0,25).map(cmd=>cmd.map(v=>v.replaceAll('nav-windows-final',tag)));
const end=[click('Fly'),...navigationMovementSegment({canvasSelector:SOURCE_CANVAS,mode:'fly',tag:tag+'-fly',screenshotPrefix:`screenshots/growth/${tag}-fly`})];
for(const name of ['Front','Rear','Reset model view','Zoom in model','Zoom out model'])end.push(ev(`window.__bottomCamera=${c}.dataset.cameraPosition`),click(name),wait(`${c}.dataset.cameraPosition!==window.__bottomCamera`));
end.push(['screenshot',`screenshots/growth/${tag}-final-controls.png`],ev(`if(window.__walkErrors?.length)throw Error(JSON.stringify(window.__walkErrors));'Release movement and bottom camera controls passed'`),['errors']);
const commands=[...prefix,...source,...end];
fs.writeFileSync(`${root}/${tag}.json`,JSON.stringify(commands,null,2)+'\n',{flag:'wx'});console.log({scenario:`${root}/${tag}.json`,commands:commands.length});
