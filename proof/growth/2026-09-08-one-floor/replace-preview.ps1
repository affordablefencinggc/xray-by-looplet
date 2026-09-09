param([switch]$StopOnly)
$ErrorActionPreference='Stop'
$base=Join-Path (Get-Location) 'proof/growth/2026-09-08-one-floor'
$records=Get-Content -LiteralPath 'proof/growth/2026-09-08-pencil-independent/processes.json' -Raw | ConvertFrom-Json
$record=$records | Where-Object {$_.ProcessId -eq 63160}
if (-not $record) {throw 'Previous preview identity not recorded'}
$current=Get-CimInstance Win32_Process -Filter 'ProcessId=63160'
if ($current) {
  $encoded=$current | Select-Object ProcessId,CreationDate,ExecutablePath,CommandLine | ConvertTo-Json | ConvertFrom-Json
  if($encoded.CreationDate -ne $record.CreationDate -or $encoded.ExecutablePath -ne $record.ExecutablePath -or $encoded.CommandLine -ne $record.CommandLine){throw 'Preview identity changed; preserved'}
  $process=Get-Process -Id 63160
  $closed=$process.CloseMainWindow()
  $exited=$process.WaitForExit(1200)
  if(-not $exited) {
    $check=Get-CimInstance Win32_Process -Filter 'ProcessId=63160'
    if($check.CreationDate -ne $current.CreationDate -or $check.ExecutablePath -ne $current.ExecutablePath -or $check.CommandLine -ne $current.CommandLine){throw 'Preview identity changed before termination'}
    Stop-Process -Id 63160
  }
  @{pid=63160;reason='Superseded user preview; verified final artifact replaces it';gracefulRequested=$closed;terminated=(-not $exited);at=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $base 'preview-replaced.json')
}
if($StopOnly){exit 0}
$artifacts=Join-Path $base 'final/release-8de251421835/web-artifacts'
New-Item -ItemType Directory -Force -Path (Join-Path $artifacts 'scripts') | Out-Null
Copy-Item -LiteralPath 'scripts/preview-built.mjs' -Destination (Join-Path $artifacts 'scripts/preview-built.mjs')
Set-Location -LiteralPath $artifacts
$env:PREVIEW_PORT='8095'
$env:PREVIEW_HOST='127.0.0.1'
node scripts/preview-built.mjs
