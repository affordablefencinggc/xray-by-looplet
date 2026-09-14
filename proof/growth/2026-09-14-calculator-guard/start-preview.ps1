$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
if($env:COMPUTERNAME -ne 'DANS1'){throw 'Wrong host'}
$root='C:/Users/danie/XRayBuilds/checks/calculator-guard-20260914'
$run='C:/Users/danie/XRayBuilds/runs/09c014abc003'
$env:PATH="$run/runtime;"+$env:PATH
$env:PREVIEW_HOST='127.0.0.1';$env:PREVIEW_PORT='8081';$env:VITE_AUTH_ENABLED='false'
$p=Start-Process "$run/runtime/node.exe" -ArgumentList @("$run/runtime/node_modules/npm/bin/npm-cli.js",'run','preview') -WorkingDirectory "$run/source" -WindowStyle Hidden -PassThru -RedirectStandardOutput "$root/preview.stdout.log" -RedirectStandardError "$root/preview.stderr.log"
$i=Get-CimInstance Win32_Process -Filter "ProcessId=$($p.Id)"
@{owner='Codex calculator guard';host=$env:COMPUTERNAME;purpose='production regression';pid=$p.Id;created=$i.CreationDate.ToString('o');command=$i.CommandLine;lastActivity=(Get-Date).ToString('o')}|ConvertTo-Json|Set-Content "$root/preview-owner.json"
Write-Output "Started owned preview PID $($p.Id)"
$p.WaitForExit()
exit $p.ExitCode
