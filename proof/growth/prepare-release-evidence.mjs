import fs from 'node:fs';
const stages=['2026-09-07-01-recovery-source','2026-09-07-02-sheets-source','2026-09-07-03-pricing-source'];
const files=[...new Set([...stages.flatMap(id=>JSON.parse(fs.readFileSync(`proof/growth/${id}/source-manifest.json`,'utf8')).entries.map(e=>e.path)),'scripts/fast-cdp-test.mjs','scripts/growth-report.mjs','scripts/growth-snapshot.mjs'])];
fs.writeFileSync('proof/growth/release-snapshot.json',JSON.stringify({id:'2026-09-07-04-release-source',files},null,2));
