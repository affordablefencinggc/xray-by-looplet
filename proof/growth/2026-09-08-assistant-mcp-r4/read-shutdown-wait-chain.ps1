param([int]$TargetPid=53296)
$ErrorActionPreference='Stop'
$taskRoot=Join-Path $PSScriptRoot 'release-71f5b012342b'
$taskLaunch=Get-Content -LiteralPath (Join-Path $taskRoot 'qa-launch.json') -Raw | ConvertFrom-Json
if($TargetPid -ne $taskLaunch.pid){throw 'Only the recorded isolated QA PID is authorized'}
$taskProcess=Get-Process -Id $TargetPid
if($taskProcess.Path -ne $taskLaunch.exe){throw 'Process identity changed'}
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class XRayShutdownWct {
  [DllImport("advapi32.dll", SetLastError=true)] static extern IntPtr OpenThreadWaitChainSession(uint flags, IntPtr callback);
  [DllImport("advapi32.dll")] static extern void CloseThreadWaitChainSession(IntPtr session);
  [DllImport("advapi32.dll", SetLastError=true)] [return:MarshalAs(UnmanagedType.Bool)] static extern bool GetThreadWaitChain(IntPtr session, UIntPtr context, uint flags, uint threadId, ref uint count, IntPtr nodes, [MarshalAs(UnmanagedType.Bool)] out bool cycle);
  public class Node { public int type; public int status; public uint processId; public uint threadId; public uint waitTime; public uint contextSwitches; }
  public class Result { public uint threadId; public bool success; public int error; public bool cycle; public uint reportedNodes; public List<Node> nodes=new List<Node>(); }
  public static Result Read(uint threadId) {
    var result=new Result {threadId=threadId};
    IntPtr session=OpenThreadWaitChainSession(0,IntPtr.Zero);
    if(session==IntPtr.Zero){result.error=Marshal.GetLastWin32Error();return result;}
    // WAITCHAIN_NODE_INFO: 8-byte enum header + 272-byte aligned union.
    // Lock-object names are deliberately not read or recorded.
    const int stride=280;IntPtr buffer=Marshal.AllocHGlobal(16*stride);
    try {
      Marshal.Copy(new byte[16*stride],0,buffer,16*stride);
      uint count=16;bool cycle;
      result.success=GetThreadWaitChain(session,UIntPtr.Zero,0,threadId,ref count,buffer,out cycle);
      result.error=result.success?0:Marshal.GetLastWin32Error();result.cycle=cycle;result.reportedNodes=count;
      if(result.success||result.error==234){for(int i=0;i<Math.Min(count,16);i++){
        IntPtr p=IntPtr.Add(buffer,i*stride);var node=new Node {type=Marshal.ReadInt32(p,0),status=Marshal.ReadInt32(p,4)};
        if(node.type==8){node.processId=(uint)Marshal.ReadInt32(p,8);node.threadId=(uint)Marshal.ReadInt32(p,12);node.waitTime=(uint)Marshal.ReadInt32(p,16);node.contextSwitches=(uint)Marshal.ReadInt32(p,20);}
        result.nodes.Add(node);
      }}
      return result;
    } finally {Marshal.FreeHGlobal(buffer);CloseThreadWaitChainSession(session);}
  }
}
'@
$taskIds=@(34540,68804,47164)
$taskCurrentIds=@($taskProcess.Threads | ForEach-Object {$_.Id})
$taskResults=@(foreach($taskId in $taskIds){if($taskCurrentIds -contains $taskId){[XRayShutdownWct]::Read([uint32]$taskId)}})
$taskResult=[ordered]@{atUtc=[DateTime]::UtcNow.ToString('o');pid=$TargetPid;exe=$taskProcess.Path;method='GetThreadWaitChain synchronous, flags0; no debug attachment, memory dump, privilege changes or object names';results=$taskResults;appModified=$false;terminated=$false}
$taskFile=Join-Path $taskRoot 'qa-close-wait-chain.json'
if(Test-Path -LiteralPath $taskFile){throw 'Prior wait-chain evidence preserved'}
$taskResult | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath $taskFile -Encoding UTF8
$taskResult | ConvertTo-Json -Depth 7
