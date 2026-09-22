import {readFileSync,writeFileSync} from 'node:fs';
const ops=JSON.parse(readFileSync('proof/growth/2026-09-23-assistant-repair/verify-02.json'));
ops.splice(8,0,['wait','--fn',"Math.abs(document.querySelector('.live-assistant-panel').getBoundingClientRect().bottom-innerHeight)<3"]);
ops.splice(ops.length-1,0,
 ['eval',"(()=>{const r=document.querySelector('.measure-inspector');if(getComputedStyle(r).visibility==='hidden')throw Error('Calibration inspector hidden while chat closed');[...document.querySelectorAll('button')].find(b=>b.textContent==='Measure a run').click();return true})()"],
 ['wait','--fn',"window.__sourceTest.getState().tool==='length'"],
 ['drag','--from',"(()=>{const r=document.querySelector('[aria-label=\"Plan drawing canvas\"]').getBoundingClientRect();return {x:r.x+r.width*.45,y:r.y+r.height*.4}})()",'--to',"(()=>{const r=document.querySelector('[aria-label=\"Plan drawing canvas\"]').getBoundingClientRect();return {x:r.x+r.width*.45,y:r.y+r.height*.4}})()",'--steps','1'],
 ['wait','--fn',"window.__sourceTest.getState().pending.length===1"],
 ['drag','--from',"(()=>{const r=document.querySelector('[aria-label=\"Plan drawing canvas\"]').getBoundingClientRect();return {x:r.x+r.width*.6,y:r.y+r.height*.4}})()",'--to',"(()=>{const r=document.querySelector('[aria-label=\"Plan drawing canvas\"]').getBoundingClientRect();return {x:r.x+r.width*.6,y:r.y+r.height*.4}})()",'--steps','1'],
 ['wait','--fn',"window.__sourceTest.getState().pending.length===2"],
 ['eval',"[...document.querySelectorAll('button')].find(b=>b.textContent.startsWith('Finish trace')).click()"],
 ['wait','--fn',"window.__sourceTest.getState().job.runs.some(r=>r.sheet===11&&r.lengthM>0)"],
 ['screenshot','measured-after-calibration.png'],
 ['eval',"(()=>{const s=window.__sourceTest.getState();return {calibration:s.currentCalibration,runs:s.job.runs.filter(r=>r.sheet===11),evidence:'UI click trial only; arbitrary endpoints are not source dimensions'}})()"]
);
writeFileSync('proof/growth/2026-09-23-assistant-repair/verify-03.json',JSON.stringify(ops,null,2));
const prod=ops.slice(0,ops.findIndex(o=>o[0]==='eval'&&o[1].includes('captureScreenContext')));
prod.push(['eval',"document.querySelector('[aria-label=\"MCP connections\"]').click()"],['wait','--fn',"document.querySelector('.mcp-connection-body')?.textContent.includes('Configuration ready')"],['eval',"[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Test external connection')).click()"],['wait','--fn',"document.querySelector('.mcp-connection-body')?.textContent.includes('External MCP verified: 6')"],['screenshot','production-external-mcp.png'],['eval',"document.querySelector('[aria-label=\"Close External model connections\"]').click()"],['set','viewport','1024','768'],['eval',"document.querySelector('.live-assistant-launcher').click()"],['wait','--fn',"!!document.querySelector('#live-assistant-prompt')"],['eval',"(()=>{const r=document.querySelector('#live-assistant-prompt').getBoundingClientRect();if(r.bottom>innerHeight||document.documentElement.scrollWidth>innerWidth)throw Error('Tablet overflow');return true})()"],['screenshot','production-tablet.png'],['errors']);
writeFileSync('proof/growth/2026-09-23-assistant-repair/production.json',JSON.stringify(prod,null,2));
