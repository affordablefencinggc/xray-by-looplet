import fs from 'node:fs';
const dir = 'proof/growth/2026-09-08-daily-recovery/';
const original = JSON.parse(fs.readFileSync(dir + 'authored-sheets-journey.json', 'utf8'));
const at = original.findIndex(c => c[0] === 'eval' && c[1].startsWith('if(JSON.stringify(window.__readSheet().sheetSet.sheets[0])'));
const remaining = original.slice(at);
remaining[0][1] = '(()=>{' + remaining[0][1] + '})()';
fs.writeFileSync(dir + 'authored-sheets-recovery-resume.json', JSON.stringify(remaining, null, 2), {flag: 'wx'});
