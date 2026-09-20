param(
  [Parameter(Mandatory = $true)][ValidatePattern('^sc09rr-[a-f0-9]{12}$')][string]$RunId,
  [Parameter(Mandatory = $true)][ValidatePattern('^[a-f0-9]{64}$')][string]$ArchiveHash,
  [switch]$ReuseSource,
  [ValidatePattern('^[a-z0-9-]+$')][string]$Attempt
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
if (([Net.Dns]::GetHostName() -split '\.')[0].ToLowerInvariant() -cne 'dans1') { throw 'DANS1 required.' }
. 'C:\Users\danie\XRayBuilds\dans1-resource-policy.ps1'
if ($dansResourcePolicy.logicalProcessors -ne 16 -or $dansResourcePolicy.priority -cne 'High') {
  throw 'The reviewed DANS1 16-CPU/high-priority resource policy is not active.'
}
[Diagnostics.Process]::GetCurrentProcess().ProcessorAffinity = [IntPtr]65535

$root = 'C:\Users\danie\XRayBuilds\preflight\' + $RunId
$source = Join-Path $root 'source'
$output = if ($Attempt) { Join-Path $root ('attempts/' + $Attempt) } else { Join-Path $root 'output' }
$baseline = 'C:\Users\danie\XRayBuilds\preflight\9abf4c807030'
$archive = Join-Path $root 'source.tar'
$manifestPath = Join-Path $root 'source-manifest.json'
if (Test-Path -LiteralPath $output) { throw 'Preserve the existing qualification receipt.' }
if ($ReuseSource -and (-not $Attempt -or -not (Test-Path -LiteralPath $source))) { throw 'Source reuse needs an existing snapshot and a new named attempt.' }
if (-not $ReuseSource -and (Test-Path -LiteralPath $source)) { throw 'Preserve the existing source snapshot.' }
if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -cne $ArchiveHash) { throw 'Source archive hash mismatch.' }
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if ($manifest.schema -cne 'xray.sc09-room-roof-source/v1' -or $manifest.runId -cne $RunId) { throw 'Unexpected source manifest.' }

$archiveEntries = @(& tar -tf $archive)
if ($LASTEXITCODE -ne 0) { throw 'Source archive listing failed.' }
foreach ($entry in $archiveEntries) {
  if ($entry -match '(^[/\\]|:|(^|[/\\])\.\.([/\\]|$))') { throw "Unsafe source archive entry: $entry" }
}
New-Item -ItemType Directory -Path $output | Out-Null
if (-not $ReuseSource) {
  New-Item -ItemType Directory -Path $source | Out-Null
  & tar -xf $archive -C $source
  if ($LASTEXITCODE -ne 0) { throw 'Source extraction failed.' }
}

