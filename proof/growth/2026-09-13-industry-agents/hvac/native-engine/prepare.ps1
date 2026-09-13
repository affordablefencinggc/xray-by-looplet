$ErrorActionPreference='Stop'
if($env:COMPUTERNAME -ne 'DANS1'){throw 'Wrong host'}
$hvacRoot='C:/Users/danie/XRayBuilds/industry-visible-20260913/native-engine-20260913-1037'
New-Item -ItemType Directory -Path $hvacRoot -ErrorAction Stop|Out-Null
New-Item -ItemType Directory -Path "$hvacRoot/source"|Out-Null
& tar -xf C:/Users/danie/XRayBuilds/industry-visible-20260913/source.tar -C "$hvacRoot/source"
if($LASTEXITCODE -ne 0){throw 'Source extraction failed'}
Copy-Item C:/Users/danie/XRayBuilds/industry-visible-20260913/source-manifest.json "$hvacRoot/source-manifest.json"
foreach($hvacEntry in (Get-Content "$hvacRoot/source-manifest.json" -Raw|ConvertFrom-Json)){if((Get-FileHash -LiteralPath (Join-Path "$hvacRoot/source" $hvacEntry.path) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $hvacEntry.sha256){throw "Source mismatch $($hvacEntry.path)"}}
$hvacMetadata=Invoke-RestMethod https://pypi.org/pypi/pyinstaller/6.22.3/json
$hvacMetadata|ConvertTo-Json -Depth 20|Set-Content "$hvacRoot/pyinstaller-pypi.json"
& C:/Users/danie/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe -m venv "$hvacRoot/venv"
if($LASTEXITCODE -ne 0){throw 'venv failed'}
& "$hvacRoot/venv/Scripts/python.exe" -m pip install --disable-pip-version-check --only-binary=:all: PyInstaller==6.22.3 -r "$hvacRoot/source/engine/python/requirements.txt" *> "$hvacRoot/install.log"
$hvacInstall=$LASTEXITCODE
& "$hvacRoot/venv/Scripts/python.exe" -m pip freeze *> "$hvacRoot/dependencies.txt"
[ordered]@{host=$env:COMPUTERNAME;at=(Get-Date).ToUniversalTime().ToString('o');installExit=$hvacInstall;sourceVerified=$true;root=$hvacRoot}|ConvertTo-Json|Set-Content "$hvacRoot/preparation.json"
Get-Content "$hvacRoot/preparation.json"
Get-Content "$hvacRoot/install.log" -Tail 8
