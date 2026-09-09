$ErrorActionPreference = 'Stop'
$proofRoot = $PSScriptRoot
$record = Get-Content -Raw -LiteralPath (Join-Path $proofRoot 'native-process.json') | ConvertFrom-Json
$expectedMillis = ([DateTimeOffset]$record.CreationDate).ToUnixTimeMilliseconds()
function Get-OwnedNative {
  $current = Get-CimInstance Win32_Process -Filter "ProcessId=$($record.ProcessId)"
  if (-not $current) { return $null }
  if ($current.ExecutablePath -ne $record.ExecutablePath -or $current.CommandLine -ne $record.CommandLine -or ([DateTimeOffset]$current.CreationDate).ToUnixTimeMilliseconds() -ne $expectedMillis) { throw 'Native PID identity changed; preserved.' }
  return $current
}
$current = Get-OwnedNative
$graceful = $false
$forced = $false
if ($current) {
  $process = Get-Process -Id $current.ProcessId
  $graceful = $process.CloseMainWindow()
  $exited = $process.WaitForExit(3000)
  if (-not $exited) {
    $current = Get-OwnedNative
    if ($current) {
      $current | Select-Object ProcessId,CreationDate,ExecutablePath,CommandLine | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $proofRoot 'native-close-diagnostic.json') -Encoding UTF8
      Stop-Process -Id $current.ProcessId -Force
      $forced = $true
    }
  }
}
$remaining = [bool](Get-OwnedNative)
@{ at=[DateTime]::UtcNow.ToString('o'); owner='assistant-hardening'; pid=$record.ProcessId; gracefulCloseRequested=$graceful; forced=$forced; remaining=$remaining; installedAppTouched=$false } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $proofRoot 'native-cleanup.json') -Encoding UTF8
if ($remaining) { throw 'Owned native process remains.' }
