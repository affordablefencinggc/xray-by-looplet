param(
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{12}$')][string]$RunId,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$SourceHash,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$RuntimeHash,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$NativeHash
)
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
if ($env:COMPUTERNAME -ne 'DANS1') { throw 'This worker is restricted to Dans1.' }
. 'C:\Users\danie\XRayBuilds\dans1-resource-policy.ps1'
if ($dansWorkers -ne 16) { throw 'This release requires the approved 16-worker policy.' }
$buildRoot='C:\Users\danie\XRayBuilds'
$incoming=Join-Path $buildRoot "incoming\$RunId"
$run=Join-Path $buildRoot "runs\$RunId"
$runtime=Join-Path $run 'runtime'
$source=Join-Path $run 'source'
if (Test-Path -LiteralPath $run) { throw 'Run already exists; prior runs are preserved.' }
foreach ($pair in @(@('source.tar',$SourceHash),@('node-runtime.tar',$RuntimeHash),@('native-source.tar',$NativeHash))) {
  $archive=Join-Path $incoming $pair[0]
  if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $pair[1]) { throw "Archive hash mismatch: $($pair[0])" }
  $names=& tar -tf $archive
  if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect archive.' }
  foreach ($name in $names) { if ($name -match '(^[/\\]|:|(^|[/\\])\.\.([/\\]|$))') { throw 'Unsafe archive path.' } }
}
New-Item -ItemType Directory -Path $runtime,$source | Out-Null
& tar -xf (Join-Path $incoming 'node-runtime.tar') -C $runtime
if ($LASTEXITCODE -ne 0) { throw 'Runtime extraction failed.' }
& tar -xf (Join-Path $incoming 'source.tar') -C $source
if ($LASTEXITCODE -ne 0) { throw 'Web source extraction failed.' }
$webManifest=Get-Content -LiteralPath (Join-Path $incoming 'source-manifest.json') -Raw | ConvertFrom-Json
$nativeManifest=Get-Content -LiteralPath (Join-Path $incoming 'native-manifest.json') -Raw | ConvertFrom-Json
if ($nativeManifest.archiveSha256 -ne $NativeHash) { throw 'Native manifest/archive identity mismatch.' }
foreach ($entry in $nativeManifest.entries) {
  $target=[IO.Path]::GetFullPath((Join-Path $source $entry.path))
  if (-not $target.StartsWith($source+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Native path outside source snapshot.' }
  if (Test-Path -LiteralPath $target) { throw "Native snapshot would overwrite web source: $($entry.path)" }
}
& tar -xf (Join-Path $incoming 'native-source.tar') -C $source
if ($LASTEXITCODE -ne 0) { throw 'Native source extraction failed.' }
function Verify-Sources {
  foreach ($entry in @($webManifest.entries)+@($nativeManifest.entries)) {
    $target=[IO.Path]::GetFullPath((Join-Path $source $entry.path))
    if (-not $target.StartsWith($source+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Manifest path outside source.' }
    if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.sha256) { throw "Source mismatch: $($entry.path)" }
  }
}
Verify-Sources
$env:PATH=$runtime+';'+$env:PATH
$env:RAYON_NUM_THREADS=[string]$dansWorkers
$env:CARGO_BUILD_JOBS=[string]$dansWorkers
$env:VITE_AUTH_ENABLED='false'
$env:VITE_XRAY_BUILD_ID=$RunId
$env:npm_config_cache=Join-Path $buildRoot 'npm-cache'
$env:CARGO_HOME=Join-Path $buildRoot 'toolchain\cargo'
$env:RUSTUP_HOME=Join-Path $buildRoot 'toolchain\rustup'
$env:PATH=(Join-Path $env:CARGO_HOME 'bin')+';'+$env:PATH
$node=Join-Path $runtime 'node.exe'
$npmCli=Join-Path $runtime 'node_modules\npm\bin\npm-cli.js'
$results=[Collections.Generic.List[object]]::new()
function Invoke-Step([string]$Name,[string[]]$Arguments) {
  $started=Get-Date
  $child=Start-Process -FilePath $node -ArgumentList $Arguments -WorkingDirectory $source -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $run "$Name.stdout.log") -RedirectStandardError (Join-Path $run "$Name.stderr.log")
  $childHandle=$child.Handle
  $child.PriorityClass='High'
  $observedPriority=$child.PriorityClass.ToString()
  $child.WaitForExit()
  $result=[pscustomobject]@{step=$Name;exitCode=$child.ExitCode;seconds=((Get-Date)-$started).TotalSeconds;priority=$observedPriority;rayonWorkers=$dansWorkers;cargoJobs=$dansWorkers}
  $results.Add($result)
  $results | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $run 'results.json') -Encoding UTF8
  Write-Output ($result | ConvertTo-Json -Compress)
  if ($child.ExitCode -ne 0) { throw "$Name failed. Logs preserved in $run" }
}
Write-Output "Verified $($webManifest.entries.Count) web and $($nativeManifest.entries.Count) native files. Node: $(& $node --version)"
Invoke-Step 'dependencies' @($npmCli,'ci','--ignore-scripts','--no-audit','--no-fund')
Invoke-Step 'typecheck' @($npmCli,'run','typecheck')
Invoke-Step 'focused-tests' @('--experimental-strip-types','--test',
  'src/studio/projectRecoveryStore.test.ts','src/studio/architect/authoredSheetSet.test.ts',
  'src/studio/cleanWalkPlan.test.ts','src/studio/FirstPersonArm.test.ts','src/studio/walkCollision.test.ts','src/studio/WalkDoors.test.ts','src/studio/sourceWalkDoors.test.ts','src/studio/FirstPersonNavigation.test.ts','src/studio/walkStartPlacement.test.ts','src/studio/domain.test.ts','src/studio/persistence.test.ts','src/studio/documents.test.ts','src/studio/documentPreview.test.ts','src/studio/projectBackup.test.ts','src/studio/backupRestorePreflight.test.ts','src/studio/sheetLifecycle.test.ts','src/studio/sheetBookmarks.test.ts','src/studio/evidenceStore.test.ts','src/studio/pricing/priceBooks.test.ts','src/studio/pricing/priceWorkbook.test.ts')
Verify-Sources
Invoke-Step 'web-build' @($npmCli,'run','build')
$artifacts=Get-ChildItem -LiteralPath (Join-Path $source '.vercel\output\static\assets') -File | ForEach-Object { [pscustomobject]@{name=$_.Name;bytes=$_.Length;sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()} }
[pscustomobject]@{computer=$env:COMPUTERNAME;run=$run;sourceSha256=$SourceHash;nativeSourceSha256=$NativeHash;sourceFiles=$webManifest.entries.Count;nativeFiles=$nativeManifest.entries.Count;buildEnvironment=@{VITE_XRAY_BUILD_ID=$env:VITE_XRAY_BUILD_ID;VITE_AUTH_ENABLED=$env:VITE_AUTH_ENABLED;RAYON_NUM_THREADS=$env:RAYON_NUM_THREADS};results=$results;artifacts=$artifacts} | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $run 'completion.json') -Encoding UTF8
Write-Output 'WEB_READY: production output available for browser QA; native build follows sequentially.'
Verify-Sources
$cacheRun=Join-Path $buildRoot 'runs\38a64f0b8c2b'
$cacheRecord=Get-Content -LiteralPath (Join-Path $cacheRun 'native-completion.json') -Raw | ConvertFrom-Json
if (($cacheRecord.results | Where-Object {$_.step -eq 'native-build'}).exitCode -ne 0 -or $cacheRecord.computer -ne 'DANS1' -or $cacheRecord.nativeSourceSha256 -ne $NativeHash) { throw 'Prior compiled cache has a different native source identity.' }
$cacheSource=[IO.Path]::GetFullPath((Join-Path $cacheRun 'source\src-tauri\target'))
$cacheTarget=[IO.Path]::GetFullPath((Join-Path $source 'src-tauri\target'))
if (-not $cacheSource.StartsWith($cacheRun+'\',[StringComparison]::OrdinalIgnoreCase) -or -not $cacheTarget.StartsWith($source+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Cache path outside isolated run.' }
if (-not (Test-Path -LiteralPath $cacheSource) -or (Test-Path -LiteralPath $cacheTarget)) { throw 'Cache copy requires existing prior target and absent new target.' }
$cacheExe=Join-Path $cacheSource 'release\xray-by-looplet.exe'
if ((Get-FileHash -LiteralPath $cacheExe -Algorithm SHA256).Hash.ToLowerInvariant() -ne '14db2b026c8a8aaaf75c54f47be9405db0f5e81a1cb9ee455582d9646bfe72ca') { throw 'Prior successful executable identity mismatch.' }
$cacheLog=Join-Path $run 'cargo-cache-copy.log'
& robocopy $cacheSource $cacheTarget /E /COPY:DAT /DCOPY:DAT /R:1 /W:1 /NP /NFL /NDL /XJ "/LOG:$cacheLog"
$cacheCopyExit=$LASTEXITCODE
if ($cacheCopyExit -ge 8) { throw 'Cargo cache copy failed; prior target preserved.' }
@{source=$cacheSource;destination=$cacheTarget;nativeSourceSha256=$NativeHash;sourceExecutableSha256='14db2b026c8a8aaaf75c54f47be9405db0f5e81a1cb9ee455582d9646bfe72ca';copyExitCode=$cacheCopyExit;mode='copy into independent target; Cargo must rebuild current application'} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $run 'cargo-cache.json') -Encoding UTF8
Invoke-Step 'native-build' @($npmCli,'run','tauri:build','--','--bundles','nsis')
$targets=@((Join-Path $source 'src-tauri\target\release\xray-by-looplet.exe'))+@(Get-ChildItem -LiteralPath (Join-Path $source 'src-tauri\target\release\bundle\nsis') -File | Select-Object -ExpandProperty FullName)
$nativeArtifacts=@($targets | ForEach-Object { @{path=$_;sha256=(Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash.ToLowerInvariant();bytes=(Get-Item -LiteralPath $_).Length} })
$nativeResult=@{buildEnvironment=@{VITE_XRAY_BUILD_ID=$env:VITE_XRAY_BUILD_ID;RAYON_NUM_THREADS=$env:RAYON_NUM_THREADS;CARGO_BUILD_JOBS=$env:CARGO_BUILD_JOBS};computer=$env:COMPUTERNAME;run=$run;sourceSha256=$SourceHash;nativeSourceSha256=$NativeHash;results=$results;artifacts=$nativeArtifacts}
$nativeResult | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $run 'native-completion.json') -Encoding UTF8
Verify-Sources
Write-Output 'BUILD_COMPLETE: web and NSIS artifacts verified; no deployment or installation performed.'
