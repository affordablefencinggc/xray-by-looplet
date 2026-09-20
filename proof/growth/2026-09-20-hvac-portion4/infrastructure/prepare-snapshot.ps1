param([switch]$DryRun)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..\..'))
$own = 'proof/growth/2026-09-20-hvac-portion4'
$approvedBranch = 'feat/closeout-sc09-remainder'
$observedBranch = (& git -C $repo branch --show-current).Trim()
if ($LASTEXITCODE -ne 0 -or $observedBranch -cne $approvedBranch) {
  throw "SC-09 snapshot is authorized only on $approvedBranch; observed $observedBranch"
}
$excludedTrees = @(
  'proof/growth/',
  'screenshots/',
  '.temp/',
  'dist/',
  'src-tauri/target/',
  'node_modules/'
)

# Derive the complete tracked application tree directly from Git. New SC-09
# files are an explicit allowlist below; unrelated untracked work never enters
# this qualification by accident.
$listed = @(& git -C $repo ls-files)
if ($LASTEXITCODE -ne 0) { throw 'Could not derive the source list from the repository.' }
$paths = @($listed | Where-Object {
  $path = $_.Replace('\', '/')
  -not ($excludedTrees | Where-Object { $path.StartsWith($_, [StringComparison]::Ordinal) }) -and
    $path -notmatch '(^|/)__pycache__(/|$)|\.pyc$' -and
    (Test-Path -LiteralPath (Join-Path $repo $path) -PathType Leaf)
} | Sort-Object -Unique)

$requiredSc09Sources = @(
  'src/studio/industries/hvac/ductMaterialTable.ts',
  'src/studio/industries/hvac/ductMaterialTable.test.ts',
  'src/studio/industries/hvac/DuctMaterialTable.tsx',
  'src/studio/industries/hvac/assistantTool.test.ts',
  'src/studio/industries/hvac/assistantTool.ts',
  'src/studio/industries/hvac/ductForm.test.ts',
  'src/studio/industries/hvac/ductForm.ts',
  'src/studio/industries/hvac/ductMaterialBasis.test.ts',
  'src/studio/industries/hvac/ductMaterialBasis.ts',
  'src/studio/industries/hvac/ductWrapTool.ts',
  'src/studio/industries/hvac/hvacCoordination.css',
  'src/studio/industries/hvac/HvacCoordinationPanel.tsx',
  'src/studio/industries/hvac/HvacDraftPanel.tsx',
  'src/studio/industries/hvac/hvacNetwork.test.ts',
  'src/studio/industries/hvac/hvacNetwork.ts',
  'src/studio/industries/hvac/HVACNetworkViewer.tsx',
  'src/studio/industries/hvac/hvacSchedules.test.ts',
  'src/studio/industries/hvac/hvacSchedules.ts',
  'src/studio/industries/hvac/straightDuct.test.ts',
  'src/studio/industries/hvac/straightDuct.ts',
  'src/studio/industries/hvac/straightDuctWrap.test.ts',
  'src/studio/industries/hvac/straightDuctWrap.ts'
)
foreach ($sourcePath in $requiredSc09Sources) {
  if (-not (Test-Path -LiteralPath (Join-Path $repo $sourcePath) -PathType Leaf)) {
    throw "Required SC-09 source is not stable on disk: $sourcePath"
  }
  if ($paths -notcontains $sourcePath) { $paths += $sourcePath }
}

$paths = @($paths | Sort-Object -Unique)

# Guard against the omission class that invalidated earlier snapshots: every
# source file named directly by the test scripts and every engine fixture must
# be present in the frozen tree.
$package = Get-Content -LiteralPath (Join-Path $repo 'package.json') -Raw | ConvertFrom-Json
$scriptText = [string]$package.scripts.test + ' ' + [string]$package.scripts.'test:src'
$scriptFiles = @([regex]::Matches($scriptText, '[A-Za-z0-9_./-]+/[A-Za-z0-9_./-]+\.(?:ts|tsx|mjs|js)') |
  ForEach-Object { $_.Value } | Sort-Object -Unique)
$absentScripts = @($scriptFiles | Where-Object { $paths -notcontains $_ })
if ($absentScripts.Count) { throw "Snapshot omits test input(s): $($absentScripts -join ', ')" }
$unregisteredSc09Tests = @($requiredSc09Sources | Where-Object { $_ -match '\.test\.ts$' -and $scriptFiles -notcontains $_ })
if ($unregisteredSc09Tests.Count) { throw "package.json does not register SC-09 test(s): $($unregisteredSc09Tests -join ', ')" }
$engineFixtures = @(& git -C $repo ls-files 'engine/fixtures/*')
if ($LASTEXITCODE -ne 0) { throw 'Could not enumerate engine fixtures.' }
$absentFixtures = @($engineFixtures | Where-Object { $paths -notcontains $_ })
if ($absentFixtures.Count) { throw "Snapshot omits engine fixture(s): $($absentFixtures -join ', ')" }

$entries = @($paths | ForEach-Object {
  $file = Get-Item -LiteralPath (Join-Path $repo $_)
  [ordered]@{
    path = $_.Replace('\', '/')
    bytes = $file.Length
    sha256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
  }
})
$entryJson = $entries | ConvertTo-Json -Depth 5
$hasher = [Security.Cryptography.SHA256]::Create()
try { $digestBytes = $hasher.ComputeHash([Text.Encoding]::UTF8.GetBytes($entryJson)) }
finally { $hasher.Dispose() }
$sourceDigest = ([BitConverter]::ToString($digestBytes)).Replace('-', '').ToLowerInvariant()
$runId = 'hvac4-' + $sourceDigest.Substring(0, 12)

$dirtyPaths = @(
  & git -C $repo diff --name-only
  & git -C $repo diff --cached --name-only
  & git -C $repo ls-files --others --exclude-standard
) | ForEach-Object { $_.Replace('\', '/') } | Where-Object { $paths -contains $_ } | Sort-Object -Unique

if ($DryRun) {
  [ordered]@{
    dryRun = $true
    runId = $runId
    sourceDigest = $sourceDigest
    sourceFiles = $entries.Count
    directlyNamedTestInputs = $scriptFiles.Count
    engineFixtures = $engineFixtures.Count
    dirtyIncludedPaths = $dirtyPaths
    entries = $entries
  } | ConvertTo-Json -Depth 7
  exit 0
}

$observed = ((& ssh tonys-test-pc hostname) -join '').Trim().ToLowerInvariant()
if ($LASTEXITCODE -ne 0 -or ($observed -split '\.')[0] -cne 'dans1') { throw 'DANS1 required.' }
$head = (& git -C $repo rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $head -notmatch '^[a-f0-9]{40}$') { throw 'Could not resolve the source commit.' }

$stage = Join-Path $repo ('.temp/hvac-portion4-stage/' + $runId)
if (Test-Path -LiteralPath $stage) { throw 'Preserve the existing source snapshot.' }
$source = Join-Path $stage 'source'
New-Item -ItemType Directory -Path $source | Out-Null
foreach ($entry in $entries) {
  $target = Join-Path $source $entry.path
  New-Item -ItemType Directory -Force -Path (Split-Path $target -Parent) | Out-Null
  Copy-Item -LiteralPath (Join-Path $repo $entry.path) -Destination $target
  if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -cne $entry.sha256) {
    throw "Source changed while packaging: $($entry.path)"
  }
}

$manifest = [ordered]@{
  schema = 'xray.hvac-portion4-source/v1'
  createdAt = [DateTime]::UtcNow.ToString('o')
  runId = $runId
  head = $head
  sourceDigest = $sourceDigest
  entries = $entries
  dirtyIncludedPaths = $dirtyPaths
  scope = 'Complete current application source at frozen working bytes; proof growth output, screenshots, build output, dependencies and native targets excluded.'
}
$manifestPath = Join-Path $stage 'source-manifest.json'
$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath -Encoding utf8
$archive = Join-Path $stage 'source.tar'
& tar -cf $archive -C $source .
if ($LASTEXITCODE -ne 0) { throw 'Source archive creation failed.' }
foreach ($entry in $entries) {
  if ((Get-FileHash -LiteralPath (Join-Path $source $entry.path) -Algorithm SHA256).Hash.ToLowerInvariant() -cne $entry.sha256) {
    throw "Frozen source changed after archive creation: $($entry.path)"
  }
}
$archiveHash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()

$remote = 'C:\Users\danie\XRayBuilds\preflight\' + $runId
$setup = "`$ErrorActionPreference='Stop';if(([Net.Dns]::GetHostName() -split '\.')[0].ToLowerInvariant() -cne 'dans1'){throw 'DANS1 required'};if(Test-Path -LiteralPath '$remote'){throw 'Preflight already exists'};New-Item -ItemType Directory -Path '$remote'|Out-Null"
$encodedSetup = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($setup))
& ssh tonys-test-pc powershell -NoProfile -NonInteractive -EncodedCommand $encodedSetup
if ($LASTEXITCODE -ne 0) { throw 'Remote preflight setup failed.' }
$destination = 'tonys-test-pc:' + $remote.Replace('\', '/') + '/'
& scp -- $archive $manifestPath (Join-Path $repo "$own/infrastructure/qualify.ps1") $destination
if ($LASTEXITCODE -ne 0) { throw 'Source snapshot transfer failed.' }

$execute = "& '$remote\qualify.ps1' -RunId '$runId' -ArchiveHash '$archiveHash'; exit `$LASTEXITCODE"
$encodedExecute = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($execute))
& ssh tonys-test-pc powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand $encodedExecute
$remoteExit = $LASTEXITCODE
& scp -r -- ($destination + 'output') $stage
if ($LASTEXITCODE -ne 0) { throw 'Machine evidence retrieval failed.' }
$returnedManifest = Get-Content -LiteralPath (Join-Path $stage 'output/sha256-manifest.json') -Raw | ConvertFrom-Json
foreach ($entry in $returnedManifest) {
  $returned = Join-Path $stage ('output/' + $entry.path)
  if ((Get-FileHash -LiteralPath $returned -Algorithm SHA256).Hash.ToLowerInvariant() -cne $entry.sha256) {
    throw "Returned evidence hash mismatch: $($entry.path)"
  }
}
[ordered]@{
  host = 'DANS1'
  runId = $runId
  sourceDigest = $sourceDigest
  archiveSha256 = $archiveHash
  remoteRoot = $remote
  remoteSource = $remote + '\source'
  localEvidence = Join-Path $stage 'output'
  remoteExit = $remoteExit
} | ConvertTo-Json -Depth 4
if ($remoteExit -ne 0) { exit $remoteExit }
