param([switch]$PreviewOnly)
$ErrorActionPreference='Stop'
if($env:COMPUTERNAME -ne 'DANS1'){throw 'Wrong host'}
$root='C:\Users\danie\XRayBuilds\project-library-20260911'
$files=@('preview-process.json')
if(-not $PreviewOnly){$files+='processes.json'}
$report=@()
foreach($file in $files){
  if(-not(Test-Path -LiteralPath ($root+'\'+$file))){continue}
  $owners=Get-Content -LiteralPath ($root+'\'+$file) -Raw | ConvertFrom-Json
  foreach($owner in $owners){
    if($owner.owner -ne 'codex-project-library'){throw 'Unexpected owner'}
    $p=Get-CimInstance Win32_Process -Filter "ProcessId=$($owner.pid)"
    if(-not $p){$report+=@{pid=$owner.pid;status='already exited'};continue}
    if($p.ExecutablePath -ne $owner.executable -or $p.CommandLine -ne $owner.command -or [Math]::Abs(($p.CreationDate.ToUniversalTime()-[DateTime]::Parse($owner.created).ToUniversalTime()).TotalSeconds) -gt 1){throw 'Process identity changed; refusing termination'}
    $all=@(Get-CimInstance Win32_Process)
    $tree=@($p)
    for($i=0;$i -lt $tree.Count;$i++){$parent=$tree[$i].ProcessId;$tree+=@($all|Where-Object {$_.ParentProcessId -eq $parent -and $_.CreationDate -ge $p.CreationDate})}
    $graceful=(Get-Process -Id $p.ProcessId).CloseMainWindow()
    if($graceful){Wait-Process -Id $p.ProcessId -Timeout 2 -ErrorAction SilentlyContinue}
    [Array]::Reverse($tree)
    foreach($item in $tree){
      $current=Get-CimInstance Win32_Process -Filter "ProcessId=$($item.ProcessId)"
      if(-not $current){continue}
      if($current.CreationDate -ne $item.CreationDate -or $current.ExecutablePath -ne $item.ExecutablePath -or $current.CommandLine -ne $item.CommandLine){throw 'Descendant identity changed'}
      Stop-Process -Id $item.ProcessId -Force -ErrorAction Stop
      $report+=@{pid=$item.ProcessId;created=$item.CreationDate.ToUniversalTime().ToString('o');executable=$item.ExecutablePath;command=$item.CommandLine;status='stopped verified task process';gracefulCloseAvailable=$graceful}
    }
  }
}
$name=if($PreviewOnly){'cleanup-preview-old.json'}else{'cleanup-final.json'}
@{host=$env:COMPUTERNAME;at=[DateTime]::UtcNow.ToString('o');processes=$report;retained='User preview on local 8091 and all unrelated processes'}|ConvertTo-Json -Depth 5|Set-Content -LiteralPath ($root+'\'+$name)
$report|ConvertTo-Json -Depth 3


