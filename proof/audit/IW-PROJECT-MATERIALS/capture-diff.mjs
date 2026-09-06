import fs from 'node:fs';import {spawnSync} from 'node:child_process';import crypto from 'node:crypto';
const dir='proof/audit/IW-PROJECT-MATERIALS';
const pairs=[['before/Studio.tsx','src/studio/Studio.tsx'],['before/DocumentPreview.tsx','src/studio/DocumentPreview.tsx'],['before/styles.css','src/styles.css'],['before/package.json','package.json'],['before/package-lock.json','package-lock.json'],['before/vite.config.ts','vite.config.ts'],...['ProjectMaterialsPanel.tsx','projectMaterialsPersistence.ts','MaterialSourceLibrary.tsx','materialLibrarySource.ts','materialDiscovery.ts','materialOcr.ts','construction/projectMaterials.ts','construction/projectMaterials.test.ts','construction/thorntonLibrary.ts','construction/thorntonMaterials.ts'].map(f=>[null,'src/studio/'+f])];
let diff='';for(const [before,after]of pairs){const r=spawnSync('git',['diff','--no-index','--',before?dir+'/'+before:'/dev/null',after],{encoding:'utf8',maxBuffer:10*1024*1024});if(![0,1].includes(r.status))throw Error(r.stderr);diff+=r.stdout;const check=spawnSync('git',['diff','--no-index','--check','--',before?dir+'/'+before:'/dev/null',after],{encoding:'utf8'});if(check.stdout)throw Error(check.stdout);}
fs.writeFileSync(dir+'/code.diff',diff);
const walk=p=>fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(p+'/'+e.name):[p+'/'+e.name]);
const assets=['public/sources/thornton-materials','public/ocr','public/pdfjs'].flatMap(walk);
const files=[...pairs.map(p=>p[1]),...assets].map(file=>{const b=fs.readFileSync(file);return {file,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')}});
fs.writeFileSync(dir+'/changed-files.json',JSON.stringify(files,null,2));
for(const mode of ['dev','built','native','installed']){const p='screenshots/project-materials/'+mode+'/report.json';if(!fs.existsSync(p))continue;const r=JSON.parse(fs.readFileSync(p));if(!r.ok||r.errors.length)throw Error(mode+' QA failed');}
console.log('Task-only diff checked; '+files.length+' code/source/runtime asset hashes recorded.');
