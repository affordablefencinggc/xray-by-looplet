$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
if($env:COMPUTERNAME -ne 'DANS1'){throw 'Wrong host'}
if(Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue){throw 'Preview port already owned'}
$run='C:\Users\danie\XRayBuilds\runs\1140a237ea84'
$audit='C:\Users\danie\XRayBuilds\navigation-20260911'
$env:PATH=$run+'\runtime;'+$env:PATH
$env:VITE_AUTH_ENABLED='false'
$p=Start-Process -FilePath ($run+'\runtime\node.exe') -ArgumentList @(($run+'\runtime\node_modules\npm\bin\npm-cli.js'),'run','preview') -WorkingDirectory ($run+'\source') -WindowStyle Hidden -PassThru -RedirectStandardOutput ($audit+'\preview-final.stdout.log') -RedirectStandardError ($audit+'\preview-final.stderr.log')
$actual=Get-CimInstance Win32_Process -Filter "ProcessId=$($p.Id)"
@{owner='codex-navigation';pid=$p.Id;created=$p.StartTime.ToUniversalTime().ToString('o');executable=$p.Path;command=$actual.CommandLine;purpose='production verification';lastActivity=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json | Set-Content ($audit+'\preview-process.json')
Write-Output "Preview PID=$($p.Id) host=DANS1"
Wait-Process -Id $p.Id