function Assert-SourceUnchanged {
  foreach ($entry in $manifest.entries) {
    $target = [IO.Path]::GetFullPath((Join-Path $source $entry.path))
    if (-not $target.StartsWith($source + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Manifest path escaped the source root.' }
    if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -cne $entry.sha256) {
      throw "Qualified source changed: $($entry.path)"
    }
  }
}
Assert-SourceUnchanged

$baselineLock = Join-Path $baseline 'source/package-lock.json'
$sourceLock = Join-Path $source 'package-lock.json'
if (-not (Test-Path -LiteralPath (Join-Path $baseline 'runtime/node.exe') -PathType Leaf) -or
    -not (Test-Path -LiteralPath (Join-Path $baseline 'source/node_modules') -PathType Container)) {
  throw 'The reviewed DANS1 runtime/dependency baseline is unavailable.'
}
if ((Get-FileHash -LiteralPath $sourceLock -Algorithm SHA256).Hash -cne (Get-FileHash -LiteralPath $baselineLock -Algorithm SHA256).Hash) {
  throw 'Dependency lock differs from the reviewed DANS1 baseline; dependency reuse is refused.'
}
$dependencies = Join-Path $baseline 'source/node_modules'
$localDependencies = Join-Path $source 'node_modules'
if (-not $ReuseSource) {
New-Item -ItemType Directory -Path $localDependencies | Out-Null
$dependencyLinks = @()
foreach ($item in Get-ChildItem -LiteralPath $dependencies -Force) {
  if ($item.Name -in @('.cache', '.vite', '.vite-temp')) { continue }
  $link = Join-Path $localDependencies $item.Name
  if ($item.PSIsContainer) {
    New-Item -ItemType Junction -Path $link -Target $item.FullName | Out-Null
    $mode = 'read-only-use junction'
  } else {
    Copy-Item -LiteralPath $item.FullName -Destination $link
    $mode = 'copied metadata'
  }
  $dependencyLinks += [ordered]@{ name = $item.Name; target = $item.FullName; mode = $mode }
}
$dependencyLinks | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $output 'dependency-links.json') -Encoding utf8
New-Item -ItemType Junction -Path (Join-Path $root 'runtime') -Target (Join-Path $baseline 'runtime') | Out-Null
} elseif (-not (Test-Path -LiteralPath $localDependencies) -or -not (Test-Path -LiteralPath (Join-Path $root 'runtime/node.exe'))) {
  throw 'The frozen source dependencies or runtime are missing; reuse refused.'
}

$node = Join-Path $root 'runtime/node.exe'
$env:PATH = (Join-Path $root 'runtime') + ';' + $env:PATH
$env:VITE_AUTH_ENABLED = $null

function ConvertFrom-NodeCommand([string]$Command, [string]$Name) {
  if ($Command -notmatch '^node\s+(.+)$') { throw "$Name is not a direct Node command." }
  $tokens = @($Matches[1] -split '\s+' | Where-Object { $_ })
  if (-not $tokens.Count -or @($tokens | Where-Object { $_ -notmatch '^[A-Za-z0-9_.:/\\-]+$' }).Count) {
    throw "$Name contains unsupported command syntax."
  }
  return $tokens
}

# Freeze the exact repository gate topology. The shared-output verifiers are
# deliberately kept out of the parallel wave; every node:test path is executed
# exactly once from the frozen package scripts.
$package = Get-Content -LiteralPath (Join-Path $source 'package.json') -Raw | ConvertFrom-Json
$testSegments = @([regex]::Split([string]$package.scripts.test, '\s*&&\s*'))
$sourceSegments = @([regex]::Split([string]$package.scripts.'test:src', '\s*&&\s*'))
if ($testSegments.Count -ne 4 -or $testSegments[0] -cne 'node scripts/verify-master-plan.mjs' -or
    $testSegments[1] -cne 'node scripts/verify-bom-goldens.mjs' -or
    $testSegments[2] -notmatch '^node --test ' -or $testSegments[3] -cne 'npm run test:src') {
  throw 'The repository test gate topology changed; refusing to run a partial qualification.'
}
if ($sourceSegments.Count -ne 2 -or @($sourceSegments | Where-Object { $_ -notmatch '^node --experimental-strip-types --test ' }).Count) {
  throw 'The source test gate topology changed; refusing to run a partial qualification.'
}
$batchCommands = @($testSegments[2]) + $sourceSegments
$batchSpecs = @($batchCommands | ForEach-Object {
  [pscustomobject]@{ command = $_; arguments = @(ConvertFrom-NodeCommand $_ 'node:test batch') }
})
$registeredTests = @($batchCommands | ForEach-Object {
  [regex]::Matches($_, '[A-Za-z0-9_./-]+\.test\.(?:ts|tsx|mjs|js)') | ForEach-Object { $_.Value }
})
if (-not $registeredTests.Count -or @($registeredTests | Sort-Object -Unique).Count -ne $registeredTests.Count) {
  throw 'The frozen full gate contains no tests or registers a test more than once.'
}
foreach ($testPath in $registeredTests) {
  if (-not (Test-Path -LiteralPath (Join-Path $source $testPath) -PathType Leaf)) { throw "Registered test is missing: $testPath" }
}

