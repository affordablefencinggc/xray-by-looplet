$ErrorActionPreference='Stop'
$workspace='C:\Users\danie\repo\xray-by-looplet'
foreach ($file in @('proof\audit\IW-PROJECT-BACKUP\native-launch.json','proof\audit\IW-REDBURN-ENCLOSURE\native-launch.json')) {
  $path=Join-Path $workspace $file
  $record=Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
  $app=Get-Process -Id $record.pid -ErrorAction SilentlyContinue
  if (-not $app) { continue }
  if ($app.Path -ne $record.exe -or -not $record.profile.StartsWith((Join-Path $workspace '.temp\'),[StringComparison]::OrdinalIgnoreCase)) { throw 'QA process identity mismatch' }
  # These are our isolated QA instances, never the installed user profile.
  $null=$app.CloseMainWindow()
  if (-not $app.WaitForExit(3000)) { $app.Kill(); $app.WaitForExit() }
  Write-Output "Closed isolated QA process $($record.pid)."
}
