$ErrorActionPreference='Stop'
$src='C:\Users\danie\XRayBuilds\native-package-7a55\extracted'
$records=@()
foreach($case in @('missing','tampered')){
$dest="C:\Users\danie\XRayBuilds\native-package-negative-$case-7a55"
if(Test-Path $dest){throw 'Negative copy exists'}
New-Item -ItemType Directory "$dest\engine\bin" -Force|Out-Null
Copy-Item "$src\xray-by-looplet.exe" "$dest\xray-by-looplet.exe"
if($case -eq 'tampered'){Copy-Item "$src\engine\bin\xray-engine.exe" "$dest\engine\bin\xray-engine.exe";$f=[IO.File]::Open("$dest\engine\bin\xray-engine.exe",[IO.FileMode]::Append);try{$f.WriteByte(0)}finally{$f.Dispose()}}
$records+=@{case=$case;path=$dest;appSha256=(Get-FileHash "$dest\xray-by-looplet.exe").Hash;enginePresent=Test-Path "$dest\engine\bin\xray-engine.exe";engineSha256=if($case -eq 'tampered'){(Get-FileHash "$dest\engine\bin\xray-engine.exe").Hash}else{$null}}
}
@{copies=$records;originalAppSha256=(Get-FileHash "$src\xray-by-looplet.exe").Hash;originalEngineSha256=(Get-FileHash "$src\engine\bin\xray-engine.exe").Hash;originalModified=$false}|ConvertTo-Json -Depth 5|Set-Content C:\Users\danie\XRayBuilds\native-package-7a55\negative-copies.json
