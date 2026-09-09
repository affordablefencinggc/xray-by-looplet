import fs from 'node:fs';
const base='proof/growth/2026-09-08-one-floor',final=base+'/final';fs.mkdirSync(final,{recursive:true});
for(const file of ['package-web.mjs','package-native.mjs','remote-orchestrator.mjs','worker.ps1','start-preview.ps1','remote-collect-artifacts.ps1','release-verify-artifacts.mjs','release-build-identity.mjs'])fs.writeFileSync(`${final}/${file}`,fs.readFileSync(`${base}/${file}`,'utf8').replaceAll(base,final));
fs.writeFileSync(`${base}/release-15d358f8a742/SUPERSEDED.md`,'Superseded during review: desktop memory router needed explicit floor route and in-app links. This artifact is not accepted or shown as the final desktop deliverable. Final snapshot will include the navigation fix.\n');