$receipts = [Collections.Generic.List[object]]::new()
$allSteps = [Collections.Generic.List[object]]::new()
$failure = $null

function Start-OwnedStep([string]$Name, [string[]]$Arguments, [int]$TimeoutMs, [string]$Lane) {
  $stepDirectory = Join-Path $output ($Lane + '/' + $Name)
  New-Item -ItemType Directory -Path $stepDirectory | Out-Null
  $stdout = Join-Path $stepDirectory 'stdout.log'
  $stderr = Join-Path $stepDirectory 'stderr.log'
  $started = [DateTime]::UtcNow
  $process = Start-Process -FilePath $node -ArgumentList ($Arguments -join ' ') -WorkingDirectory $source -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
  $null = $process.Handle
  $identity = Get-CimInstance Win32_Process -Filter "ProcessId=$($process.Id)"
  if (-not $identity) { throw "Could not capture process identity for $Name." }
  $identity | Select-Object ProcessId, CreationDate, ExecutablePath, CommandLine | ConvertTo-Json |
    Set-Content -LiteralPath (Join-Path $stepDirectory 'process.json') -Encoding utf8
  $step = [pscustomobject]@{
    name = $Name
    arguments = $Arguments
    timeoutMs = $TimeoutMs
    directory = $stepDirectory
    stdout = $stdout
    stderr = $stderr
    started = $started
    deadline = $started.AddMilliseconds($TimeoutMs)
    process = $process
    identity = $identity
    owned = @{}
    timedOut = $false
    cleanup = [Collections.Generic.List[object]]::new()
  }
  $key = [string]$identity.ProcessId + '|' + [string]$identity.CreationDate
  $step.owned[$key] = $identity | Select-Object ProcessId, ParentProcessId, CreationDate, ExecutablePath, CommandLine
  $allSteps.Add($step)
  return $step
}

function Capture-OwnedTrees([object[]]$Steps) {
  if (-not $Steps.Count) { return }
  $snapshot = @(Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId, CreationDate, ExecutablePath, CommandLine)
  foreach ($step in $Steps) {
    # A historical PID alone cannot establish parentage after PID reuse.
    $ownedPids = @($snapshot | Where-Object {
      $key = [string]$_.ProcessId + '|' + [string]$_.CreationDate
      $known = $step.owned[$key]
      $known -and $known.ExecutablePath -ceq $_.ExecutablePath -and $known.CommandLine -ceq $_.CommandLine
    } | ForEach-Object { [int]$_.ProcessId })
    do {
      $children = @($snapshot | Where-Object {
        $child = $_
        $parent = $snapshot | Where-Object { $_.ProcessId -eq $child.ParentProcessId } | Select-Object -First 1
        # ParentProcessId can refer to an earlier incarnation of the PID. A
        # child must have been created after this exact live parent and task.
        [int]$child.ParentProcessId -in $ownedPids -and $parent.CreationDate -and $child.CreationDate -and
          ([datetime]$child.CreationDate).ToUniversalTime() -ge ([datetime]$parent.CreationDate).ToUniversalTime() -and
          ([datetime]$child.CreationDate).ToUniversalTime() -ge $step.started.ToUniversalTime()
      })
      $added = $false
      foreach ($child in $children) {
        $key = [string]$child.ProcessId + '|' + [string]$child.CreationDate
        if (-not $step.owned.ContainsKey($key)) {
          $step.owned[$key] = $child
          $ownedPids += [int]$child.ProcessId
          $added = $true
        }
      }
    } while ($added)
  }
}

function Test-OwnedIdentity($Identity) {
  $current = Get-CimInstance Win32_Process -Filter "ProcessId=$($Identity.ProcessId)" -ErrorAction SilentlyContinue
  return $current -and $current.CreationDate -eq $Identity.CreationDate -and
    $current.ExecutablePath -ceq $Identity.ExecutablePath -and $current.CommandLine -ceq $Identity.CommandLine
}

