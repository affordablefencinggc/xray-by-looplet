import fs from 'node:fs';
const base='proof/growth/2026-09-08-production-pencil';
const a=JSON.parse(fs.readFileSync(base+'/dev-bottom-r3.json','utf8'));
for(const c of a){if(c[0]==='screenshot')c[1]=c[1].replace('dev-bottom-r3-','dev-bottom-r3-layoutretry-');if(c[0]==='eval'&&c[1].includes('Small target'))c[1]=c[1].replace('return {viewport:',`const draft=document.querySelector('.draftsman-control-dock'),top=document.querySelector('[aria-label="3D view controls"]');if(draft&&top){const dr=draft.getBoundingClientRect(),tr=top.getBoundingClientRect();if(dr.left<tr.right&&dr.right>tr.left&&dr.top<tr.bottom&&dr.bottom>tr.top)throw Error('Drafting dock overlaps original top settings: '+JSON.stringify({draft:rect(dr),top:rect(tr)}));}return {viewport:`);}
fs.writeFileSync(base+'/dev-bottom-r3-layoutretry.json',JSON.stringify(a,null,2),{flag:'wx'});
