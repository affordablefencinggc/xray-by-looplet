$ErrorActionPreference='Stop'
$root='C:\Users\danie\XRayBuilds\native-package-7a55';$out=Join-Path $root 'extracted'
$r=Get-Content "$root\native-completion.json" -Raw|ConvertFrom-Json
$exe=Join-Path $out 'xray-by-looplet.exe';$engine=Join-Path $out 'engine\bin\xray-engine.exe'
$diff=Get-Content "$root\app-byte-diff.json" -Raw|ConvertFrom-Json
if($diff.count -ne 3 -or (Get-FileHash $exe).Hash -ne '19271950158352EEEAEA7F75FA2BC9F67B5A2B80C5A8B9E0E250FA14E8583920'){throw 'Packaged bytes changed'}
if((Get-FileHash $engine).Hash -ne 'e4693d8f2c84f125f87c316505866e23ea57aaf6e5bbc0315b0cc5360d09a49d'){throw 'Engine changed'}
@{installer=@($r.artifacts|Where-Object path -Like '*setup.exe')[0];exe=$exe;exeSha256=(Get-FileHash $exe).Hash;releaseSha256=@($r.artifacts|Where-Object path -NotLike '*setup.exe')[0].sha256;engine=$engine;engineSha256=(Get-FileHash $engine).Hash;installerExecuted=$false;registryChanged=$false;difference=$diff}|ConvertTo-Json -Depth 6|Set-Content "$root\package.json"
