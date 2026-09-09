import fs from 'node:fs';
const base='proof/growth/2026-09-08-one-floor';
const batch=[['reload'],['set','viewport','1600','1100'],['wait','--fn',"!!document.querySelector('canvas[data-floor-ready=true]')"]];
for(let i=0;i<9;i++) {
  batch.push(['click',`nav[aria-label="Construction stages"] button:nth-child(${i+1})`]);
  batch.push(['eval',`window.__floorStudio.seek(window.__floorStudio.stages[${i}].start+.037)`]);
  batch.push(['wait','--fn',`Number(document.querySelector('canvas').dataset.floorTime)===window.__floorStudio.stages[${i}].start+.037`]);
  batch.push(['eval',`if(document.querySelector('canvas').dataset.floorPencils!=='5')throw Error('Missing graphite pencils');window.__floorStudio.seek(window.__floorStudio.stages[${i}].start+window.__floorStudio.stages[${i}].wireDuration+.18);`]);
  batch.push(['wait','--fn',"document.querySelector('canvas').dataset.floorPass==='Colour shading'"]);
  batch.push(['eval',"if(window.__floorStudio.poses().length!==50)throw Error('Missing coloured pencils'); if(!window.__floorStudio.poses().some(p=>p.visible))throw Error('No visible shading nibs');"]);
  if([0,2,3,6].includes(i))batch.push(['screenshot',`screenshots/growth/one-floor-stage-${i+1}.png`]);
}
batch.push(['find','role','button','click','--name','Finish','--exact'],['wait','--fn',"document.querySelector('canvas').dataset.floorPass==='Complete'"],['screenshot','screenshots/growth/one-floor-complete.png']);
batch.push(['eval',"window.__beforeParts=Number(document.querySelector('canvas').dataset.floorParts)"]);
batch.push(['find','role','button','click','--name','Expose services','--exact'],['wait','--fn',"document.querySelector('canvas').dataset.floorExposed==='true'"],['eval',"if(Number(document.querySelector('canvas').dataset.floorParts)>=window.__beforeParts)throw Error('Exposure did not remove finishes');"],['screenshot','screenshots/growth/one-floor-services.png']);
batch.push(['find','role','button','click','--name','Visual settings','--exact'],['eval',"window.__beforeImage=document.querySelector('canvas').toDataURL()"],['select','select[aria-label="Floor backdrop"]','#333b3c'],['wait','--fn',"document.querySelector('canvas').dataset.floorBackground==='#333b3c'"],['eval',"if(document.querySelector('canvas').toDataURL()===window.__beforeImage)throw Error('Backdrop pixels unchanged');delete window.__beforeImage;"],['click','.floor-settings input[type="checkbox"]'],['wait','--fn',"document.querySelector('canvas').dataset.floorShadows==='false'"],['screenshot','screenshots/growth/one-floor-settings.png'],['find','role','button','click','--name','Reset appearance','--exact'],['wait','--fn',"document.querySelector('canvas').dataset.floorBackground==='#e8e5db' && document.querySelector('canvas').dataset.floorShadows==='true'"],['find','role','button','click','--name','Visual settings','--exact']);
batch.push(['find','role','button','click','--name','Plan view','--exact'],['screenshot','screenshots/growth/one-floor-plan.png'],['find','role','button','click','--name','Fit floor','--exact'],['find','role','button','click','--name','Expose services','--exact']);
batch.push(['set','viewport','1024','1366'],['eval',"for(const el of document.querySelectorAll('.floor-studio button,.floor-studio select')){const r=el.getBoundingClientRect();if(r.width&& (r.left<0||r.right>innerWidth||r.height<44))throw Error('Clipped/small control: '+el.textContent);}if(document.documentElement.scrollWidth>innerWidth)throw Error('Horizontal overflow');"],['screenshot','screenshots/growth/one-floor-tablet.png']);
batch.push(['set','viewport','1600','1100'],['find','role','button','click','--name','Replay','--exact'],['wait','--fn',"Number(document.querySelector('canvas').dataset.floorTime)>.12 && document.querySelector('canvas').dataset.floorStage==='structure'"],['find','role','button','click','--name','Pause construction','--exact'],['eval',"window.__pausedTime=document.querySelector('canvas').dataset.floorTime"],['eval',"await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));if(window.__pausedTime!==document.querySelector('canvas').dataset.floorTime)throw Error('Pause advanced'); 'All nine stages, real ink/colour, exposure, appearance, camera, replay and pause passed'"],['errors']);
for(const op of batch)if(op[0]==='eval'&&op[1].includes('__beforeImage')) {
  if(op[1].startsWith('window.__beforeImage='))op[1]+="; 'Captured backdrop baseline'";
  else op[1]="await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));"+op[1];
}
for(const op of batch)if(op[0]==='eval'&&op[1].includes('await '))op[1]='(async()=>{'+op[1]+'})()';
fs.writeFileSync(`${base}/controls.json`,JSON.stringify(batch,null,2));
