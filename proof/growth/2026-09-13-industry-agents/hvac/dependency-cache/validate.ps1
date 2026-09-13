$ErrorActionPreference='Stop'
if ($env:COMPUTERNAME -ne 'DANS1') {throw 'Wrong host'}
$worker='C:/Users/danie/XRayBuilds/industry-visible-20260913/hvac-dependency-worker.ps1'
$tokens=$null;$errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile($worker,[ref]$tokens,[ref]$errors)
if ($errors.Count) {throw ($errors|Out-String)}
foreach($f in $ast.FindAll({param($a) $a -is [Management.Automation.Language.FunctionDefinitionAst]},$false)){Invoke-Expression $f.Extent.Text}
$base='C:/Users/danie/XRayBuilds/industry-visible-20260913/hvac-dependency-validation-4'
if(Test-Path $base){throw 'Fixture already exists'}
New-Item -ItemType Directory "$base/source"|Out-Null
& tar -xf C:/Users/danie/XRayBuilds/incoming/3c9aafaf58a4/source.tar -C "$base/source"
if($LASTEXITCODE){throw 'Extract failed'}
& tar -xf C:/Users/danie/XRayBuilds/incoming/3c9aafaf58a4/native-source.tar -C "$base/source"
if($LASTEXITCODE){throw 'Extract failed'}
$cache='C:\Users\danie\XRayBuilds\runs\a8a4f707ac43'
$sha='f34586aff3970801645cad794ee2ceb0c989ef5e5a55d4b353613f0c8fec1822'
$results=[Collections.Generic.List[string]]::new()
$results.Add('PowerShell AST parses')
$d=Get-VerifiedDependencyCargoCache $cache "$base/source" $sha
if($d.mode -ne 'verified-dependency-copy'){throw 'Valid cache rejected'}
$results.Add('Real successful cache passes against same dependency archive inputs')
$d|ConvertTo-Json -Depth 8|Set-Content "$base/decision.json"
function Reject([string]$Name,[scriptblock]$Action){$rejected=$false;try{&$Action|Out-Null}catch{$rejected=$true};if(-not $rejected){throw "Did not reject $Name"};$results.Add($Name)}
Reject 'Wrong executable SHA rejected' {Get-VerifiedDependencyCargoCache $cache "$base/source" ('0'*64)}
Reject 'Missing explicit completion rejected' {Get-VerifiedDependencyCargoCache "$base/missing" "$base/source" $sha}
$f="$base/source/src-tauri/Cargo.toml";$bytes=[IO.File]::ReadAllBytes($f)
Add-Content $f '# changed dependency input'
Reject 'Changed Cargo manifest rejected' {Get-VerifiedDependencyCargoCache $cache "$base/source" $sha}
[IO.File]::WriteAllBytes($f,$bytes)
New-Item -ItemType Directory "$base/source/new-crate"|Out-Null
Set-Content "$base/source/new-crate/Cargo.toml" '[package]'
Reject 'Added Cargo manifest rejected' {Get-VerifiedDependencyCargoCache $cache "$base/source" $sha}
Remove-Item -LiteralPath "$base/source/new-crate/Cargo.toml"
Add-Content "$base/source/src-tauri/src/lib.rs" '// application source changes must compile later'
$d=Get-VerifiedDependencyCargoCache $cache "$base/source" $sha
$results.Add('Changed application source permitted for subsequent real compilation')
$c=Get-VerifiedCargoCache "$base/missing" ('0'*64)
if($c.mode -ne 'cold'){throw 'Default missing cache changed'}
$results.Add('Default missing cache still cold')
$c=Get-VerifiedCargoCache $cache ('0'*64)
if($c.mode -ne 'cold'){throw 'Default differing cache changed'}
$results.Add('Default different native source still cold')
$text=Get-Content $worker -Raw
foreach($guard in @('applicationAbsentBeforeBuild=$true','Prior application executable survived cache invalidation','Changed source produced the prior cached application identity','--package''','xray-engine-host','Verify-Sources')){if(-not $text.Contains($guard)){throw "Missing acceptance guard $guard"}}
$results.Add('Targeted local package invalidation and final identity guards present (not executed)')
@{computer=$env:COMPUTERNAME;workerSha=(Get-FileHash $worker).Hash.ToLowerInvariant();passed=$results.Count;cases=$results;note='No native build, helper execution, policy change or original cache mutation. Actual Cargo clean/build acceptance awaits full build.'}|ConvertTo-Json -Depth 6|Set-Content "$base/result.json"
Get-Content "$base/result.json"
