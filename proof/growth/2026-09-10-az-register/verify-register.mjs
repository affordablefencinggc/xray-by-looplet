import fs from 'node:fs';
const s=fs.readFileSync('PROFESSIONAL-A-Z-CHECKLIST.md','utf8');
const L=s.split('\n');
console.log('lines',L.length,'chars',s.length);
console.log('U+FFFD',(s.match(/\uFFFD/g)||[]).length);
const rows=L.filter(l=>/^- \[[ x]\] \*\*[A-Z]-\d\d/.test(l));
console.log('rows',rows.length);
const bad=rows.filter(l=>!/State: (verified|partial|gap|failed|dependency-blocked|in-progress)/.test(l));
console.log('rows without a valid state:',bad.length);
bad.slice(0,3).forEach(b=>console.log('  ',b.slice(0,120)));
// every row must give a reason after the state
const noreason=rows.filter(l=>{const m=l.match(/State: [a-z-]+[^.]*\.\s*(.*)$/);return !m||m[1].trim().length<40;});
console.log('rows with a state but no substantive reason:',noreason.length);
noreason.slice(0,3).forEach(b=>console.log('  ',b.slice(0,140)));
// unbalanced markdown emphasis / broken bold
const badbold=rows.filter(l=>((l.match(/\*\*/g)||[]).length%2)!==0);
console.log('rows with unbalanced bold:',badbold.length);
// table integrity
const tbl=L.filter(l=>l.startsWith('|')).length;
console.log('table lines',tbl);
