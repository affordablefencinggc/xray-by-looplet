import fs from 'node:fs';
import crypto from 'node:crypto';
const old=JSON.parse(fs.readFileSync('proof/growth/2026-09-08-walk-boundaries/source-snapshot.json','utf8'));
const spec={id:'2026-09-08-09-walkthrough-polish-source',files:[...old.files,'src/studio/FirstPersonArm.ts','src/studio/FirstPersonArm.test.ts','src/studio/cleanWalkPlan.ts','src/studio/cleanWalkPlan.test.ts','src/studio/walkStartPlacement.css','src/studio/sourceBuilding.css']};
fs.writeFileSync('proof/growth/2026-09-08-walkthrough-polish/source-snapshot.json',JSON.stringify(spec,null,2),{flag:'wx'});
const entries=['public/assets/walkthrough/arms.glb','public/assets/walkthrough/LICENSE.txt'].map(path=>{const b=fs.readFileSync(path);return {path,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')};});
fs.writeFileSync('proof/growth/2026-09-08-walkthrough-polish/asset-source-identity.json',JSON.stringify({capturedAt:new Date().toISOString(),entries},null,2),{flag:'wx'});
