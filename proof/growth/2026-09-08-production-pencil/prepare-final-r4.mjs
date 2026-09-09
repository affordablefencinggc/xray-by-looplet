import fs from 'node:fs';
const root='proof/growth/2026-09-08-production-pencil',base=root+'/2026-09-08-8095-pencil-final-01';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const badge=['eval',"(()=>{if(!document.body.textContent.includes('Build 71f5b012342b'))throw Error('Wrong production artifact');return {build:'71f5b012342b',origin:location.origin};})()"];
const desktop=read(base+'/desktop-exports.json').map(c=>c.map(v=>v.replaceAll('http://127.0.0.1:8093','http://127.0.0.1:8095')));desktop.splice(3,0,badge);
fs.writeFileSync(base+'/desktop-exports.json',JSON.stringify(desktop,null,2));
const tablets=read(root+'/dev-bottom-r3-layoutretry.json').map(c=>c.map(v=>v.replaceAll('http://127.0.0.1:8080','http://127.0.0.1:8095').replaceAll('2026-09-08-dev-bottom-r3-layoutretry-','2026-09-08-8095-pencil-final-01-production-controls-')));tablets.splice(3,0,badge);
for(let i=0;i<tablets.length;i++){if(tablets[i][0]==='screenshot'){const p=tablets[i][1].replace('.png','-top-scroll.png');tablets.splice(i+1,0,['eval',"document.querySelector('[data-testid=draftsman-dock]').scrollTop=0"],['screenshot',p]);i+=2;}}
fs.writeFileSync(base+'/all-controls.json',JSON.stringify(tablets,null,2));
const init=[['open','http://127.0.0.1:8095/'],['wait','--fn',"document.querySelector('.workbench')?.dataset.hydrationStatus==='ready'"],badge,['get','cdp-url']];
fs.writeFileSync(base+'/initialize.json',JSON.stringify(init,null,2));
const manifest=read(base+'/prepared-manifest.json');manifest.origin='http://127.0.0.1:8095';manifest.expectedBuild='71f5b012342b';manifest.buildArtifact='71f5b012342b - must confirm badge at execution';manifest.commands={desktop:desktop.length,allControls:tablets.length};manifest.screenshots=[...desktop,...tablets].filter(c=>c[0]==='screenshot').map(c=>c[1]);fs.writeFileSync(base+'/prepared-manifest.json',JSON.stringify(manifest,null,2));
console.log(JSON.stringify({base,desktop:desktop.length,allControls:tablets.length,expectedBuild:manifest.expectedBuild}));
