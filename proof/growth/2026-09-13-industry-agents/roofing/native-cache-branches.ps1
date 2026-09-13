$ErrorActionPreference='Stop'
if($env:COMPUTERNAME -ne 'DANS1'){throw 'DANS1 only'}
$root=Split-Path -Parent $PSCommandPath
$worker=Join-Path $root 'dans1-build-worker.ps1'
$tokens=$null; $errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile($worker,[ref]$tokens,[ref]$errors)
if($errors.Count){throw ($errors|Out-String)}
$fn=$ast.Find({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Get-VerifiedCargoCache'},$true)
if(-not $fn){throw 'Cache selector absent'}
# Execute only the parsed selector, never the worker/build steps.
Invoke-Expression $fn.Extent.Text
$fixtures=Join-Path $root ('cache-fixtures-'+[guid]::NewGuid())
New-Item -ItemType Directory -Path $fixtures|Out-Null
$hash='a'*64
$results=[Collections.Generic.List[object]]::new()
function Check($name,$action,$expected){$actual=& $action;if($actual -ne $expected){throw "$name expected $expected got $actual"};$results.Add(@{name=$name;actual=$actual;pass=$true})}
function Reject($action){try{& $action|Out-Null;return 'accepted'}catch{return 'rejected'}}
Check 'missing record' { (Get-VerifiedCargoCache (Join-Path $fixtures 'absent') $hash).mode } 'cold'
$case=Join-Path $fixtures 'case';New-Item -ItemType Directory -Path $case|Out-Null
$record=@{computer='DANS1';nativeSourceSha256=$hash;results=@(@{step='native-build';exitCode=0});artifacts=@()}
function SaveRecord {$record|ConvertTo-Json -Depth 6|Set-Content (Join-Path $case 'native-completion.json')}
SaveRecord
Check 'different source hash' {(Get-VerifiedCargoCache $case ('b'*64)).mode} 'cold'
Check 'missing executable' {(Get-VerifiedCargoCache $case $hash).mode} 'cold'
$record.results[0].exitCode=1;SaveRecord
Check 'failed build is rejected' {Reject {Get-VerifiedCargoCache $case $hash}} 'rejected'
$record.results[0].exitCode=$null;SaveRecord
Check 'missing exit status is rejected' {Reject {Get-VerifiedCargoCache $case $hash}} 'rejected'
$record.results[0].exitCode=0;$record.computer='OTHER';SaveRecord
Check 'wrong host is rejected' {Reject {Get-VerifiedCargoCache $case $hash}} 'rejected'
$record.computer='DANS1';SaveRecord
$release=Join-Path $case 'source\src-tauri\target\release';New-Item -ItemType Directory -Path $release -Force|Out-Null
Set-Content (Join-Path $release 'xray-by-looplet.exe') 'not the verified executable'
Check 'unverified executable is rejected' {Reject {Get-VerifiedCargoCache $case $hash}} 'rejected'
Set-Content (Join-Path $case 'native-completion.json') '{broken'
Check 'malformed record is rejected' {Reject {Get-VerifiedCargoCache $case $hash}} 'rejected'
$prior='C:\Users\danie\XRayBuilds\runs\44c9a5bdd386'
Check 'actual compatible cache verified' {(Get-VerifiedCargoCache $prior '9e85e6501cbe8e92b7f504ba1b9b41b3be8268059955e065a852a1f032b2f6d7').mode} 'verified-copy'
Check 'actual current native source uses cold build' {(Get-VerifiedCargoCache $prior 'a2be2e25bbc9043ef2b678e14a6e3b45187a0aed9de69567a983aa7133649b27').mode} 'cold'
@{host=$env:COMPUTERNAME;at=[DateTime]::UtcNow.ToString('o');syntaxErrors=$errors.Count;tests=$results;buildExecuted=$false;fixtures=$fixtures;workerSha256=(Get-FileHash $worker).Hash}|ConvertTo-Json -Depth 6
