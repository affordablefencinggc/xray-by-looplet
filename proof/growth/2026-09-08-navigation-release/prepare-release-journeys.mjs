import fs from 'node:fs';
import { navigationMovementSegment, SOURCE_CANVAS } from './navigation-movement-scenarios.mjs';
const tag=process.argv[2],native=process.argv.includes('--native');
if(!/^[a-z0-9-]+$/.test(tag??''))throw Error('Unique evidence tag required');
const dir='proof/growth/2026-09-08-navigation-release';
const click=name=>['find','role','button','click','--name',name,'--exact'];
const wait=p=>['wait','--fn',p];
const c="document.querySelector('.building-canvas canvas')";
const shot=name=>['screenshot',`screenshots/growth/${tag}-${name}.png`];
const scenario=[];
if(native){
 const retained=JSON.parse(fs.readFileSync('proof/growth/tablet-native-upgrade.json','utf8'));
 for(const command of retained){if(command[0]==='screenshot')command[1]=command[1].replace('2026-09-07-tablet-native',tag);scenario.push(command);}
 scenario.push(click('Close Project backups'));
}else scenario.push(['set','viewport','1440','1000']);
scenario.push(click('Model'),wait(`${c}?.dataset.meshCount==='198'`),
 ['eval',`(()=>{const canvas=${c};window.__growthCaptureOriginal=canvas.requestPointerLock;canvas.requestPointerLock=()=>Promise.reject(new DOMException('Isolated QA refusal','NotAllowedError'));return 'Capture refusal armed for this QA canvas'})()`]);
const core=JSON.parse(fs.readFileSync(`${dir}/${tag}-journeys.json`,'utf8'));
scenario.push(...core,
 click('Walk-through'),['select','[aria-label="Starting floor"]','upper'],wait("document.querySelector('.walk-start-picker')?.dataset.startFloor==='upper'&&document.querySelector('.walk-start-picker')?.dataset.startReady==='true'"),shot('upper-picker'),click('Start walking here'),
 ...navigationMovementSegment({canvasSelector:SOURCE_CANVAS,mode:'walk',tag:tag+'-upper',screenshotPrefix:`screenshots/growth/${tag}-upper`,expectedEyeHeight:4.785}),
 click('Reset model view'),['eval',`window.__navBefore=${c}.dataset.cameraPosition; 'Camera sampled before zoom'`],
 click('Zoom in model'),wait(`${c}.dataset.cameraPosition!==window.__navBefore`),['eval',`window.__navAfterZoom=${c}.dataset.cameraPosition; 'Zoom in moved camera'`],
 click('Zoom out model'),wait(`${c}.dataset.cameraPosition!==window.__navAfterZoom`),
 click('Front'),['eval',`window.__navFront=${c}.dataset.cameraPosition; 'Front viewpoint sampled'`],click('Rear'),wait(`${c}.dataset.cameraPosition!==window.__navFront`),click('Reset model view'),shot('bottom-actions'),['errors']
);
fs.writeFileSync(`${dir}/${tag}-release.json`,JSON.stringify(scenario,null,2)+'\n',{flag:'wx'});
console.log({file:`${dir}/${tag}-release.json`,commands:scenario.length,native});
