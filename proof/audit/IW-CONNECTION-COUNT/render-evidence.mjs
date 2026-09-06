import fs from 'node:fs';
import {createCanvas} from '@napi-rs/canvas';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
const doc=await getDocument({data:new Uint8Array(fs.readFileSync('public/sources/thornton-connection-trial/structural.pdf')),useSystemFonts:true}).promise;
// Normalized page crops, without scaling dimensions or altering drawing content.
const crops=[['plan',10,[.385,.452,.16,.091]],['schedule',6,[.62,.427,.21,.32]],['detail',18,[.665,.045,.211,.293]]];
for(const [name,n,[x,y,w,h]] of crops){const p=await doc.getPage(n),v=p.getViewport({scale:2.5}),c=createCanvas(Math.ceil(v.width*w),Math.ceil(v.height*h));await p.render({canvasContext:c.getContext('2d'),viewport:v,transform:[1,0,0,1,-v.width*x,-v.height*y]}).promise;fs.writeFileSync(`public/sources/thornton-connection-trial/${name}.png`,c.toBuffer('image/png'));}