function Stop-OwnedStep($Step, [string]$Reason) {
  Capture-OwnedTrees @($Step)
  $live = @($Step.owned.Values | Where-Object { Test-OwnedIdentity $_ })
  if (-not $live.Count) { return }
  # First offer only the exact launched root its normal window-close path. Most
  # console Node processes have no window; the bounded wait is still recorded.
  $graceful = $false
  if (Test-OwnedIdentity $Step.identity) {
    try { $graceful = $Step.process.CloseMainWindow() } catch {}
  }
  if ($graceful) { $null = $Step.process.WaitForExit(1500) }
  Capture-OwnedTrees @($Step)
  # Stop deepest descendants first, using the captured PID+creation+path+command
  # identity. Never enumerate-and-kill unrelated Node processes.
  $live = @($Step.owned.Values | Where-Object { Test-OwnedIdentity $_ } | Sort-Object ProcessId -Descending)
  foreach ($identity in $live) {
    if (Test-OwnedIdentity $identity) {
      Stop-Process -Id $identity.ProcessId -ErrorAction Stop
      $Step.cleanup.Add([ordered]@{ processId = $identity.ProcessId; reason = $Reason; phase = 'bounded-stop' })
    }
  }
  Start-Sleep -Milliseconds 500
  $remaining = @($Step.owned.Values | Where-Object { Test-OwnedIdentity $_ })
  foreach ($identity in $remaining) {
    if (Test-OwnedIdentity $identity) {
      Stop-Process -Id $identity.ProcessId -Force -ErrorAction Stop
      $Step.cleanup.Add([ordered]@{ processId = $identity.ProcessId; reason = $Reason; phase = 'forced-after-bounded-stop' })
    }
  }
  Start-Sleep -Milliseconds 250
  $remaining = @($Step.owned.Values | Where-Object { Test-OwnedIdentity $_ })
  if ($remaining.Count) { throw "Owned process tree remains alive after cleanup: $($Step.name)" }
}

function Wait-OwnedWave([object[]]$Steps) {
  while (@($Steps | Where-Object { -not $_.process.HasExited -and -not $_.timedOut }).Count) {
    Capture-OwnedTrees $Steps
    foreach ($step in $Steps) {
      if (-not $step.process.HasExited -and [DateTime]::UtcNow -ge $step.deadline) {
        $step.timedOut = $true
        Stop-OwnedStep $step 'deadline exceeded'
      }
    }
    Start-Sleep -Milliseconds 500
  }
  Capture-OwnedTrees $Steps
}

