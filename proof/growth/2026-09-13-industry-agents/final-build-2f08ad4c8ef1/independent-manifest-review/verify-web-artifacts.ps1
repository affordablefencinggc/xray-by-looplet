$ErrorActionPreference='Stop'
if($env:COMPUTERNAME -ne 'DANS1'){throw 'Wrong host'}
$run='C:/Users/danie/XRayBuilds/runs/2f08ad4c8ef1'
$completion=Get-Content "$run/completion.json" -Raw|ConvertFrom-Json
$assets=@($completion.artifacts|ForEach-Object{$path=Join-Path "$run/source/dist/assets" $_.name;$hash=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLower();@{name=$_.name;expected=$_.sha256;actual=$hash;matched=($hash -eq $_.sha256);bytes=(Get-Item -LiteralPath $path).Length}})
@{computer=$env:COMPUTERNAME;at=(Get-Date).ToString('o');count=$assets.Count;matched=@($assets|Where-Object matched).Count;assets=$assets}|ConvertTo-Json -Depth 5
