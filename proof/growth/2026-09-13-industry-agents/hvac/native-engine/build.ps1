$ErrorActionPreference='Stop'
if($env:COMPUTERNAME -ne 'DANS1'){throw 'Wrong host'}
$hvacRoot='C:/Users/danie/XRayBuilds/industry-visible-20260913/native-engine-20260913-1037'
foreach($hvacEntry in (Get-Content "$hvacRoot/source-manifest.json" -Raw|ConvertFrom-Json)){if((Get-FileHash -LiteralPath (Join-Path "$hvacRoot/source" $hvacEntry.path) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $hvacEntry.sha256){throw "Source mismatch $($hvacEntry.path)"}}
$hvacArgs=@('-m','PyInstaller','--noconfirm','--console','--onefile','--name','xray-engine-verified','--distpath',"$hvacRoot/dist",'--workpath',"$hvacRoot/work",'--specpath',"$hvacRoot/spec",'--paths',"$hvacRoot/source/engine/python",'--add-data',"$hvacRoot/source/contracts/xray-job-bom-v1.schema.json;contracts","$hvacRoot/source/engine/python/xray/__main__.py")
$hvacProcess=Start-Process -FilePath "$hvacRoot/venv/Scripts/python.exe" -ArgumentList $hvacArgs -WorkingDirectory $hvacRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput "$hvacRoot/build.stdout.log" -RedirectStandardError "$hvacRoot/build.stderr.log"
$hvacHandle=$hvacProcess.Handle
$hvacProcess.PriorityClass='High'
if([Environment]::ProcessorCount -ge 16){$hvacProcess.ProcessorAffinity=[IntPtr]65535}
[ordered]@{pid=$hvacProcess.Id;started=(Get-Date).ToUniversalTime().ToString('o');purpose='Verified real Python CLI packaging';executable="$hvacRoot/venv/Scripts/python.exe";arguments=$hvacArgs;priority='High';affinity=$hvacProcess.ProcessorAffinity.ToInt64()}|ConvertTo-Json|Set-Content "$hvacRoot/build-process.json"
$hvacProcess.WaitForExit()
[ordered]@{exitCode=$hvacProcess.ExitCode;ended=(Get-Date).ToUniversalTime().ToString('o')}|ConvertTo-Json|Set-Content "$hvacRoot/build-result.json"
Get-Content "$hvacRoot/build-result.json"
Get-Content "$hvacRoot/build.stderr.log" -Tail 10
if($hvacProcess.ExitCode -ne 0){throw 'Packaging failed'}
Get-FileHash "$hvacRoot/dist/xray-engine-verified.exe" -Algorithm SHA256|Select-Object Path,Hash|ConvertTo-Json|Set-Content "$hvacRoot/executable-hash.json"
