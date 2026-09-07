import fs from 'node:fs';
const tag=process.argv[2];if(!/^[a-z0-9-]+$/.test(tag??''))throw Error('Unique evidence tag required');
const click=name=>['find','role','button','click','--name',name,'--exact'];
const screenshot=name=>['screenshot',`screenshots/growth/${tag}-${name}.png`];
const controls="(()=>{const top=document.querySelector('[aria-label=\"3D view controls\"]'),bottom=document.querySelector('[aria-label=\"Model navigation\"]');if(bottom?.querySelectorAll('button').length!==5)throw Error('Bottom controls missing');const bs=[...bottom.querySelectorAll('button'),...[...top.querySelectorAll('button')].filter(b=>['Fly','Walk-through'].includes(b.textContent))];for(const b of bs){const r=b.getBoundingClientRect();if(r.width<43.9||r.height<43.9||r.top<0||r.bottom>innerHeight||r.left<0||r.right>innerWidth||!b.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)))throw Error('Unreachable/undersized '+b.textContent);}if(document.documentElement.scrollWidth>innerWidth+1)throw Error('Page overflow');return {viewport:[innerWidth,innerHeight],reachable:bs.length,minTarget:44}})()";
const commands=[];
for(const [w,h,name]of[[1024,768,'landscape'],[768,1024,'portrait']])commands.push(
 ['set','viewport',String(w),String(h)],['eval',controls],screenshot(name+'-controls'),click('Walk-through'),
 ['wait','--fn',"document.querySelector('.walk-start-picker')?.dataset.startReady==='true'"],
 ['eval',"(()=>{const b=document.querySelector('.walk-start-suggestions button');if(b.getBoundingClientRect().height<44)throw Error('Small suggested-start target');const style=getComputedStyle(b.querySelector('strong'));return {selectedTitle:style.color,background:getComputedStyle(b).backgroundColor}})()"],screenshot(name+'-picker'),
 ['eval',"document.querySelector('.walk-start-footer button').scrollIntoView({block:'center'})"],
 ['wait','--fn',"(()=>{const b=document.querySelector('.walk-start-footer button'),r=b.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&b.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2))})()"],
 ['eval',"(()=>{const b=document.querySelector('.walk-start-footer button'),r=b.getBoundingClientRect();if(b.disabled||r.height<44||r.width<44||r.bottom>innerHeight||!b.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)))throw Error('Start button inaccessible');return 'Start action reachable by dialog scrolling'})()"],screenshot(name+'-start'),click('Close Pick your walking start')
);
commands.push(['errors']);
fs.writeFileSync(`proof/growth/2026-09-08-navigation-release/${tag}-tablet.json`,JSON.stringify(commands,null,2)+'\n',{flag:'wx'});
