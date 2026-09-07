$ErrorActionPreference='Stop'
$buildRun='C:\Users\danie\XRayBuilds\runs\2c7d6511ecf4'
if ($env:COMPUTERNAME -ne 'DANS1') { throw 'Dans1 only' }
[Diagnostics.Process]::GetCurrentProcess().PriorityClass='BelowNormal'
$env:PREVIEW_HOST='127.0.0.1'
$env:PREVIEW_PORT='8083'
$env:VITE_AUTH_ENABLED='false'
Set-Location -LiteralPath (Join-Path $buildRun 'source')
& (Join-Path $buildRun 'runtime\node.exe') scripts/preview-built.mjs
