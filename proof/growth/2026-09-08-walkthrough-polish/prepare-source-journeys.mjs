import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const tag=process.argv[2];
if(!/^[a-z0-9-]+$/.test(tag??''))throw Error('Usage: node prepare-source-journeys.mjs <unique-candidate-tag>');
const root=path.resolve(import.meta.dirname,'../../..'), prior=path.join(root,'proof/growth/2026-09-08-walk-boundaries');
const canvas="document.querySelector('.building-canvas canvas')", svg="document.querySelector('.walk-clean-plan')";
const ev=text=>['eval',text],wait=text=>['wait','--fn',text];
const title='Pick your walkthrough starting point';
const pointInView=(x,z)=>`(()=>{const s=${svg},d=s?.closest('dialog');if(!s||!d)return false;const m=s.getScreenCTM();if(!m)return false;const p=new DOMPoint(${x},${z}).matrixTransform(m),r=d.getBoundingClientRect(),hit=document.elementFromPoint(p.x,p.y);return p.y>r.top+35&&p.y<r.bottom-30&&p.x>r.left&&p.x<r.right&&hit?.closest('svg')===s})()`;
const selectWorld=(x,z)=>[
  wait(`!!${svg}&&document.querySelector('dialog[open]')?.getAttribute('aria-label')===${JSON.stringify(title)}`),
  ev(`(()=>{const d=document.querySelector('dialog[open]'),b=d.querySelector('[aria-label=${JSON.stringify('Close '+title)}]'),r=b?.getBoundingClientRect();if(!r||r.height<44||r.width<44)throw Error('Picker Close target below44px');const s=${svg};s.scrollIntoView({block:'center',behavior:'instant'});const p=new DOMPoint(${x},${z}).matrixTransform(s.getScreenCTM()),box=d.getBoundingClientRect();d.scrollTop+=p.y-Math.min(Math.max(p.y,box.top+100),box.bottom-80);return 'Exact title and Close target checked; SVG world point scrolled into view'})()`),
  wait(pointInView(x,z)),
  ev(`(()=>{const s=${svg},p=new DOMPoint(${x},${z}).matrixTransform(s.getScreenCTM());const event=new MouseEvent('click',{clientX:p.x,clientY:p.y,bubbles:true});const actual=new DOMPoint(event.clientX,event.clientY).matrixTransform(s.getScreenCTM().inverse());if(Math.hypot(actual.x-(${x}),actual.y-(${z}))>.08)throw Error('Pointer rounding exceeds placement tolerance');s.dispatchEvent(event);window.__selectedWalkPoint={requested:[${x},${z}],actual:[actual.x,actual.y]};return window.__selectedWalkPoint})()`)
];
const startReachable=[
  ev("(()=>{const b=[...document.querySelectorAll('dialog[open] button')].find(b=>b.textContent.trim()==='Start walking here');if(!b)throw Error('Start button missing');b.scrollIntoView({block:'center',behavior:'instant'});return 'Start action scrolled into view'})()"),
  wait("(()=>{const b=[...document.querySelectorAll('dialog[open] button')].find(b=>b.textContent.trim()==='Start walking here'),r=b?.getBoundingClientRect();return !!r&&!b.disabled&&r.height>=44&&r.width>=44&&r.top>=0&&r.bottom<=innerHeight&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===b})()")
];
const prepared=[];
for(const kind of ['source','native']) {
  const oldTag=kind==='source'?'walk-boundaries-built-release':'walk-boundaries-native-release';
  const template=path.join(prior,oldTag+'.json'), input=fs.readFileSync(template,'utf8'), old=JSON.parse(input);
  const prefix=`${tag}-${kind}`, output=[], replacements={points:0,arm:0};
  for(const original of old) {
    const command=original.map(value=>value.replaceAll(oldTag,prefix).replaceAll('Pick your walking start',title));
    const body=command.join(' ');
    if(command[0]==='eval'&&body.includes(".walk-start-picker canvas")) {
      const point=replacements.points++===0?[0,2.1]:[-6.2,2.8];output.push(...selectWorld(...point));continue;
    }
    if(command[0]==='find'&&command.includes('Start walking here')) output.push(...startReachable);
    if(command[0]==='wait'&&body.includes('walkDoorProgress')&&body.includes('>.15')) {
      replacements.arm++;
      output.push(wait(`${canvas}.dataset.walkArmAsset==='ready'&&${canvas}.dataset.walkArmAnchor==='camera-body'&&${canvas}.dataset.walkArmVisible==='true'&&Number(${canvas}.dataset.walkDoorProgress)>=.2&&Number(${canvas}.dataset.walkDoorProgress)<=.6&&Number(${canvas}.dataset.walkArmProgress)>=.2&&Number(${canvas}.dataset.walkArmProgress)<=.6`));
      output.push(ev(`(()=>{const c=${canvas};window.__armCapture={asset:c.dataset.walkArmAsset,anchor:c.dataset.walkArmAnchor,visible:c.dataset.walkArmVisible,doorProgress:Number(c.dataset.walkDoorProgress),armProgress:Number(c.dataset.walkArmProgress),frame:Number(c.dataset.frameCount)};if(window.__armCapture.doorProgress<.2||window.__armCapture.doorProgress>.6)throw Error('Missed opening capture window');return {bodyArmBeforeScreenshot:window.__armCapture}})()`));
      continue;
    }
    output.push(command);
    if(command[0]==='wait'&&body.includes('dataset.meshCount')) output.push(wait(`${canvas}.dataset.walkArmAsset==='ready'&&${canvas}.dataset.walkArmAnchor==='camera-body'`));
    if(command[0]==='screenshot'&&command[1].endsWith('-reach.png')) {
      output.push(ev(`(()=>{const c=${canvas};return {bodyArmAfterScreenshot:{asset:c.dataset.walkArmAsset,anchor:c.dataset.walkArmAnchor,progress:Number(c.dataset.walkArmProgress),frame:Number(c.dataset.frameCount),visible:c.dataset.walkArmVisible,note:'Capture latency may advance animation; inspect the actual screenshot for visible attached arm'}}})()`));
    }
    if(command[0]==='screenshot'&&command[1].endsWith('-slide-open.png')) output.push(wait(`${canvas}.dataset.walkArmVisible==='false'`));
  }
  if(replacements.points!==2||replacements.arm!==1)throw Error('Unexpected preserved template shape; inspect before generating '+kind);
  if(JSON.stringify(output).includes('.walk-start-picker canvas')||JSON.stringify(output).includes('Pick your walking start'))throw Error('Old picker selector survived');
  for(const command of output) {
    if(command[0]==='eval')new Function(command[1]);
    if(command[0]==='wait'&&command[1]==='--fn')new Function(`return (${command[2]});`);
  }
  const file=path.join(import.meta.dirname,prefix+'.json');fs.writeFileSync(file,JSON.stringify(output,null,2)+'\n',{flag:'wx'});
  prepared.push({kind,file:path.relative(root,file),commands:output.length,template:path.relative(root,template),templateSha256:createHash('sha256').update(input).digest('hex')});
}
console.log(JSON.stringify({prepared,executed:false,prerequisites:['Source journey assumes the target candidate is open and the Redburn PDF was imported through the UI.','Native journey retains the existing isolated QA job/sheets/bookmark/backup assertions from its original full journey. Pass the new candidate CDP port; do not run the normal installed profile.','Both journeys choose SVG world coordinates, log actual rounded points, and use stair landing z2.8. The .2-.6 capture window is asserted before the screenshot; post-capture telemetry records elapsed animation without a timing failure. Inspect the actual image.'],runner:'node scripts/fast-cdp-test.mjs <isolated-session> <generated-scenario.json> [--cdp <candidate-port>]'},null,2));
