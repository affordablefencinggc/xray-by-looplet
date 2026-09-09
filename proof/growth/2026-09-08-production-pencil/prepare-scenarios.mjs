import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const tag = process.argv[2];
if (!tag || !/^[a-zA-Z0-9_-]+$/.test(tag)) throw Error('Supply a NEW dated run tag for every execution; never reuse evidence filenames.');
const root = 'proof/growth/2026-09-08-production-pencil';
const base = `${root}/${tag}`;
if (fs.existsSync(base)) throw Error('This evidence run already exists; choose a fresh dated tag.');
fs.mkdirSync(`${base}/downloads`, { recursive: true });
const shot = suffix => `screenshots/growth/${tag}-${suffix}.png`;
const button = name => ['find', 'role', 'button', 'click', '--name', name, '--exact'];
const wait = predicate => ['wait', '--fn', predicate];
const evalCode = code => ['eval', code];
const setup = [
  ['open', 'http://127.0.0.1:8093/'], ['set', 'viewport', '1440', '900'],
  wait("document.querySelector('.workbench')?.dataset.hydrationStatus==='ready'"),
  button('Model'), wait("!!document.querySelector('.building-workspace')"), button('Crown Wharf A4 tower'),
  wait("document.querySelector('.building-center-column')?.textContent.includes('Crown Wharf') && Array.from(document.querySelectorAll('button')).some(b=>b.textContent.includes('Explore & Draw')&&!b.disabled)"),
  button('Explore & Draw 3D Model'), wait("Number(document.querySelector('.building-canvas canvas')?.dataset.frameCount)>2"),
  button('Magic Pencil'), wait("!!document.querySelector('[data-testid=draftsman-dock]') && !!window.__magicPencil"),
  evalCode("(()=>{const pause=Array.from(document.querySelectorAll('button')).find(b=>b.getAttribute('aria-label')==='Pause drawing');if(pause)pause.click();if(window.__magicPencil.getStatus().cinematicOrbit)window.__magicPencil.toggleCinematicOrbit();return window.__magicPencil.getStatus();})()"),
];
const monitor = evalCode(`(()=>{if(window.__productionPencil)throw Error('Proof monitor already installed');const state=window.__productionPencil={tag:${JSON.stringify(tag)},downloads:[],errors:[],originalClick:HTMLAnchorElement.prototype.click};state.onError=e=>state.errors.push(String(e.message||e.reason));addEventListener('error',state.onError);addEventListener('unhandledrejection',state.onError);HTMLAnchorElement.prototype.click=function(){if(this.download&&/\\.(png|pdf)$/i.test(this.download)){const ext=this.download.split('.').pop().toLowerCase();const filename=state.tag+'-'+String(state.downloads.length+1).padStart(2,'0')+'.'+ext;state.downloads.push({filename,originalName:this.download,requestedAt:new Date().toISOString()});this.download=filename;}return state.originalClick.call(this);};return {tag:state.tag,origin:location.origin,sourceSha256:document.querySelector('.building-canvas canvas').dataset.sourceSha256};})()`);
const cleanup = evalCode("(()=>{const s=window.__productionPencil;if(!s)return 'No monitor';HTMLAnchorElement.prototype.click=s.originalClick;removeEventListener('error',s.onError);removeEventListener('unhandledrejection',s.onError);if(s.errors.length)throw Error(JSON.stringify(s.errors));return {downloads:s.downloads,rapid:s.rapid,errors:s.errors};})()");
const rapid = evalCode("(()=>{const s=window.__productionPencil,c=document.querySelector('.building-canvas canvas'),buttons=Array.from(document.querySelectorAll('[data-testid=draftsman-dock] button'));const finish=buttons.find(b=>b.textContent.trim()==='Solid Finish'),png=buttons.find(b=>b.textContent.trim()==='Blueprint');if(!finish||!png)throw Error('Export actions absent');const before=Number(c.dataset.frameCount);finish.click();png.click();s.rapid={before,after:Number(c.dataset.frameCount),phase:c.dataset.drawPhase,visible:c.dataset.drawVisibleMeshes,total:c.dataset.drawTotalMeshes};if(s.rapid.after!==before)throw Error('Rapid test unexpectedly yielded to a frame');if(s.rapid.phase!=='complete')throw Error('Solid Finish was not applied');if(s.rapid.visible!==s.rapid.total)throw Error('Finish leaves meshes hidden');if(s.downloads.length!==1||!s.downloads[0].filename.endsWith('.png'))throw Error('Rapid PNG not requested');return s.rapid;})()");
const desktop = [...setup, monitor,
  ['find','role','tab','click','--name','2. Wireframe Ascend','--exact'], wait("document.querySelector('.building-canvas canvas').dataset.drawPhase==='ascending_wireframe'"),
  ['screenshot',shot('production-wireframe')], rapid,
  wait("Number(document.querySelector('.building-canvas canvas').dataset.frameCount)>window.__productionPencil.rapid.after"),
  ['screenshot',shot('production-solid-after-rapid-export')],
  button('Blueprint'), wait("window.__productionPencil.downloads.length===2"),
  button('Model sheets PDF'), wait("window.__productionPencil.downloads.length===3 && !Array.from(document.querySelectorAll('button')).some(b=>b.textContent.includes('Preparing PDF'))"),
  ['screenshot',shot('production-pdf-requested')], cleanup,
  button('Close Draftsman mode'), wait("!document.querySelector('[data-testid=draftsman-dock]') && !window.__magicPencil"),
  ['screenshot',shot('production-restored')], ['errors'],
];
const checkControls = evalCode("(()=>{const dock=document.querySelector('[data-testid=draftsman-dock]');if(!dock)throw Error('Missing drafting dock');const rect=r=>({left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height});const controls=Array.from(dock.querySelectorAll('button,select')).filter(b=>b.getClientRects().length&&getComputedStyle(b).visibility!=='hidden');const result=[];for(const b of controls){b.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});const r=b.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);if(r.width<43.9||r.height<43.9)throw Error('Target under44: '+(b.ariaLabel||b.textContent));if(r.left<0||r.right>innerWidth||r.top<0||r.bottom>innerHeight||!b.contains(hit))throw Error('Unreachable drafting control: '+(b.ariaLabel||b.textContent));result.push({name:b.ariaLabel||b.textContent.trim(),...rect(r)});}const launcher=document.querySelector('.live-assistant-launcher');if(!launcher)throw Error('Missing assistant launcher');const l=launcher.getBoundingClientRect(),d=dock.getBoundingClientRect();if(!launcher.contains(document.elementFromPoint(l.x+l.width/2,l.y+l.height/2)))throw Error('Assistant launcher blocked');if(d.left<l.right&&d.right>l.left&&d.top<l.bottom&&d.bottom>l.top)throw Error('Drafting dock overlaps assistant launcher');return {viewport:[innerWidth,innerHeight],controls:result,dock:rect(d),assistant:rect(l)};})()");
const tablets = [...setup];
for (const [width,height,label] of [[1024,768,'tablet-landscape'],[768,1024,'tablet-portrait']]) {
  tablets.push(['set','viewport',String(width),String(height)],wait(`innerWidth===${width}&&innerHeight===${height}&&document.querySelector('[data-testid=draftsman-dock]').getAnimations().every(a=>a.playState==='finished')`),checkControls,
    evalCode("document.querySelector('[data-testid=draftsman-dock]').scrollTop=0"), ['screenshot',shot(`${label}-dock-top`)],
    evalCode("document.querySelector('[data-testid=draftsman-dock]').scrollTop=document.querySelector('[data-testid=draftsman-dock]').scrollHeight"), ['screenshot',shot(`${label}-dock-bottom`)]);
}
tablets.push(button('Close Draftsman mode'),wait("!document.querySelector('[data-testid=draftsman-dock]')"),['screenshot',shot('tablet-portrait-restored')],['errors']);
const write=(name,value)=>fs.writeFileSync(`${base}/${name}`,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
write('desktop-exports.json',desktop);write('tablet-controls.json',tablets);
write('cleanup.json',[cleanup]);
const identities=['src/studio/MagicPencilDraftsman.ts','src/studio/SourceBuildingViewer.tsx','src/studio/DraftsmanControlDock.tsx','src/studio/blueprintBook.ts','src/studio/blueprintSheet.ts','src/studio/draftsman.css'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
write('prepared-manifest.json',{status:'prepared-not-executed',tag,origin:'http://127.0.0.1:8093',createdAt:new Date().toISOString(),buildArtifact:'MUST record actual 8093 run identity before acceptance',source:identities,expectedDownloads:[`${tag}-01.png`,`${tag}-02.png`,`${tag}-03.pdf`],commands:{desktop:desktop.length,tablet:tablets.length},screenshots:[...desktop,...tablets].filter(c=>c[0]==='screenshot').map(c=>c[1])});
console.log(JSON.stringify({base,desktopCommands:desktop.length,tabletCommands:tablets.length}));
