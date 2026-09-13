$ErrorActionPreference='Stop'
$root='C:\Users\danie\XRayBuilds\native-package-7a55'
$r=Get-Content "$root\native-completion.json" -Raw|ConvertFrom-Json
$a=@($r.artifacts|Where-Object path -Like '*setup.exe')[0]
$entries=@(Get-Content "$root\listing.txt"|Where-Object {$_ -like 'Path = *'}|Select-Object -Skip 1|ForEach-Object {$_.Substring(7)})
foreach($p in $entries){if([IO.Path]::IsPathRooted($p) -or $p -match '(^|[\\/])\.\.([\\/]|$)' -or $p.Contains(':')){throw 'Unsafe archive path'}}
$out=Join-Path $root 'extracted'
if(Test-Path $out){throw 'Extraction exists'}
& C:\Users\danie\XRayBuilds\native-industry-tools-7zip2603\portable\7z.exe x $a.path "-o$out" -y > "$root\extract.log"
if($LASTEXITCODE -ne 0){throw 'Extraction failed'}
$app=@($r.artifacts|Where-Object path -NotLike '*setup.exe')[0]
$exe=Join-Path $out 'xray-by-looplet.exe';$engine=Join-Path $out 'engine\bin\xray-engine.exe'
if((Get-FileHash $exe).Hash -ne $app.sha256){throw 'Extracted app mismatch'}
if((Get-FileHash $engine).Hash -ne 'e4693d8f2c84f125f87c316505866e23ea57aaf6e5bbc0315b0cc5360d09a49d'){throw 'Extracted engine mismatch'}
@{installer=$a;exe=$exe;exeSha256=$app.sha256;engine=$engine;engineSha256=(Get-FileHash $engine).Hash;installerExecuted=$false;registryChanged=$false}|ConvertTo-Json -Depth 5|Set-Content "$root\package.json"
Get-Content "$root\package.json"
