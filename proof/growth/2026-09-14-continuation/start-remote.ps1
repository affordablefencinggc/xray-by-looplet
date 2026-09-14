$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
if($env:COMPUTERNAME -ne 'DANS1'){throw 'Wrong host'}
$root='C:/Users/danie/XRayBuilds/checks/continuation-20260914'
Set-Location $root
if(Get-NetTCPConnection -State Listen -LocalPort 8080 -ErrorAction SilentlyContinue){throw 'Port occupied'}
tar -xf C:/Users/danie/XRayBuilds/incoming/continuation-support-20260914.tar -C $root
if($LASTEXITCODE){throw 'Support extraction failed'}
if(!(Test-Path "$root/public")){New-Item -ItemType Junction -Path "$root/public" -Target 'C:/Users/danie/XRayBuilds/runs/5b80085aab3f/source/public' | Out-Null}
$config=[Console]::ReadLine() | ConvertFrom-Json
if(-not $config.MINIMAX_API_KEY){throw 'MiniMax key missing; no requests made'}
$env:MINIMAX_API_KEY=$config.MINIMAX_API_KEY
$env:MINIMAX_MODEL='MiniMax-M3'
$env:XRAY_AI_WEB_ENABLED='true'
$env:VITE_AUTH_ENABLED='false'
$runtime='C:/Users/danie/XRayBuilds/runs/5b80085aab3f/runtime'
$env:PATH=$runtime+';'+$env:PATH
$p=Start-Process "$runtime/node.exe" -ArgumentList @("$runtime/node_modules/npm/bin/npm-cli.js",'run','dev') -WorkingDirectory $root -WindowStyle Hidden -PassThru -RedirectStandardOutput "$root/dev.stdout.log" -RedirectStandardError "$root/dev.stderr.log"
$identity=Get-CimInstance Win32_Process -Filter "ProcessId=$($p.Id)"
@{owner='Codex continuation';purpose='roofing and QS live acceptance';host=$env:COMPUTERNAME;pid=$p.Id;created=$identity.CreationDate.ToString('o');command=$identity.CommandLine;lastActivity=(Get-Date).ToString('o')} | ConvertTo-Json | Set-Content "$root/process-owner.json"
Remove-Item Env:MINIMAX_API_KEY
Write-Output "Started owned npm dev PID $($p.Id)"
$p.WaitForExit()
exit $p.ExitCode
