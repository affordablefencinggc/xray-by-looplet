import fs from 'node:fs';
const dir='proof/growth/2026-09-07-pricing/';
const csv=JSON.parse(fs.readFileSync(dir+'malformed-csv-mobile.json','utf8'));
const xlsx=JSON.parse(fs.readFileSync(dir+'workbook-flow.json','utf8'));
const findButton=name=>['find','role','button','click','--name',name,'--exact'];
const read="const key=Object.keys(localStorage).find(k=>k.startsWith('xray:price-books:v1:')),lib=key?JSON.parse(localStorage.getItem(key)):null;";
const csvStart=csv.findIndex(c=>c[0]==='upload'&&c[2].endsWith('.csv'));
const csvSave=csv.findIndex((c,i)=>i>csvStart&&c.includes('Save reviewed price book'));
const xlsxSave=xlsx.findIndex(c=>c.includes('Save reviewed price book'));
const commands=[
 ['wait','--fn',"document.querySelector('.workbench')?.dataset.hydrationStatus==='ready'"],findButton('Cost'),
 ['wait','--fn',"!!document.querySelector('.price-books')"],
 ['eval',`(()=>{${read}sessionStorage.setItem('qa-portable-before',JSON.stringify(lib));})()`],findButton('Import price sheet'),
 ...csv.slice(csvStart,csvSave+1),
 ['wait','--fn',"document.querySelector('.price-notice')?.textContent.includes('Saved')||[...document.querySelectorAll('.price-books h3')].some(e=>e.textContent==='CSV mapped header QA')"],
 ['eval',`(()=>{${read}const book=lib.books.find(b=>b.name==='CSV mapped header QA');if(!book||book.revisions[0].source.headerRow!==3)throw Error('CSV fixture not saved');sessionStorage.setItem('qa-portable-csv',JSON.stringify(book));sessionStorage.setItem('qa-portable-job',lib.jobId);})()`],
 findButton('Import price sheet'),['upload',"input[aria-label='Supplier price file']",'C:/Users/danie/repo/xray-by-looplet/proof/growth/2026-09-07-pricing/supplier-workbook.xlsx'],
 ['wait','--fn',"!!document.querySelector('select[aria-label=\"Workbook worksheet\"]')"],
 ...xlsx.slice(0,xlsxSave+1).flatMap(c=>c[0]==='screenshot'?[['scroll','down','3000','--selector','.workspace-central-content'],['screenshot',c[1].replace(/\/([^/]+)\.png$/,'/candidate-$1.png')]]:[c]),
 ['wait','--fn',"[...document.querySelectorAll('.price-books h3')].some(e=>e.textContent==='Civil and electrical workbook QA')"],
 ['eval','window.__portableReload=true'],['reload'],
 ['wait','--fn',"window.__portableReload!==true&&document.querySelector('.workbench')?.dataset.hydrationStatus==='ready'"],findButton('Cost'),
 ['wait','--fn',"!!document.querySelector('.price-books')"],
 ['eval',`(()=>{${read}const old=JSON.parse(sessionStorage.getItem('qa-portable-before')),r=lib.books.find(b=>b.name==='Civil and electrical workbook QA')?.revisions[0],csv=lib.books.find(b=>b.name==='CSV mapped header QA');if(lib.jobId!==sessionStorage.getItem('qa-portable-job')||!r||r.source.kind!=='xlsx'||r.source.worksheet!=='Civil and electrical'||r.source.headerRow!==3||r.rows[0].sourceLine!==4||r.rows[0].rate!==150.25||r.source.sha256!=='c950510911d6f27407841922a4ae7bd531162fe6e92f08983a4555e827f02244')throw Error('XLSX reload/provenance failed');if(JSON.stringify(csv)!==sessionStorage.getItem('qa-portable-csv'))throw Error('CSV book changed');if(old&&(JSON.stringify(old.worksheet)!==JSON.stringify(lib.worksheet)||old.books.some(b=>JSON.stringify(b)!==JSON.stringify(lib.books.find(v=>v.id===b.id)))))throw Error('Existing price data changed');return {jobId:lib.jobId,books:lib.books.length,worksheet:lib.worksheet.length,source:r.source};})()`],
 ['errors']
];
fs.writeFileSync(dir+'portable-candidate.json',JSON.stringify(commands,null,2));
