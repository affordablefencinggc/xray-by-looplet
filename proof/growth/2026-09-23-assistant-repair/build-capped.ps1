$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
public static class AssistantRepairCpuCap {
  [StructLayout(LayoutKind.Sequential)] struct Rate { public uint Flags; public uint CpuRate; }
  [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr attr, string name);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job, int info, ref Rate rate, uint length);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
  [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
  public static IntPtr Handle;
  public static void Apply() {
    Handle = CreateJobObject(IntPtr.Zero, null);
    if (Handle == IntPtr.Zero) throw new Win32Exception();
    var rate = new Rate { Flags = 5, CpuRate = 2000 };
    if (!SetInformationJobObject(Handle, 15, ref rate, 8)) throw new Win32Exception();
    if (!AssignProcessToJobObject(Handle, GetCurrentProcess())) throw new Win32Exception();
  }
}
'@
[AssistantRepairCpuCap]::Apply()
Write-Output "Host=$env:COMPUTERNAME; build process tree capped to 20% aggregate CPU before launch; owner PID=$PID; created=$([DateTime]::UtcNow.ToString('o'))"
& $env:ComSpec /d /c "npm.cmd run build 2>&1"
$buildExit = $LASTEXITCODE
Write-Output "build_exit=$buildExit"
exit $buildExit
