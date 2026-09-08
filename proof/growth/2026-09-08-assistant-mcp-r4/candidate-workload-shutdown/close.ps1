$ErrorActionPreference = 'Stop'
$proofBase = (Resolve-Path -LiteralPath 'proof/growth/2026-09-08-assistant-mcp-r4/candidate-workload-shutdown').Path
$launch = Get-Content -LiteralPath (Join-Path $proofBase 'launch.json') -Raw | ConvertFrom-Json
$process = Get-Process -Id $launch.pid -ErrorAction Stop
if ($process.Path -ne $launch.exe) { throw 'Owned process executable mismatch' }
$verifiedHash = (Get-FileHash -LiteralPath $launch.exe -Algorithm SHA256).Hash.ToLowerInvariant()
if ($verifiedHash -ne $launch.sha256) { throw 'Owned executable hash mismatch' }
$process.Refresh()
if ($process.MainWindowHandle -eq 0) { throw 'Owned candidate has no main window to close' }
$beforeChildren = @(Get-CimInstance Win32_Process -Filter "ParentProcessId=$($launch.pid)" | Select-Object ProcessId,ParentProcessId,Name)
$before = @{ at = [DateTime]::UtcNow.ToString('o'); pid = $process.Id; hwnd = $process.MainWindowHandle.ToInt64(); title = $process.MainWindowTitle; startedAt = $process.StartTime.ToUniversalTime().ToString('o'); childProcesses = $beforeChildren }
$accepted = $process.CloseMainWindow()
$exited = $process.WaitForExit(15000)
$remaining = Get-Process -Id $launch.pid -ErrorAction SilentlyContinue
$afterChildren = @(Get-CimInstance Win32_Process -Filter "ParentProcessId=$($launch.pid)" | Select-Object ProcessId,ParentProcessId,Name)
$result = @{ runId = $launch.runId; exe = $launch.exe; sha256 = $verifiedHash; profile = $launch.profile; cdpPort = $launch.cdpPort; method = 'CloseMainWindow'; requestAccepted = $accepted; waitTimeoutMilliseconds = 15000; exited = $exited; processStillExists = [bool]$remaining; remainingHwnd = $(if ($remaining) { $remaining.Refresh(); $remaining.MainWindowHandle.ToInt64() } else { $null }); remainingChildProcesses = $afterChildren; exitCode = $(if ($exited) { $process.ExitCode } else { $null }); before = $before; checkedAt = [DateTime]::UtcNow.ToString('o'); forcedTermination = $false; workload = 'Native status 11, desktop model controls 34, native design persistence 52 commands in original order; no viewport emulation.' }
$output = Join-Path $proofBase 'normal-close.json'
if (Test-Path -LiteralPath $output) { throw 'Preserve prior close evidence' }
[System.IO.File]::WriteAllText($output, ($result | ConvertTo-Json -Depth 6), [System.Text.UTF8Encoding]::new($false))
$result | ConvertTo-Json -Depth 6
