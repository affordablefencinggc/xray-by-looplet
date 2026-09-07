import fs from 'node:fs';
import { navigationMovementSegment, SOURCE_CANVAS } from './navigation-movement-scenarios.mjs';
const root='proof/growth/2026-09-08-navigation-release';
const stamp=process.argv[2];
if(!/^[a-z0-9-]+$/.test(stamp??'')) throw Error('Pass a unique evidence tag');
const click=name=>['find','role','button','click','--name',name,'--exact'];
const wait=predicate=>['wait','--fn',predicate];
const canvas="document.querySelector('.building-canvas canvas')";
const shot=name=>['screenshot',`screenshots/growth/${stamp}-${name}.png`];
const commands=[
 click('Fly'),wait(`${canvas}?.dataset.navigation==='fly'`),
 ['eval',`window.__growthFlyFrame=Number(${canvas}.dataset.frameCount); 'Await settled Fly telemetry'`],
 wait(`Number(${canvas}.dataset.frameCount)>window.__growthFlyFrame`),
 ['eval',`(()=>{const c=${canvas};if(c.dataset.navigationCapture!=='drag')throw Error('Expected injected capture refusal');window.__growthYawBefore=Number(c.dataset.navigationYaw);const r=c.getBoundingClientRect();window.__growthDrag={x:r.left+r.width/2,y:r.top+r.height/2};return 'Drag-look check ready'})()`],
 ['eval',`(()=>{const c=${canvas},{x,y}=window.__growthDrag;c.dispatchEvent(new PointerEvent('pointerdown',{pointerId:73,pointerType:'mouse',button:0,buttons:1,clientX:x,clientY:y,bubbles:true}));document.dispatchEvent(new PointerEvent('pointermove',{pointerId:73,pointerType:'mouse',buttons:1,clientX:x+100,clientY:y,bubbles:true}));document.dispatchEvent(new PointerEvent('pointerup',{pointerId:73,pointerType:'mouse',button:0,buttons:0,clientX:x+100,clientY:y,bubbles:true}));return 'Dragged 100px right'})()`],
 wait(`Math.abs(Number(${canvas}.dataset.navigationYaw)-window.__growthYawBefore+0.2)<0.001`),
 shot('fly-drag'),
 ['eval',`${canvas}.requestPointerLock=window.__growthCaptureOriginal; 'Original capture API restored'`],
 click('Capture mouse'),wait(`${canvas}.dataset.navigationCapture==='locked'&&document.pointerLockElement===${canvas}`),
 ...navigationMovementSegment({canvasSelector:SOURCE_CANVAS,mode:'fly',tag:stamp+'-fly',screenshotPrefix:`screenshots/growth/${stamp}-fly`}),
 click('Walk-through'), wait("document.querySelector('.walk-start-picker')?.dataset.startReady==='true'"),
 ['eval',"(()=>{const c=document.querySelector('.walk-start-picker canvas'),r=c.getBoundingClientRect();c.dispatchEvent(new MouseEvent('click',{clientX:r.left+2,clientY:r.top+2,bubbles:true}));return 'Unsupported edge selected'})()"],
 wait("document.querySelector('.walk-start-picker')?.dataset.startReady==='false'"),
 ['eval',"(()=>{const b=[...document.querySelectorAll('.walk-start-picker button')].find(b=>b.textContent==='Start walking here');if(!b?.disabled||!document.querySelector('.walk-start-picker [role=alert]'))throw Error('Invalid placement not refused');return 'Unsupported placement blocked without losing the previous recommendation'})()"],shot('invalid-start'),
 ['click','.walk-start-suggestions button:first-child'],wait("document.querySelector('.walk-start-picker')?.dataset.startReady==='true'"),
 shot('ground-picker'),click('Start walking here'),
 ...navigationMovementSegment({canvasSelector:SOURCE_CANVAS,mode:'walk',tag:stamp+'-ground',screenshotPrefix:`screenshots/growth/${stamp}-ground`,expectedEyeHeight:1.665}),
 click('Reset model view'),
 ['eval',"(()=>{const top=document.querySelector('[aria-label=\"3D view controls\"]'),bottom=document.querySelector('[aria-label=\"Model navigation\"]');if(bottom?.querySelectorAll('button').length!==5)throw Error('Bottom controls missing');for(const b of [...bottom.querySelectorAll('button'),...[...top.querySelectorAll('button')].filter(b=>['Fly','Walk-through'].includes(b.textContent))]){const r=b.getBoundingClientRect();if(r.width<1||r.height<1||r.top<0||r.bottom>innerHeight||r.left<0||r.right>innerWidth||!b.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)))throw Error('Unreachable '+b.textContent);}return 'Top Fly/Walk and all five bottom buttons reachable'})()"],shot('controls'),['errors']
];
fs.writeFileSync(`${root}/${stamp}-journeys.json`,JSON.stringify(commands,null,2)+'\n',{flag:'wx'});
console.log({file:`${root}/${stamp}-journeys.json`,commands:commands.length});
