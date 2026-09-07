$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
if ($env:COMPUTERNAME -ne 'DANS1') { throw 'Dans1 only' }
[Diagnostics.Process]::GetCurrentProcess().PriorityClass='BelowNormal'
$run='C:\Users\danie\XRayBuilds\runs\2c7d6511ecf4'
$incoming='C:\Users\danie\XRayBuilds\incoming\2c7d6511ecf4'
$source=Join-Path $run 'source'
$manifest=Get-Content -Raw -LiteralPath (Join-Path $incoming 'native-manifest.json') | ConvertFrom-Json
$archive=Join-Path $incoming 'native-source.tar'
if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne '9e85e6501cbe8e92b7f504ba1b9b41b3be8268059955e065a852a1f032b2f6d7') { throw 'Native archive hash mismatch' }
foreach ($name in (& tar -tf $archive)) { if ($name -match '(^[/\\]|:|(^|[/\\])\.\.([/\\]|$))') { throw 'Unsafe archive path' } }
if (Test-Path -LiteralPath (Join-Path $source 'src-tauri')) { throw 'Native source already extracted; do not overwrite an existing run' }
& tar -xf $archive -C $source
if ($LASTEXITCODE -ne 0) { throw 'Native extraction failed' }
$webManifest=Get-Content -Raw -LiteralPath (Join-Path $incoming 'source-manifest.json') | ConvertFrom-Json
foreach ($entry in @($manifest.entries)+@($webManifest.entries)) {
  $target=[IO.Path]::GetFullPath((Join-Path $source $entry.path))
  if (-not $target.StartsWith($source+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Manifest path outside source' }
  if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.sha256) { throw "Source hash mismatch: $($entry.path)" }
}
$env:CARGO_HOME='C:\Users\danie\XRayBuilds\toolchain\cargo'
$env:RUSTUP_HOME='C:\Users\danie\XRayBuilds\toolchain\rustup'
$env:CARGO_BUILD_JOBS='6'
$env:RAYON_NUM_THREADS='6'
$env:VITE_AUTH_ENABLED='false'
$env:PATH=(Join-Path $run 'runtime')+';'+(Join-Path $env:CARGO_HOME 'bin')+';'+$env:PATH
$env:npm_config_cache='C:\Users\danie\XRayBuilds\npm-cache'
Set-Location -LiteralPath $source
Write-Output "Verified $($manifest.entries.Count) native files plus $($webManifest.entries.Count) web files. Building NSIS installer on Dans1."
$started=Get-Date
$node=Join-Path $run 'runtime\node.exe'
$npm=Join-Path $run 'runtime\node_modules\npm\bin\npm-cli.js'
$child=Start-Process -FilePath $node -ArgumentList @($npm,'run','tauri:build','--','--bundles','nsis') -WorkingDirectory $source -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $run 'native-build.stdout.log') -RedirectStandardError (Join-Path $run 'native-build.stderr.log')
$handle=$child.Handle
$child.PriorityClass='BelowNormal'
$child.WaitForExit()
$result=@{computer=$env:COMPUTERNAME;exitCode=$child.ExitCode;seconds=((Get-Date)-$started).TotalSeconds;priority='BelowNormal';cargoJobs=6;rayonWorkers=6;webSourceSha256='2c7d6511ecf4eeec351da3ed35253115f2cdb1f2677c684121b3186f91a1fc34';nativeSourceSha256=$manifest.archiveSha256}
Write-Output ($result | ConvertTo-Json -Compress)
if ($child.ExitCode -ne 0) { throw 'Native build failed; logs retained' }
$targets=@((Join-Path $source 'src-tauri\target\release\xray-by-looplet.exe'))+@(Get-ChildItem -LiteralPath (Join-Path $source 'src-tauri\target\release\bundle\nsis') -File | Select-Object -ExpandProperty FullName)
$result.artifacts=@($targets | ForEach-Object { @{path=$_;sha256=(Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash.ToLowerInvariant();bytes=(Get-Item -LiteralPath $_).Length} })
$result | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $run 'native-completion.json') -Encoding UTF8
Write-Output 'Dans1 native installer complete.'
