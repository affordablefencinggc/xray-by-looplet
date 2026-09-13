$ErrorActionPreference='Stop'
$helper='C:/Users/danie/XRayBuilds/industry-visible-20260913/stage-bundled-engine.ps1'
$tokens=$null;$errors=$null;[Management.Automation.Language.Parser]::ParseFile($helper,[ref]$tokens,[ref]$errors)|Out-Null
if($errors.Count){throw ($errors|Out-String)}
. $helper
$base='C:/Users/danie/XRayBuilds/industry-visible-20260913/hvac-stage-validation-final'
$package='C:/Users/danie/XRayBuilds/industry-visible-20260913/native-engine-selected-20260913'
$sha='e4693d8f2c84f125f87c316505866e23ea57aaf6e5bbc0315b0cc5360d09a49d'
if(Test-Path $base){throw 'Preserve fixture'}
New-Item -ItemType Directory $base|Out-Null
Copy-Item -LiteralPath "$package/source" -Destination "$base/source" -Recurse
$cases=[Collections.Generic.List[string]]::new()
function Reject([string]$Name,[scriptblock]$Action){$failed=$false;try{&$Action|Out-Null}catch{$failed=$true};if(-not $failed){throw "Expected rejection $Name"};$cases.Add($Name)}
Reject 'Wrong expected SHA' {Invoke-VerifiedBundledEngineStage $package ('0'*64) "$base/source" "$base/wrong.json"}
$f="$base/source/engine/python/xray/job_bom.py";$original=[IO.File]::ReadAllBytes($f)
Add-Content $f '# changed'
Reject 'Current source mismatch' {Invoke-VerifiedBundledEngineStage $package $sha "$base/source" "$base/mismatch.json"}
[IO.File]::WriteAllBytes($f,$original)
Set-Content "$base/source/engine/python/extra.py" '# unmanifested'
Reject 'Unmanifested source' {Invoke-VerifiedBundledEngineStage $package $sha "$base/source" "$base/extra.json"}
Remove-Item -LiteralPath "$base/source/engine/python/extra.py"
Reject 'Outside build workspace path' {Invoke-VerifiedBundledEngineStage $package $sha 'C:/Windows' "$base/outside.json"}
$clone="$base/package"
Copy-Item -LiteralPath $package -Destination $clone -Recurse
$v=Get-Content "$clone/fixture-verdict.json" -Raw|ConvertFrom-Json
$v.executable=[IO.Path]::GetFullPath("$clone/dist/xray-engine-verified.exe")
$v|ConvertTo-Json -Depth 8|Set-Content "$clone/fixture-verdict.json"
$parity=[IO.File]::ReadAllBytes("$clone/parity.json")
Set-Content "$clone/parity.json" '{"exactPythonTypeScriptResponseMatch":false}'
Reject 'Failed parity proof' {Invoke-VerifiedBundledEngineStage $clone $sha "$base/source" "$base/parity.json"}
[IO.File]::WriteAllBytes("$clone/parity.json",$parity)
$v.checks[0].exactFrozenResponseMatch=$false
$v|ConvertTo-Json -Depth 8|Set-Content "$clone/fixture-verdict.json"
Reject 'Failed fixture proof' {Invoke-VerifiedBundledEngineStage $clone $sha "$base/source" "$base/fixture.json"}
$v.checks[0].exactFrozenResponseMatch=$true
$v|ConvertTo-Json -Depth 8|Set-Content "$clone/fixture-verdict.json"
$manifest=[IO.File]::ReadAllBytes("$clone/source-manifest.json")
$m=Get-Content "$clone/source-manifest.json" -Raw|ConvertFrom-Json
$m[0].path='../escape'
$m|ConvertTo-Json|Set-Content "$clone/source-manifest.json"
Reject 'Traversal manifest path' {Invoke-VerifiedBundledEngineStage $clone $sha "$base/source" "$base/traversal.json"}
[IO.File]::WriteAllBytes("$clone/source-manifest.json",$manifest)
$m=Get-Content "$clone/source-manifest.json" -Raw|ConvertFrom-Json
@($m)+@($m[0])|ConvertTo-Json|Set-Content "$clone/source-manifest.json"
Reject 'Duplicate manifest entry' {Invoke-VerifiedBundledEngineStage $clone $sha "$base/source" "$base/dupmanifest.json"}
$result=Invoke-VerifiedBundledEngineStage $package $sha "$base/source" "$base/staged.json"
if($result -cne $sha){throw 'Wrong result'}
$cases.Add('Qualified current source stages exact binary and provenance')
Reject 'Existing destination not overwritten' {Invoke-VerifiedBundledEngineStage $package $sha "$base/source" "$base/duplicate.json"}
@{computer=$env:COMPUTERNAME;passed=$cases.Count;cases=$cases;helperSha=(Get-FileHash $helper).Hash.ToLowerInvariant()}|ConvertTo-Json|Set-Content "$base/result.json"
Get-Content "$base/result.json"
