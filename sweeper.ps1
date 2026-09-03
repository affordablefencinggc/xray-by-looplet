<#
.SYNOPSIS
  X-Ray by Looplet Verification Sweeper
.DESCRIPTION
  Sweeps behind the autopilot to inspect git state, syntax, imports, stubs,
  TODO matrix status, FastMCP tools, and dev server health.
.EXAMPLE
  .\sweeper.ps1
  .\sweeper.ps1 -Watch
#>
param(
  [switch]$Watch
)

$argsList = @("scripts/sweeper.mjs")
if ($Watch) {
  $argsList += "--watch"
}

node $argsList
