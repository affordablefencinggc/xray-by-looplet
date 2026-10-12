param(
  [Parameter(Mandatory=$true)][ValidateSet('preflight','all','containment','containment-fixture')][string]$Gate,
  [string]$FixturePath
)
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
if($env:COMPUTERNAME -cne 'DANIELS'){throw 'Local ledger checks are restricted to DANIELS'}
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Set-Location -LiteralPath $repo
# Reuse the campaign's verified aggregate cap mechanism, before any test child.
Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
public static class LedgerCpuCap {
  [StructLayout(LayoutKind.Sequential)] public struct Rate { public uint Flags; public uint CpuRate; }
  [StructLayout(LayoutKind.Sequential)] struct Basic {
    public long ProcessTime, JobTime; public uint Flags; public UIntPtr MinWs, MaxWs;
    public uint ProcessLimit; public UIntPtr Affinity; public uint Priority, Scheduling;
  }
  [StructLayout(LayoutKind.Sequential)] struct Io { public ulong R, W, O, Rb, Wb, Ob; }
  [StructLayout(LayoutKind.Sequential)] struct Extended {
    public Basic Basic; public Io Io; public UIntPtr ProcessMemory, JobMemory, PeakProcess, PeakJob;
  }
  [StructLayout(LayoutKind.Sequential)] struct Accounting {
    public long User, Kernel, PeriodUser, PeriodKernel;
    public uint PageFaults, Total, Active, Terminated;
  }
  [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr attr, string name);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job, int info, ref Rate rate, uint length);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool QueryInformationJobObject(IntPtr job, int info, out Rate rate, uint length, out uint returned);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool IsProcessInJob(IntPtr process, IntPtr job, out bool result);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job, int info, ref Extended limits, uint length);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool QueryInformationJobObject(IntPtr job, int info, out Extended limits, uint length, out uint returned);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool QueryInformationJobObject(IntPtr job, int info, out Accounting accounting, uint length, out uint returned);
  [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
  static IntPtr handle;
  public static void Apply() {
    handle=CreateJobObject(IntPtr.Zero,null);
    if(handle==IntPtr.Zero) throw new Win32Exception();
    var limits=new Extended(); limits.Basic.Flags=0x2000;
    if(!SetInformationJobObject(handle,9,ref limits,(uint)Marshal.SizeOf(typeof(Extended)))) throw new Win32Exception();
    var rate=new Rate { Flags=5, CpuRate=2000 };
    if(!SetInformationJobObject(handle,15,ref rate,8) || !AssignProcessToJobObject(handle,GetCurrentProcess())) throw new Win32Exception();
    Rate actual; uint returned;
    if(!QueryInformationJobObject(handle,15,out actual,8,out returned)) throw new Win32Exception();
    if(!Contains(GetCurrentProcess()) || actual.Flags!=5 || actual.CpuRate!=2000) throw new Exception("CPU cap verification failed");
    Extended actualLimits;
    if(!QueryInformationJobObject(handle,9,out actualLimits,(uint)Marshal.SizeOf(typeof(Extended)),out returned) || actualLimits.Basic.Flags!=0x2000) throw new Exception("Kill-on-close verification failed");
  }
  public static bool Contains(IntPtr process) {
    bool member;
    if(!IsProcessInJob(process,handle,out member)) throw new Win32Exception();
    return member;
  }
  public static uint Active() {
    Accounting info; uint returned;
    if(!QueryInformationJobObject(handle,1,out info,(uint)Marshal.SizeOf(typeof(Accounting)),out returned)) throw new Win32Exception();
    return info.Active;
  }
  public static bool Drain(System.Diagnostics.Process process, int milliseconds) {
    // Parameterless WaitForExit drains redirected output, but descendants may
    // retain pipes. Never allow that drain to bypass our owner deadline.
    return System.Threading.Tasks.Task.Run(() => process.WaitForExit()).Wait(milliseconds);
  }
}
'@
[LedgerCpuCap]::Apply()
[Diagnostics.Process]::GetCurrentProcess().PriorityClass='BelowNormal'
Get-ChildItem Env: | Where-Object {$_.Name -match 'SECRET|TOKEN|PASSWORD|API_KEY|DATABASE_URL|PGPASSWORD|NODE_OPTIONS|^PYTHON|^PYINSTALLER'} | ForEach-Object {Remove-Item ('Env:'+ $_.Name)}
$env:PYTHONDONTWRITEBYTECODE='1'
$python='C:\Users\danie\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
$node=(Get-Command node.exe -ErrorAction Stop).Source
if(-not (Test-Path -LiteralPath $python -PathType Leaf)){throw 'Verified local build/test Python is unavailable'}
$root=Join-Path ([IO.Path]::GetTempPath()) ('xray-ledger-'+[Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $root -ErrorAction Stop | Out-Null
Write-Output "Local checks: gate=$Gate aggregateCpuCapPercent=20 flags=5 rate=2000 killOnClose=True ownerPid=$PID"
Write-Output "Temporary test data: $root (never remote engine acceptance)"
function Run-Check([string]$Name,[string]$Executable,[string[]]$Arguments,[int]$Seconds=120) {
  $out=Join-Path $root ($Name+'.stdout.log');$err=Join-Path $root ($Name+'.stderr.log')
  $p=Start-Process -FilePath $Executable -ArgumentList $Arguments -WorkingDirectory $repo -NoNewWindow -PassThru -RedirectStandardOutput $out -RedirectStandardError $err
  try {
    $handle=$p.Handle
    if(-not [LedgerCpuCap]::Contains($handle)){throw 'Child did not inherit CPU cap'}
    $timer=[Diagnostics.Stopwatch]::StartNew()
    while(-not $p.WaitForExit(100)){
      if($timer.Elapsed.TotalSeconds -ge $Seconds){throw "Check deadline exceeded: $Name"}
      if((Get-Item -LiteralPath $out).Length -gt 4MB -or (Get-Item -LiteralPath $err).Length -gt 4MB){throw "Check log bound exceeded: $Name"}
    }
    if(-not [LedgerCpuCap]::Drain($p,10000)){throw "Redirected output drain deadline exceeded: $Name"}
    # A exited direct child can leave a live descendant holding redirected files.
    # Require the owned job to drain before opening logs (or claiming success).
    $remaining=[Diagnostics.Stopwatch]::StartNew()
    while([LedgerCpuCap]::Active() -ne 1 -and $remaining.Elapsed.TotalSeconds -lt 10){Start-Sleep -Milliseconds 100}
    if([LedgerCpuCap]::Active() -ne 1){throw 'Owned descendants remain; containing job will terminate on owner exit'}
    if((Get-Item -LiteralPath $out).Length -gt 4MB -or (Get-Item -LiteralPath $err).Length -gt 4MB){throw "Check log bound exceeded: $Name"}
    Write-Output "CHECK $Name exit=$($p.ExitCode)"
    if(Test-Path -LiteralPath $out){[Console]::Out.Write([IO.File]::ReadAllText($out))}
    if(Test-Path -LiteralPath $err){[Console]::Out.Write([IO.File]::ReadAllText($err))}
    if($p.ExitCode -ne 0){throw "Check failed: $Name"}
  } finally {
    if(-not $p.HasExited){$p.Kill();if(-not $p.WaitForExit(10000)){throw 'Owned check did not exit'}}
    $p.Dispose()
  }
}
$success=$false
try {
  if($Gate -eq 'containment-fixture'){
    if(-not $FixturePath -or -not [IO.Path]::GetFullPath($FixturePath).StartsWith([IO.Path]::GetTempPath(),[StringComparison]::OrdinalIgnoreCase)){throw 'Fixture marker must be in local temp'}
    if(Test-Path -LiteralPath $FixturePath){throw 'Fixture marker exists; no overwrite'}
    $fixture=Join-Path $root 'pipe-fixture.py'
    [IO.File]::WriteAllText($fixture,"import subprocess,sys,time`nfrom pathlib import Path`np=subprocess.Popen([sys.executable,'-c','import time; time.sleep(180)',sys.argv[1]],stdout=sys.stdout,stderr=sys.stderr)`nwith Path(sys.argv[1]).open('x',encoding='ascii') as f: f.write(str(p.pid))`ntime.sleep(0.5)`nprint('Direct child exiting with pipe held by owned descendant',flush=True)`n",[Text.UTF8Encoding]::new($false))
    Run-Check 'pipe-descendant-fixture' $python @('-B',('"'+$fixture+'"'),('"'+$FixturePath+'"')) 5
    $drain=[Diagnostics.Stopwatch]::StartNew()
    while([LedgerCpuCap]::Active() -ne 1 -and $drain.Elapsed.TotalSeconds -lt 10){Start-Sleep -Milliseconds 100}
    if([LedgerCpuCap]::Active() -ne 1){throw 'Owned descendants remain; containing job will terminate on owner exit'}
    throw 'Fixture unexpectedly lost descendant before containment assertion'
  }
  if($Gate -ne 'containment'){
    Run-Check 'evidence-tests' $python @('-B','-m','unittest','discover','-s','scripts','-p','test_verify_recovery_preflight.py','-v')
    Run-Check 'preserved-evidence' $python @('-B','scripts/verify_recovery_preflight.py',('"'+$repo+'"'))
  }
  if($Gate -in @('all','containment')){Run-Check 'runner-containment-test' $python @('-B','scripts/test_recovery_ledger_containment.py') 75}
  if($Gate -eq 'all'){
    Run-Check 'helper-tests' $python @('-B','-m','unittest','discover','-s','scripts','-p','test_qualify_frozen_engine.py','-v')
    Run-Check 'node-syntax' $node @('--check','scripts/frozen-engine-cases.mjs')
    foreach($name in @('run-frozen-engine-qualification.ps1','run-recovery-ledger-check.ps1')){
      $tokens=$null;$errors=$null
      $null=[Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot $name),[ref]$tokens,[ref]$errors)
      if($errors.Count){throw "PowerShell parse failed: $name"}
      Write-Output "PowerShell syntax PASS: $name"
    }
    # Cases/snapshot generated at this HEAD into a new throwaway LOCAL directory.
    $snapshot=Join-Path $root 'snapshot'
    Run-Check 'new-snapshot' $python @('-B','scripts/qualify_frozen_engine.py','snapshot',('"'+$repo+'"'),('"'+$snapshot+'"'))
    $cases=Join-Path $snapshot 'cases.json'
    Run-Check 'six-reference-cases' $node @('--experimental-strip-types','scripts/frozen-engine-cases.mjs',('"'+$cases+'"'))
    $verify=Join-Path $root 'verify-bindings.py'
    [IO.File]::WriteAllText($verify,"import sys`nfrom pathlib import Path`nsys.path.insert(0, sys.argv[1])`nimport qualify_frozen_engine as q`np=Path(sys.argv[2])`nq.verify_cases(q.load(p/'cases.json'), q.load(p/'snapshot.json'))`nprint('Current HEAD reference/snapshot binding PASS; no frozen engine executed')`n",[Text.UTF8Encoding]::new($false))
    Run-Check 'reference-binding' $python @('-B',('"'+$verify+'"'),('"'+$PSScriptRoot+'"'),('"'+$snapshot+'"'))
  }
  $drain=[Diagnostics.Stopwatch]::StartNew()
  while([LedgerCpuCap]::Active() -ne 1 -and $drain.Elapsed.TotalSeconds -lt 10){Start-Sleep -Milliseconds 100}
  if([LedgerCpuCap]::Active() -ne 1){throw 'Owned descendants remain; containing job will terminate on owner exit'}
  Write-Output 'LOCAL TOOLING CHECKS PASS; frozen-engine/native/install gates remain unaccepted.'
  Write-Output 'Job accounting: activeProcesses=1 (this owner only); no task descendants remain.'
  $success=$true
} finally {
  # Failed/interrupted diagnostics stay intact. Non-inheritable Job handle is held
  # until this owner exits; killing the owner also terminates its owned descendants.
  if($success){
    Remove-Item -LiteralPath $root -Recurse -Force
    Write-Output 'Local temporary test directory removed after child-job accounting.'
  } else {Write-Output "FAIL: retained diagnostic directory $root; job terminates with owner exit"}
}