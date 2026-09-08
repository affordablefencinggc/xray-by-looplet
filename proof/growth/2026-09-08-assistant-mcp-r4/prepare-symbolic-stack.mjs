import fs from 'node:fs';
const base='proof/growth/2026-09-08-assistant-mcp-r4';
let source=fs.readFileSync(base+'/read-main-thread-stack.ps1','utf8');
source=source.replaceAll('XRayReadStack','XRayReadStackSymbols')
 .replace('Read(uint pid,uint tid)','Read(uint pid,uint tid,string symbolPath)')
 .replace('SymInitialize(p,"",true)','SymInitialize(p,symbolPath,true)')
 .replace('::Read(53296,34540)',"::Read(53296,34540,(Join-Path $taskRoot 'diagnostic-symbols'))")
 .replace('qa-close-main-thread-stack.json','qa-close-main-thread-stack-symbols.json');
fs.writeFileSync(base+'/read-main-thread-stack-symbols.ps1',source,{flag:'wx'});
