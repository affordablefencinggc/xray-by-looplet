import {readFileSync,writeFileSync} from 'node:fs';
const path='proof/growth/2026-09-23-assistant-repair/verify.json';
const ops=JSON.parse(readFileSync(path));
const dragCheck=ops.findIndex(o=>o[0]==='eval'&&o[1].includes('Drag resize not saved'));
ops[dragCheck]=['wait','--fn',"Number(document.querySelector('.arch-view-divider').getAttribute('aria-valuenow'))>50 && Number(document.querySelector('.arch-view-divider').getAttribute('aria-valuenow'))===Number(localStorage.getItem('xray:plan-model-split:v1'))"];
const mcpWait=ops.findIndex(o=>o[0]==='wait'&&o[2].includes('workspace tools connected'));
ops.splice(mcpWait,1,['wait','--fn',"document.querySelector('.mcp-connection-body')?.textContent.includes('Configuration ready')"],['eval',"[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Test external connection')).click()"],['wait','--fn',"document.querySelector('.mcp-connection-body')?.textContent.includes('External MCP verified: 6')"]);
for(const op of ops)if(op[0]==='eval'&&op[1].includes('Close MCP connections'))op[1]=op[1].replace('Close MCP connections','Close External model connections');
ops.splice(ops.length-1,0,
 ['set','viewport','1440','900'],
 ['eval',`(async()=>{const {useStudio}=await import('/src/studio/store.ts');const {inspectPlanBytes}=await import('/src/studio/documents.ts');const bytes=new Uint8Array(await(await fetch('/models/redburn/source.pdf')).arrayBuffer());const imported=await inspectPlanBytes({name:'21-08-26_Redburn_BR250157_Prelim_Council (1).pdf',bytes,source:'web'});await useStudio.getState().importPlan(imported);useStudio.getState().setSheet(11);useStudio.getState().setPane('measure');window.__sourceTest=useStudio;return imported.binary.sha256})()`],
 ['wait','--fn',"!!document.querySelector('.printed-scale-action') && document.querySelector('img.document-source-page')?.complete"],
 ['eval',`(()=>{const s=window.__sourceTest.getState();const legacy={...s.currentCalibration,coordinateSpace:undefined};window.__sourceTest.setState({job:{...s.job,calibrations:s.job.calibrations.map(c=>c.sheet===s.sheet?legacy:c)},currentCalibration:legacy});return 'legacy calibration fixture on exact original source'})()`],
 ['wait','--fn',"[...document.querySelectorAll('button')].some(b=>b.textContent==='Use drawing scale 1:250')"],
 ['screenshot','scale-found-page12.png'],
 ['eval',"[...document.querySelectorAll('button')].find(b=>b.textContent==='Use drawing scale 1:250').click()"],
 ['wait','--fn',"window.__sourceTest.getState().currentCalibration.locked && window.__sourceTest.getState().currentCalibration.coordinateSpace==='source-page-v1'"],
 ['eval',`(()=>{const s=window.__sourceTest.getState();if(Math.abs(s.scaleM-250*.0254/72)>1e-12||s.calibrationError)throw Error('Scale wrong');return {sheet:s.sheet,calibration:s.currentCalibration,source:s.activePlanBinary.sha256,recoveryKeys:Object.keys(localStorage).filter(k=>k.startsWith('xray:scale-recovery:'))}})()`],
 ['screenshot','scale-applied-page12.png'],
 ['eval',`(async()=>{const {captureScreenContext}=await import('/src/studio/assistant/screenContext.ts');const s=await captureScreenContext();if(!s.images.length||!s.text.includes('source plan'))throw Error('PDF not visible to assistant');return {text:s.text,images:s.images.map(i=>({mimeType:i.mimeType,bytes:i.data.length}))}})()`]
);
writeFileSync('proof/growth/2026-09-23-assistant-repair/verify-02.json',JSON.stringify(ops,null,2));
