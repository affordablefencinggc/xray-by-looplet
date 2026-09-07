$ErrorActionPreference='Stop'
$workspace='C:\Users\danie\repo\xray-by-looplet'
$proof=Join-Path $workspace 'proof\audit\IW-REDBURN-ENCLOSURE'
$qa=Get-Content -LiteralPath (Join-Path $proof 'installed-qa-launch.json') -Raw | ConvertFrom-Json
$process=Get-Process -Id $qa.pid -ErrorAction SilentlyContinue
if ($process) {
  if ($process.Path -ne $qa.exe -or -not $qa.profile.StartsWith((Join-Path $workspace '.temp\'),[StringComparison]::OrdinalIgnoreCase)) { throw 'Isolated QA identity mismatch' }
  $null=$process.CloseMainWindow()
  if (-not $process.WaitForExit(3000)) { $process.Kill(); $process.WaitForExit() }
}
$oldArguments=$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS
$oldProfile=$env:WEBVIEW2_USER_DATA_FOLDER
try {
  $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS='--remote-debugging-port=9254'
  Remove-Item Env:WEBVIEW2_USER_DATA_FOLDER -ErrorAction SilentlyContinue
  $app=& (Join-Path $workspace 'scripts\start-local-desktop.ps1') -PassThru
  @{pid=$app.Id;exe=$app.Path;profile='Existing default application profile';cdpPort=9254;openedAt=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $proof 'normal-launch.json') -Encoding UTF8
  Write-Output "Reopened updated X-Ray with existing profile (PID $($app.Id))."
} finally {
  $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=$oldArguments
  $env:WEBVIEW2_USER_DATA_FOLDER=$oldProfile
}
