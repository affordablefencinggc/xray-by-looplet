param([Parameter(Mandatory=$true)][string]$RunId)
$ErrorActionPreference='Stop'
if($RunId -notmatch '^sc11-panel-[a-f0-9]{12}$'){throw 'Unexpected run identifier.'}
$campaign=Join-Path $PSScriptRoot $RunId
$manifest=Get-Content -LiteralPath (Join-Path $campaign 'input/source-manifest.json') -Raw | ConvertFrom-Json
$results=Get-Content -LiteralPath (Join-Path $campaign 'output/results.json') -Raw | ConvertFrom-Json
$script=@'
$ErrorActionPreference='Stop'
if(([Net.Dns]::GetHostName().Trim().ToLowerInvariant()) -cne 'dans1'){throw 'Host guard failed'}
$campaign='C:\Users\danie\XRayBuilds\preflight\__RUN__'
$manifest=Get-Content -LiteralPath (Join-Path $campaign 'input/source-manifest.json') -Raw | ConvertFrom-Json
$results=Get-Content -LiteralPath (Join-Path $campaign 'output/results.json') -Raw | ConvertFrom-Json
$files=@($manifest.entries | ForEach-Object {
  $file=Join-Path $manifest.baseline $_.path
  [ordered]@{path=$_.path;exists=(Test-Path -LiteralPath $file);sha256=if(Test-Path -LiteralPath $file){(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()}else{$null}}
})
$processes=@($results.commands | ForEach-Object {
  $live=Get-Process -Id $_.process.pid -ErrorAction SilentlyContinue
  $same=$false
  if($live){$same=($live.StartTime.ToUniversalTime().ToString('o') -ceq $_.process.createdAt)}
  [ordered]@{purpose=$_.name;pid=$_.process.pid;expectedCreatedAt=$_.process.createdAt;recordedExited=$_.processExited;stillSameProcess=$same}
})
[ordered]@{host='DANS1';owner='/root/sc09_review';checkedAt=[DateTime]::UtcNow.ToString('o');baselineFiles=$files;ownedProcesses=$processes} | ConvertTo-Json -Depth 8 -Compress
'@
$encoded=[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($script.Replace('__RUN__',$RunId)))
$raw=@(& ssh tonys-test-pc powershell -NoProfile -NonInteractive -EncodedCommand $encoded)
if($LASTEXITCODE -ne 0){throw 'Remote evidence check failed.'}
$record=($raw -join "`n") | ConvertFrom-Json
if(@($record.ownedProcesses | Where-Object {$_.stillSameProcess}).Count){throw 'An owned process is unexpectedly still running.'}
$record | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $campaign 'cleanup-and-baseline.json') -Encoding utf8
$baseline=Join-Path $campaign 'input/baseline'
$diffPath=Join-Path $campaign 'source-diff.patch'
if(Test-Path -LiteralPath $diffPath){throw 'Source diff already exists; preserve evidence.'}
$diff=New-Object Text.StringBuilder
foreach($entry in $record.baselineFiles){
  $old='/dev/null'
  if($entry.exists){
    $old=Join-Path $baseline $entry.path
    New-Item -ItemType Directory -Path (Split-Path -Parent $old) -Force | Out-Null
    & scp -- ('tonys-test-pc:'+($manifest.baseline.Replace('\','/')+'/'+$entry.path)) $old
    if($LASTEXITCODE -ne 0){throw "Baseline readback failed: $($entry.path)"}
    if((Get-FileHash -LiteralPath $old -Algorithm SHA256).Hash.ToLowerInvariant() -cne $entry.sha256){throw 'Baseline readback hash mismatch.'}
  }
  $next=Join-Path (Join-Path $campaign 'input/overlay') $entry.path
  $lines=@(& git diff --no-index --no-ext-diff -- $old $next)
  if($LASTEXITCODE -gt 1){throw "Exact diff failed: $($entry.path)"}
  foreach($line in $lines){[void]$diff.AppendLine($line)}
}
[IO.File]::WriteAllText($diffPath,$diff.ToString(),(New-Object Text.UTF8Encoding($false)))
$outputs=@(Get-ChildItem -LiteralPath (Join-Path $campaign 'output') -File)
$outputs+=Get-Item -LiteralPath $diffPath,(Join-Path $campaign 'cleanup-and-baseline.json'),(Join-Path $campaign 'invocation-results.json')
@($outputs | ForEach-Object {[ordered]@{path=$_.FullName.Substring($campaign.Length+1).Replace('\','/');bytes=$_.Length;sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()}}) | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $campaign 'evidence-manifest.json') -Encoding utf8
Write-Output "Evidence captured for $RunId; all owned process identities exited."
