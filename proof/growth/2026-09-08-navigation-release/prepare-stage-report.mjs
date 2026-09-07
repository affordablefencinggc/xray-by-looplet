import fs from 'node:fs';
const run=process.argv[2];if(!/^[a-f0-9]{12}$/.test(run??''))throw Error('Verified run ID required');
const dir='proof/growth/2026-09-08-navigation-release';
const native=JSON.parse(fs.readFileSync(`${dir}/release-${run}/native-completion.json`,'utf8').replace(/^\uFEFF/,''));
if(native.results.some(r=>r.exitCode!==0)||!native.results.some(r=>r.step==='native-build'))throw Error('Release gates incomplete');
const scenarios=['nav-built-final-release.json','nav-built-final-tablet.json','nav-built-final-tablet-fallback.json','nav-windows-final-release.json'];
const records=fs.readdirSync('proof/growth/runner').filter(f=>f.endsWith('.json')&&!f.endsWith('.scenario.json')).map(f=>{try{return {file:`proof/growth/runner/${f}`,...JSON.parse(fs.readFileSync(`proof/growth/runner/${f}`,'utf8'))}}catch{return {}}});
const passed=scenarios.map(name=>{const found=records.filter(r=>r.scenario?.endsWith('/'+name)&&r.exitCode===0).at(-1);if(!found)throw Error('Missing executed pass '+name);return found});
const exe=native.artifacts.find(a=>a.path.endsWith('xray-by-looplet.exe'));
const installer=native.artifacts.find(a=>a.path.includes('nsis'));
const stage={
 id:'2026-09-08-07-walkthrough-release',title:'Stage 07 — Walk-through you can use',date:'8 September 2026',
 platform:`Windows candidate ${run}; production browser at laptop and tablet sizes`,
 summary:'Walk-through now suggests supported, clear room positions and useful headings. Fly and Walk remain usable with drag-to-look when mouse capture is refused, with a fresh-click capture action. Tablet targets and hint clearance are corrected; all five lower model controls remain available. Real camera movement, invalid starts, both Redburn floors and retained project data were exercised. This closes the bounded navigation repair, not the whole A–Z register.',
 requirements:[
 {id:'R-02',status:'Pass: controls/start milestone; full ID partial',change:'Real W/S/A/D displacement at nonzero headings; ground and upper eye heights; capture refusal, drag, retry and Escape. Source and architectural viewers exercised.',remaining:'Collision, gravity, stairs and full model/industry coverage remain open. Starts are inferred from model geometry.'},
 {id:'R-01',status:'Pass: lower-control regression; full ID partial',change:'Five bottom actions retained. Zoom, front/rear and reset changed the actual camera in browser and Windows journeys.',remaining:'Broader pan/scale/model/aspect-ratio acceptance remains open.'},
 {id:'U-02 / U-05',status:'Pass: navigation guidance; full IDs partial',change:'Visible movement/exit hints, keyboard controls, chosen heading, capture retry and selected-start contrast. Focus/blur and stale requests covered by controller tests.',remaining:'Whole-app command palette and accessibility audit remain open.'},
 {id:'U-06',status:'Pass: bounded tablet layouts; full ID partial',change:'1024×768 and 768×1024 target sizes, hit tests, start-dialog scrolling, capture retry and assistant/hint separation executed and visually inspected.',remaining:'Physical tablets, touch-only locomotion and native macOS/Linux acceptance are unverified; phone QA is excluded.'},
 {id:'U-09',status:'Pass: start/capture recovery; full ID partial',change:'Unsupported starting points refused with previous recommendation retained. Capture refusal keeps navigation usable. New Windows candidate reopens prior job, 13 sheets, two price books, saved view and backup review.',remaining:'Full project restoration, journaling, staff delivery/auth and other validation workflows remain open.'}
 ],
 images:[
 {file:'screenshots/growth/nav-windows-final-ground-before.png',caption:'After: the final Windows candidate opens into a clear lounge/kitchen view. Camera movement and 1.665 m eye height were verified separately in the executed log.'},
 {file:'screenshots/growth/2026-09-08-walk-retry-active.png',caption:'Before: the prior candidate entered walk mode at an unhelpful close surface. This failed visual starting point remains preserved.'},
 {file:'screenshots/growth/nav-windows-final-upper-before.png',caption:'Upper floor: a useful starting view at 4.785 m eye height; all four movement directions passed without changing walking height.'},
 {file:'screenshots/growth/nav-windows-final-ground-picker.png',caption:'Named recommendations and a direction arrow help choose a clear start. Obstructed/unsupported selections are refused before entry.'},
 {file:'screenshots/growth/nav-built-final-portrait-fallback.png',caption:'Tablet portrait: capture refusal offers drag-to-look and a retry button. The hint clears the assistant, and the five lower actions remain reachable.'},
 {file:'screenshots/growth/nav-built-final-landscape-start.png',caption:'Tablet landscape: the walking action remains a 44 px target, reachable through normal dialog scrolling.'},
 {file:'screenshots/growth/nav-windows-final-retained-backup.png',caption:'The new executable reopens the prior isolated QA workspace and verifies its existing backup without changing it. This is review/persistence proof, not full restore proof.'},
 {file:'screenshots/growth/nav-architect-production-walk-before.png',caption:'Architectural viewer production check on candidate 049d8ae830ee: real walk/fly, refused capture and retry passed. Its controller and viewer source are unchanged in the final CSS-only candidate.'}
 ],
 commands:[
 'Dans1: dependency restore, npm run typecheck, 110 focused tests, web production build, sequential Tauri/NSIS build — all exit 0, High priority, 16 workers.',
 ...passed.map(r=>`node scripts/fast-cdp-test.mjs ${r.session} ${r.scenario}${r.session.includes('native')?' --cdp 9266':''} — ${r.commands} commands, ${r.seconds.toFixed(3)} seconds, exit 0; exact report ${r.file}`),
 'Architect production: 175 commands across setup, captured/refused Fly and Walk, rapid re-entry and cleanup; see architect-production-acceptance.md and exact executed scenario copies.',
 'Screenshots were inspected. Initial failures and superseded builds remain recorded; timing corrections wait for rendered frames/scroll completion, with no arbitrary sleeps.'
 ],
 logs:passed.map(r=>r.log).concat([`${dir}/architect-production-acceptance.md`,`${dir}/dev-acceptance.md`,`${dir}/release-${run}/native-completion.json`,`${dir}/release-${run}/artifacts-verified.json`,`${dir}/release-${run}/source-drift.json`]),
 sourceIdentity:`Baseline commit 93a94a85d9ae829425fc5bde00fbe8ee2d5d5702 on feat/architect-cad-engine. Final web source SHA-256 ${native.sourceSha256}; native source ${native.nativeSourceSha256}. 516 web + 101 native files verified. EXE ${exe.sha256}. Installer ${installer.sha256}. Final scoped source snapshot proof/growth/2026-09-08-07-navigation-final-source/ (SHA 6e2ae651e6fc4c9dad6c5710c4c47d1047e37d041c8614925e671ee5ab76ba02). Earlier 527 candidate superseded by tablet target correction; 049 functional-pass candidate superseded only by hint clearance. No installation, merge, CRM edits or normal user-data changes.`,
 codeDiff:'proof/growth/2026-09-08-07-navigation-final-source/code.diff',
 summaryImage:'screenshots/growth/2026-09-08-07-walkthrough-release.png'
};
for(const image of stage.images)if(!fs.existsSync(image.file))throw Error('Missing image '+image.file);
fs.writeFileSync(`${dir}/stage-report.json`,JSON.stringify(stage,null,2)+'\n',{flag:'wx'});
console.log({file:`${dir}/stage-report.json`,run,passed:passed.map(r=>({scenario:r.scenario,commands:r.commands,seconds:r.seconds}))});
