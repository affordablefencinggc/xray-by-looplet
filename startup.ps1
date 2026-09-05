$ErrorActionPreference = 'Stop'
node (Join-Path $PSScriptRoot 'scripts/industry-baseline-start.mjs')
exit $LASTEXITCODE
