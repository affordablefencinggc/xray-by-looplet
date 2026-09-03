<#
.SYNOPSIS
  X-Ray by Looplet Autopilot Runner
.DESCRIPTION
  Automatically executes tasks from XRAY-TOPDOWN-MINDMAP-TODO.md step by step.
  Clears session after each step, applies the work prompt, submits, and loops through the list.
.EXAMPLE
  .\autopilot.ps1
  .\autopilot.ps1 -Runner codex
  .\autopilot.ps1 -DryRun
  .\autopilot.ps1 -Task XR-UI-ENH-01
#>
param(
  [string]$Runner = "gemini",
  [string]$Model = "",
  [string]$Task = "",
  [int]$Max = 0,
  [switch]$DryRun
)

$argsList = @("scripts/autopilot.mjs", "--runner=$Runner")

if ($Model) {
  $argsList += "--model=$Model"
}
if ($Task) {
  $argsList += "--task=$Task"
}
if ($Max -gt 0) {
  $argsList += "--max=$Max"
}
if ($DryRun) {
  $argsList += "--dry-run"
}

node $argsList
