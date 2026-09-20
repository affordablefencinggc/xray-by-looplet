param(
  [Parameter(Mandatory = $true)][string]$Helper,
  [Parameter(Mandatory = $true)][ValidatePattern('^[a-f0-9]{64}$')][string]$HelperSha256,
  [Parameter(Mandatory = $true)][string]$ParserDiff,
  [Parameter(Mandatory = $true)][ValidatePattern('^[a-f0-9]{64}$')][string]$ParserDiffSha256
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
if (([Net.Dns]::GetHostName() -split '\.')[0].ToLowerInvariant() -cne 'dans1') { throw 'DANS1 required.' }
$root = 'C:\Users\danie\XRayBuilds\preflight\sc09rr-bf09e36e3100'
$original = Join-Path $root 'attempts/machine-2'
$output = Join-Path $root 'attempts/parser-4/retry-1'
if (Test-Path -LiteralPath $output) { throw 'Preserve the existing parser-only receipt.' }
if ((Get-FileHash -LiteralPath $Helper -Algorithm SHA256).Hash.ToLowerInvariant() -cne $HelperSha256) { throw 'Transferred helper hash mismatch.' }
if ((Get-FileHash -LiteralPath $ParserDiff -Algorithm SHA256).Hash.ToLowerInvariant() -cne $ParserDiffSha256) { throw 'Transferred parser diff hash mismatch.' }
$oldHelper = Join-Path $root 'qualify-spawn3.ps1'
$oldHelperHash = (Get-FileHash -LiteralPath $oldHelper -Algorithm SHA256).Hash.ToLowerInvariant()
if ($oldHelperHash -cne '3e257cee8ef65e57688ff2e6d7cd29f428e6ad729ab6ae19467f4e6f31ce472a') { throw 'Spawn-3 baseline helper changed.' }
$manifestPath = Join-Path $original 'sha256-manifest.json'
$manifestHash = (Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($manifestHash -cne '2721406e14a156c1f8fa4ad6c2e3080714890865d3212cc0284a3773a0463d38') { throw 'Original manifest changed.' }
$inputManifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding utf8 | ConvertFrom-Json
function Assert-OriginalUnchanged {
  if ($inputManifest.Count -ne 29) { throw 'Expected all 29 original evidence entries.' }
  foreach ($entry in $inputManifest) {
    $path = Join-Path $original $entry.path
    if ((Get-Item -LiteralPath $path).Length -ne $entry.bytes -or
      (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -cne $entry.sha256) { throw "Original evidence changed: $($entry.path)" }
  }
  if ((Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $manifestHash) { throw 'Original manifest changed during audit.' }
}
Assert-OriginalUnchanged
$originalResult = Get-Content -LiteralPath (Join-Path $original 'results.json') -Raw -Encoding utf8 | ConvertFrom-Json
if ($originalResult.verdict -cne 'FAIL' -or $originalResult.commands.Count -ne 7) { throw 'Unexpected original machine result.' }
foreach ($command in $originalResult.commands) {
  if ($command.exitCode -ne 0 -or -not $command.processExited -or $command.timedOut -or
    -not $command.allOwnedProcessesExited -or $command.cleanup.Count -ne 0) { throw "Original command lacks clean-exit authority: $($command.name)" }
}

$tokens = $null; $parseErrors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile($Helper, [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count) { throw 'Changed helper does not parse.' }
$complete = @($ast.FindAll({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq 'Complete-OwnedStep' }, $true))
if ($complete.Count -ne 1) { throw 'Actual Complete-OwnedStep was not uniquely found.' }
. ([scriptblock]::Create($complete[0].Extent.Text))

# These fixtures supply recorded exit state; no product process is started,
# polled or stopped. Original process cleanup authority is checked above.
function Test-OwnedIdentity { return $false }
function Stop-OwnedStep { throw 'Parser-only verification must never clean up a product process.' }
$node = $originalResult.commands[0].command[0]
$script:receipts = [Collections.Generic.List[object]]::new()
New-Item -ItemType Directory -Path $output | Out-Null
function Invoke-ActualParser([string]$Name, [string]$Stdout, [int]$ExitCode, [bool]$ParseCounts, $OriginalCommand) {
  $directory = Join-Path $output ('parsed/' + $Name)
  New-Item -ItemType Directory -Path $directory | Out-Null
  $step = [pscustomobject]@{
    name = $Name; stdout = $Stdout; directory = $directory; timedOut = $false
    process = [pscustomobject]@{ HasExited = $true; ExitCode = $ExitCode }
    owned = @{}; cleanup = @(); timeoutMs = 0
    arguments = @(); started = [DateTime]::UtcNow
  }
  if ($OriginalCommand) { $step.arguments = @($OriginalCommand.command | Select-Object -Skip 1); $step.started = [DateTime]$OriginalCommand.startedAt }
  return Complete-OwnedStep $step -Tap:$ParseCounts
}

$actual = @()
foreach ($command in $originalResult.commands) {
  $lane = if ($command.name -like 'test-batch-*' -or $command.name -ceq 'typecheck') { 'parallel' } else { 'serial' }
  $actual += Invoke-ActualParser $command.name (Join-Path $original ($lane + '/' + $command.name + '/stdout.log')) $command.exitCode ($command.name -like 'test-batch-*') $command
}
$actualTests = @($actual | Where-Object { $_.name -like 'test-batch-*' })
if (@($actual | Where-Object { $_.verdict -cne 'PASS' }).Count -or $actualTests.Count -ne 3) { throw 'Actual receipt reprocessing did not fully pass.' }
if (($actualTests.tests -join ',') -cne '203,858,971' -or @($actualTests | Where-Object { -not $_.testCountsAvailable -or $_.pass -ne $_.tests -or $_.fail -ne 0 }).Count) { throw 'Actual immutable log counts differ from 203+858+971.' }

$info = [char]0x2139
$cases = @(
  @{ name='tap'; text="# tests 3`n# pass 3`n# fail 0`n"; code=0; verdict='PASS'; available=$true },
  @{ name='spec'; text="$info tests 3`n$info pass 3`n$info fail 0`n"; code=0; verdict='PASS'; available=$true },
  @{ name='absent-clean'; text="No summary emitted.`n"; code=0; verdict='PASS'; available=$false },
  @{ name='absent-nonzero'; text="No summary emitted.`n"; code=1; verdict='FAIL'; available=$false },
  @{ name='partial'; text="# tests 3`n"; code=0; verdict='FAIL'; available=$false },
  @{ name='duplicate'; text="# tests 3`n# tests 3`n# pass 3`n# fail 0`n"; code=0; verdict='FAIL'; available=$false },
  @{ name='all-duplicated'; text="# tests 3`n# tests 3`n# pass 3`n# pass 3`n# fail 0`n# fail 0`n"; code=0; verdict='FAIL'; available=$false },
  @{ name='failing'; text="# tests 3`n# pass 2`n# fail 1`n"; code=0; verdict='FAIL'; available=$true },
  @{ name='mismatched-total'; text="# tests 3`n# pass 2`n# fail 0`n"; code=0; verdict='FAIL'; available=$true },
  @{ name='malformed'; text="# tests nope`n# pass nope`n# fail nope`n"; code=0; verdict='FAIL'; available=$false },
  @{ name='malformed-spec'; text="$info tests nope`n$info pass nope`n$info fail nope`n"; code=0; verdict='FAIL'; available=$false }
)
$caseResults = @()
foreach ($case in $cases) {
  $log = Join-Path $output ($case.name + '.synthetic.log')
  [IO.File]::WriteAllText($log, $case.text, [Text.UTF8Encoding]::new($false))
  $parsed = Invoke-ActualParser ('test-batch-synthetic-' + $case.name) $log $case.code $true $null
  if ($parsed.verdict -cne $case.verdict -or $parsed.testCountsAvailable -ne $case.available) { throw "Unexpected parser result: $($case.name)" }
  if (-not $case.available -and ($null -ne $parsed.tests -or $null -ne $parsed.pass -or $null -ne $parsed.fail) -and $case.name -like 'absent-*') { throw 'Absent counts must remain null.' }
  $caseResults += [pscustomobject]@{ name=$case.name; expectedVerdict=$case.verdict; actualVerdict=$parsed.verdict; countsAvailable=$parsed.testCountsAvailable; parserReceipt=$parsed; assertion='PASS' }
}

# Execute the actual aggregate assignments, acceptance guard, and final summary
# assignment extracted from the helper, rather than a copied implementation.
$aggregateBlocks = @()
foreach ($variable in @('countsComplete','aggregateTests','aggregatePass','aggregateFail')) {
  $assignment = @($ast.FindAll({ param($candidate) $candidate -is [Management.Automation.Language.AssignmentStatementAst] -and $candidate.Left.Extent.Text -ceq ('$' + $variable) }, $true))
  if ($assignment.Count -ne 1) { throw "Aggregate assignment not unique: $variable" }
  $aggregateBlocks += [scriptblock]::Create($assignment[0].Extent.Text)
}
$guard = @($ast.FindAll({ param($candidate) $candidate -is [Management.Automation.Language.IfStatementAst] -and $candidate.Extent.Text.StartsWith('if ($parallelFailures.Count -or $lintReceipt.verdict') }, $true))
$summary = @($ast.FindAll({ param($candidate) $candidate -is [Management.Automation.Language.AssignmentStatementAst] -and $candidate.Left.Extent.Text -ceq '$testSummary' }, $true))
if ($guard.Count -ne 1 -or $summary.Count -ne 1) { throw 'Actual aggregate guard/summary not unique.' }
function Invoke-ActualAggregate([object[]]$Inputs) {
  $receipts = $Inputs
  $tapReceipts = @($Inputs | Where-Object { $_.name -like 'test-batch-*' })
  $parallelFailures = @($Inputs | Where-Object { $_.verdict -cne 'PASS' })
  $lintReceipt = [pscustomobject]@{ verdict='PASS' }
  $failure = $null
  foreach ($block in $aggregateBlocks) { . $block }
  . ([scriptblock]::Create($guard[0].Extent.Text))
  . ([scriptblock]::Create($summary[0].Extent.Text))
  return [pscustomobject]$testSummary
}
$completeAggregate = Invoke-ActualAggregate $actualTests
if ($completeAggregate.tests -ne 2032 -or $completeAggregate.pass -ne 2032 -or $completeAggregate.fail -ne 0 -or -not $completeAggregate.countsAvailable) { throw 'Actual complete aggregate failed.' }
$absentReceipt = ($caseResults | Where-Object name -eq 'absent-clean').parserReceipt
$absentAggregate = Invoke-ActualAggregate @($absentReceipt)
if ($absentAggregate.countsAvailable -or $null -ne $absentAggregate.tests -or $null -ne $absentAggregate.pass -or $null -ne $absentAggregate.fail) { throw 'Clean absent-count aggregate must stay null.' }
$mixedAggregate = Invoke-ActualAggregate @($actualTests[0], $absentReceipt)
if ($mixedAggregate.countsAvailable -or $null -ne $mixedAggregate.tests) { throw 'Mixed available/absent counts must not claim a complete total.' }
$rejected = $false
try { Invoke-ActualAggregate @(($caseResults | Where-Object name -eq 'absent-nonzero').parserReceipt) | Out-Null } catch { $rejected = $true }
if (-not $rejected) { throw 'Nonzero absent-count exit must fail aggregate acceptance.' }

$diffPath = Join-Path $output 'parser-change.patch'
Copy-Item -LiteralPath $ParserDiff -Destination $diffPath
Assert-OriginalUnchanged
$result = [ordered]@{
  schema='xray.sc09-room-roof-parser-reprocessing/v1'; host='DANS1'; verdict='PASS'; originalVerdict='FAIL'
  freshQualification=$false; parserCorrection=$true; classification='Receipt reprocessing only; no product gates rerun'
  priorParserAttempt=[ordered]@{path='..';exitCode=1;reason='DANS1 had no git command for final diff packaging. Earlier generated parser-case receipts preserved; this retry uses a locally generated hash-bound diff.'}
  runId=$originalResult.runId; head=$originalResult.head; sourceDigest=$originalResult.sourceDigest
  checkedAt=[DateTime]::UtcNow.ToString('o'); originalResults='../machine-2/results.json'; originalManifestSha256=$manifestHash
  originalEvidenceEntries=29; originalEvidenceBytes=($inputManifest | Measure-Object bytes -Sum).Sum
  originalHashesUnchangedBeforeAndAfter=$true; cleanOriginalCommandCount=7; originalInputs=$inputManifest
  helper=[ordered]@{path=$Helper;sha256=$HelperSha256;baseline=$oldHelper;baselineSha256=$oldHelperHash;diff='parser-change.patch';diffSha256=(Get-FileHash -LiteralPath $diffPath -Algorithm SHA256).Hash.ToLowerInvariant()}
  verifierSha256=(Get-FileHash -LiteralPath $PSCommandPath -Algorithm SHA256).Hash.ToLowerInvariant()
  actualFunction='Complete-OwnedStep extracted from changed helper PowerShell AST'
  fixtureBoundary='Recorded exited-process fixtures; Test-OwnedIdentity returns false only for empty owned sets. Original clean exits, timeouts and leftovers independently checked from immutable receipts. No product process launched, polled or cleaned.'
  derivedCommands=$actual; fullTestGate=$completeAggregate; syntheticCaseCount=$caseResults.Count; syntheticCases=$caseResults
  aggregateCases=[ordered]@{complete=$completeAggregate;entirelyAbsent=$absentAggregate;mixed=$mixedAggregate;absentNonzeroRejected=$rejected}
  limitations=@('Original machine-2 results and test receipts remain FAIL and unchanged.','This is a parser correction and derived interpretation of prior execution, not a fresh qualification.','No tests, tsc, lint, build, browser, screenshots, native or deployment gates were rerun.','Scoped lint retains its original 16 warnings; no SC-09 completion is claimed.')
}
$result | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $output 'results.json') -Encoding utf8
$hashes = @(Get-ChildItem -LiteralPath $output -Recurse -File | ForEach-Object { [ordered]@{path=$_.FullName.Substring($output.Length).TrimStart('\').Replace('\','/');bytes=$_.Length;sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()} })
$hashes | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $output 'sha256-manifest.json') -Encoding utf8
[ordered]@{host='DANS1';verdict='PASS';originalVerdict='FAIL';freshQualification=$false;actualTests=2032;syntheticCases=$caseResults.Count;output=$output;helperSha256=$HelperSha256} | ConvertTo-Json -Compress
