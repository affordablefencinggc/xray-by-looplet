import fs from 'node:fs';
const commands=JSON.parse(fs.readFileSync('proof/growth/native-sheets.json','utf8'));
// WebView2 does not support this agent-browser viewport operation. Desktop
// acceptance uses the real window; mobile acceptance is executed on built web.
const selected=[['tab','t1'],['eval',"if(!window.__TAURI_INTERNALS__)throw Error('Not native');({native:true,width:innerWidth,height:innerHeight})"],...commands.slice(1,54),commands[57].map(s=>s.replaceAll('Reload/mobile','Reload desktop').replaceAll('Reload and mobile resize','Reload')),
 ['screenshot','screenshots/growth/2026-09-07-sheets/native-bookmark-reloaded.png'],...commands.slice(61)];
fs.writeFileSync('proof/growth/native-sheets-desktop.json',JSON.stringify(selected,null,2));
