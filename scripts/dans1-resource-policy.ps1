$ErrorActionPreference = 'Stop'
if ($env:COMPUTERNAME -ne 'DANS1') { throw 'Dedicated resource policy is restricted to Dans1.' }
$dansMachine = Get-CimInstance Win32_ComputerSystem
$dansWorkers = [int]$dansMachine.NumberOfLogicalProcessors
if ($dansWorkers -lt 1) { throw 'Cannot determine CPU capacity.' }
if (-not ('DansBuildPriorityJob' -as [type])) {
Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
public static class DansBuildPriorityJob {
  [StructLayout(LayoutKind.Sequential)] struct Limits {
    public long ProcessTime, JobTime;
    public uint Flags;
    public UIntPtr MinimumWorkingSet, MaximumWorkingSet;
    public uint ActiveProcesses;
    public UIntPtr Affinity;
    public uint PriorityClass, SchedulingClass;
  }
  [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr attrs, string name);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job, int info, ref Limits limits, uint size);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
  [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
  public static IntPtr Handle;
  public static void Apply() {
    if (Handle != IntPtr.Zero) return;
    var job = CreateJobObject(IntPtr.Zero, null);
    if (job == IntPtr.Zero) throw new Win32Exception();
    // HIGH_PRIORITY_CLASS for this worker and descendants; no kill-on-close.
    var limits = new Limits { Flags = 0x20, PriorityClass = 0x80 };
    if (!SetInformationJobObject(job, 2, ref limits, (uint)Marshal.SizeOf(typeof(Limits)))) throw new Win32Exception();
    if (!AssignProcessToJobObject(job, GetCurrentProcess())) throw new Win32Exception();
    Handle = job;
  }
}
'@
}
[DansBuildPriorityJob]::Apply()
[Diagnostics.Process]::GetCurrentProcess().PriorityClass = 'High'
$env:XRAY_BUILD_PROFILE = 'dedicated'
$env:RAYON_NUM_THREADS = [string]$dansWorkers
$env:CARGO_BUILD_JOBS = [string]$dansWorkers
$env:CMAKE_BUILD_PARALLEL_LEVEL = [string]$dansWorkers
$env:UV_THREADPOOL_SIZE = [string]$dansWorkers
$dansResourcePolicy = [pscustomobject]@{
  computer = $env:COMPUTERNAME
  priority = [Diagnostics.Process]::GetCurrentProcess().PriorityClass.ToString()
  logicalProcessors = $dansWorkers
  rayonWorkers = $dansWorkers
  cargoJobs = $dansWorkers
  memoryGiB = [math]::Round($dansMachine.TotalPhysicalMemory / 1GB, 1)
  profile = $env:XRAY_BUILD_PROFILE
  localAssistance = 'Only if needed; cap background build workers to at most 20% aggregate CPU before launching.'
  updatedAt = [DateTime]::UtcNow.ToString('o')
}
$dansResourcePolicy | ConvertTo-Json | Set-Content -LiteralPath 'C:\Users\danie\XRayBuilds\resource-policy.json' -Encoding UTF8
