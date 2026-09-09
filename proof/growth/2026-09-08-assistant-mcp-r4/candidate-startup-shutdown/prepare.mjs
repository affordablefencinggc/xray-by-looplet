import fs from 'node:fs';
const old='proof/growth/2026-09-08-assistant-mcp-r4/baseline-shutdown-38a64';
const next='proof/growth/2026-09-08-assistant-mcp-r4/candidate-startup-shutdown';
let launch=fs.readFileSync(old+'/launch.mjs','utf8')
 .replace('14db2b026c8a8aaaf75c54f47be9405db0f5e81a1cb9ee455582d9646bfe72ca','38c673ae5591c79ffda0fa283c6dc292118cfd2e6c1823b0f4660170ff474f3c')
 .replace('proof/growth/2026-09-08-walkthrough-polish/release-38a64f0b8c2b','proof/growth/2026-09-08-assistant-mcp-r4/release-71f5b012342b')
 .replaceAll('baseline-shutdown-38a64','candidate-startup-shutdown')
 .replaceAll('38a64f0b8c2b','71f5b012342b')
 .replace('const port=9274','const port=9275')
 .replaceAll('Previous verified','Final verified')
 .replace('2026-09-08-shutdown-baseline-38a64-ready.png','2026-09-08-shutdown-candidate-71f5-ready.png');
fs.writeFileSync(next+'/launch.mjs',launch,{flag:'wx'});
let close=fs.readFileSync(old+'/close.ps1','utf8').replaceAll('baseline-shutdown-38a64','candidate-startup-shutdown').replace('Owned baseline has no main window','Owned candidate has no main window');
fs.writeFileSync(next+'/close.ps1',close,{flag:'wx'});
