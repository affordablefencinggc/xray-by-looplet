import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const old = 'proof/growth/2026-09-08-assistant-layout/final';
const dest = 'proof/growth/2026-09-08-assistant-hardening';
// Read-only preflight: do not compete with another chat's remote build.
const code = `Get-CimInstance Win32_Process | Where-Object { $_.Name -in @('cargo.exe','rustc.exe','node.exe','ninja.exe') } | Select-Object ProcessId,Name,CommandLine | ConvertTo-Json`;
const probe = spawnSync('ssh', ['-o','BatchMode=yes','-o','ConnectTimeout=10','tonys-test-pc','powershell','-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(code,'utf16le').toString('base64')], {encoding:'utf8',windowsHide:true});
fs.writeFileSync(`${dest}/remote-process-preflight.json`, probe.stdout || '[]');
if (probe.status !== 0) throw Error(probe.stderr);
console.log('Remote process inventory:', probe.stdout || 'No matching build processes');
const inventory = JSON.parse((probe.stdout || '').trim() || '[]');
const processes = Array.isArray(inventory) ? inventory : [inventory];
if (processes.some(p => p.Name !== 'node.exe' || !/preview-built\.mjs|npm-cli\.js run preview/.test(p.CommandLine || ''))) throw Error('Unrecognised remote build-related process; inspect ownership before launching.');
for (const name of ['package-web.mjs','package-native.mjs','remote-orchestrator.mjs','worker.ps1','start-preview.ps1','remote-collect-artifacts.ps1','release-verify-artifacts.mjs','release-build-identity.mjs','launch-native.mjs']) {
  const target = `${dest}/${name}`;
  if (fs.existsSync(target)) throw Error(`Preserve existing script ${target}`);
  let text = fs.readFileSync(`${old}/${name}`, 'utf8').replaceAll(old, dest);
  if (name === 'worker.ps1') text = text.replace("'src/studio/assistant/mcp.test.ts'", "'src/studio/assistant/skills.test.ts','src/studio/assistant/mcp.test.ts'");
  fs.writeFileSync(target, text);
}
