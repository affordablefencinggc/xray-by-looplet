(async()=>{
 const frame=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
 const root=document.querySelector('.industry-form');if(!root)throw Error('Missing QS form');
 const set=async(label,value)=>{const row=[...root.querySelectorAll('label')].find(x=>x.textContent.trim().startsWith(label));if(!row)throw Error(label);const e=row.querySelector('input,select');Object.getOwnPropertyDescriptor(e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(e,value);e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));await frame()};
 const click=async(text)=>{const e=[...root.querySelectorAll('button')].find(x=>x.textContent.trim()===text);if(!e||e.disabled)throw Error('Unavailable '+text);e.click();await frame()};
 if(root.querySelectorAll('input').length!==10)throw Error('Unexpected existing fixture; refusing duplicate edit');
 await set('Hierarchy name','QS report QA');
 const staleHidden=!root.querySelector('[aria-label="Quantity classification report"]');if(!staleHidden)throw Error('Stale report retained after edit');
 await click('Add classification');await set('Classification code 2','Building');await set('Classification label 2','Building work');
 const parent=[...root.querySelectorAll('label')].find(x=>x.textContent.startsWith('Parent classification 1')).querySelector('select').options[1].value;
 await set('Parent classification 1',parent);
 await set('Assign item 2','');
 await click('Add quantity');await set('Item reference 3','=1+1');await set('Quantity 3','3');await set('Unit 3','lm');await set('Evidence 3','sample');
 const picker=[...root.querySelectorAll('label')].find(x=>x.textContent.startsWith('Assign item 3')).querySelector('select');
 const wall=[...picker.options].find(x=>x.textContent.startsWith('walls')).value;
 await set('Assign item 3',wall);
 await click('Add quantity');await set('Item reference 4','quoted,"item"');await set('Quantity 4','4');await set('Unit 4','m2');await set('Evidence 4','inferred');await set('Assign item 4',parent);
 await click('Calculate classification');const report=root.querySelector('[aria-label="Quantity classification report"]');if(!report)throw Error('Missing calculated report');report.scrollIntoView({block:'start'});
 return {staleHidden,text:report.innerText,tables:[...report.querySelectorAll('table')].map(t=>({caption:t.caption.textContent,rows:[...t.querySelectorAll('tbody tr')].map(x=>x.innerText)}))};
})()
