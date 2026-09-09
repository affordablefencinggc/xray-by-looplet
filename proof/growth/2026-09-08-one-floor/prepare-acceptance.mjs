import fs from 'node:fs';
const base='proof/growth/2026-09-08-one-floor',final=base+'/final';
fs.writeFileSync(`${final}/launch-native.mjs`,fs.readFileSync('proof/growth/2026-09-08-pencil-independent/launch-native.mjs','utf8').replaceAll('proof/growth/2026-09-08-pencil-independent',final));
const controls=JSON.parse(fs.readFileSync(`${base}/controls.json`,'utf8'));
fs.writeFileSync(`${base}/production.json`,JSON.stringify(controls.map(op=>op.map(v=>typeof v==='string'?v.replaceAll('screenshots/growth/one-floor-','screenshots/growth/one-floor-production-'):v)),null,2));
const native=[['wait','--fn',"!!document.querySelector('nav[aria-label=Panes]')"],['find','role','button','click','--name','Model','--exact'],['find','role','link','click','--name','One-floor construction studio ↗','--exact'],['wait','--fn',"!!document.querySelector('canvas[data-floor-ready=true]')"]];
// Native window sizing stays native; it is not evidence of tablet emulation.
const nativeControls=controls.filter(op=>op[0]!=='reload'&&op[0]!=='set'&&!(op[0]==='eval'&&op[1].includes('Clipped/small'))&&!(op[0]==='screenshot'&&op[1].includes('tablet')));
native.push(...nativeControls.map(op=>op.map(v=>typeof v==='string'?v.replaceAll('screenshots/growth/one-floor-','screenshots/growth/one-floor-native-'):v)));
native.push(['find','role','link','click','--name','Back to X-Ray','--exact'],['wait','--fn',"!!document.querySelector('nav[aria-label=Panes]')"],['eval',"if(!document.body.innerText.includes('8de251421835'))throw Error('Native build ID mismatch'); 'Native route return and build identity passed'"],['errors']);
fs.writeFileSync(`${base}/native.json`,JSON.stringify(native,null,2));
