param(
  [Parameter(Mandatory=$true)][ValidateSet('tests','web','dev','preview')][string]$Stage,
  [Parameter(Mandatory=$true)][string]$Output
)
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
if ($env:COMPUTERNAME -ne 'DANIELS') { throw 'Recovery runner is restricted to DANIELS.' }
$workspace=(Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$outputFull=[IO.Path]::GetFullPath($Output)
if (-not $outputFull.StartsWith($PSScriptRoot+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Output must be inside this campaign.' }
if (Test-Path -LiteralPath $outputFull) { throw 'Prior evidence must be preserved.' }
New-Item -ItemType Directory -Path $outputFull | Out-Null
# Apply an aggregate Windows Job CPU hard cap before any Node child is created.
Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
public static class RecoveryCpuCap {
  [StructLayout(LayoutKind.Sequential)] public struct Rate { public uint Flags; public uint CpuRate; }
  [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr attr, string name);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job, int info, ref Rate rate, uint length);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool QueryInformationJobObject(IntPtr job, int info, out Rate rate, uint length, out uint returned);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool IsProcessInJob(IntPtr process, IntPtr job, out bool result);
  [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
  public static IntPtr Handle;
  public static Rate Apply() {
    Handle=CreateJobObject(IntPtr.Zero,null);
    if(Handle==IntPtr.Zero) throw new Win32Exception();
    var rate=new Rate { Flags=5, CpuRate=2000 };
    if(!SetInformationJobObject(Handle,15,ref rate,8)) throw new Win32Exception();
    if(!AssignProcessToJobObject(Handle,GetCurrentProcess())) throw new Win32Exception();
    Rate actual; uint returned;
    if(!QueryInformationJobObject(Handle,15,out actual,8,out returned)) throw new Win32Exception();
    if(!Contains(GetCurrentProcess()) || actual.Flags!=5 || actual.CpuRate!=2000) throw new Exception("CPU cap verification failed");
    return actual;
  }
  public static bool Contains(IntPtr process) {
    bool member;
    if(!IsProcessInJob(process,Handle,out member)) throw new Win32Exception();
    return member;
  }
}
'@
$cap=[RecoveryCpuCap]::Apply()
[Diagnostics.Process]::GetCurrentProcess().PriorityClass='BelowNormal'
# Do not pass provider credentials, database URLs or injected Node options to recovered code.
Get-ChildItem Env: | Where-Object {$_.Name -match 'SECRET|TOKEN|PASSWORD|API_KEY|DATABASE_URL|PGPASSWORD|NODE_OPTIONS'} | ForEach-Object { Remove-Item ('Env:'+ $_.Name) }
# Build flags belong to build/serve stages only: the test suite asserts the default
# (auth-enabled) environment, so 'tests' must run without VITE_AUTH_ENABLED set.
switch ($Stage) {
  'tests' {
    foreach ($n in 'VITE_AUTH_ENABLED','VITE_XRAY_BUILD_ID','PREVIEW_HOST','PREVIEW_PORT','VITE_DEV_HOST') {
      if (Test-Path ("Env:$n")) { Remove-Item ("Env:$n") }
    }
  }
  'web' { $env:VITE_AUTH_ENABLED='false'; $env:VITE_XRAY_BUILD_ID='recovery-69a2b5b9-main-75bd12b5' }
  'dev' {
    foreach ($n in 'VITE_AUTH_ENABLED','VITE_XRAY_BUILD_ID','PREVIEW_HOST','PREVIEW_PORT') {
      if (Test-Path ("Env:$n")) { Remove-Item ("Env:$n") }
    }
    $env:VITE_DEV_HOST='127.0.0.1'
  }
  'preview' { $env:VITE_AUTH_ENABLED='false'; $env:VITE_XRAY_BUILD_ID='recovery-69a2b5b9-main-75bd12b5'; $env:PREVIEW_HOST='127.0.0.1'; $env:PREVIEW_PORT='8181' }
}
$env:RAYON_NUM_THREADS='4'
$env:UV_THREADPOOL_SIZE='4'
$node=(Get-Command node.exe).Source
$npm=Join-Path (Split-Path $node -Parent) 'node_modules/npm/bin/npm-cli.js'
$self=Get-CimInstance Win32_Process -Filter "ProcessId=$PID"
$record=[ordered]@{host=$env:COMPUTERNAME;stage=$Stage;ownerPid=$PID;creationTime=$self.CreationDate.ToUniversalTime().ToString('o');executable=$self.ExecutablePath;command=$self.CommandLine;purpose='Isolated recovery verification';lastTaskActivity=[DateTime]::UtcNow.ToString('o');jobCpuRate=$cap.CpuRate;jobFlags=$cap.Flags;aggregateCpuCapPercent=20;appliedBeforeChildren=$true}
$arguments=switch($Stage) {
  'tests' { @('scripts/run-src-tests.mjs') }
  'web' { @('scripts/with-app-env.mjs',('"'+$node+'"'),'node_modules/vite/bin/vite.js','build') }
  'dev' { @(('"'+$npm+'"'),'run','dev','--','--host','127.0.0.1','--port','8180') }
  'preview' { @('scripts/with-app-env.mjs',('"'+$node+'"'),'scripts/preview-built.mjs') }
}
Set-Location -LiteralPath $workspace
$child=Start-Process -FilePath $node -ArgumentList $arguments -WorkingDirectory $workspace -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $outputFull 'stdout.log') -RedirectStandardError (Join-Path $outputFull 'stderr.log')
$handle=$child.Handle
if (-not [RecoveryCpuCap]::Contains($handle)) { throw 'Child did not inherit CPU cap.' }
$record.childPid=$child.Id
$record.childStartedAt=$child.StartTime.ToUniversalTime().ToString('o')
$record | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $outputFull 'resources.json') -Encoding UTF8
$child.WaitForExit()
$record.exitCode=$child.ExitCode
$record.completedAt=[DateTime]::UtcNow.ToString('o')
$record.lastTaskActivity=$record.completedAt
$record | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $outputFull 'resources.json') -Encoding UTF8
exit $child.ExitCode
