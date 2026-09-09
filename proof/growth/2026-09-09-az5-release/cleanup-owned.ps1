$ErrorActionPreference='Stop'
$stage='proof/growth/2026-09-09-az5-release'
$runId=(Get-Content -LiteralPath "$stage/run-id.txt").Trim()
$launchPath="$stage/release-$runId/qa-launch.json"; $previewPath="$stage/release-$runId/candidate-preview.json"
$out=@()
function Close-Owned($id,$exeMatch,$cmdMatch,$owner){
  $p=Get-CimInstance Win32_Process -Filter "ProcessId=$id"
  if(-not $p){ return @{pid=$id;owner=$owner;found=$false} }
  if(($exeMatch -and $p.ExecutablePath -ne $exeMatch) -or ($cmdMatch -and $p.CommandLine -notlike "*$cmdMatch*")){ throw "PID $id identity changed; preserved" }
  $proc=Get-Process -Id $id
  $graceful=$proc.CloseMainWindow()
  $exited=$proc.WaitForExit(5000)
  $forced=$false
  if(-not $exited){
    $again=Get-CimInstance Win32_Process -Filter "ProcessId=$id"
    if($again -and $again.CreationDate -eq $p.CreationDate){ Stop-Process -Id $id; $forced=$true; $proc.WaitForExit(5000) | Out-Null }
  }
  return @{pid=$id;owner=$owner;found=$true;created=$p.CreationDate.ToString('o');exe=$p.ExecutablePath;gracefulCloseRequested=$graceful;forced=$forced;remaining=[bool](Get-Process -Id $id -ErrorAction SilentlyContinue)}
}
if(Test-Path -LiteralPath $launchPath){ $launch=Get-Content -Raw -LiteralPath $launchPath | ConvertFrom-Json; $out+=Close-Owned $launch.pid $launch.exe $null 'native QA app (CDP 9281)' }
if(Test-Path -LiteralPath $previewPath){ $preview=Get-Content -Raw -LiteralPath $previewPath | ConvertFrom-Json; $out+=Close-Owned $preview.pid $null 'preview-built.mjs' 'candidate preview 8096' }
@{at=[DateTime]::UtcNow.ToString('o');runId=$runId;installedAppTouched=$false;results=$out} | ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 -LiteralPath "$stage/native-cleanup.json"
Get-Content "$stage/native-cleanup.json"
