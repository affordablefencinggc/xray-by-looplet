$ErrorActionPreference='Stop'
$base=Join-Path $PSScriptRoot 'native-process.json'
$record=Get-Content -Raw -LiteralPath $base | ConvertFrom-Json
$events=@()
foreach($identity in @($record)+@((Get-Content -Raw (Join-Path $PSScriptRoot 'processes-active.json') | ConvertFrom-Json) | Where-Object ProcessId -eq 58424)) {
  $current=Get-CimInstance Win32_Process -Filter "ProcessId = $($identity.ProcessId)"
  if (!$current) { continue }
  $expected=if($identity.CreationDate -is [datetime]) { [Math]::Floor(($identity.CreationDate.ToUniversalTime()-[datetime]'1970-01-01').TotalMilliseconds) } else { [double]([regex]::Match([string]$identity.CreationDate,'\d+').Value) }
  $stamp=[Math]::Floor(($current.CreationDate.ToUniversalTime()-[datetime]'1970-01-01').TotalMilliseconds)
  if($stamp -ne $expected -or $current.ExecutablePath -ne $identity.ExecutablePath -or $current.CommandLine -ne $identity.CommandLine) { throw 'Identity mismatch: preserved' }
  $p=Get-Process -Id $current.ProcessId
  $requested=$p.CloseMainWindow()
  $exited=$p.WaitForExit(1500)
  $action='graceful exit'
  if(!$exited) {
    $again=Get-CimInstance Win32_Process -Filter "ProcessId = $($identity.ProcessId)"
    if($again -and $again.CreationDate -eq $current.CreationDate -and $again.ExecutablePath -eq $current.ExecutablePath -and $again.CommandLine -eq $current.CommandLine) { Stop-Process -Id $again.ProcessId; $action='terminated after bounded close' }
  }
  $events+=@{pid=$identity.ProcessId;action=$action;closeRequested=$requested}
}
@{at=[DateTime]::UtcNow.ToString('o');events=$events;remaining=@(Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -in @(72708,58424) } | Select-Object ProcessId,CreationDate);existingUserAppsPreserved=$true} | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $PSScriptRoot 'local-cleanup.json')
