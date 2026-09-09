$ErrorActionPreference='Stop'
$records=Get-Content -LiteralPath 'proof/growth/2026-09-08-one-floor/acceptance-processes.json' -Raw | ConvertFrom-Json
$record=$records | Where-Object {$_.ProcessId -eq 71008}
$current=Get-CimInstance Win32_Process -Filter 'ProcessId=71008'
$result=@{at=[DateTime]::UtcNow.ToString('o');pid=71008;purpose='Completed isolated one-floor native QA';retained=@('8956: verified user preview','44196: authorized local development','user Chrome tab','normal installed application and user profiles')}
if($current){
 $encoded=$current | Select-Object ProcessId,CreationDate,ExecutablePath,CommandLine | ConvertTo-Json | ConvertFrom-Json
 if($encoded.CreationDate -ne $record.CreationDate -or $encoded.ExecutablePath -ne $record.ExecutablePath -or $encoded.CommandLine -ne $record.CommandLine){throw 'Native identity mismatch; preserved'}
 $process=Get-Process -Id 71008
 $result.gracefulRequested=$process.CloseMainWindow()
 $exited=$process.WaitForExit(1500)
 if(-not $exited){
  $check=Get-CimInstance Win32_Process -Filter 'ProcessId=71008'
  if($check.CreationDate -ne $current.CreationDate -or $check.ExecutablePath -ne $current.ExecutablePath -or $check.CommandLine -ne $current.CommandLine){throw 'Native identity changed before termination'}
  $result.diagnostic=@{responding=$process.Responding;workingSet=$process.WorkingSet64;cpuSeconds=$process.CPU}
  Stop-Process -Id 71008
  $result.terminated=$true
 }
}
$result.remaining=[bool](Get-Process -Id 71008 -ErrorAction SilentlyContinue)
$result | ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 -LiteralPath 'proof/growth/2026-09-08-one-floor/cleanup.json'
