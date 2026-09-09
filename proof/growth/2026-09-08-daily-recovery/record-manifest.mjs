import fs from 'node:fs';
import {createHash} from 'node:crypto';
const digest=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const downloadProof='proof/growth/2026-09-08-daily-recovery/download-byte-proof.json';
const proofBytes=fs.readFileSync(downloadProof);
if(proofBytes[0]===255&&proofBytes[1]===254)fs.writeFileSync(downloadProof,proofBytes.toString('utf16le').replace(/^\uFEFF/,''));
const screenshots=['blocked-desktop','blocked-landscape','blocked-portrait','unsaved-desktop','unsaved-landscape','unsaved-portrait','readback-unsaved-portrait','final-restored'].map(s=>`screenshots/growth/daily-recovery-dev-${s}.png`);
const source=['src/studio/Studio.tsx','src/studio/store.ts','src/studio/persistence.ts','src/studio/ProjectDetails.tsx','src/studio/ProjectRecoveryNotice.tsx','src/studio/projectDetails.css'];
fs.writeFileSync('proof/growth/2026-09-08-daily-recovery/qa-manifest.json',JSON.stringify({scope:'Development UI only, isolated growth-daily-recovery; no immutable source snapshot or production/native gate',sourceAtAuditClose:source.map(path=>({path,sha256:digest(path)})),screenshots:screenshots.map(path=>({path,sha256:digest(path),visuallyInspected:true})),download:JSON.parse(fs.readFileSync('proof/growth/2026-09-08-daily-recovery/download-byte-proof.json','utf8').replace(/^\uFEFF/,''))},null,2));
