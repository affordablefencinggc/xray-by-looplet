import {writeFileSync} from 'node:fs';
const check=`(() => { const rail=document.querySelector('.studio-right-rail,.building-inspector,.measure-inspector'); const r=rail?.getBoundingClientRect(); const buttons=[document.querySelector('.rail-assistant-toggle'),document.querySelector('.rail-controls-right .rail-toggle')]; if(!r||buttons.some(b=>!b))return false; return buttons.every(b=>{const q=b.getBoundingClientRect(); const s=getComputedStyle(b,'::before');return Math.abs(q.left+q.width/2-r.left)<2 && s.backgroundImage.includes('linear-gradient') && b.contains(document.elementFromPoint(q.left+q.width/2,q.top+q.height/2));}); })()`;
const cmds=[['open','http://127.0.0.1:8080/'],['set','viewport','1440','900'],['wait','--fn',"!!document.querySelector('.live-assistant-launcher,.live-assistant-panel')"],['eval',"if(!document.querySelector('.live-assistant.is-open'))document.querySelector('.live-assistant-launcher').click()"]];
for(const [w,h] of [[1440,900],[1024,768]]){
 cmds.push(['set','viewport',String(w),String(h)]);
 for(const name of ['Overview','Sheets','Measure','Sketch','Components','Model','Render','Review','Cost','Proof']){
 cmds.push(['find','role','button','click','--name',name,'--exact'],['wait','--fn',`document.querySelector('.workspace-rails')?.dataset.pane==='${name.toLowerCase()}'`],['wait','--fn',check]);
 }
 cmds.push(['screenshot',`screenshots/gemini-dubai-capacity/seam-controls-open-${w}.png`],['find','role','button','click','--name','Collapse live assistant','--exact'],['wait','--fn',check],['screenshot',`screenshots/gemini-dubai-capacity/seam-controls-closed-${w}.png`],['click','.live-assistant-launcher']);
}
cmds.push(['errors']);
writeFileSync(new URL('./seam-controls.scenario.json',import.meta.url),JSON.stringify(cmds,null,2));
