import fs from 'node:fs';
import {compileBomRequest} from 'file:///C:/Users/danie/XRayBuilds/runs/e173b12b942c/source/src/studio/bomCompiler.ts';
const dir='C:/Users/danie/XRayBuilds/native-industry-e173b12b942c-ui1';
const proof=JSON.parse(fs.readFileSync(dir+'/generate-equal-result.json','utf8'));
const v=proof.receipts.find(r=>r.name==='saved-result').value;
const result=await compileBomRequest({job:v.job,recipeSet:v.recipe.recipeSet,hydrationSettled:true,runtimeAssets:{document:{state:'ready'},photos:{}},requestId:'qa-derived-replay-e173-equal-20260913'});
fs.writeFileSync(dir+'/derived-replay.json',JSON.stringify({provenance:'Derived from actual persisted UI readback with same-build compiler; not intercepted network request. Readiness confirmed by original successful compile and native source-byte binding; no photos.',result},null,2),{flag:'wx'});
if(!result.ok)throw Error(JSON.stringify(result));
fs.writeFileSync(dir+'/derived-request.json',JSON.stringify(result.request,null,2),{flag:'wx'});
console.log(JSON.stringify({requestId:result.request.requestId,runs:result.request.runs.map(r=>({id:r.id,recipeId:r.recipeId})),recipes:result.request.recipeSet.recipes.map(r=>({id:r.id,assumptions:r.assumptions.map(a=>({id:a.id,status:a.status}))}))}));

