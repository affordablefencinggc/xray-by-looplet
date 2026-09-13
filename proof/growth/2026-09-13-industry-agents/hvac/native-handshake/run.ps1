$ErrorActionPreference='Stop'
if($env:COMPUTERNAME -ne 'DANS1'){throw 'Wrong host'}
$hvacRoot='C:/Users/danie/XRayBuilds/industry-visible-20260913/native-handshake-20260913-1105'
$hvacOld='C:/Users/danie/XRayBuilds/runs/a8a4f707ac43/source'
if(Test-Path -LiteralPath $hvacRoot){throw 'Task folder already exists'}
New-Item -ItemType Directory -Path $hvacRoot|Out-Null
foreach($hvacPath in @("$hvacRoot/source","$hvacRoot/target")){if(![IO.Path]::GetFullPath($hvacPath).StartsWith([IO.Path]::GetFullPath($hvacRoot)+[IO.Path]::DirectorySeparatorChar)){throw 'Path outside task'}}
& robocopy $hvacOld "$hvacRoot/source" /E /COPY:DAT /DCOPY:DAT /XJ /XD node_modules target .git /NFL /NDL /NP /LOG:"$hvacRoot/source-copy.log"|Out-Null
if($LASTEXITCODE -ge 8){throw 'Source copy failed'}
& robocopy "$hvacOld/src-tauri/target" "$hvacRoot/target" /E /COPY:DAT /DCOPY:DAT /XJ /NFL /NDL /NP /LOG:"$hvacRoot/target-copy.log"|Out-Null
if($LASTEXITCODE -ge 8){throw 'Target copy failed'}
& tar -xf C:/Users/danie/XRayBuilds/industry-visible-20260913/inputs.tar -C "$hvacRoot/source"
if($LASTEXITCODE -ne 0){throw 'Overlay failed'}
Copy-Item C:/Users/danie/XRayBuilds/industry-visible-20260913/manifest.json "$hvacRoot/manifest.json"
foreach($hvacEntry in (Get-Content "$hvacRoot/manifest.json" -Raw|ConvertFrom-Json)){if((Get-FileHash -LiteralPath (Join-Path "$hvacRoot/source" $hvacEntry.path) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $hvacEntry.sha256){throw "Source mismatch $($hvacEntry.path)"}}
$env:CARGO_HOME='C:/Users/danie/XRayBuilds/toolchain/cargo';$env:RUSTUP_HOME='C:/Users/danie/XRayBuilds/toolchain/rustup';$env:CARGO_TARGET_DIR="$hvacRoot/target";$env:CARGO_BUILD_JOBS='16';$env:RAYON_NUM_THREADS='16'
$env:PATH="$env:CARGO_HOME/bin;"+$env:PATH
$hvacResults=@()
foreach($hvacUnit in @('engine/host','src-tauri')){
 $hvacName=$hvacUnit.Replace('/','-')
 $hvacProcess=Start-Process -FilePath "$env:CARGO_HOME/bin/cargo.exe" -ArgumentList 'test','--release','--manifest-path',"$hvacRoot/source/$hvacUnit/Cargo.toml",'--lib' -WorkingDirectory "$hvacRoot/source" -WindowStyle Hidden -PassThru -RedirectStandardOutput "$hvacRoot/$hvacName.stdout.txt" -RedirectStandardError "$hvacRoot/$hvacName.stderr.txt"
 $hvacHandle=$hvacProcess.Handle;$hvacProcess.PriorityClass='High';$hvacProcess.ProcessorAffinity=[IntPtr]65535
 $hvacResults+=@{name=$hvacName;pid=$hvacProcess.Id;started=(Get-Date).ToUniversalTime().ToString('o')}
 $hvacResults|ConvertTo-Json|Set-Content "$hvacRoot/processes.json"
 $hvacProcess.WaitForExit()
 $hvacResults[-1].exitCode=$hvacProcess.ExitCode
 if($hvacProcess.ExitCode -ne 0){Get-Content "$hvacRoot/$hvacName.stderr.txt" -Tail 25;Get-Content "$hvacRoot/$hvacName.stdout.txt" -Tail 25;break}
}
$hvacResults|ConvertTo-Json|Set-Content "$hvacRoot/verdict.json"
Get-Content "$hvacRoot/verdict.json"
