param(
  [ValidatePattern('^[a-f0-9]{12}$')][string]$RunId='6e8adc3db8cc',
  [ValidatePattern('^[a-f0-9]{64}$')][string]$SourceHash='6e8adc3db8ccf667cf32b4052042cdc9261580a31a7dd7e40e667f137fa8f34a',
  [ValidatePattern('^[a-f0-9]{64}$')][string]$RuntimeHash='8e87b113f36b78dbd615e00cbd64cbdcef3376d2c0280e5a347c969505105e64',
  [switch]$Resume,
  [switch]$BuildOnly
)
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
if ($env:COMPUTERNAME -ne 'DANS1') { throw 'This build runner is restricted to Dans1.' }
[Diagnostics.Process]::GetCurrentProcess().PriorityClass='BelowNormal'
$buildRoot='C:\Users\danie\XRayBuilds'
$incoming=Join-Path $buildRoot "incoming\$RunId"
$run=Join-Path $buildRoot "runs\$RunId"
$runtime=Join-Path $run 'runtime'
$source=Join-Path $run 'source'
if ((Test-Path -LiteralPath $run) -and -not $Resume) { throw 'Run directory already exists. Previous work will not be overwritten.' }
foreach ($pair in @(@('source.tar',$SourceHash),@('node-runtime.tar',$RuntimeHash))) {
  $archive=Join-Path $incoming $pair[0]
  if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $pair[1]) { throw "Archive hash mismatch: $($pair[0])" }
  $names=& tar -tf $archive
  if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect archive.' }
  foreach ($name in $names) { if ($name -match '(^[/\\]|:|(^|[/\\])\.\.([/\\]|$))') { throw 'Unsafe archive path.' } }
}
if (-not $Resume) {
  New-Item -ItemType Directory -Path $runtime,$source | Out-Null
  & tar -xf (Join-Path $incoming 'node-runtime.tar') -C $runtime
  if ($LASTEXITCODE -ne 0) { throw 'Runtime extraction failed.' }
  & tar -xf (Join-Path $incoming 'source.tar') -C $source
  if ($LASTEXITCODE -ne 0) { throw 'Source extraction failed.' }
}
$manifest=Get-Content -LiteralPath (Join-Path $incoming 'source-manifest.json') -Raw | ConvertFrom-Json
foreach ($entry in $manifest.entries) {
  $target=[IO.Path]::GetFullPath((Join-Path $source $entry.path))
  if (-not $target.StartsWith($source+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Manifest path escapes the build snapshot.' }
  if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.sha256) { throw "Source mismatch: $($entry.path)" }
}
$env:PATH=$runtime+';'+$env:PATH
$env:RAYON_NUM_THREADS='6'
# Match this workspace's public .grok/app-env.json without transferring secrets.
$env:VITE_AUTH_ENABLED='false'
$env:npm_config_cache=Join-Path $buildRoot 'npm-cache'
$node=Join-Path $runtime 'node.exe'
$npmCli=Join-Path $runtime 'node_modules\npm\bin\npm-cli.js'
$results=[Collections.Generic.List[object]]::new()
function Invoke-BuildStep([string]$Name,[string[]]$Arguments) {
  $started=Get-Date
  $child=Start-Process -FilePath $node -ArgumentList (@($npmCli)+$Arguments) -WorkingDirectory $source -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $run "$Name.stdout.log") -RedirectStandardError (Join-Path $run "$Name.stderr.log")
  # Retain the process handle before waiting: WinPS otherwise may report a null exit code.
  $childHandle=$child.Handle
  $child.PriorityClass='BelowNormal'
  $observedPriority=$child.PriorityClass.ToString()
  $child.WaitForExit()
  $result=[pscustomobject]@{step=$Name;exitCode=$child.ExitCode;seconds=((Get-Date)-$started).TotalSeconds;priority=$observedPriority;rayonWorkers=6}
  $results.Add($result)
  $results | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $run 'results.json') -Encoding UTF8
  Write-Output ($result | ConvertTo-Json -Compress)
  if ($child.ExitCode -ne 0) { throw "$Name failed. Logs preserved in $run" }
}
Write-Output "Verified $($manifest.entries.Count) source files on Dans1. Node: $(& $node --version)"
if (-not $BuildOnly) {
  Invoke-BuildStep 'dependencies' @('ci','--ignore-scripts','--no-audit','--no-fund')
  Invoke-BuildStep 'typecheck' @('run','typecheck')
}
Invoke-BuildStep 'web-build' @('run','build')
$artifacts=Get-ChildItem -LiteralPath (Join-Path $source '.vercel\output\static\assets') -File | ForEach-Object { [pscustomobject]@{name=$_.Name;bytes=$_.Length;sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()} }
[pscustomobject]@{computer=$env:COMPUTERNAME;run=$run;sourceSha256=$SourceHash;sourceFiles=$manifest.entries.Count;buildEnvironment=@{VITE_AUTH_ENABLED=$env:VITE_AUTH_ENABLED;RAYON_NUM_THREADS=$env:RAYON_NUM_THREADS};results=$results;artifacts=$artifacts} | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $run 'completion.json') -Encoding UTF8
Write-Output 'Dans1 web build completed; no deployment or CRM changes performed.'
