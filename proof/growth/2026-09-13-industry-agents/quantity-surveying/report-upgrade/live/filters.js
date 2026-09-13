(async()=>{
 const frame=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
 const report=document.querySelector('[aria-label="Quantity classification report"]');if(!report)throw Error('Report absent');
 const set=async(label,value)=>{const e=[...report.querySelectorAll('label')].find(x=>x.textContent.startsWith(label)).querySelector('select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(e,value);e.dispatchEvent(new Event('change',{bubbles:true}));await frame()};
 const table=caption=>[...report.querySelectorAll('table')].find(t=>t.caption.textContent.startsWith(caption));
 const rows=()=>[...table('Shown quantity items').querySelectorAll('tbody tr')].map(r=>r.innerText);
 const originalWhole=table('Whole draft totals').innerText;
 await set('Show quantities','unassigned');const unassigned=rows();if(unassigned.length!==1||!unassigned[0].startsWith('b\t0.2'))throw Error('Unassigned filter wrong');
 await set('Show quantities','classified');await set('Classification branch','walls');const walls=rows();if(walls.length!==2||!walls.some(x=>x.startsWith('=1+1')))throw Error('Branch filter wrong');
 await set('Classification branch','Building');const building=rows();if(building.length!==3)throw Error('Parent direct plus child count wrong');
 if(table('Whole draft totals').innerText!==originalWhole)throw Error('Filter changed full totals');
 await set('Show quantities','all');
 report.querySelector('details>summary').click();await frame();
 const root=[...report.querySelectorAll('summary')].find(x=>x.textContent.startsWith('Building'));root.click();await frame();
 const child=[...report.querySelectorAll('summary')].find(x=>x.textContent.startsWith('walls'));child.click();await frame();
 const direct=table('Building: direct').innerText,childTotal=table('walls: direct').innerText;
 if(rows().length!==4)throw Error('Item rows double counted');
 return {unassigned,walls,building,wholeUnchanged:true,all:rows(),direct,childTotal,expanded:[...report.querySelectorAll('details')].map(d=>({summary:d.querySelector('summary').textContent,open:d.open}))};
})()
