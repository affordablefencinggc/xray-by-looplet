import fs from 'node:fs';
const model=process.env.XRAY_AI_MODEL;let report;
try {const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model),{headers:{'x-goog-api-key':process.env.GEMINI_API_KEY},redirect:'error',signal:AbortSignal.timeout(20000)});const body=await r.json();report={checkedAt:new Date().toISOString(),model,httpStatus:r.status,available:r.ok,returnedModel:r.ok?body.name:null,status:r.ok?'Model access verified':(body.error?.status||'Request rejected'),generationRequested:false};} catch {report={model,available:false,status:'Model access could not be verified',generationRequested:false};}
fs.writeFileSync('proof/audit/IW-DESKTOP-REFRESH-20260906/model-access.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
