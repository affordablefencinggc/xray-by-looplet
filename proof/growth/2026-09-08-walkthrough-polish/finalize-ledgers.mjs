import fs from 'node:fs';
const stage='proof/growth/2026-09-08-09-walkthrough-polish';
if(!fs.existsSync(stage+'/index.html')||!fs.existsSync('screenshots/growth/2026-09-08-09-walkthrough-polish.png'))throw Error('Final illustrated report required first');
const marker='## 2026-09-08 - Walkthrough boundaries and polish accepted within tested scope';
const report='[Stage09 illustrated proof](proof/growth/2026-09-08-09-walkthrough-polish/index.html)';
const summary=`Source checkpoint 844e091 on feat/architect-cad-engine. Both pickers say "Pick your walkthrough starting point" and use clean aligned plans. Solid geometry, real stair/threshold traversal, E/button door operation and a body-mounted CC0 reaching rig are implemented. Original Fly, arrival animation and bottom controls remain verified. Dans1 candidate38a64f0b8c2b: five gates and145tests pass; High/16 CPU policy observed;631source files without drift. Production Source158commands, Architect/tablet/reduced-motion/asset recovery330commands and Windows-native183commands pass (671total). All relevant screenshots inspected. Native retained13sheets,2pricebooks,saved view and unchanged backup review verified; isolatedQAapp closed normally. ${report}.`;
const remaining='Full A-Z rows remain PARTIAL: wider model/platform coverage is open. The real ~0.92m unsupported Redburn stair connection remains blocked; inferred door styles are presentation approximations. Instruction overlays partly cover the hand in compact views. No physical tablet, macOS/Linux-native, installation or whole-industry certification claimed. Remote publication remains held by the previously recorded automatic approval rejection; no new push attempted.';
for(const file of ['GROWTH-TODO.md','COMPLETE-CHECKLIST.md','LOOPLET_BRANCH_RELEASE_LEDGER.md']){
  if(fs.readFileSync(file,'utf8').includes(marker))throw Error('Already appended '+file);
  fs.appendFileSync(file,`\n\n${marker}\n\n${summary}\n\n${remaining}\n`,'utf8');
}
const progress=summary.replaceAll('](proof/growth/','](')+`\n\n${remaining}\n\nExact source/asset identity, code diff, commands, saved scenarios, pass/fail history and remaining work are linked in the Stage09 report. Before: [preserved Stage08](2026-09-08-08-walk-boundaries/index.html). After: [openable HTML](2026-09-08-09-walkthrough-polish/index.html) and [PNG summary](../../screenshots/growth/2026-09-08-09-walkthrough-polish.png).\n`;
fs.appendFileSync('proof/growth/PROGRESS.md',`\n\n${marker}\n\n${progress}`,'utf8');
const todo='WALK-BOUNDARIES-TODO.md';let t=fs.readFileSync(todo,'utf8');
const rows={
 '02':'SC-02: Door interactions and body reach accepted within tested scope: actual swing/slide/lift, body safety and occlusion; E/button/reduced-motion/missing-arm recovery verified. Compact-view hand occlusion remains disclosed polish.',
 '03':'SC-03: Complete development and final production journeys pass: Source158, Architect126, real thresholds/stairs, invalid starts, Fly and original controls. Native183 complete pass includes retained working data in the isolated QA profile.',
 '04':'SC-04: Dans1 five build gates/145tests, production/tablet/Windows-native checks, frozen source/artifact identity and inspected Stage09 HTML/PNG accepted. Whole A-Z rows remain partial.',
 '07':'SC-07: Camera/body-mounted CC0 rig visibly reaches from the lower-right edge; real mesh animation and transparent-world ordering verified. Reduced motion and missing-asset recovery pass. Compact overlays can partly cover the hand.',
 '09':'SC-09: New frozen38a64f0b8c2b release passed production and complete native journeys; inspected Stage09 HTML/PNG and earlier evidence preserved.'
};
for(const [id,text] of Object.entries(rows))t=t.replace(new RegExp('^- \\[ \\] SC-'+id+':?.*$','m'),'- [x] '+text);
t=t.replace(/^- \[ \] SC-05:.*$/m,'- [ ] SC-05: Local source checkpoint844e091 saved; evidence checkpoint follows. Publication remains held until exact payload/destination approval resolves the previous automatic-review rejection.');
t+=`\n\n${marker}\n\n${summary}\n\n${remaining}\n`;
fs.writeFileSync(todo,t,'utf8');
const az='PROFESSIONAL-A-Z-CHECKLIST.md';let a=fs.readFileSync(az,'utf8');
for(const id of ['R-01','R-02','U-02','U-05','U-06','U-09'])a=a.replace(new RegExp('(^- \\[ \\] \\*\\*'+id+'[^\\n]*)(?=\\n|$)','m'),line=>line+' Latest bounded milestone: [Stage09 clean plans, boundaries, body reach and release evidence](proof/growth/2026-09-08-09-walkthrough-polish/index.html); full row stays open.');
fs.writeFileSync(az,a,'utf8');
console.log('Appended verified milestones; no whole A-Z requirement ticked.');
