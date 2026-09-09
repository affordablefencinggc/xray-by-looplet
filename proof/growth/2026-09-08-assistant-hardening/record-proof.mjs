import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const base = 'proof/growth/2026-09-08-assistant-hardening';
const files = ['src/studio/LiveAssistant.tsx','src/studio/assistantPanel.css','src/studio/assistant/panelGeometry.ts','src/studio/assistant/panelGeometry.test.ts','src/studio/assistant/useAssistantPanel.ts','src/studio/assistant/contract.ts','src/studio/assistant/conversation.ts','src/studio/assistant/conversation.test.ts','src/studio/assistant/useAssistantChat.ts','src/studio/assistant/session.ts','src-tauri/src/assistant_ai.rs','src/studio/assistant/skills.ts','src/studio/assistant/skills.test.ts'];
const hash = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const manifest = [], diffs = [];
for (const file of files) {
  const before = `${base}/baseline/${file}`;
  const result = spawnSync('git',['diff','--no-index','--',fs.existsSync(before)?before:'/dev/null',file],{encoding:'utf8',windowsHide:true});
  if (result.status > 1) throw Error(result.stderr);
  diffs.push(result.stdout);
  manifest.push({path:file,beforeSha256:fs.existsSync(before)?hash(before):null,sha256:hash(file)});
}
fs.writeFileSync(`${base}/code.diff`,diffs.join('\n'));
fs.writeFileSync(`${base}/task-source-manifest.json`,JSON.stringify({at:new Date().toISOString(),files:manifest},null,2));
const runs = fs.readdirSync('proof/growth/runner').filter(f=>f.endsWith('.json')&&!f.endsWith('.scenario.json')&&f.includes('assistant-hardening')).map(f=>({file:f,...JSON.parse(fs.readFileSync(`proof/growth/runner/${f}`,'utf8'))}));
fs.writeFileSync(`${base}/browser-runs.json`,JSON.stringify(runs,null,2));
console.log(JSON.stringify({files:files.length,diffBytes:diffs.join('\n').length,browserRuns:runs.length,passing:runs.filter(r=>r.exitCode===0).length}));
