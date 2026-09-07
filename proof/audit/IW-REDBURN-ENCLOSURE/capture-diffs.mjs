import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const diff=(args)=>{const r=spawnSync('git',args,{encoding:'utf8',windowsHide:true,maxBuffer:20e6});if(r.status!==0&&r.status!==1)throw Error(r.stderr);return r.stdout;};
const sets=[
 ['proof/audit/IW-PROJECT-BACKUP/implementation.diff',['src/studio/Studio.tsx','src/studio/projectMaterialsPersistence.ts'],['src/studio/projectBackup.ts','src/studio/projectBackupStorage.ts','src/studio/ProjectBackups.tsx','src/studio/projectBackups.css','src/studio/projectBackup.test.ts']],
 ['proof/audit/IW-DANS1/implementation.diff',[],['scripts/package-dans1-build.mjs','proof/audit/IW-DANS1/remote-build.ps1']],
 ['proof/audit/IW-REDBURN-ENCLOSURE/implementation.diff',['scripts/build-redburn-model.mjs','src/studio/redburnBuilding.test.ts','src/studio/SourceBuildingViewer.tsx','src/studio/sourceBuilding.css','src/studio/liveAssistant.css'],[]],
];
for(const [file,tracked,added] of sets) {
 const content=(tracked.length?diff(['diff','--',...tracked]):'')+added.map(file=>diff(['diff','--no-index','--','NUL',file])).join('\n');
 fs.writeFileSync(file,content);
}
const note='\n\n- [x] 2026-09-07 | feat/architect-cad-engine | Named workspace backup library verified: immutable save, rename, archive, reload, portable download, validated import preview/library and real IndexedDB rollback/conflict checks. 692 tests at backup snapshot, typecheck, web/native builds, desktop/mobile/native proof. Editor restoration remains open; installed app not replaced. Evidence: proof/audit/IW-PROJECT-BACKUP/completion.md.\n- [x] 2026-09-07 | Dans1 isolated web build worker verified over existing trusted SSH alias. Portable runtime, explicit hashed snapshots, BelowNormal builds with six workers, built-output browser smoke. Native toolchain remains open. Evidence: DANS1-BUILD-TODO.md and proof/audit/IW-DANS1/. No CRM changes, stage, commit, merge, push or deployment.\n';
for(const file of ['COMPLETE-CHECKLIST.md','LOOPLET_BRANCH_RELEASE_LEDGER.md']) {
 const s=fs.readFileSync(file,'utf8'); if(!s.includes('Named workspace backup library verified:'))fs.appendFileSync(file,note);
}
