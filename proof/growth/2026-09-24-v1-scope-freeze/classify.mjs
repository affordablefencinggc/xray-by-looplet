import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const base = 'proof/growth/2026-09-24-v1-scope-freeze';
const files = execFileSync('git', ['ls-files', '*.md'], { encoding: 'utf8' }).trim().split('\n');
const deferredCategories = new Set('G H I J K L M N O S W Y'.split(' '));
const deferredIds = new Set('A-01 A-02 A-03 A-04 A-05 A-06 A-07 A-08 A-09 A-11 V-05 V-06 V-07 V-14 Z-06 B-06 P-01 P-03 X-09'.split(' '));
function classify(file, text) {
  const id = text.match(/\*\*([A-Z]{1,2}-\d{2})\b/)?.[1];
  if (id && (deferredIds.has(id) || deferredCategories.has(id.split('-')[0]))) return 'backlog';
  if ((file === 'DAY-TO-DAY-TODO.md' && /SC-0[56]\b/.test(text)) ||
      (file === 'WORKSPACE-PANELS-TODO.md' && /SC-13\b/.test(text)) ||
      (file === 'GROWTH-TODO.md' && /Full collision\/gravity/.test(text)) ||
      (file === 'PROJECT-MATERIALS-TODO.md' && /1,260/.test(text))) return 'backlog';
  if (/COMPLEX-PLAN|HVAC/.test(file) && /reload|hydration|404/.test(text)) return '01';
  if (/close requests|graceful.shutdown|development.reload/i.test(text)) return '01';
  if (/ASSISTANT|AI-MATERIALS|TAKEOVER|VISIBLE-WORKING/.test(file)) return '05';
  if (/FENCING|SC07-BRIDGE|TOPDOWN/.test(file)) return '03';
  if (/HVAC|INDUSTRY-AGENT|PROFESSIONAL|INDUSTRY-CHECKLIST|INDUSTRY-REMAINING/.test(file) && !id) return '02';
  if (/DWG|ARCHITECT-SKETCH|AZ-CLOSEOUT|COMPLETE-CHECKLIST|walkthrough|HANDOVER/.test(file)) return '06';
  if (id) {
    if (/^(E|F|U)-/.test(id)) return '03';
    if (/^(P|X)-/.test(id)) return '05';
    if (/^(A|Q|Z)-/.test(id)) return '06';
    if (/^(C|R|SO|PH)-/.test(id)) return '02';
  }
  return '04';
}
const rows = [];
for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  const lines = original.split(/\r?\n/);
  let changed = false;
  lines.forEach((text, i) => {
    if (!/^\s*- \[ \]/.test(text)) return;
    const disposition = classify(file, text);
    const historical = file.startsWith('proof/') || file.startsWith('.');
    rows.push({ file, line: i + 1, disposition, historical, text });
    // Historical receipts are immutable. Their ownership is recorded in the index.
    if (!historical && !/\[section 0[1-6]\]|moved to POST-V1-BACKLOG/.test(text)) {
      lines[i] += disposition === 'backlog'
        ? ' — moved to POST-V1-BACKLOG (v1 scope freeze 2026-09-24).'
        : ` [section ${disposition}]`;
      changed = true;
    }
  });
  if (changed) fs.writeFileSync(file, lines.join(original.includes('\r\n') ? '\r\n' : '\n'));
}
fs.writeFileSync(`${base}/scope-index.json`, JSON.stringify(rows, null, 2) + '\n');
const reference = row => `[${row.file}:${row.line}](${row.file}#L${row.line})`;
const label = row => row.text.replace(/^\s*- \[ \]\s*/, '').replace(/\|/g, '\\|');
fs.writeFileSync('POST-V1-BACKLOG.md', '# Post-v1 backlog\n\nScope freeze 2026-09-24, authorized by the request to execute 00-ledger-hygiene.md. Deferred work remains unchecked at its source. No feature or proof is deleted. Source line numbers identify this freeze snapshot.\n\n' +
  rows.filter(row => row.disposition === 'backlog').map(row => `- ${reference(row)} — ${label(row)}`).join('\n') +
  '\n\n## External release infrastructure\n\nMaster ledger SC-11/15/16 external CI, SBOM and update-channel work is deferred; v1 Windows signing and installed acceptance remain section 06.\n\n' +
  ['SC-11', 'SC-15', 'SC-16'].map(id => {
    const lines = fs.readFileSync('XRAY-MASTER-LEDGER.md', 'utf8').split(/\r?\n/);
    const line = lines.findIndex(text => text.startsWith(`### ${id}`)) + 1;
    return `- [XRAY-MASTER-LEDGER.md:${line}](XRAY-MASTER-LEDGER.md#L${line}) — ${id}: external CI/SBOM/update-channel portion only; preserve signing, native packaging and local evidence gates.`;
  }).join('\n') + '\n');
let finish = fs.readFileSync('FINISH-LINE.md', 'utf8').split('\n## Open-item ownership index')[0];
finish += '\n## Open-item ownership index\n\nFreeze snapshot 2026-09-24. Every tracked Markdown open checkbox is assigned below or in POST-V1-BACKLOG.md. Historical proof remains unchanged; its lines are references, not newly accepted requirements or passes. Machine-readable index: `proof/growth/2026-09-24-v1-scope-freeze/scope-index.json`.\n';
for (const section of ['01', '02', '03', '04', '05', '06']) {
  finish += `\n### Section ${section} open lines\n\n`;
  finish += rows.filter(row => row.disposition === section).map(row => `- ${reference(row)}${row.historical ? ' (historical reference)' : ''} — ${label(row)}`).join('\n') + '\n';
}
fs.writeFileSync('FINISH-LINE.md', finish);
console.log(JSON.stringify({ open: rows.length, backlog: rows.filter(row => row.disposition === 'backlog').length, historical: rows.filter(row => row.historical).length }));
