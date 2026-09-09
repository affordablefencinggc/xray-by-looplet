$ErrorActionPreference='Stop'
$stage='proof/growth/2026-09-09-az3-release'
$launch=Get-Content -Raw -LiteralPath "$stage/release-5dfc922f097f/qa-launch.json" | ConvertFrom-Json
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
$out+=Close-Owned $launch.pid $launch.exe $null 'native QA app (CDP 9281)'
$out+=Close-Owned 56200 $null 'preview-built.mjs' 'candidate preview 8096'
@{at=[DateTime]::UtcNow.ToString('o');installedAppTouched=$false;results=$out} | ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 -LiteralPath "$stage/native-cleanup.json"
Get-Content "$stage/native-cleanup.json"
