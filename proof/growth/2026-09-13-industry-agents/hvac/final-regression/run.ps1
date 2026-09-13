$ErrorActionPreference='Stop'
if($env:COMPUTERNAME -ne 'DANS1'){throw 'Wrong host'}
$hvacRoot='C:/Users/danie/XRayBuilds/industry-visible-20260913'
$hvacSource="$hvacRoot/concurrency-source"
& tar -xf "$hvacRoot/hvac-final-inputs.tar" -C $hvacSource
if($LASTEXITCODE -ne 0){throw 'Extraction failed'}
$hvacManifest=Get-Content "$hvacRoot/hvac-final-manifest.json" -Raw|ConvertFrom-Json
foreach($hvacEntry in $hvacManifest){if((Get-FileHash -LiteralPath (Join-Path $hvacSource $hvacEntry.path) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $hvacEntry.sha256){throw "Source mismatch $($hvacEntry.path)"}}
$hvacRuntime='C:/Users/danie/XRayBuilds/runs/3e041c91ca5e/runtime'
$env:PATH=$hvacRuntime+';'+$env:PATH
$hvacTests=Start-Process -FilePath "$hvacRuntime/node.exe" -ArgumentList "$hvacRuntime/node_modules/npm/bin/npm-cli.js",'test' -WorkingDirectory $hvacSource -WindowStyle Hidden -PassThru -RedirectStandardOutput "$hvacRoot/hvac-final-test.stdout.txt" -RedirectStandardError "$hvacRoot/hvac-final-test.stderr.txt"
$hvacHandle=$hvacTests.Handle
$hvacTests.WaitForExit()
$hvacTsc=Start-Process -FilePath "$hvacRuntime/node.exe" -ArgumentList 'node_modules/typescript/bin/tsc','--noEmit' -WorkingDirectory $hvacSource -WindowStyle Hidden -PassThru -RedirectStandardOutput "$hvacRoot/hvac-final-tsc.stdout.txt" -RedirectStandardError "$hvacRoot/hvac-final-tsc.stderr.txt"
$hvacHandle2=$hvacTsc.Handle
$hvacTsc.WaitForExit()
[ordered]@{host=$env:COMPUTERNAME;at=(Get-Date).ToUniversalTime().ToString('o');verifiedFileCount=$hvacManifest.Count;testExit=$hvacTests.ExitCode;tscExit=$hvacTsc.ExitCode;testPid=$hvacTests.Id;tscPid=$hvacTsc.Id}|ConvertTo-Json|Set-Content "$hvacRoot/hvac-final-verdict.json"
Get-Content "$hvacRoot/hvac-final-verdict.json"
Select-String -Path "$hvacRoot/hvac-final-test.stdout.txt" -Pattern 'tests [0-9]','suites [0-9]','pass [0-9]','fail [0-9]'
Get-Content "$hvacRoot/hvac-final-tsc.stdout.txt"
Get-Content "$hvacRoot/hvac-final-tsc.stderr.txt"
