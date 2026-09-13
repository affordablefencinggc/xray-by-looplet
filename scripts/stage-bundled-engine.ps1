# Build-time staging only. Dot-source to expose the function; no work at import.
function Invoke-VerifiedBundledEngineStage {
  param([Parameter(Mandatory=$true)][string]$PackageDir,[Parameter(Mandatory=$true)][string]$ExpectedSha256,[Parameter(Mandatory=$true)][string]$SourceRoot,[Parameter(Mandatory=$true)][string]$ProofPath)
  $ErrorActionPreference='Stop'
  if ($env:COMPUTERNAME -ne 'DANS1') { throw 'Bundled engine staging is restricted to DANS1.' }
  if ($ExpectedSha256 -cne 'e4693d8f2c84f125f87c316505866e23ea57aaf6e5bbc0315b0cc5360d09a49d') { throw 'Expected engine identity is not the qualified executable.' }
  function Assert-PlainPath([string]$Path) {
    $absolute=[IO.Path]::GetFullPath($Path)
    $cursor=$absolute
    while ($cursor) {
      if (Test-Path -LiteralPath $cursor) {
        if (((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Reparse paths are not allowed for engine staging.' }
      }
      $parent=Split-Path -Path $cursor -Parent
      if ($parent -eq $cursor) { break }
      $cursor=$parent
    }
    return $absolute
  }
  foreach ($candidate in @($PackageDir,$SourceRoot,$ProofPath)) {
    if (-not [IO.Path]::IsPathRooted($candidate) -or -not [IO.Path]::GetFullPath($candidate).StartsWith('C:\Users\danie\XRayBuilds\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Engine staging paths must remain inside XRayBuilds.' }
  }
  $package=Assert-PlainPath $PackageDir
  $source=Assert-PlainPath $SourceRoot
  if (-not (Test-Path -LiteralPath $package -PathType Container) -or -not (Test-Path -LiteralPath $source -PathType Container)) { throw 'Engine package/source directory missing.' }
  function Read-Record([string]$Name) {
    $path=Assert-PlainPath (Join-Path $package $Name)
    return (Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json)
  }
  $manifest=Read-Record 'source-manifest.json'
  if ($manifest -isnot [Array] -or $manifest.Count -eq 0) { throw 'Engine source manifest must be a nonempty array.' }
  $seen=[Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
  foreach ($entry in $manifest) {
    if ($entry.path -isnot [string] -or $entry.path -match '(^[/\\]|:|\\|(^|/)\.\.?(/|$)|//)' -or $entry.sha256 -cnotmatch '^[a-f0-9]{64}$') { throw 'Unsafe engine source manifest entry.' }
    if (-not $seen.Add($entry.path)) { throw 'Duplicate engine source manifest path.' }
    if ($entry.path -notlike 'engine/python/*' -and $entry.path -cne 'contracts/xray-job-bom-v1.schema.json') { throw 'Unexpected engine source manifest scope.' }
    foreach ($base in @((Join-Path $package 'source'),$source)) {
      $path=Assert-PlainPath (Join-Path $base $entry.path)
      if (-not $path.StartsWith([IO.Path]::GetFullPath($base).TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $path -PathType Leaf)) { throw 'Engine source path missing or outside snapshot.' }
      if ((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -cne $entry.sha256) { throw "Engine source identity mismatch: $($entry.path)" }
    }
  }
  foreach ($required in @('engine/python/xray/__main__.py','engine/python/xray/job_bom.py','engine/python/xray/bom_protocol.py','contracts/xray-job-bom-v1.schema.json')) { if (-not $seen.Contains($required)) { throw 'Engine source manifest is incomplete.' } }
  foreach ($base in @((Join-Path $package 'source'),$source)) {
    foreach ($file in Get-ChildItem -LiteralPath (Join-Path $base 'engine/python') -Recurse -File -Force) {
      if ($file.FullName -match '[\\/]__pycache__[\\/]|\.pyc$') { continue }
      $null=Assert-PlainPath $file.FullName
      $relative=$file.FullName.Substring([IO.Path]::GetFullPath($base).TrimEnd('\').Length+1).Replace('\','/')
      if (-not $seen.Contains($relative)) { throw 'Unmanifested engine source file.' }
    }
  }
  $build=Read-Record 'build-result.json'
  if ($null -eq $build.exitCode -or $build.exitCode -ne 0) { throw 'Engine build was not successful.' }
  $verdict=Read-Record 'fixture-verdict.json'
  $exe=Assert-PlainPath (Join-Path $package 'dist/xray-engine-verified.exe')
  if ([IO.Path]::GetFullPath($verdict.executable) -ne $exe -or $verdict.sha256 -cne $ExpectedSha256 -or (Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash.ToLowerInvariant() -cne $ExpectedSha256) { throw 'Qualified executable identity mismatch.' }
  if ($verdict.contractStatus.requestSchema -cne 'xray.job-to-bom/v1' -or $verdict.contractStatus.responseSchema -cne 'xray.bom/v1' -or $verdict.contractStatus.ruleset -cne 'fencing-v1' -or @($verdict.checks).Count -ne 6) { throw 'Engine contract qualification is incomplete.' }
  foreach ($name in @('colorbond','timber-paling','chain-wire','concrete-allowance','equal','full-bays-terminal-cut')) {
    $checks=@($verdict.checks | Where-Object {$_.fixture -ceq $name})
    if ($checks.Count -ne 1 -or $null -eq $checks[0].exitCode -or $checks[0].exitCode -ne 0) { throw 'Engine fixture failed or missing.' }
    if ($name -in @('equal','full-bays-terminal-cut')) {
      $sheets=if ($name -eq 'equal') {'13'} else {'14'}
      if ($checks[0].expectedSheets -cne $sheets -or $checks[0].actualSheets -cne $sheets) { throw 'Engine layout fixture mismatch.' }
    } elseif ($checks[0].exactFrozenResponseMatch -isnot [bool] -or -not $checks[0].exactFrozenResponseMatch) { throw 'Engine frozen response mismatch.' }
  }
  $parity=Read-Record 'parity.json'
  if ($parity.exactPythonTypeScriptResponseMatch -isnot [bool] -or -not $parity.exactPythonTypeScriptResponseMatch) { throw 'Engine parity qualification failed.' }
  $destination=Assert-PlainPath (Join-Path $source 'engine/bin/xray-engine.exe')
  $proof=Assert-PlainPath $ProofPath
  if (Test-Path -LiteralPath $destination) { throw 'Engine destination already exists; no overwrite allowed.' }
  if (Test-Path -LiteralPath $proof) { throw 'Engine staging proof already exists; no overwrite allowed.' }
  $null=New-Item -ItemType Directory -Path (Split-Path $destination -Parent) -Force
  [IO.File]::Copy($exe,$destination,$false)
  if ((Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant() -cne $ExpectedSha256) { throw 'Staged engine identity mismatch.' }
  $record=[ordered]@{computer=$env:COMPUTERNAME;package=$package;source=$source;destination=$destination;sha256=$ExpectedSha256;sourceManifestSha256=(Get-FileHash (Join-Path $package 'source-manifest.json')).Hash.ToLowerInvariant();fixtureVerdictSha256=(Get-FileHash (Join-Path $package 'fixture-verdict.json')).Hash.ToLowerInvariant();paritySha256=(Get-FileHash (Join-Path $package 'parity.json')).Hash.ToLowerInvariant();stagedAt=(Get-Date).ToUniversalTime().ToString('o')}
  $stream=[IO.File]::Open($proof,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
  try { $bytes=[Text.Encoding]::UTF8.GetBytes(($record|ConvertTo-Json -Depth 4));$stream.Write($bytes,0,$bytes.Length) } finally {$stream.Dispose()}
  return $ExpectedSha256
}
