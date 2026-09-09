$ErrorActionPreference='Stop'
if ($env:COMPUTERNAME -ne 'DANS1') { throw 'Dans1 only' }
$run='C:\Users\danie\XRayBuilds\runs\925531795d82'
$record=Get-Content -Raw -LiteralPath (Join-Path $run 'preview-process.json') | ConvertFrom-Json
$root=Get-CimInstance Win32_Process -Filter "ProcessId = $($record.pid)"
$events=[Collections.Generic.List[object]]::new()
if ($root) {
  $stamp=[Math]::Floor(($root.CreationDate.ToUniversalTime()-[datetime]'1970-01-01').TotalMilliseconds)
  $expectedStamp=if ($record.creationTime -is [datetime]) { [Math]::Floor(($record.creationTime.ToUniversalTime()-[datetime]'1970-01-01').TotalMilliseconds) } else { [double]([regex]::Match([string]$record.creationTime,'\d+').Value) }
  if ($root.ExecutablePath -ne $record.executable -or $root.CommandLine -ne $record.command -or $stamp -ne $expectedStamp) { throw "Preview identity mismatch; preserved (creation $stamp expected $expectedStamp)" }
  $all=@(Get-CimInstance Win32_Process)
  $owned=[Collections.Generic.List[object]]::new()
  $owned.Add($root)
  for($i=0;$i -lt $owned.Count;$i++) { foreach($child in $all | Where-Object ParentProcessId -eq $owned[$i].ProcessId) { $owned.Add($child) } }
  $p=Get-Process -Id $root.ProcessId
  $requested=$p.CloseMainWindow()
  $exited=$p.WaitForExit(1500)
  foreach($identity in @($owned.ToArray()) | Sort-Object CreationDate -Descending) {
    $current=Get-CimInstance Win32_Process -Filter "ProcessId = $($identity.ProcessId)"
    if ($current -and $current.CreationDate -eq $identity.CreationDate -and $current.ExecutablePath -eq $identity.ExecutablePath -and $current.CommandLine -eq $identity.CommandLine) {
      Stop-Process -Id $current.ProcessId -ErrorAction Stop
      $events.Add(@{pid=$current.ProcessId;creationTime=$current.CreationDate;executable=$current.ExecutablePath;action='terminated owned QA preview after bounded close attempt'})
    }
  }
}
@{at=[DateTime]::UtcNow.ToString('o');owner='ring-overflow';events=$events;previewRemaining=[bool](Get-CimInstance Win32_Process -Filter "ProcessId = $($record.pid)");existing8095Preserved=$true} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $run 'preview-cleanup.json')