function Complete-OwnedStep($Step, [switch]$Tap) {
  $issues = [Collections.Generic.List[string]]::new()
  if ($Step.timedOut) { $issues.Add('deadline exceeded') }
  if (-not $Step.process.HasExited) {
    Stop-OwnedStep $Step 'completion cleanup'
    $issues.Add('root process had not exited at completion')
  }
  # A completed node:test root must not leave an owned child behind.
  $residual = @($Step.owned.Values | Where-Object { Test-OwnedIdentity $_ })
  if ($residual.Count) {
    Stop-OwnedStep $Step 'residual descendant after root exit'
    $issues.Add('owned descendant required cleanup after root exit')
  }
  $exitCode = if ($Step.process.HasExited) { [int]$Step.process.ExitCode } else { $null }
  if ($exitCode -ne 0) { $issues.Add("exit code $exitCode") }
  $receipt = [ordered]@{
    name = $Step.name
    host = 'DANS1'
    command = @($node) + $Step.arguments
    exitCode = $exitCode
    startedAt = $Step.started.ToString('o')
    finishedAt = [DateTime]::UtcNow.ToString('o')
    processExited = $Step.process.HasExited
    timeoutMs = $Step.timeoutMs
    timedOut = $Step.timedOut
    resourcePolicy = [ordered]@{ priority = 'High'; logicalProcessors = 16; inheritedByDescendants = $true; rootAffinity = 65535 }
  }
  if ($Tap) {
    $tapText = if (Test-Path -LiteralPath $Step.stdout) { Get-Content -LiteralPath $Step.stdout -Raw -Encoding utf8 } else { '' }
    $countsSeen = 0
    foreach ($field in @('tests', 'pass', 'fail')) {
      $countMatches = [regex]::Matches($tapText, "(?m)^(?:#|$([char]0x2139))\s+$field\s+(\d+)\s*$")
      $countMarkers = [regex]::Matches($tapText, "(?m)^(?:#|$([char]0x2139))\s+$field(?:\s|$)")
      if ($countMarkers.Count -ne $countMatches.Count) { $issues.Add("invalid $field count") }
      if ($countMatches.Count -eq 1) { $receipt[$field] = [int]$countMatches[0].Groups[1].Value; $countsSeen += 1 }
      else { $receipt[$field] = $null }
      if ($countMatches.Count -gt 1) { $issues.Add("ambiguous $field count") }
    }
    $receipt['testCountsAvailable'] = $countsSeen -eq 3
    $receipt['testCountBasis'] = if ($countsSeen -eq 3) { 'stdout TAP/spec summary' } else { 'process exit; counts unavailable' }
    if ($countsSeen -gt 0 -and $countsSeen -ne 3) { $issues.Add('incomplete test count block') }
    if ($countsSeen -eq 3 -and ($receipt.fail -ne 0 -or $receipt.pass -ne $receipt.tests)) { $issues.Add('Test result is not fully passing') }
  }
  $receipt['ownedProcesses'] = @($Step.owned.Values | Sort-Object ProcessId | ForEach-Object {
    [ordered]@{ processId = $_.ProcessId; parentProcessId = $_.ParentProcessId; creationDate = $_.CreationDate; executablePath = $_.ExecutablePath; commandLine = $_.CommandLine }
  })
  $receipt['cleanup'] = @($Step.cleanup)
  $receipt['allOwnedProcessesExited'] = @($Step.owned.Values | Where-Object { Test-OwnedIdentity $_ }).Count -eq 0
  $receipt['verdict'] = if (-not $issues.Count -and $receipt.allOwnedProcessesExited) { 'PASS' } else { 'FAIL' }
  $receipt['errors'] = @($issues)
  $receipt | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath (Join-Path $Step.directory 'receipt.json') -Encoding utf8
  $receipts.Add([pscustomobject]$receipt)
  return [pscustomobject]$receipt
}

