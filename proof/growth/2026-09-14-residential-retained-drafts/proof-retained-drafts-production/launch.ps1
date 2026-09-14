$ErrorActionPreference='Stop'
if($env:COMPUTERNAME -ne 'DANS1'){throw 'host mismatch'}
$body="& ([scriptblock]::Create((Get-Content 'C:/Users/danie/XRayBuilds/runs/5b80085aab3f/source/proof-retained-drafts-production/task.ps1' -Raw)))"
$encoded=[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($body))
$action=New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -EncodedCommand $encoded"
$principal=New-ScheduledTaskPrincipal -UserId 'danie' -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName 'XRay-IND01-Retained-Production-20260914-9355' -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName 'XRay-IND01-Retained-Production-20260914-9355'
