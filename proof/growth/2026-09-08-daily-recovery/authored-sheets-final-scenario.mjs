import fs from 'node:fs';
const dir='proof/growth/2026-09-08-daily-recovery/';
const setup=JSON.parse(fs.readFileSync(dir+'authored-sheets-open-attempt2.json','utf8'));
const journey=JSON.parse(fs.readFileSync(dir+'authored-sheets-journey.json','utf8'));
const click=name=>['find','role','button','click','--name',name,'--exact'];
const beforeReview=journey.findIndex(c=>c[0]==='screenshot'&&c[1].endsWith('archive-review.png'));
journey.splice(beforeReview,0,
  ['fill','.arch-inspector > label:nth-of-type(2) input','S-202'],['press','Enter'],
  ['wait','--fn',"document.querySelector('.arch-sheet-review [role=alert]')?.textContent.includes('design changed')"],
  ['eval',"if(![...document.querySelectorAll('.arch-sheet-review button')].find(b=>b.textContent==='Confirm sheet archive').disabled)throw Error('Stale review could be confirmed');'Stale archive review blocked'"],
  ['screenshot','screenshots/growth/authored-sheets-final-stale-review.png'],
  click('Cancel sheet archive'),click('Archive sheet'),
  ['wait','--fn',"!!document.querySelector('.arch-sheet-review')&&!document.querySelector('.arch-sheet-review [role=alert]')"]);
for(const command of journey){
  if(command[0]==='eval'&&command[1].startsWith('if(JSON.stringify(window.__readSheet().sheetSet.sheets[0])'))command[1]='(()=>{'+command[1]+'})()';
  if(command[0]==='screenshot'&&!command[1].includes('-final-'))command[1]=command[1].replace('authored-sheets-','authored-sheets-final-');
}
const beforeDesktop=journey.findIndex(c=>c[0]==='screenshot'&&c[1].endsWith('recovered-desktop.png'));
journey.splice(beforeDesktop,0,
  click('Add drawing sheet'),['wait','--fn','window.__readSheet().sheetSet.sheets.length===3'],
  ['eval',"window.__savedBeforeFailure=localStorage.getItem(window.__sheetKey);window.__realSheetSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key===window.__sheetKey)throw new DOMException('Isolated QA quota failure','QuotaExceededError');return window.__realSheetSetItem.call(this,key,value)};'Scoped architecture write failure installed'"],
  click('Duplicate sheet'),['wait','--fn',"document.querySelector('.arch-error')?.textContent.includes('Isolated QA quota failure')"],
  ['eval',"if(localStorage.getItem(window.__sheetKey)!==window.__savedBeforeFailure||document.querySelectorAll('select[aria-label=\"Active drawing sheet\"] option').length!==3)throw Error('Failed save published sheet');Storage.prototype.setItem=window.__realSheetSetItem;'Write failure left saved bytes and UI unchanged; normal storage restored'"],
  ['screenshot','screenshots/growth/authored-sheets-final-save-failure.png'],
  click('Duplicate sheet'),['wait','--fn',"window.__readSheet().sheetSet.sheets.length===4&&!document.querySelector('.arch-error')"],
  ['eval',"(()=>{const select=document.querySelector('select[aria-label=\"Active drawing sheet\"]');select.value=window.__sheetProof.id;select.dispatchEvent(new Event('change',{bubbles:true}));})()"],
  ['wait','--fn','window.__readSheet().sheetSet.activeId===window.__sheetProof.id'],
  ['eval',"document.querySelector('.arch-sheet-register').scrollIntoView({block:'start'});'Recovered original selected after add and successful retry'" ]);
fs.writeFileSync(dir+'authored-sheets-final.json',JSON.stringify([['open','http://127.0.0.1:8080/'],['set','viewport','1440','1000'],['console','--clear'],...setup,...journey],null,2),{flag:'wx'});
