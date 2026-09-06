param([Parameter(Mandatory=$true)][int]$OwnedProcessId,[Parameter(Mandatory=$true)][string]$SourcePath,[switch]$InspectOnly,[string]$ScreenshotPath)
$ErrorActionPreference = 'Stop'
$SourcePath = (Get-Item -LiteralPath $SourcePath -ErrorAction Stop).FullName
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$dialog = $null
for ($attempt=0; $attempt -lt 50; $attempt++) {
  $ownedProcess = Get-Process -Id $OwnedProcessId -ErrorAction Stop
  $window = [System.Windows.Automation.AutomationElement]::FromHandle($ownedProcess.MainWindowHandle)
  if ($window -and $window.Current.ProcessId -eq $OwnedProcessId -and $window.Current.ClassName -eq '#32770') { $dialog=$window }
  if ($dialog) { break }
  Start-Sleep -Milliseconds 300
}
if (-not $dialog) { throw "Owned native file dialog was not found for process $OwnedProcessId" }
$editCondition = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ClassNameProperty,'Edit')
$edits=$dialog.FindAll([System.Windows.Automation.TreeScope]::Descendants,$editCondition)
$fileName=$null
foreach($edit in $edits) { if($edit.Current.AutomationId -eq '1148' -or $edit.Current.Name -match '^File name') {$fileName=$edit;break} }
if(-not $fileName){throw 'Owned file dialog has no filename field'}
$buttonCondition=New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::AutomationIdProperty,'1')
$open=$null
foreach($candidate in $dialog.FindAll([System.Windows.Automation.TreeScope]::Descendants,$buttonCondition)) { if($candidate.Current.ClassName -eq 'Button' -and $candidate.Current.Name -eq 'Open') {$open=$candidate;break} }
if(-not $open){throw 'Owned file dialog has no Open button'}
$proof=@{processId=$OwnedProcessId;dialog=$dialog.Current.Name;class=$dialog.Current.ClassName;filenameId=$fileName.Current.AutomationId;source=$SourcePath;button=$open.Current.Name;selectedUtc=[DateTime]::UtcNow.ToString('o')}
Add-Type -TypeDefinition @'
using System; using System.Text; using System.Runtime.InteropServices;
public static class OwnedDialogNative {
 [DllImport("user32.dll", CharSet=CharSet.Unicode, SetLastError=true)] public static extern IntPtr SendMessageTimeout(IntPtr h, uint msg, IntPtr w, string text, uint flags, uint timeout, out IntPtr result);
 [DllImport("user32.dll", EntryPoint="SendMessageTimeoutW", CharSet=CharSet.Unicode, SetLastError=true)] public static extern IntPtr ReadMessage(IntPtr h, uint msg, IntPtr w, StringBuilder text, uint flags, uint timeout, out IntPtr result);
 [DllImport("user32.dll", SetLastError=true)] public static extern bool PostMessage(IntPtr h, uint msg, IntPtr w, IntPtr l);
}
'@
$result=[IntPtr]::Zero
$sent=[OwnedDialogNative]::SendMessageTimeout([IntPtr]$fileName.Current.NativeWindowHandle,0x000C,[IntPtr]::Zero,$SourcePath,2,3000,[ref]$result)
if($sent -eq [IntPtr]::Zero){throw 'Could not fill owned filename control'}
$actualText = New-Object System.Text.StringBuilder(32768)
$read=[OwnedDialogNative]::ReadMessage([IntPtr]$fileName.Current.NativeWindowHandle,0x000D,[IntPtr]32768,$actualText,2,3000,[ref]$result)
if($read -eq [IntPtr]::Zero -or $actualText.ToString() -cne $SourcePath){throw "Native filename read-back does not equal original Windows path: $($actualText.ToString())"}
$proof.filenameReadBack=$actualText.ToString()
if($ScreenshotPath){
 Add-Type -AssemblyName System.Drawing
 $rect=$dialog.Current.BoundingRectangle
 $bitmap=New-Object System.Drawing.Bitmap([int]$rect.Width,[int]$rect.Height)
 $graphics=[System.Drawing.Graphics]::FromImage($bitmap)
 try { $graphics.CopyFromScreen([int]$rect.X,[int]$rect.Y,0,0,$bitmap.Size); $bitmap.Save($ScreenshotPath); $proof.dialogScreenshot=$ScreenshotPath }
 finally { $graphics.Dispose(); $bitmap.Dispose() }
}
if($InspectOnly){$proof.submitted=$false; $proof | ConvertTo-Json -Depth 4; exit 0}
if(-not [OwnedDialogNative]::PostMessage([IntPtr]$open.Current.NativeWindowHandle,0x00F5,[IntPtr]::Zero,[IntPtr]::Zero)){throw 'Could not click owned Open button'}
$proof.submitted=$true
$proof | ConvertTo-Json -Depth 4
