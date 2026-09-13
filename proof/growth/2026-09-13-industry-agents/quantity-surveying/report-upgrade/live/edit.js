(async()=>{
 const frame=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
 const {useStudio}=await import('/src/studio/store.ts');const before=JSON.stringify(useStudio.getState().job);
 const root=document.querySelector('[aria-label="Quantity surveying draft"]');if(!root)throw Error('No QS form');
 const input=[...root.querySelectorAll('label')].find(x=>x.textContent.startsWith('Quantity 1')).querySelector('input');
 Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'0.10');input.dispatchEvent(new Event('input',{bubbles:true}));await frame();
 if(root.querySelector('[aria-label="Quantity classification report"]')||[...root.querySelectorAll('button')].some(x=>x.textContent.includes('Download shown')))throw Error('Stale output/export retained');
 [...root.querySelectorAll('button')].find(x=>x.textContent==='Calculate classification').click();await frame();
 const report=root.querySelector('[aria-label="Quantity classification report"]');if(!report)throw Error('Report missing after recalculate');
 const table=[...report.querySelectorAll('table')].find(t=>t.caption.textContent.startsWith('Whole draft'));
 if(!table.innerText.includes('0.3\t0.1\t0.2'))throw Error('Decimal normalization changed totals');
 report.scrollIntoView({block:'start'});
 return {staleInvalidated:true,normalizedTotalInvariant:true,jobUnchanged:JSON.stringify(useStudio.getState().job)===before,job:useStudio.getState().job,storage:Object.fromEntries(Object.keys(localStorage).filter(k=>k.includes('industry')).map(k=>[k,localStorage.getItem(k)])),report:report.innerText};
})()
