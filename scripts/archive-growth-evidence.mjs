// Recover physical copies of the immutable images already embedded in a published report.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const id=process.argv[2];if(!/^[a-z0-9-]+$/.test(id))throw Error('Invalid stage');
const report=path.resolve('proof/growth',id), manifest=JSON.parse(fs.readFileSync(path.join(report,'manifest.json'),'utf8'));
const html=fs.readFileSync(path.join(report,'index.html'),'utf8');
const images=[...html.matchAll(/<img src="data:image\/png;base64,([^"]+)"/g)];
if(images.length!==manifest.images.length)throw Error('Image count mismatch');
const dir=path.resolve('screenshots/growth',id);fs.mkdirSync(dir,{recursive:true});
const archive=images.map((match,index)=>{
 const bytes=Buffer.from(match[1],'base64'), sha256=createHash('sha256').update(bytes).digest('hex');
 if(sha256!==manifest.images[index].sha256)throw Error('Embedded evidence identity mismatch');
 const file=path.join(dir,`${String(index+1).padStart(2,'0')}.png`);
 fs.writeFileSync(file,bytes,{flag:'wx'});return {file,sha256,original:manifest.images[index].file};
});
fs.writeFileSync(path.join(report,'evidence-archive.json'),JSON.stringify(archive,null,2),{flag:'wx'});
console.log(JSON.stringify({archived:archive.length,report}));
