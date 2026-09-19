import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { hostname } from 'node:os';
import { resolve,sep } from 'node:path';
import { createHash } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
if(hostname().split('.')[0].toLowerCase()!=='dans1')throw Error('DANS1 only');
const browserOutput=resolve(process.argv[2]),renderInput=resolve(process.argv[3]);
const inspection=JSON.parse(await readFile(resolve(browserOutput,'download-inspection.json'),'utf8'));
const pdfPath=resolve(browserOutput,inspection.pdfFile);if(!pdfPath.startsWith(browserOutput+sep))throw Error('PDF path escapes download output');
const bytes=await readFile(pdfPath),sha=createHash('sha256').update(bytes).digest('hex');if(sha!==inspection.pdfSha256)throw Error('PDF changed after disk download readback');
const pdf=await PDFDocument.load(bytes),pageCount=pdf.getPageCount();
const expected={pdfFile:inspection.pdfFile,pdfSha256:sha,pageCount,contentSha256:inspection.manifest.contentSha256,title:inspection.transmittal.transmittal.title,delivery:inspection.delivery};
await mkdir(renderInput,{recursive:true});await writeFile(resolve(renderInput,'expected.json'),JSON.stringify(expected,null,2),{flag:'wx'});
const operations=[['set','viewport','1600','1000'],['open','{{ORIGIN}}/viewer.html'],['wait','--fn','() => { if(window.pdfProof?.error) throw Error(window.pdfProof.error); return window.pdfProof?.ready === true }',30000],['eval',`(()=>{const p=window.pdfProof;if(p.pageCount!==${pageCount}||p.pdfSha256!==${JSON.stringify(sha)})throw Error('PDF disk identity mismatch');const all=p.pages.map(v=>v.text).join(String.fromCharCode(10));for(const token of ${JSON.stringify(['Executive summary','Basis of estimate and exclusions','Elements and trade breakdown','Cost variance report','Source and rate audit trail','ACCEPTED TOTAL CHANGE','saved-draft','QS-WALL-A','QS-WALL-C',inspection.manifest.contentSha256])})if(!all.includes(token))throw Error('Missing exported PDF token: '+token);const schedule=p.pages.find(page=>page.text.includes('Elements and trade breakdown')),items=schedule?.textItems??[],quantity=items.find(i=>i.text==='Quantity'),unit=items.find(i=>i.text==='Unit'),rowA=items.find(i=>i.text.startsWith('QS-WALL-A:')),rowC=items.find(i=>i.text.startsWith('QS-WALL-C:'));if(!quantity||!unit||!rowA||!rowC)throw Error('Cannot identify exact quantity cell bounds');const fragments=items.filter(i=>i.x>=quantity.x-0.1&&i.x<unit.x-0.1&&i.y<=rowA.y+0.1&&i.y>rowC.y+0.1).sort((a,b)=>b.y-a.y||a.x-b.x);const exact=fragments.map(i=>i.text).join('');if(exact!=='5.999999930955706')throw Error('Exact measured decimal differs inside quantity cell: '+exact);if(p.pages.some(page=>page.outside.length))throw Error('PDF text outside physical page');return {pageCount:p.pageCount,pdfSha256:p.pdfSha256,renderer:p.version,allPagesWithinBounds:true,exactQuantityCell:{value:exact,column:[quantity.x,unit.x],row:[rowA.y,rowC.y],fragments},source:'actual separately downloaded application PDF; ZIP digest identical'}})()`]];
for(const [width,height,name] of [[1600,1000,'desktop'],[1024,768,'tablet']]){
 operations.push(['set','viewport',String(width),String(height)]);
 for(let page=1;page<=pageCount;page++){
  operations.push(['eval',`window.showPdfPage(${page})`]);
  operations.push(['wait','--fn',`()=>window.pdfProof.current===${page} && !document.querySelector('[data-page="${page}"]').hidden`]);
  operations.push(['eval',`(()=>{const p=window.pdfProof.pages[${page-1}],canvas=document.querySelector('[data-page="${page}"] canvas'),r=canvas.getBoundingClientRect();if(r.left<0||r.right>innerWidth||r.top<0||r.bottom>innerHeight)throw Error('PDF canvas clipped');if(!p.text.includes('${page} / ${pageCount}'))throw Error('Missing page footer');const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let nonWhite=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]<240||pixels[i+1]<240||pixels[i+2]<240)nonWhite++;if(nonWhite<5000)throw Error('Blank PDF render');return {...p,nonWhitePixels:nonWhite,viewport:[innerWidth,innerHeight],canvasWidth:canvas.width,canvasHeight:canvas.height}})()`]);
  operations.push(['screenshot',`captures/sc11-downloaded-pdf-page-${String(page).padStart(2,'0')}-${name}-${width}x${height}.png`]);
 }
}
operations.push(['errors']);await writeFile(resolve(renderInput,'pdf-render.scenario.json'),JSON.stringify({schemaVersion:1,name:'SC11 actual disk-downloaded PDF all-page desktop and tablet readback',host:'DANS1',pdfSha256:sha,pageCount,operations},null,2),{flag:'wx'});
console.log(JSON.stringify({renderInput,pdfPath,pdfSha256:sha,pageCount,operations:operations.length}));
