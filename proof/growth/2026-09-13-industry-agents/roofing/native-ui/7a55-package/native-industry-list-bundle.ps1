$ErrorActionPreference='Stop'
$r=Get-Content C:\Users\danie\XRayBuilds\runs\7a55db807d34\native-completion.json -Raw|ConvertFrom-Json
if(@($r.results|Where-Object exitCode -ne 0).Count){throw 'Build did not pass'}
$a=@($r.artifacts|Where-Object path -Like '*setup.exe')[0]
if((Get-FileHash -LiteralPath $a.path).Hash -ne $a.sha256){throw 'Installer hash mismatch'}
$dest='C:\Users\danie\XRayBuilds\native-package-7a55'
if(Test-Path $dest){throw 'Package proof exists'}
New-Item -ItemType Directory $dest|Out-Null
Copy-Item C:\Users\danie\XRayBuilds\runs\7a55db807d34\native-completion.json "$dest\native-completion.json"
& C:\Users\danie\XRayBuilds\native-industry-tools-7zip2603\portable\7z.exe l -slt $a.path > "$dest\listing.txt"
if($LASTEXITCODE -ne 0){throw 'List failed'}
Get-Content "$dest\listing.txt"|Select-String '^Path = '
