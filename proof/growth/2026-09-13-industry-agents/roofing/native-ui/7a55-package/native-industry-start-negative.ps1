param([ValidateSet('missing','tampered')][string]$Case)
$ErrorActionPreference='Stop'
$dest="C:\Users\danie\XRayBuilds\native-package-negative-$Case-7a55"
$args="-NoProfile -ExecutionPolicy Bypass -File C:\Users\danie\XRayBuilds\industry-visible-20260913\roofing\native-industry-launch-negative.ps1 -Exe $dest\xray-by-looplet.exe -ExeSha256 19271950158352eeeaea7f75fa2bc9f67b5a2b80c5a8b9e0e250fa14e8583920 -Engine $dest\engine\bin\xray-engine.exe -EngineSha256 e4693d8f2c84f125f87c316505866e23ea57aaf6e5bbc0315b0cc5360d09a49d -Attempt 7a55-$Case-ui1 -NegativeCase $Case"
$a=New-ScheduledTaskAction -Execute powershell.exe -Argument $args
$p=New-ScheduledTaskPrincipal -UserId danie -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName "XRay-Native-7a55-$Case" -Action $a -Principal $p -Force|Out-Null
Start-ScheduledTask -TaskName "XRay-Native-7a55-$Case"
