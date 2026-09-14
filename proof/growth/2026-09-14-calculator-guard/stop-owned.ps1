param([ValidateSet('dev','preview')][string]$Kind='dev')
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
if($env:COMPUTERNAME -ne 'DANS1'){throw 'Wrong host'}
$root='C:/Users/danie/XRayBuilds/checks/calculator-guard-20260914'
$file=if($Kind -eq 'dev'){'process-owner.json'}else{'preview-owner.json'}
$owner=Get-Content "$root/$file" -Raw|ConvertFrom-Json
$all=@(Get-CimInstance Win32_Process)
$parent=$all|Where-Object ProcessId -eq $owner.pid
$stopped=@()
if($parent){
 if($parent.CreationDate.ToString('o') -ne $owner.created -or $parent.CommandLine -ne $owner.command){throw 'Owner identity differs; not stopped'}
 $tree=[Collections.Generic.List[object]]::new();$tree.Add($parent)
 for($n=0;$n -lt $tree.Count;$n++){foreach($child in $all|Where-Object ParentProcessId -eq $tree[$n].ProcessId){$tree.Add($child)}}
 $process=Get-Process -Id $owner.pid
 $process.CloseMainWindow()|Out-Null
 foreach($saved in @($tree.ToArray())|Sort-Object CreationDate -Descending){
  $live=Get-CimInstance Win32_Process -Filter "ProcessId=$($saved.ProcessId)"
  if($live -and $live.CreationDate -eq $saved.CreationDate -and $live.CommandLine -eq $saved.CommandLine){Stop-Process -Id $live.ProcessId;$stopped+=@{pid=$live.ProcessId;created=$live.CreationDate.ToString('o');command=$live.CommandLine}}
 }
}
@{host=$env:COMPUTERNAME;owner=$owner;stopped=$stopped;remaining=[bool](Get-CimInstance Win32_Process -Filter "ProcessId=$($owner.pid)");finished=(Get-Date).ToString('o')}|ConvertTo-Json -Depth 6|Tee-Object "$root/$Kind-cleanup.json"
