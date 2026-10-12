param(
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{12}$')][string]$RunId,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-zA-Z0-9_-]+$')][string]$Actor
)
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$evidence=Join-Path ($repo+'-evidence') ('coverage-records-'+$RunId)
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
foreach($name in @('verify_qualification_coverage.py','test_verify_qualification_coverage.py','qualification_structure.py',
  'verify_qualification_terminal.py','qualify_frozen_engine.py','run-coverage-evidence-check.ps1',
  'run-recovery-ledger-check.ps1','verify_recovery_preflight.py','test_verify_recovery_preflight.py')){
  $hashes[$name]=(Get-FileHash -LiteralPath (Join-Path $PSScriptRoot $name) -Algorithm SHA256).Hash.ToLowerInvariant()
}
[ordered]@{scope='Synthetic declared-test coverage consistency only; NOT engine acceptance'
  actor=$Actor;ownerPid=$PID;creationTime=$self.CreationDate.ToUniversalTime().ToString('o')
  executable=$self.ExecutablePath;command=$self.CommandLine;sourceHashes=$hashes
  purpose='Bounded local declared coverage tests';lastTaskActivity=[DateTime]::UtcNow.ToString('o')}|
  ConvertTo-Json -Depth 5|Set-Content -LiteralPath (Join-Path $evidence 'owner.json') -Encoding UTF8
$code=1;$jobConfirmed=$false
try {
  . (Join-Path $PSScriptRoot 'run-recovery-ledger-check.ps1') -Gate preflight
  $jobConfirmed=$true;$root=$evidence
  Run-Check 'git-head' (Get-Command git.exe -ErrorAction Stop).Source @('rev-parse','HEAD') 15
  $head=[IO.File]::ReadAllText((Join-Path $root 'git-head.stdout.log')).Trim()
  if($head -cnotmatch '^[a-f0-9]{40}$'){throw 'Invalid HEAD'}
  [ordered]@{head=$head;sourceHashes=$hashes;observedAt=[DateTime]::UtcNow.ToString('o')}|
    ConvertTo-Json -Depth 5|Set-Content -LiteralPath (Join-Path $evidence 'tested-source.json') -Encoding UTF8
  Run-Check 'coverage-tests' $python @('-B','-m','unittest','discover','-s','scripts','-p','test_verify_qualification_coverage.py','-v') 90
  if([LedgerCpuCap]::Active() -ne 1){throw 'Owned descendants remain after coverage tests'}
  foreach($name in $hashes.Keys){
    if((Get-FileHash -LiteralPath (Join-Path $PSScriptRoot $name) -Algorithm SHA256).Hash.ToLowerInvariant() -cne $hashes[$name]){throw 'Tested source changed during run'}
  }
  Write-Output 'DECLARED COVERAGE TESTS PASS; authenticated inventory/collector/engine gates remain OPEN.'
  Write-Output 'Job accounting: activeProcesses=1 (owner only).'
  $code=0
} finally {
  [ordered]@{scope='Synthetic declared coverage only';exitCode=$code;ownerPid=$PID;actor=$Actor
    endedAt=[DateTime]::UtcNow.ToString('o');noDescendantsObserved=($code -eq 0)
    jobTerminatesOnOwnerExit=$jobConfirmed;executionAuthenticated=$false;freshEngineQualified=$false;appAccepted=$false}|
    ConvertTo-Json|Set-Content -LiteralPath (Join-Path $evidence 'exit.json') -Encoding UTF8
  Write-Output "Retained local test evidence: $evidence"
}
exit $code