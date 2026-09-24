param(
  [Parameter(Mandatory=$true)][ValidateSet('source','web','native')][string]$Stage,
  [Parameter(Mandatory=$true)][string]$Output
)
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
if ($env:COMPUTERNAME -ne 'DANIEL') { throw 'This explicitly authorized campaign is restricted to DANIEL.' }
$workspace=(Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$outputFull=[IO.Path]::GetFullPath($Output)
if (-not $outputFull.StartsWith($PSScriptRoot+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Output must be inside this proof campaign.' }
if (Test-Path -LiteralPath $outputFull) { throw 'Prior output must be preserved.' }
New-Item -ItemType Directory -Path $outputFull | Out-Null

# Apply to this worker before spawning any build child; descendants inherit it.
# Same Windows hard-cap mechanism as the previously executed assistant-repair build.
Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
public static class LocalCloseoutCpuCap {
  [StructLayout(LayoutKind.Sequential)] public struct Rate { public uint Flags; public uint CpuRate; }
  [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr attr, string name);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job, int info, ref Rate rate, uint length);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool QueryInformationJobObject(IntPtr job, int info, out Rate rate, uint length, out uint returned);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool IsProcessInJob(IntPtr process, IntPtr job, out bool result);
  [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
  public static IntPtr Handle;
  public static Rate ApplyAndVerify() {
    Handle = CreateJobObject(IntPtr.Zero, null);
    if (Handle == IntPtr.Zero) throw new Win32Exception();
    var rate = new Rate { Flags = 5, CpuRate = 2000 };
    if (!SetInformationJobObject(Handle, 15, ref rate, 8)) throw new Win32Exception();
    if (!AssignProcessToJobObject(Handle, GetCurrentProcess())) throw new Win32Exception();
    Rate actual; uint returned; bool member;
    if (!QueryInformationJobObject(Handle, 15, out actual, 8, out returned)) throw new Win32Exception();
    if (!IsProcessInJob(GetCurrentProcess(), Handle, out member)) throw new Win32Exception();
    if (!member || actual.Flags != 5 || actual.CpuRate != 2000) throw new Exception("CPU hard-cap verification failed");
    return actual;
  }
  public static bool Contains(IntPtr process) {
    bool member;
    if (!IsProcessInJob(process, Handle, out member)) throw new Win32Exception();
    return member;
  }
}
'@
$cap=[LocalCloseoutCpuCap]::ApplyAndVerify()
[Diagnostics.Process]::GetCurrentProcess().PriorityClass='BelowNormal'
$env:RAYON_NUM_THREADS='4'
$env:CARGO_BUILD_JOBS='4'
$env:VITE_AUTH_ENABLED=if ($Stage -eq 'source') { $null } else { 'false' }
$env:VITE_XRAY_BUILD_ID='local-e74e67d4-20260924'
$env:DATABASE_URL=$null
$self=Get-CimInstance Win32_Process -Filter "ProcessId=$PID"
$resource=[ordered]@{host=$env:COMPUTERNAME;stage=$Stage;ownerPid=$PID;creationTime=$self.CreationDate.ToUniversalTime().ToString('o');executable=$self.ExecutablePath;command=$self.CommandLine;purpose='Authorized local final-build qualification';lastTaskActivity=[DateTime]::UtcNow.ToString('o');jobCpuRate=$cap.CpuRate;jobFlags=$cap.Flags;aggregateCpuCapPercent=20;priority='BelowNormal';appliedBeforeChildren=$true}
$resource | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $outputFull 'resources.json') -Encoding UTF8
$node=(Get-Command node.exe).Source
$npm=Join-Path (Split-Path $node -Parent) 'node_modules/npm/bin/npm-cli.js'
$results=[Collections.Generic.List[object]]::new()
function Step([string]$Name,[string[]]$Arguments) {
  $started=[DateTime]::UtcNow
  $child=Start-Process -FilePath $node -ArgumentList $Arguments -WorkingDirectory $workspace -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $outputFull "$Name.stdout.log") -RedirectStandardError (Join-Path $outputFull "$Name.stderr.log")
  $handle=$child.Handle
  if (-not [LocalCloseoutCpuCap]::Contains($handle)) { throw 'Child did not inherit aggregate CPU cap.' }
  $child.WaitForExit()
  $record=[ordered]@{name=$Name;exitCode=$child.ExitCode;startedAt=$started.ToString('o');completedAt=[DateTime]::UtcNow.ToString('o');pid=$child.Id;inCappedJob=$true}
  $results.Add($record)
  @($results) | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $outputFull 'results.json') -Encoding UTF8
  Write-Output ($record | ConvertTo-Json -Compress)
  if ($child.ExitCode -ne 0) { throw "$Name failed; preserved output: $outputFull" }
}
Set-Location $workspace
Step 'identity-before' @('proof/growth/2026-09-24-local-closeout/source-identity.mjs','verify')
if ($Stage -eq 'source') {
  Step 'typecheck' @($npm,'run','typecheck')
  Step 'source-tests' @($npm,'run','test:src')
} elseif ($Stage -eq 'web') {
  Step 'web-build' @($npm,'run','build')
} else {
  $expected='e4693d8f2c84f125f87c316505866e23ea57aaf6e5bbc0315b0cc5360d09a49d'
  if ((Get-FileHash -LiteralPath (Join-Path $workspace 'engine/bin/xray-engine.exe')).Hash.ToLowerInvariant() -cne $expected) { throw 'Qualified bundled engine must be staged before native build.' }
  $env:XRAY_BUNDLED_ENGINE_SHA256=$expected
  Step 'native-build' @($npm,'run','tauri:build','--','--bundles','nsis')
}
Step 'identity-after' @('proof/growth/2026-09-24-local-closeout/source-identity.mjs','verify')
$resource.lastTaskActivity=[DateTime]::UtcNow.ToString('o')
$resource['completedAt']=$resource.lastTaskActivity
$resource | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $outputFull 'resources.json') -Encoding UTF8
