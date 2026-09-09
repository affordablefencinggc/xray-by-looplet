$ErrorActionPreference='Stop'
# Stops only the dev server this stage started (vite dev on 127.0.0.1:8091), after checking its identity.
$stage='proof/growth/2026-09-09-assistant-workbench'
$listener=Get-NetTCPConnection -LocalPort 8091 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
$result=@{at=[DateTime]::UtcNow.ToString('o');port=8091;found=$false}
if($listener){
  $p=Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
  if($p -and $p.CommandLine -like '*vite*' -and $p.CommandLine -like '*8091*'){
    $result.found=$true; $result.pid=$p.ProcessId; $result.created=$p.CreationDate.ToString('o'); $result.command=$p.CommandLine
    Stop-Process -Id $p.ProcessId
    Start-Sleep -Milliseconds 1500
    $result.remaining=[bool](Get-Process -Id $p.ProcessId -ErrorAction SilentlyContinue)
  } else { throw "Listener on 8091 is not this stage's vite dev server; preserved" }
}
$result | ConvertTo-Json | Set-Content -Encoding UTF8 -LiteralPath "$stage/dev-cleanup.json"
Get-Content "$stage/dev-cleanup.json"
