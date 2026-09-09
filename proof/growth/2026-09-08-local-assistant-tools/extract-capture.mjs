import fs from 'node:fs';
import {createHash} from 'node:crypto';
const value=JSON.parse(fs.readFileSync('proof/growth/runner/2026-09-07T20-54-56-326Z-growth-local-app-tools.log','utf8'));
const part=value.content.find(part=>part.type==='image');
if(value.isError||part?.mimeType!=='image/png')throw Error('Capture result is not a PNG');
const bytes=Buffer.from(part.data,'base64');
if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('PNG signature mismatch');
fs.writeFileSync('screenshots/growth/local-app-tools-actual-capture.png',bytes,{flag:'wx'});
console.log(JSON.stringify({bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),metadata:JSON.parse(value.content[0].text)}));
