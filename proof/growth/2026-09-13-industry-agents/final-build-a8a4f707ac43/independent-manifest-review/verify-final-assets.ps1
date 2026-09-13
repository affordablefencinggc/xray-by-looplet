$ErrorActionPreference='Stop'
if($env:COMPUTERNAME -ne 'DANS1'){throw 'Wrong host'}
$run='C:/Users/danie/XRayBuilds/runs/a8a4f707ac43'
$completion=Get-Content "$run/completion.json" -Raw|ConvertFrom-Json
$assets=@($completion.artifacts|ForEach-Object{$path=Join-Path "$run/source/dist/assets" $_.name;if(Test-Path -LiteralPath $path){$hash=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLower();@{name=$_.name;expected=$_.sha256;actual=$hash;status=$(if($hash -eq $_.sha256){'match'}else{'different'})}}else{@{name=$_.name;expected=$_.sha256;status='not-present-after-desktop-build'}}})
$current=@(Get-ChildItem "$run/source/dist/assets" -File|ForEach-Object{@{name=$_.Name;bytes=$_.Length;sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLower()}})
@{computer=$env:COMPUTERNAME;at=(Get-Date).ToString('o');originalWebArtifacts=$assets;currentDesktopAssets=$current}|ConvertTo-Json -Depth 5

