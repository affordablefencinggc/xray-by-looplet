param(
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{12}$')][string]$RunId,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-zA-Z0-9_-]+$')][string]$Actor
)
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$evidence=Join-Path ($repo+'-evidence') ('observer-records-'+$RunId)
$cursor=$evidence
while($cursor){
  if(Test-Path -LiteralPath $cursor){
    if(((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'Reparse evidence path rejected'}
  }
  $parent=Split-Path $cursor -Parent;if($parent -eq $cursor){break};$cursor=$parent
}
if(Test-Path -LiteralPath $evidence){throw 'Immutable evidence directory already exists'}
$null=New-Item -ItemType Directory -Path $evidence -ErrorAction Stop
$self=Get-CimInstance Win32_Process -Filter "ProcessId=$PID"
$hashes=[ordered]@{}
foreach($name in @('collect_qualification_tests.py','test_collect_qualification_tests.py',
  'verify_qualification_coverage.py','qualification_structure.py','verify_qualification_terminal.py',
  'qualify_frozen_engine.py','run-collection-observer-check.ps1','run-recovery-ledger-check.ps1',
  'verify_recovery_preflight.py','test_verify_recovery_preflight.py')){
  $hashes[$name]=(Get-FileHash -LiteralPath (Join-Path $PSScriptRoot $name) -Algorithm SHA256).Hash.ToLowerInvariant()
}
# Separate, already installed development interpreter. No PATH fallback or install.
$observerPython='C:\Users\danie\AppData\Local\Programs\Python\Python312\python.exe'
$site='C:\Users\danie\AppData\Local\Programs\Python\Python312\Lib\site-packages'
$toolPins=[ordered]@{}
$toolPins[$observerPython]='4d6f5f81a4bca11191c4c7c6b43632694d0a4ce74e068619d8fdc161d469859a'
$toolPins[(Join-Path $site 'pytest-9.1.1.dist-info\METADATA')]='c5d032518012789cabc870d46589aca3aeda36cf9fa4399ee88bda3d10438451'
$toolPins[(Join-Path $site '_pytest\junitxml.py')]='557b8978c66b8010fafc50ada4bf56333f9927f31b2b5909fe4c1a9df1a3c0f0'
$toolPins[(Join-Path $site '_pytest\config\findpaths.py')]='535d149e6f3962e44260b6645bb354976e19531f5dd248e14ee7d7fff61c8848'
$toolPins[(Join-Path $site 'pytest\__init__.py')]='ee37885c9583f843390684dfb496907f87a0905128e7a3cf4ad227f49ff34c2d'
[ordered]@{scope='Real synthetic pytest observer fixtures only; NOT engine acceptance'
  actor=$Actor;ownerPid=$PID;creationTime=$self.CreationDate.ToUniversalTime().ToString('o')
  executable=$self.ExecutablePath;command=$self.CommandLine;sourceHashes=$hashes
  developmentToolPins=$toolPins;toolPinLimit='Selected interpreter/pytest files, not full runtime attestation'
  purpose='Bounded local collection observer tests';lastTaskActivity=[DateTime]::UtcNow.ToString('o')}|
  ConvertTo-Json -Depth 5|Set-Content -LiteralPath (Join-Path $evidence 'owner.json') -Encoding UTF8
$code=1;$jobConfirmed=$false
try {
  . (Join-Path $PSScriptRoot 'run-recovery-ledger-check.ps1') -Gate preflight
  $jobConfirmed=$true;$root=$evidence
  foreach($path in $toolPins.Keys){
    if((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -cne $toolPins[$path]){throw 'Development observer tool pin mismatch'}
  }
  Get-ChildItem Env:|Where-Object {$_.Name -match '^PYTEST|^XRAY_OBSERVER'}|ForEach-Object {Remove-Item ('Env:'+$_.Name)}
  $env:XRAY_OBSERVER_PYTHON=$observerPython
  $env:PYTEST_DISABLE_PLUGIN_AUTOLOAD='1'
  $env:PYTHONNOUSERSITE='1'
  Run-Check 'git-head' (Get-Command git.exe -ErrorAction Stop).Source @('rev-parse','HEAD') 15
  $head=[IO.File]::ReadAllText((Join-Path $root 'git-head.stdout.log')).Trim()
  if($head -cnotmatch '^[a-f0-9]{40}$'){throw 'Invalid HEAD'}
  [ordered]@{head=$head;sourceHashes=$hashes;developmentToolPins=$toolPins;observedAt=[DateTime]::UtcNow.ToString('o')}|
    ConvertTo-Json -Depth 5|Set-Content -LiteralPath (Join-Path $evidence 'tested-source.json') -Encoding UTF8
  $tokens=$null;$errors=$null
  $null=[Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'run-collection-observer-check.ps1'),[ref]$tokens,[ref]$errors)
  if($errors.Count){throw 'Observer runner PowerShell syntax failed'}
  Run-Check 'observer-tests' $python @('-B','-s','-m','unittest','discover','-s','scripts','-p','test_collect_qualification_tests.py','-v') 120
  if([LedgerCpuCap]::Active() -ne 1){throw 'Owned descendants remain after observer tests'}
  foreach($name in $hashes.Keys){
    if((Get-FileHash -LiteralPath (Join-Path $PSScriptRoot $name) -Algorithm SHA256).Hash.ToLowerInvariant() -cne $hashes[$name]){throw 'Tested source changed during run'}
  }
  foreach($path in $toolPins.Keys){
    if((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -cne $toolPins[$path]){throw 'Development observer tool changed'}
  }
  Write-Output 'COLLECTION OBSERVER TESTS PASS; trusted DANS1 preparation/collector/engine gates remain OPEN.'
  Write-Output 'Job accounting: activeProcesses=1 (owner only).'
  $code=0
} finally {
  [ordered]@{scope='Local synthetic pytest observer fixtures only';exitCode=$code;ownerPid=$PID;actor=$Actor
    endedAt=[DateTime]::UtcNow.ToString('o');noDescendantsObserved=($code -eq 0)
    jobTerminatesOnOwnerExit=$jobConfirmed;testInventoryAuthenticated=$false
    executionAuthenticated=$false;freshEngineQualified=$false;appAccepted=$false}|
    ConvertTo-Json|Set-Content -LiteralPath (Join-Path $evidence 'exit.json') -Encoding UTF8
  Write-Output "Retained local test evidence: $evidence"
}
exit $code