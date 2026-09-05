import { request } from 'node:http';
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const checks=[];
const get=(path,method='GET',headers={})=>new Promise((resolve,reject)=>{const req=request({hostname:'127.0.0.1',port:8097,path,method,headers},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,bytes:Buffer.concat(chunks)}));});req.on('error',reject);req.end();});
for(const [name,path,method,headers,status] of [
 ['gallery','/','GET',{},200],['write-refusal','/','POST',{},405],['foreign-host','/','GET',{Host:'external.example'},403],['foreign-origin','/','GET',{Origin:'https://external.example'},403],['non-allowlisted-source','/artifact?path=package.json','GET',{},404],['traversal','/artifact?path=..%2Fpackage.json','GET',{},400],['double-encoding','/artifact?path=%252e%252e%252fpackage.json','GET',{},400],['environment-file','/.env','GET',{},404],
]) {const result=await get(path,method,headers);assert.equal(result.status,status,name);checks.push({name,path,status:result.status,bytes:result.bytes.length});if(name==='gallery'){assert.match(result.headers['content-security-policy'],/img-src 'self'/);assert.match(result.headers['content-security-policy'],/frame-ancestors 'none'/);assert.equal(result.headers['x-content-type-options'],'nosniff');}}
writeFileSync('proof/audit/IW-GALLERY-REVIEW/http-results.json',JSON.stringify(checks,null,2));console.log(JSON.stringify(checks));
