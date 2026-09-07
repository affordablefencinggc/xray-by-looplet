import fs from 'node:fs';
const tag=process.argv[2];if(!/^[a-z0-9-]+$/.test(tag??''))throw Error('Unique tag required');
const click=name=>['find','role','button','click','--name',name,'--exact'];
const commands=[click('Model'),['wait','--fn',"document.querySelector('.building-canvas canvas')?.dataset.meshCount==='198'"]];
for(const [w,h,name]of[[1024,768,'landscape'],[768,1024,'portrait']])commands.push(
 ['set','viewport',String(w),String(h)],
 ['eval',"(()=>{const c=document.querySelector('.building-canvas canvas');window.__tabletCapture=c.requestPointerLock;c.requestPointerLock=()=>Promise.reject(new DOMException('Tablet QA capture refusal','NotAllowedError'));return 'Isolated tablet refusal enabled'})()"],click('Fly'),
 ['wait','--fn',"document.querySelector('.building-canvas canvas')?.dataset.navigation==='fly'&&document.querySelector('.building-canvas canvas')?.dataset.navigationCapture==='drag'"],
 ['eval',"(()=>{const b=[...document.querySelectorAll('.building-toolbar button')].find(b=>b.textContent==='Capture mouse'),r=b.getBoundingClientRect();if(r.width<44||r.height<44||r.top<0||r.bottom>innerHeight||!b.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)))throw Error('Capture action inaccessible');for(const b of document.querySelectorAll('[aria-label=\"Model navigation\"] button')){const r=b.getBoundingClientRect();if(!b.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)))throw Error('Bottom button obscured in fallback');}return {capture:'drag',retry:'reachable',bottomControls:5}})()"],
 ['eval',"(()=>{const hint=document.querySelector('.building-navigation-hint'),a=document.querySelector('.live-assistant-launcher'),h=hint.getBoundingClientRect(),r=a.getBoundingClientRect();if(h.top<0||h.bottom>innerHeight||Math.min(h.right,r.right)>Math.max(h.left,r.left)&&Math.min(h.bottom,r.bottom)>Math.max(h.top,r.top))throw Error('Assistant obscures navigation instructions');return {hintVisible:true,hintBottom:h.bottom,assistantTop:r.top}})()"],
 ['screenshot',`screenshots/growth/${tag}-${name}-fallback.png`],click('Orbit'),
 ['eval',"document.querySelector('.building-canvas canvas').requestPointerLock=window.__tabletCapture; 'Real capture method restored'"],
 ['wait','--fn',"document.querySelector('.building-canvas canvas')?.dataset.navigation==='orbit'"]
);
commands.push(['errors']);fs.writeFileSync(`proof/growth/2026-09-08-navigation-release/${tag}-tablet-fallback.json`,JSON.stringify(commands,null,2)+'\n',{flag:'wx'});
