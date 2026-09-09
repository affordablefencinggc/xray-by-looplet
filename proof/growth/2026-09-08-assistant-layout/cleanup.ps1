$ErrorActionPreference='Stop'
$base='proof/growth/2026-09-08-assistant-layout'
$records=Get-Content -LiteralPath "$base/acceptance-processes.json" -Raw | ConvertFrom-Json
$record=$records | Where-Object {$_.ProcessId -eq 31368}
$current=Get-CimInstance Win32_Process -Filter 'ProcessId=31368'
$result=@{at=[DateTime]::UtcNow.ToString('o');pid=31368;purpose='Completed isolated assistant and floor native QA';retained=@('Current verified user preview','44196: authorized local development','User floor and assistant browser tabs','Normal installed app and user profiles')}
if($current){
 $encoded=$current | Select-Object ProcessId,CreationDate,ExecutablePath,CommandLine | ConvertTo-Json | ConvertFrom-Json
 if(-not $record -or $encoded.CreationDate -ne $record.CreationDate -or $encoded.ExecutablePath -ne $record.ExecutablePath -or $encoded.CommandLine -ne $record.CommandLine){throw 'Native identity mismatch; preserved'}
 $process=Get-Process -Id 31368
 $result.gracefulRequested=$process.CloseMainWindow()
 $exited=$process.WaitForExit(1500)
 if(-not $exited){
  $check=Get-CimInstance Win32_Process -Filter 'ProcessId=31368'
  if($check.CreationDate -ne $current.CreationDate -or $check.ExecutablePath -ne $current.ExecutablePath -or $check.CommandLine -ne $current.CommandLine){throw 'Native identity changed before termination'}
  $result.diagnostic=@{responding=$process.Responding;workingSet=$process.WorkingSet64;cpuSeconds=$process.CPU}
  Stop-Process -Id 31368
  $process.WaitForExit(1500) | Out-Null
  $result.terminated=$true
 }
}
$result.remaining=[bool](Get-Process -Id 31368 -ErrorAction SilentlyContinue)
$result | ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 -LiteralPath "$base/cleanup.json"
$previewProcess=Get-NetTCPConnection -LocalPort 8095 -State Listen | Select-Object -First 1 -ExpandProperty OwningProcess
Get-CimInstance Win32_Process -Filter "ProcessId=$previewProcess OR ProcessId=44196" | Select-Object ProcessId,CreationDate,ExecutablePath,CommandLine | ConvertTo-Json | Set-Content -Encoding UTF8 -LiteralPath "$base/final-retained-processes.json"
