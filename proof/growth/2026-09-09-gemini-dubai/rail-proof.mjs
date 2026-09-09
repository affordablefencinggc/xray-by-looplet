import { writeFileSync } from 'node:fs';
const commands = [
  ['open', 'http://127.0.0.1:8080/'],
  ['set', 'viewport', '1440', '900'],
  ['wait', '--fn', "!!document.querySelector('.live-assistant-launcher')"],
  ['click', '.live-assistant-launcher'],
];
const bounds = `(() => {
 const rail = document.querySelector('.studio-right-rail, .building-inspector, .measure-inspector');
 const panel = document.querySelector('.live-assistant-panel');
 if (!rail || !panel) return false;
 const r=rail.getBoundingClientRect(), p=panel.getBoundingClientRect();
 return r.width>300 && Math.abs(p.left-r.left)<2 && Math.abs(p.right-innerWidth)<2 && Math.abs(p.bottom-innerHeight)<2 && getComputedStyle(panel).borderRadius==='0px';
})()`;
for (const [width,height] of [[1440,900],[1024,768]]) {
 commands.push(['set','viewport',String(width),String(height)]);
 for (const name of ['Overview','Sheets','Measure','Sketch','Components','Model','Render','Review','Cost','Proof']) {
  commands.push(['find','role','button','click','--name',name,'--exact']);
  commands.push(['wait','--fn',`document.querySelector('.workspace-rails')?.dataset.pane === '${name.toLowerCase()}'`]);
  commands.push(['wait','--fn',bounds]);
  commands.push(['eval',`if (!${bounds}) throw Error('${name} rail bounds'); ({page:'${name}', width:innerWidth, rail:document.querySelector('.live-assistant-panel').getBoundingClientRect().toJSON()})`]);
 }
 commands.push(['wait','--fn',"!document.querySelector('.assistant-canvas-action button')?.disabled"]);
 commands.push(['find','role','button','click','--name','Open canvas','--exact']);
 commands.push(['wait','--fn',"document.querySelector('.workspace-rails')?.dataset.canvasFocus === 'true'"]);
 commands.push(['wait','--fn',bounds]);
 commands.push(['eval',`(() => { const c=document.querySelector('.arch-canvases, .building-stage').getBoundingClientRect(); const p=document.querySelector('.live-assistant-panel').getBoundingClientRect(); if(Math.abs(c.left)>2 || Math.abs(c.right-p.left)>2) throw Error('Canvas must fill only the space beside chat'); return {canvas:c.toJSON(),chat:p.toJSON()}; })()`]);
 commands.push(['screenshot',`screenshots/gemini-dubai-capacity/rail-canvas-${width}.png`]);
 commands.push(['find','role','button','click','--name','Exit canvas','--exact']);
 commands.push(['find','role','button','click','--name','Collapse right menu','--exact']);
 commands.push(['wait','--fn',"getComputedStyle(document.querySelector('.live-assistant')).display === 'none'"]);
 commands.push(['find','role','button','click','--name','Expand right menu','--exact']);
 commands.push(['wait','--fn',bounds]);
 commands.push(['find','role','button','click','--name','Collapse live assistant','--exact']);
 commands.push(['wait','--fn',"!document.querySelector('.live-assistant.is-open')"]);
 commands.push(['screenshot',`screenshots/gemini-dubai-capacity/rail-collapsed-${width}.png`]);
 commands.push(['click','.live-assistant-launcher']);
}
commands.push(['errors']);
writeFileSync(new URL('./rail-layout.scenario.json',import.meta.url),JSON.stringify(commands,null,2));
