param([switch]$ExecuteAfterQa)
$ErrorActionPreference='Stop'
if (-not $ExecuteAfterQa) { throw 'QA must be complete and root must explicitly authorize execution with -ExecuteAfterQa.' }
$release=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'release-38a64f0b8c2b'))
$launch=Get-Content -LiteralPath (Join-Path $release 'qa-launch.json') -Raw | ConvertFrom-Json
$expectedExe=[IO.Path]::GetFullPath((Join-Path $release 'artifacts\src-tauri\target\release\xray-by-looplet.exe'))
$expectedHash='14db2b026c8a8aaaf75c54f47be9405db0f5e81a1cb9ee455582d9646bfe72ca'
$output=Join-Path $release 'native-qa-close.json'
if (Test-Path -LiteralPath $output) { throw 'Existing close record preserved.' }
if ($launch.runId -ne '38a64f0b8c2b' -or $launch.pid -ne 78792 -or $launch.sha256 -ne $expectedHash) { throw 'Unexpected QA launch identity.' }
if (-not [string]::Equals([IO.Path]::GetFullPath($launch.exe),$expectedExe,[StringComparison]::OrdinalIgnoreCase)) { throw 'Launch executable outside the exact verified release.' }
$process=Get-Process -Id 78792 -ErrorAction Stop
if (-not [string]::Equals($process.Path,$expectedExe,[StringComparison]::OrdinalIgnoreCase)) { throw 'PID executable differs from the verified QA launch.' }
if ((Get-FileHash -LiteralPath $process.Path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expectedHash) { throw 'Executable bytes differ from verified artifact.' }
$accepted=$process.CloseMainWindow()
$exited=$process.WaitForExit(10000)
@{recordedAt=[DateTime]::UtcNow.ToString('o');runId=$launch.runId;pid=78792;exe=$expectedExe;sha256=$expectedHash;method='CloseMainWindow';requestAccepted=$accepted;exited=$exited;forcedTermination=$false} | ConvertTo-Json | Set-Content -LiteralPath $output -Encoding UTF8
Get-Content -LiteralPath $output
if (-not $exited) { throw 'Normal close did not finish; process preserved, no forced termination performed.' }
