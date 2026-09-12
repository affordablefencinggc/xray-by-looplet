param([string]$Scenario = 'scenario.json', [string]$Output = 'browser-review', [string]$Browser = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe')
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
if ($env:COMPUTERNAME -ne 'DANS1') { throw 'DANS1 is required.' }
$taskRoot='C:\Users\danie\XRayBuilds\d15-review-20260912'
$runtime='C:\Users\danie\XRayBuilds\runs\c484f17f2b4d\runtime'
$env:Path=$runtime+';'+$env:Path
Set-Location -LiteralPath $taskRoot
if (Get-NetTCPConnection -State Listen -LocalPort 8080 -ErrorAction SilentlyContinue) { throw 'Port 8080 is already owned; no process will be replaced.' }
$proofRoot=Join-Path 'C:\Users\danie\XRayBuilds\visualise-review-evidence' $Output
New-Item -ItemType Directory -Force $proofRoot | Out-Null
$Output=$proofRoot
$owned=$null
try {
  $owned=Start-Process -FilePath "$runtime\node.exe" -ArgumentList "$runtime\node_modules\npm\bin\npm-cli.js run dev -- --config vite.config.spa.ts" -WorkingDirectory $taskRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput "$proofRoot\dev.stdout.log" -RedirectStandardError "$proofRoot\dev.stderr.log"
  $created=$owned.StartTime
  Get-CimInstance Win32_Process -Filter "ProcessId=$($owned.Id)" | Select-Object ProcessId,CreationDate,ExecutablePath,CommandLine,@{n='owner';e={'codex-visualise-review'}},@{n='purpose';e={'Active UI verification'}},@{n='lastActivity';e={(Get-Date).ToString('o')}} | ConvertTo-Json | Set-Content "$proofRoot\owned-dev.json"
  $deadline=(Get-Date).AddSeconds(45)
  do {
    try { $ready=(Invoke-WebRequest http://127.0.0.1:8080/ -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200 } catch { $ready=$false }
    if (!$ready) { Start-Sleep -Milliseconds 250 }
  } until ($ready -or (Get-Date) -gt $deadline)
  if (!$ready) { Get-Content "$proofRoot\dev.stderr.log"; throw 'Development app did not become ready.' }
  (Invoke-WebRequest "http://127.0.0.1:8080/?pane=model" -UseBasicParsing).Headers | ConvertTo-Json | Set-Content "$proofRoot\http-headers.json"
  & "$taskRoot\run-fast-cdp.ps1" -Scenario $Scenario -Output $Output -Port 9337 -Chrome $Browser
} finally {
  if ($owned -and !$owned.HasExited) {
    if ((Get-Process -Id $owned.Id).StartTime -ne $created) { throw 'Dev process identity changed; cleanup refused.' }
    $all=@(Get-CimInstance Win32_Process)
    $tree=[Collections.Generic.List[object]]::new()
    $pending=[Collections.Generic.Queue[int]]::new(); $pending.Enqueue($owned.Id)
    while ($pending.Count) {
      $parent=$pending.Dequeue()
      foreach ($child in $all | Where-Object ParentProcessId -eq $parent) { $tree.Add($child); $pending.Enqueue($child.ProcessId) }
    }
    $tree.Add(($all | Where-Object ProcessId -eq $owned.Id))
    $tree | Select-Object ProcessId,CreationDate,ExecutablePath,CommandLine | ConvertTo-Json | Set-Content "$proofRoot\owned-dev-tree.json"
    $owned.CloseMainWindow() | Out-Null
    $owned.WaitForExit(1000) | Out-Null
    foreach ($record in $tree) {
      $live=Get-CimInstance Win32_Process -Filter "ProcessId=$($record.ProcessId)"
      if ($live -and $live.CreationDate -eq $record.CreationDate -and $live.ExecutablePath -eq $record.ExecutablePath -and $live.CommandLine -eq $record.CommandLine) { Stop-Process -Id $record.ProcessId -ErrorAction Stop }
    }
    'Stopped identity-verified task-owned dev tree after campaign. User preview and unrelated processes retained.' | Set-Content "$proofRoot\dev-cleanup.txt"
  }
}
