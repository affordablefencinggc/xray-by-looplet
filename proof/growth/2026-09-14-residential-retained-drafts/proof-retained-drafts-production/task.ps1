$ErrorActionPreference='Stop'
$root='C:/Users/danie/XRayBuilds/runs/5b80085aab3f/source'
$proof=Join-Path $root 'proof-retained-drafts-production'
$runtime='C:/Users/danie/XRayBuilds/runs/73fb96374c6e/runtime'
New-Item -ItemType Directory -Path $proof -Force | Out-Null
$server=$null
try {
 if($env:COMPUTERNAME -ne 'DANS1'){throw 'host mismatch'}
 if(Get-NetTCPConnection -State Listen -LocalPort 8081,9355 -ErrorAction SilentlyContinue){throw 'requested port already owned'}
 $env:Path=$runtime+';'+$env:Path
 Set-Location $root
 $server=Start-Process -FilePath "$runtime/node.exe" -ArgumentList "$runtime/node_modules/npm/bin/npm-cli.js run preview" -WorkingDirectory $root -WindowStyle Hidden -PassThru -RedirectStandardOutput "$proof/server-out.txt" -RedirectStandardError "$proof/server-err.txt"
 $created=$server.StartTime
 Get-CimInstance Win32_Process -Filter "ProcessId=$($server.Id)" | Select-Object ProcessId,CreationDate,CommandLine,ExecutablePath | ConvertTo-Json | Set-Content "$proof/owned-server.json"
 $deadline=[DateTime]::UtcNow.AddSeconds(40)
 do {try {$r=Invoke-WebRequest http://127.0.0.1:8081 -UseBasicParsing -TimeoutSec 2;break}catch{if([DateTime]::UtcNow -gt $deadline -or $server.HasExited){throw 'server did not become ready'}}}while($true)
 $runner=Get-Content C:/Users/danie/XRayBuilds/run-fast-cdp.ps1 -Raw
 $runner=$runner.Replace('$PSScriptRoot', "'C:/Users/danie/XRayBuilds'")
 & ([scriptblock]::Create($runner)) -Scenario "$proof/scenario.json" -Port 9355 -Output $proof *> "$proof/runner.txt"
 'PASS' | Set-Content "$proof/task-verdict.txt"
}catch{
 $_ | Out-String | Set-Content "$proof/task-error.txt"
 'INFRA_FAILURE' | Set-Content "$proof/task-verdict.txt"
}finally{
 if($server){
  $all=@(Get-CimInstance Win32_Process)
  $owned=@($all | Where-Object {$_.ProcessId -eq $server.Id -and $_.ExecutablePath -eq (Join-Path $runtime "node.exe").Replace("/", "\")})
  if($owned.Count -and (Get-Process -Id $server.Id).StartTime -eq $created){
   $ids=@($server.Id)
   do{$children=@($all|Where-Object {$_.ParentProcessId -in $ids -and $_.ProcessId -notin $ids});$ids+=@($children.ProcessId);$owned+=$children}while($children.Count)
   $owned | Select-Object ProcessId,ParentProcessId,CreationDate,CommandLine,ExecutablePath | ConvertTo-Json | Set-Content "$proof/owned-server-tree.json"
   [array]::Reverse($owned)
   foreach($item in $owned){$live=Get-CimInstance Win32_Process -Filter "ProcessId=$($item.ProcessId)";if($live -and $live.CreationDate -eq $item.CreationDate -and $live.CommandLine -eq $item.CommandLine){Stop-Process -Id $item.ProcessId -ErrorAction SilentlyContinue}}
  }
 }
 'cleanup completed' | Set-Content "$proof/task-cleanup.txt"
}




