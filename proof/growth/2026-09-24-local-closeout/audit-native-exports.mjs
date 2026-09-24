import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { hostname } from 'node:os';
import { unzipSync } from 'fflate';
import { createCanvas, DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';
assert.equal(hostname().toLowerCase(),'daniel');
Object.assign(globalThis,{DOMMatrix,ImageData,Path2D});
const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
const base='proof/growth/2026-09-24-local-closeout', root=base+'/native-features01';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const e of read(base+'/source-identity.json').entries)assert.equal(hash(e.path),e.sha256,e.path);
for(const e of read(base+'/stage1-audit.json').artifacts)assert.equal(hash(e.path),e.sha256,e.path);
function csv(text){const rows=[];let row=[],value='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++}else quoted=!quoted}else if(c===','&&!quoted){row.push(value);value=''}else if(c==='\n'&&!quoted){row.push(value.replace(/\r$/,''));rows.push(row);row=[];value=''}else value+=c}if(value||row.length){row.push(value);rows.push(row)}const headers=rows.shift().map(x=>x.replace(/^\uFEFF/,''));return rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]])))}
const cents=s=>{assert.match(s,/^\d+\.\d{2}$/);return BigInt(s.replace('.',''))};
const campaigns=[];
for(const name of ['native-features01','native-readback01']){
 const raw=read(base+'/'+name+'/close-results.json'),r=Array.isArray(raw)?raw:[raw];assert.equal(r.length,1);assert(r[0].requested&&r[0].exited&&!r[0].forced&&!r[0].error&&r[0].defaultBundledEngine);assert.equal(hash(r[0].exe),r[0].sha256);assert.equal(read(base+'/'+name+'/browser-errors-1.json').length,0);campaigns.push(r[0]);
}
assert.equal(read(root+'/features-result.json').verdict,'PASS');assert.equal(read(base+'/native-readback01/readback-result.json').verdict,'PASS');
const nativeSteps=read(root+'/features.json');assert.equal(nativeSteps.length,133);assert(nativeSteps.every(x=>!x.error));
const workload=read(root+'/workload-1.json').filter(x=>Number.isInteger(x.index));assert.equal(workload.length,137);assert(workload.every((r,i)=>r.index===i&&!r.error));
for(const e of read(root+'/exports.json')){assert.equal(hash(root+'/'+e.file),e.sha256);assert.equal(fs.statSync(root+'/'+e.file).size,e.bytes)}
const cuts=csv(fs.readFileSync(root+'/fencing-cuts-register-1.csv','utf8'));assert.equal(cuts.length,46);
const groups=[];
for(const code of ['TP-RAIL-CUT','TP-POST-END']){
 const lines=cuts.filter(r=>r.Component===code),pieces=new Map();
 for(const r of lines){const id=r.StockPiece;const entry=pieces.get(id)??{stock:Number(r.StockMm),cuts:0,kerf:0,offcut:Number(r.OffcutMm)};assert.equal(Number(r.EndMm)-Number(r.StartMm),Number(r.LengthMm));entry.cuts+=Number(r.LengthMm);entry.kerf+=Number(r.KerfEndMm)-Number(r.EndMm);assert(entry.kerf>=0);pieces.set(id,entry)}
 for(const p of pieces.values())assert(Math.abs(p.stock-p.cuts-p.kerf-p.offcut)<1e-7,'Stock conservation');
 const sum=field=>[...pieces.values()].reduce((a,p)=>a+p[field],0);groups.push({code,cuts:lines.length,purchases:pieces.size,stockMm:sum('stock'),cutsMm:sum('cuts'),kerfMm:sum('kerf'),offcutMm:sum('offcut')});
}
assert.deepEqual(groups,[{code:'TP-RAIL-CUT',cuts:44,purchases:44,stockMm:105600,cutsMm:99176,kerfMm:220,offcutMm:6204},{code:'TP-POST-END',cuts:2,purchases:2,stockMm:4800,cutsMm:4800,kerfMm:0,offcutMm:0}]);
const exports=[];
for(const [ordinal,ref,inclusive] of [['first','NATIVE-LEVEL-Q1','585.84'],['second','NATIVE-LEVEL-Q1-R2','1025.84']]){
 const saved=read(root+'/'+ordinal+'-issued.json'), prefix=ref+'-issued-quote';
 const zip=unzipSync(fs.readFileSync(root+'/'+prefix+'-handover.zip'));assert.equal(Object.keys(zip).length,4);assert(Object.keys(zip).every(n=>path.basename(n)===n));
 const q=JSON.parse(Buffer.from(zip[prefix+'.json']).toString('utf8')), lines=csv(Buffer.from(zip[prefix+'-lines.csv']).toString('utf8')),coverage=csv(Buffer.from(zip[prefix+'-material-coverage.csv']).toString('utf8'));
 assert.equal(q.status,'issued');assert.equal(q.reference,ref);assert.deepEqual(q.issue,saved.issue);assert.deepEqual(q.pricingBasis,saved.pricingBasis);assert.deepEqual(q.materialCoverage,saved.materialCoverage);assert.equal(lines.length,saved.lines.length);assert.equal(coverage.length,13);assert.equal(coverage.filter(x=>x.Status==='no-rate').length,5);assert(coverage.every(x=>x.Status!=='unreviewed'));
 saved.lines.forEach((line,i)=>{assert.equal(lines[i].UnitAmount,line.rate);assert.equal(lines[i].LineAmount,line.amount);assert.equal(lines[i].Quantity,line.quantity);assert.equal(lines[i].IssuedAt,saved.issue.issuedAt);assert.equal(lines[i].PriceLibraryRevision,String(saved.pricingBasis.libraryRevision));assert.equal(q.lines[i].unitRate,line.rate);assert.equal(q.lines[i].amount,line.amount);assert.equal(cents(line.amount),BigInt(line.quantity)*cents(line.rate))});
 const hardware=saved.lines.filter(l=>['0131443','0131450','0131457'].includes(l.stockCode));assert.equal(hardware.length,3);assert.equal(hardware.reduce((s,l)=>s+cents(l.amount),0n),10884n);assert(hardware.every(l=>l.taxLabel==='tax included (10%)'));
 assert.deepEqual(saved.totals.map(t=>t.amount),['2111.00',inclusive]);for(const t of saved.totals)assert.equal(saved.lines.filter(l=>l.taxLabel===t.taxLabel).reduce((s,l)=>s+cents(l.amount),0n),cents(t.amount));
 for(const key of ['TP-GATE-LEAF','TP-GATE-OPENING'])assert(saved.materialCoverage.lines.some(l=>l.key===key&&l.status==='no-rate'&&l.reason.includes('No reviewed fit')));
 for(const key of ['TP-RAIL-CUT','TP-RAIL-LM','TP-POST-END'])assert(!saved.lines.some(l=>l.source===`material register 1 (${key})`));
 const pdf=await getDocument({data:new Uint8Array(fs.readFileSync(root+'/'+prefix+'.pdf')),standardFontDataUrl:path.resolve('node_modules/pdfjs-dist/standard_fonts')+'/'}).promise;const pages=[];
 for(let n=1;n<=pdf.numPages;n++){const page=await pdf.getPage(n),viewport=page.getViewport({scale:1.5}),canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));await page.render({canvas,canvasContext:canvas.getContext('2d'),viewport}).promise;const file=ordinal+'-quote-page-'+n+'.png';fs.writeFileSync(root+'/'+file,canvas.toBuffer('image/png'));const content=await page.getTextContent();pages.push({page:n,file,text:content.items.map(i=>i.str).join(' ')})}
 const text=pages.map(p=>p.text).join('\n');assert(text.includes(ref)&&text.includes('ISSUED')&&text.includes(saved.issue.issuedAt));for(const l of saved.lines)assert(text.includes(l.rate)&&text.includes(l.amount),'PDF amounts');assert(text.includes('2111.00')&&text.includes(inclusive)&&text.includes('No reviewed fit'));exports.push({reference:ref,issue:saved.issue,libraryRevision:saved.pricingBasis.libraryRevision,hardwareInclGst:'108.84',totals:saved.totals,pages,archiveEntries:Object.keys(zip)});
}
const artifacts=[];for(const dir of ['native-features01','native-readback01']){const walk=p=>{for(const e of fs.readdirSync(p,{withFileTypes:true})){const f=path.join(p,e.name);if(e.isDirectory())walk(f);else artifacts.push({file:f.replaceAll('\\','/'),sha256:hash(f)})}};walk(base+'/'+dir)}
fs.writeFileSync(base+'/stage4-native-audit.json',JSON.stringify({host:'DANIEL',verdict:'PASS',at:new Date().toISOString(),sourceAndBuildUnchanged:true,baselineOperations:137,featureOperations:133,campaigns,cuts:groups,exports,artifacts,limits:'Synthetic native test, mixed tax bases kept separate, missing gate fit excluded; not a real-job quote or geometric revision.'},null,2));console.log('PASS: native workload + 133 feature operations; 46 cuts conserved; both issued PDF/CSV/JSON packages match saved quotes; hardware AUD108.84 including GST.');
