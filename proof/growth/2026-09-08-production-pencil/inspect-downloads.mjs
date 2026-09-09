import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
const [runDirectory, artifactId] = process.argv.slice(2);
if (!runDirectory || !artifactId || /MUST|UNCONFIRMED|awaiting/i.test(artifactId)) throw Error('Usage: node inspect-downloads.mjs <prepared-run-directory> <verified-build-artifact-id>');
const manifest=JSON.parse(fs.readFileSync(path.join(runDirectory,'prepared-manifest.json'),'utf8'));
const output=path.join(runDirectory,'download-inspection.json');
if(fs.existsSync(output))throw Error('Inspection evidence exists: do not overwrite; create a new run.');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const downloaded=manifest.expectedDownloads.map(name=>{
  const file=path.join(runDirectory,'downloads',name),bytes=fs.readFileSync(file);
  assert(bytes.length>0,`${name} empty`);
  return {file,bytes,sha256:sha(bytes)};
});
const images=[];
for(const item of downloaded.slice(0,2)){
  assert.equal(item.bytes.subarray(1,4).toString(),'PNG');
  const image=await loadImage(item.bytes),canvas=createCanvas(image.width,image.height),ctx=canvas.getContext('2d');
  ctx.drawImage(image,0,0);
  const roi={x:Math.floor(image.width*.2),y:Math.floor(image.height*.2),width:Math.floor(image.width*.6),height:Math.floor(image.height*.5)};
  const pixels=ctx.getImageData(roi.x,roi.y,roi.width,roi.height).data;
  let brightPixels=0;
  for(let i=0;i<pixels.length;i+=4)if(pixels[i]>140&&pixels[i+1]>140&&pixels[i+2]>140)brightPixels++;
  images.push({file:item.file,sha256:item.sha256,width:image.width,height:image.height,roi,brightPixels,pixels});
}
assert.equal(images[0].width,images[1].width);assert.equal(images[0].height,images[1].height);
let difference=0;
for(let i=0;i<images[0].pixels.length;i++)difference+=Math.abs(images[0].pixels[i]-images[1].pixels[i]);
const pdfBytes=downloaded[2].bytes;
assert.match(pdfBytes.subarray(0,8).toString(),/^%PDF-/);
const loading=getDocument({data:new Uint8Array(pdfBytes),useSystemFonts:true}),pdf=await loading.promise;
assert.equal(pdf.numPages,5);
const metadata=await pdf.getMetadata();assert.match(metadata.info.Subject,/ILLUSTRATIVE MODEL PREVIEW - NOT FOR CONSTRUCTION/);
const pages=[];
for(let i=1;i<=pdf.numPages;i++){
  const page=await pdf.getPage(i),viewport=page.getViewport({scale:1.4});
  assert(Math.abs(page.view[2]-841.89)<1&&Math.abs(page.view[3]-595.28)<1,'A4 landscape page required');
  const canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));
  await page.render({canvas,canvasContext:canvas.getContext('2d'),viewport}).promise;
  const file=`screenshots/growth/${manifest.tag}-production-pdf-page-${i}.png`,png=canvas.toBuffer('image/png');
  fs.writeFileSync(file,png,{flag:'wx'});pages.push({page:i,file,sha256:sha(png)});
}
await loading.destroy();
const result={status:'actual-files-parsed-awaiting-visual-review',artifactId,origin:manifest.origin,tag:manifest.tag,
  files:downloaded.map(({bytes,...rest})=>({...rest,byteLength:bytes.length})),
  pngs:images.map(({pixels,...rest})=>rest),rapidVsSettledMeanAbsoluteChannelDifference:difference/images[0].pixels.length,
  pixelMetricsScope:'Diagnostic only: inspect actual rapid PNG and both screenshots; byte size or bright pixels alone cannot establish model visibility.',pdf:{pages,metadata:metadata.info},
  visualChecklist:['Rapid PNG visibly contains completed model, not just a title/grid.','Settled PNG offers the same completed model framing; explain any ROI pixel difference.','Every PDF page notice and NTS label readable; no invented approval, revision, survey north or physical scale.','S-201 is an elevation projection, not a cut section.','S-301 contains actual current model snapshot.','All supplied levels retained in register.']};
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,status:result.status,pages:pages.length}));
