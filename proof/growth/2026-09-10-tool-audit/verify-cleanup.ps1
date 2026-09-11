$ErrorActionPreference='Stop'
if($env:COMPUTERNAME -ne 'DANS1'){throw 'Wrong host'}
$remaining=@(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object {$_.LocalPort -in @(8080,8081,9337)})
$result=@{host=$env:COMPUTERNAME;at=[DateTime]::UtcNow.ToString('o');testListenersRemaining=$remaining.Count;pass=($remaining.Count -eq 0)}
$result|ConvertTo-Json|Set-Content C:\Users\danie\XRayBuilds\tool-audit-20260910\cleanup-verification.json
$result|ConvertTo-Json
if($remaining.Count){exit 1}
