$ErrorActionPreference='Stop'
$taskRoot=Join-Path $PSScriptRoot 'release-71f5b012342b'
$taskLaunch=Get-Content -LiteralPath (Join-Path $taskRoot 'qa-launch.json') -Raw|ConvertFrom-Json
$taskProcess=Get-Process -Id 53296
if($taskProcess.Path -ne $taskLaunch.exe){throw 'Wrong QA process'}
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class XRayHiddenWindows {
 delegate bool Callback(IntPtr hwnd,IntPtr data);
 [DllImport("user32.dll")] static extern bool EnumWindows(Callback callback,IntPtr data);
 [DllImport("user32.dll")] static extern bool EnumThreadWindows(uint thread,Callback callback,IntPtr data);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd,out uint pid);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr hwnd,StringBuilder text,int count);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr hwnd,StringBuilder text,int count);
 [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hwnd);
 [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr hwnd,uint command);
 [DllImport("user32.dll")] static extern IntPtr GetParent(IntPtr hwnd);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern IntPtr FindWindowEx(IntPtr parent,IntPtr after,string cls,string name);
 public class Window {public string handle,cls,title,owner,parent,kind;public uint tid;public bool visible;}
 public static List<Window> Read(uint pid,uint[] tids){
  var output=new List<Window>();var seen=new HashSet<long>();
  Action<IntPtr,string> capture=(hwnd,kind)=>{uint ownerPid;uint tid=GetWindowThreadProcessId(hwnd,out ownerPid);if(ownerPid!=pid||!seen.Add(hwnd.ToInt64()))return;var cls=new StringBuilder(512);var title=new StringBuilder(512);GetClassName(hwnd,cls,512);GetWindowText(hwnd,title,512);output.Add(new Window{handle="0x"+hwnd.ToInt64().ToString("x"),cls=cls.ToString(),title=title.ToString(),owner="0x"+GetWindow(hwnd,4).ToInt64().ToString("x"),parent="0x"+GetParent(hwnd).ToInt64().ToString("x"),kind=kind,tid=tid,visible=IsWindowVisible(hwnd)});};
  Callback cb=(hwnd,data)=>{capture(hwnd,"top-level/thread window");return true;};EnumWindows(cb,IntPtr.Zero);foreach(uint tid in tids)EnumThreadWindows(tid,cb,IntPtr.Zero);
  IntPtr last=IntPtr.Zero;for(int i=0;i<10000;i++){last=FindWindowEx(new IntPtr(-3),last,null,null);if(last==IntPtr.Zero)break;capture(last,"message-only");}
  return output;
 }
}
'@
$taskWindows=[XRayHiddenWindows]::Read(53296,[uint32[]]@($taskProcess.Threads|ForEach-Object{$_.Id}))
$taskRecord=[ordered]@{atUtc=[DateTime]::UtcNow.ToString('o');pid=53296;method='EnumWindows, EnumThreadWindows and HWND_MESSAGE enumeration; read-only; capture titles/classes only for owned QA PID';windows=@($taskWindows);mutated=$false}
$taskFile=Join-Path $taskRoot 'qa-close-hidden-windows.json';if(Test-Path -LiteralPath $taskFile){throw 'Preserve prior diagnostic'};$taskRecord|ConvertTo-Json -Depth 5|Set-Content -LiteralPath $taskFile -Encoding UTF8;$taskRecord|ConvertTo-Json -Depth 5
