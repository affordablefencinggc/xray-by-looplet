import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const base = 'proof/growth/2026-09-08-assistant-hardening';
const code = `
$ErrorActionPreference='Stop'
$run='C:/Users/danie/XRayBuilds/runs/72804bfa9fac'
$record=Get-Content -Raw -LiteralPath (Join-Path $run 'preview.json') | ConvertFrom-Json
$root=Get-CimInstance Win32_Process -Filter "ProcessId=$($record.pid)"
if(-not $root){ @{remaining=$false;reason='Already exited'} | ConvertTo-Json; exit 0 }
$expected=[IO.Path]::GetFullPath((Join-Path $run 'runtime/node.exe'))
if($root.ExecutablePath -ne $expected -or $root.CommandLine -notlike '*npm-cli.js*run*preview*' -or [Math]::Abs(($root.CreationDate.ToUniversalTime()-[DateTime]::Parse($record.startedAt).ToUniversalTime()).TotalSeconds) -gt 15){throw 'Preview identity changed; preserved'}
$all=Get-CimInstance Win32_Process
$owned=[Collections.Generic.List[object]]::new()
$owned.Add($root)
for($i=0;$i -lt $owned.Count;$i++){foreach($child in $all | Where-Object {$_.ParentProcessId -eq $owned[$i].ProcessId}){$owned.Add($child)}}
$identities=@($owned | Select-Object ProcessId,CreationDate,ExecutablePath,CommandLine)
$identities | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $run 'preview-cleanup-identities.json')
$process=Get-Process -Id $root.ProcessId
$graceful=$process.CloseMainWindow()
if($graceful){$null=$process.WaitForExit(2000)}
for($i=$owned.Count-1;$i -ge 0;$i--){
 $before=$owned[$i];$now=Get-CimInstance Win32_Process -Filter "ProcessId=$($before.ProcessId)"
 if($now){if($now.CreationDate -ne $before.CreationDate -or $now.ExecutablePath -ne $before.ExecutablePath -or $now.CommandLine -ne $before.CommandLine){throw 'Descendant identity changed; preserved'};Stop-Process -Id $now.ProcessId -Force}
}
$remaining=@($owned | Where-Object {Get-CimInstance Win32_Process -Filter "ProcessId=$($_.ProcessId)"})
@{owner='assistant-hardening';at=[DateTime]::UtcNow.ToString('o');pids=@($owned.ProcessId);remaining=$remaining.Count;existingPreviewPreserved=$true} | ConvertTo-Json
if($remaining.Count){throw 'Preview descendants remain'}
`;
const result = spawnSync('ssh',['-o','BatchMode=yes','-o','ConnectTimeout=10','tonys-test-pc','powershell','-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(code,'utf16le').toString('base64')],{encoding:'utf8',windowsHide:true});
fs.writeFileSync(`${base}/remote-cleanup.log`, (result.stdout || '') + (result.stderr || ''));
console.log(result.stdout || result.stderr);
if(result.status!==0)throw Error('Remote cleanup failed; inspect log.');
