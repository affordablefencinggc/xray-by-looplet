const search=document.querySelector('#search');
const status=document.querySelector('#status');
let active=document.querySelector('[data-panel=features]')?'features':'tasks';
const taskStatuses=[...status.options].map(o=>({value:o.value,label:o.textContent}));
const featureStatuses=['all','untested','running','awaiting-review','pass','fail','blocked','notimplemented'];
function statusOptions(){status.parentElement.firstChild.textContent=active==='features'?'Feature status':'Task status';status.replaceChildren(...(active==='features'?featureStatuses.map(value=>({value,label:value==='all'?'All feature states':value})):taskStatuses).map(o=>{const option=document.createElement('option');option.value=o.value;option.textContent=o.label;return option;}));status.disabled=!['tasks','features'].includes(active);}
statusOptions();
function filter(){
 const panel=document.querySelector(`[data-panel="${active}"]`);
 let count=0;
 for(const row of panel.querySelectorAll('.searchable')){
  row.hidden=!(row.dataset.search.includes(search.value.trim().toLowerCase()) && (!['tasks','features'].includes(active) || status.value==='all' || row.dataset.status===status.value));
  if(!row.hidden)count++;
 }
 document.querySelector('#result-count').textContent=active==='handover'?'Handover instructions':`${count} ${active==='inventory'?'historical rows':active} shown${count===0?' — try a different search or status.':''}`;
}
for(const button of document.querySelectorAll('[data-view]'))button.addEventListener('click',()=>{
 active=button.dataset.view;
 for(const b of document.querySelectorAll('[data-view]'))b.setAttribute('aria-pressed',String(b===button));
 for(const panel of document.querySelectorAll('[data-panel]'))panel.hidden=panel.dataset.panel!==active;
 statusOptions();
 filter();
});
search.addEventListener('input',filter);status.addEventListener('change',filter);
for(const button of document.querySelectorAll('[data-copy]'))button.addEventListener('click',async()=>{
 const field=document.getElementById(button.dataset.copy);
 try{await navigator.clipboard.writeText(field.value);document.querySelector('#copy-result').textContent='Startup packet copied.';}
 catch{field.focus();field.select();document.querySelector('#copy-result').textContent='Packet selected. Use your copy command.';}
});
filter();