try {
  foreach ($verifier in @(
    [ordered]@{ name = 'verify-master-plan'; arguments = @(ConvertFrom-NodeCommand $testSegments[0] 'master-plan verifier') },
    [ordered]@{ name = 'verify-bom-goldens'; arguments = @(ConvertFrom-NodeCommand $testSegments[1] 'BOM verifier') }
  )) {
    Assert-SourceUnchanged
    $step = Start-OwnedStep $verifier.name $verifier.arguments 300000 'serial'
    Wait-OwnedWave @($step)
    $verifierReceipt = Complete-OwnedStep $step
    if ($verifierReceipt.verdict -cne 'PASS') { throw "Machine verifier failed: $($verifier.name)" }
    Assert-SourceUnchanged
  }

  Assert-SourceUnchanged
  $parallel = @()
  for ($index = 0; $index -lt $batchSpecs.Count; $index += 1) {
    $parallel += Start-OwnedStep ('test-batch-{0:d2}' -f ($index + 1)) $batchSpecs[$index].arguments 900000 'parallel'
  }
  $parallel += Start-OwnedStep 'typecheck' @('node_modules/typescript/bin/tsc', '--noEmit') 900000 'parallel'
  Wait-OwnedWave $parallel

  $tapReceipts = @()
  foreach ($step in $parallel) {
    $isTap = $step.name -like 'test-batch-*'
    $receipt = Complete-OwnedStep $step -Tap:$isTap
    if ($isTap) { $tapReceipts += $receipt }
  }
  $parallelFailures = @($receipts | Where-Object { ($_.name -like 'test-batch-*' -or $_.name -eq 'typecheck') -and $_.verdict -ne 'PASS' })
  Assert-SourceUnchanged

  $lint = Start-OwnedStep 'scoped-lint' @(
    'node_modules/eslint/bin/eslint.js',
    'src/studio/SourceAreaEditor.tsx',
    'src/studio/sourceAreaChanges.ts',
    'src/studio/sourceAreaDrag.ts',
    'src/studio/sourceAreaMeasurement.ts',
    'src/studio/industries/quantity-surveying'
  ) 300000 'serial'
  Wait-OwnedWave @($lint)
  $lintReceipt = Complete-OwnedStep $lint
  Assert-SourceUnchanged
  $countsComplete = @($tapReceipts | Where-Object { -not $_.testCountsAvailable }).Count -eq 0
  $aggregateTests = if ($countsComplete) { ($tapReceipts | Measure-Object -Property tests -Sum).Sum } else { $null }
  $aggregatePass = if ($countsComplete) { ($tapReceipts | Measure-Object -Property pass -Sum).Sum } else { $null }
  $aggregateFail = if ($countsComplete) { ($tapReceipts | Measure-Object -Property fail -Sum).Sum } else { $null }
  if ($parallelFailures.Count -or $lintReceipt.verdict -cne 'PASS' -or ($countsComplete -and
      ($aggregateTests -lt 1964 -or $aggregatePass -ne $aggregateTests -or $aggregateFail -ne 0))) {
    throw "Qualification gate failed: parallelFailures=$($parallelFailures.Count) lint=$($lintReceipt.verdict) tests=$aggregateTests pass=$aggregatePass fail=$aggregateFail"
  }
} catch {
  $failure = $_
} finally {
  foreach ($step in $allSteps) {
    try { Stop-OwnedStep $step 'final owned-process cleanup' } catch { if (-not $failure) { $failure = $_ } }
    $step.process.Dispose()
  }
}

$testSummary = if ($failure) { $null } else {
  $testReceipts = @($receipts | Where-Object { $_.name -like 'test-batch-*' })
  [ordered]@{
    batches = $testReceipts.Count
    tests = $aggregateTests
    pass = $aggregatePass
    fail = $aggregateFail
    countsAvailable = $countsComplete
    priorFullGateFloor = 1964
  }
}

$result = [ordered]@{
  schema = 'xray.sc09-room-roof-machine/v1'
  host = 'DANS1'
  runId = $RunId
  attempt = $Attempt
  reusedSource = [bool]$ReuseSource
  head = $manifest.head
  sourceDigest = $manifest.sourceDigest
  archiveSha256 = $ArchiveHash
  source = $source
  sourceFiles = @($manifest.entries).Count
  reusedDependencyBaseline = $baseline
  packageLockMatched = $true
  commands = @($receipts)
  fullTestGate = $testSummary
  verdict = if ($failure) { 'FAIL' } else { 'PASS' }
  error = if ($failure) { [string]$failure } else { $null }
  limits = 'Serial shared-output verifiers, all three frozen repository node:test batches, one full no-emit TypeScript check, and scoped changed-surface lint only; no browser, build, native, room-area, or roof-plane acceptance.'
}
$result | ConvertTo-Json -Depth 9 | Set-Content -LiteralPath (Join-Path $output 'results.json') -Encoding utf8
$hashes = @(Get-ChildItem -LiteralPath $output -File -Recurse | Where-Object { $_.Name -ne 'sha256-manifest.json' } | ForEach-Object {
  $relative = $_.FullName.Substring($output.Length).TrimStart('\\').Replace('\\', '/')
  [ordered]@{ path = $relative; bytes = $_.Length; sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant() }
} | Sort-Object path)
$hashes | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $output 'sha256-manifest.json') -Encoding utf8
Write-Output ($result | ConvertTo-Json -Depth 9 -Compress)
if ($failure) { exit 1 }
