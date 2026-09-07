import fs from 'node:fs';
const file='proof/growth/2026-09-08-walkthrough-polish/asset-acquisition/creator-download-page.html';
const html=fs.readFileSync(file,'utf8').replace(/(<meta name="csrf_token" value=")[^"]+/g,'$1[redacted anonymous form token]').replace(/(psx-first-person-arms-free\/download\/)[^"\s<]+/g,'$1[redacted anonymous signed link]');fs.writeFileSync(file,html);console.log('Anonymous form tokens removed from retained download-page evidence.');
