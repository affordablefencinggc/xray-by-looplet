$ErrorActionPreference='Stop'
$taskRoot=Join-Path $PSScriptRoot 'release-71f5b012342b'
$taskLaunch=Get-Content -LiteralPath (Join-Path $taskRoot 'qa-launch.json') -Raw|ConvertFrom-Json
$taskProcess=Get-Process -Id $taskLaunch.pid
if($taskProcess.Id -ne 53296 -or $taskProcess.Path -ne $taskLaunch.exe){throw 'Isolated process identity mismatch'}
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class XRayReadStackSymbols {
 [StructLayout(LayoutKind.Sequential)] struct FT {public uint lo,hi;}
 [StructLayout(LayoutKind.Sequential)] struct TE {public uint exit;public IntPtr teb;public uint pid,tid;public UIntPtr affinity;public int priority,basePriority;public IntPtr lastArg;public ushort syscall;public FT created,exited,kernel,user;public IntPtr start;public FT captured;public uint flags;public ushort suspend,contextSize;public IntPtr context;}
 [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr OpenProcess(uint access,bool inherit,uint pid);
 [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr OpenThread(uint access,bool inherit,uint tid);
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
 [DllImport("kernel32.dll")] static extern uint PssCaptureSnapshot(IntPtr process,uint flags,uint contextFlags,out IntPtr snapshot);
 [DllImport("kernel32.dll")] static extern uint PssFreeSnapshot(IntPtr process,IntPtr snapshot);
 [DllImport("kernel32.dll")] static extern uint PssWalkMarkerCreate(IntPtr allocator,out IntPtr marker);
 [DllImport("kernel32.dll")] static extern uint PssWalkMarkerFree(IntPtr marker);
 [DllImport("kernel32.dll")] static extern uint PssWalkSnapshot(IntPtr snapshot,uint cls,IntPtr marker,IntPtr entry,uint length);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode)] static extern IntPtr LoadLibrary(string name);
 [DllImport("kernel32.dll",CharSet=CharSet.Ansi)] static extern IntPtr GetProcAddress(IntPtr module,string name);
 [DllImport("dbghelp.dll",CharSet=CharSet.Ansi,SetLastError=true)] static extern bool SymInitialize(IntPtr process,string search,bool invade);
 [DllImport("dbghelp.dll")] static extern bool SymCleanup(IntPtr process);
 [DllImport("dbghelp.dll")] static extern uint SymSetOptions(uint options);
 [DllImport("dbghelp.dll",SetLastError=true)] static extern bool SymFromAddr(IntPtr process,ulong address,out ulong displacement,IntPtr symbol);
 [DllImport("dbghelp.dll",SetLastError=true)] static extern bool StackWalk64(uint machine,IntPtr process,IntPtr thread,IntPtr frame,IntPtr context,IntPtr read,IntPtr table,IntPtr module,IntPtr translate);
 public class Frame {public string address,symbol;public ulong displacement;}
 public class Result {public uint pid,threadId,captureError,walkError;public int entryBytes;public bool contextFound;public List<Frame> frames=new List<Frame>();}
 public static Result Read(uint pid,uint tid,string symbolPath) {
  var r=new Result{pid=pid,threadId=tid,entryBytes=Marshal.SizeOf(typeof(TE))};
  IntPtr p=OpenProcess(0x410,false,pid);if(p==IntPtr.Zero)throw new Exception("OpenProcess error "+Marshal.GetLastWin32Error());
  IntPtr snap=IntPtr.Zero,marker=IntPtr.Zero,entry=IntPtr.Zero,ctx=IntPtr.Zero,frame=IntPtr.Zero,thread=IntPtr.Zero,symbol=IntPtr.Zero;bool symbols=false;
  try {
   r.captureError=PssCaptureSnapshot(p,0x180,0x10000b,out snap);if(r.captureError!=0)return r;
   uint error=PssWalkMarkerCreate(IntPtr.Zero,out marker);if(error!=0)throw new Exception("Walk marker error "+error);
   entry=Marshal.AllocHGlobal(r.entryBytes);
   while((error=PssWalkSnapshot(snap,3,marker,entry,(uint)r.entryBytes))==0){
    TE t=(TE)Marshal.PtrToStructure(entry,typeof(TE));if(t.tid!=tid)continue;if(t.pid!=pid||t.context==IntPtr.Zero||t.contextSize<256)throw new Exception("Invalid context identity");
    r.contextFound=true;byte[] bytes=new byte[t.contextSize];Marshal.Copy(t.context,bytes,0,bytes.Length);ctx=Marshal.AllocHGlobal(bytes.Length);Marshal.Copy(bytes,0,ctx,bytes.Length);
    frame=Marshal.AllocHGlobal(512);Marshal.Copy(new byte[512],0,frame,512);
    Marshal.WriteInt64(frame,0,Marshal.ReadInt64(ctx,248));Marshal.WriteInt32(frame,12,3);
    Marshal.WriteInt64(frame,32,Marshal.ReadInt64(ctx,160));Marshal.WriteInt32(frame,44,3);
    Marshal.WriteInt64(frame,48,Marshal.ReadInt64(ctx,152));Marshal.WriteInt32(frame,60,3);
    thread=OpenThread(0x48,false,tid);if(thread==IntPtr.Zero)throw new Exception("OpenThread error "+Marshal.GetLastWin32Error());
    SymSetOptions(0x80006);symbols=SymInitialize(p,symbolPath,true);
    IntPtr dbg=LoadLibrary("dbghelp.dll"),table=GetProcAddress(dbg,"SymFunctionTableAccess64"),module=GetProcAddress(dbg,"SymGetModuleBase64");
    symbol=Marshal.AllocHGlobal(1200);ulong previous=0;
    for(int i=0;i<48;i++){
     if(!StackWalk64(0x8664,p,thread,frame,ctx,IntPtr.Zero,table,module,IntPtr.Zero)){r.walkError=(uint)Marshal.GetLastWin32Error();break;}
     ulong address=(ulong)Marshal.ReadInt64(frame,0);if(address==0||address==previous)break;previous=address;
     Marshal.Copy(new byte[1200],0,symbol,1200);Marshal.WriteInt32(symbol,0,88);Marshal.WriteInt32(symbol,80,1000);ulong delta;
     string name=null;if(symbols&&SymFromAddr(p,address,out delta,symbol)){int length=Marshal.ReadInt32(symbol,76);if(length>=0&&length<=1000)name=Marshal.PtrToStringAnsi(IntPtr.Add(symbol,84),length);}else delta=0;
     r.frames.Add(new Frame{address="0x"+address.ToString("x"),symbol=name,displacement=delta});
    }break;
   }return r;
  }finally{if(symbols)SymCleanup(p);foreach(var b in new[]{entry,ctx,frame,symbol})if(b!=IntPtr.Zero)Marshal.FreeHGlobal(b);if(thread!=IntPtr.Zero)CloseHandle(thread);if(marker!=IntPtr.Zero)PssWalkMarkerFree(marker);if(snap!=IntPtr.Zero)PssFreeSnapshot(p,snap);CloseHandle(p);}
 }
}
'@
$taskResult=[XRayReadStackSymbols]::Read(53296,34540,(Join-Path $taskRoot 'diagnostic-symbols'))
$taskModules=@($taskProcess.Modules | ForEach-Object {[pscustomobject]@{name=$_.ModuleName;base=[uint64]$_.BaseAddress.ToInt64();bytes=$_.ModuleMemorySize}})
$taskFrames=@($taskResult.frames | ForEach-Object {$taskFrame=$_;$taskAddress=[Convert]::ToUInt64($taskFrame.address.Substring(2),16);$taskModule=$taskModules|Where-Object {$taskAddress -ge $_.base -and $taskAddress -lt ($_.base+$_.bytes)}|Select-Object -First 1;[pscustomobject]@{address=$taskFrame.address;module=$taskModule.name;moduleOffset=if($taskModule){'0x'+($taskAddress-$taskModule.base).ToString('x')}else{$null};symbol=$taskFrame.symbol;displacement=$taskFrame.displacement}})
$taskOutput=[ordered]@{atUtc=[DateTime]::UtcNow.ToString('o');pid=53296;threadId=34540;method='PSS threads+contexts only; no VA clone, dump, debugger attachment, explicit suspend/resume or target writes. DbgHelp outputs symbols/addresses only.';captureError=$taskResult.captureError;walkError=$taskResult.walkError;entryBytes=$taskResult.entryBytes;contextFound=$taskResult.contextFound;frames=$taskFrames}
$taskFile=Join-Path $taskRoot 'qa-close-main-thread-stack-symbols.json';if(Test-Path -LiteralPath $taskFile){throw 'Preserve prior stack evidence'};$taskOutput|ConvertTo-Json -Depth 6|Set-Content -LiteralPath $taskFile -Encoding UTF8;$taskOutput|ConvertTo-Json -Depth 6
