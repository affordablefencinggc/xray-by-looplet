param([switch]$StopOnly)
$ErrorActionPreference='Stop'
$base=Join-Path (Get-Location) 'proof/growth/2026-09-08-assistant-layout'
$records=Get-Content -LiteralPath 'proof/growth/2026-09-08-assistant-layout/acceptance-processes.json' -Raw | ConvertFrom-Json
$record=$records | Where-Object {$_.ProcessId -eq 44308}
if(-not $record){throw 'Previous preview identity unavailable'}
$current=Get-CimInstance Win32_Process -Filter 'ProcessId=44308'
if($current){
 $encoded=$current | Select-Object ProcessId,CreationDate,ExecutablePath,CommandLine | ConvertTo-Json | ConvertFrom-Json
 if($encoded.CreationDate -ne $record.CreationDate -or $encoded.ExecutablePath -ne $record.ExecutablePath -or $encoded.CommandLine -ne $record.CommandLine){throw 'Previous preview identity changed'}
 $process=Get-Process -Id 44308
 $closed=$process.CloseMainWindow()
 $exited=$process.WaitForExit(1500)
 if(-not $exited){
  $check=Get-CimInstance Win32_Process -Filter 'ProcessId=44308'
  if($check.CreationDate -ne $current.CreationDate -or $check.ExecutablePath -ne $current.ExecutablePath -or $check.CommandLine -ne $current.CommandLine){throw 'Preview identity changed before termination'}
  Stop-Process -Id 44308
  $process.WaitForExit(1500) | Out-Null
 }
 @{pid=44308;reason='Superseded by verified assistant layout and corrected floor artifact';gracefulRequested=$closed;terminated=(-not $exited);remaining=[bool](Get-Process -Id 44308 -ErrorAction SilentlyContinue);at=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $base 'preview-config-restarted.json')
}
if($StopOnly){exit 0}
$artifacts=Join-Path $base 'final/release-a570fcaf7e77/web-artifacts'
$identity=Get-Content -LiteralPath (Join-Path $base 'final/release-a570fcaf7e77/build-identity-verified.json') -Raw | ConvertFrom-Json
if($identity.status -ne 'pass'){throw 'Final build identity is not verified'}
New-Item -ItemType Directory -Force -Path (Join-Path $artifacts 'scripts') | Out-Null
Copy-Item -LiteralPath 'scripts/preview-built.mjs' -Destination (Join-Path $artifacts 'scripts/preview-built.mjs')
Set-Location -LiteralPath $artifacts
$env:PREVIEW_PORT='8095'
$env:PREVIEW_HOST='127.0.0.1'
node --env-file="$(Join-Path $base '../../../.env.local')" scripts/preview-built.mjs
