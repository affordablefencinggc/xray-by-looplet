param([ValidateSet('dev','production')][string]$Campaign)
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
if($env:COMPUTERNAME -ne 'DANS1'){throw 'Wrong host'}
$root='C:/Users/danie/XRayBuilds/checks/calculator-guard-20260914'
Set-Location $root
$profile="C:/Users/danie/XRayBuilds/checks/browser-$Campaign-$([Guid]::NewGuid().ToString('N'))"
$p=Start-Process 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' -ArgumentList @('--headless=new','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0',"--user-data-dir=$profile",'--no-first-run','--no-default-browser-check','about:blank') -WindowStyle Hidden -PassThru
$i=Get-CimInstance Win32_Process -Filter "ProcessId=$($p.Id)"
$owner=@{owner='Codex continuation';pid=$p.Id;created=$i.CreationDate.ToString('o');command=$i.CommandLine;purpose="$Campaign live test";lastActivity=(Get-Date).ToString('o')}
$owner | ConvertTo-Json | Set-Content "$profile-owner.json"
try {
 $end=(Get-Date).AddSeconds(15)
 while(!(Test-Path "$profile/DevToolsActivePort")){if((Get-Date)-gt $end){throw 'Browser unavailable'};Start-Sleep -Milliseconds 100}
 $port=[int](Get-Content "$profile/DevToolsActivePort" -First 1)
 $c=Get-NetTCPConnection -State Listen -LocalPort $port
 if($c.LocalAddress -notin @('127.0.0.1','::1') -or $c.OwningProcess -ne $p.Id){throw 'CDP owner/bind mismatch'}
 $runner='guard-check.mjs'
 & C:/Users/danie/XRayBuilds/runs/5b80085aab3f/runtime/node.exe $runner $Campaign $profile
 $result=$LASTEXITCODE
} finally {
 $current=Get-CimInstance Win32_Process -Filter "ProcessId=$($p.Id)"
 if($current -and $current.CreationDate.ToString('o') -eq $owner.created -and $current.CommandLine -eq $owner.command){
  $p.CloseMainWindow() | Out-Null
  if(!$p.WaitForExit(1500)){Stop-Process -Id $p.Id}
 }
 @{owner=$owner;remaining=[bool](Get-CimInstance Win32_Process -Filter "ProcessId=$($p.Id)");finished=(Get-Date).ToString('o')} | ConvertTo-Json -Depth 4 | Set-Content "$profile-cleanup.json"
}
exit $result