$ErrorActionPreference='Stop'
if($env:COMPUTERNAME -ne 'DANS1'){throw 'Wrong host'}
$incoming='C:/Users/danie/XRayBuilds/incoming/2f08ad4c8ef1'
$run='C:/Users/danie/XRayBuilds/runs/2f08ad4c8ef1'
$results=@()
foreach($name in @('source','native')){
 $entries=(Get-Content "$incoming/$name-manifest.json" -Raw|ConvertFrom-Json).entries
 $diff=@()
 foreach($entry in $entries){$path=Join-Path "$run/source" $entry.path;if(!(Test-Path -LiteralPath $path)){$diff+=@{path=$entry.path;status='missing'}}else{$hash=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLower();if($hash -ne $entry.sha256){$diff+=@{path=$entry.path;expected=$entry.sha256;actual=$hash}}}}
 $results+=@{manifest=$name;entries=$entries.Count;matched=$entries.Count-$diff.Count;differences=$diff}
}
$completion=Get-Content "$run/native-completion.json" -Raw|ConvertFrom-Json
$artifacts=@($completion.artifacts|ForEach-Object{$hash=(Get-FileHash -LiteralPath $_.path -Algorithm SHA256).Hash.ToLower();@{path=$_.path;expected=$_.sha256;actual=$hash;matched=($hash -eq $_.sha256);bytes=(Get-Item -LiteralPath $_.path).Length}})
@{computer=$env:COMPUTERNAME;at=(Get-Date).ToString('o');manifests=$results;nativeArtifacts=$artifacts}|ConvertTo-Json -Depth 8
