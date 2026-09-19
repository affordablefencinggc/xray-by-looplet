param([Parameter(Mandatory=$true)][string]$Campaign,[Parameter(Mandatory=$true)][string]$Node)
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$observed=([Net.Dns]::GetHostName().Trim() -split '\.')[0].ToLowerInvariant()
if($observed -cne 'dans1'){throw "Expected DANS1, observed $observed"}
$campaignFull=[IO.Path]::GetFullPath($Campaign)
if(-not $campaignFull.StartsWith('C:\Users\danie\XRayBuilds\dashboard\dash-',[StringComparison]::OrdinalIgnoreCase)){throw 'Unexpected static dashboard campaign path'}
$source=Join-Path $campaignFull 'source'
$output=Join-Path $campaignFull 'output'
if(Test-Path -LiteralPath $output){throw 'Output exists; preserve historical evidence and stage a new source snapshot'}
New-Item -ItemType Directory -Path $output | Out-Null
$manifest=Get-Content -LiteralPath (Join-Path $campaignFull 'source-manifest.json') -Raw | ConvertFrom-Json
foreach($entry in $manifest.entries){
  $path=[IO.Path]::GetFullPath((Join-Path $source $entry.path))
  if(-not $path.StartsWith($source+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Source entry escaped snapshot'}
  if((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -cne $entry.sha256){throw "Transferred source hash mismatch: $($entry.path)"}
}
$receipts=@()
function Invoke-RecordedNode([string]$Name,[string[]]$Arguments){
  $process=New-Object Diagnostics.Process
  $info=New-Object Diagnostics.ProcessStartInfo
  $info.FileName=$Node
  $info.Arguments=$Arguments -join ' '
  $info.WorkingDirectory=$source
  $info.UseShellExecute=$false
  $info.CreateNoWindow=$true
  $info.RedirectStandardOutput=$true
  $info.RedirectStandardError=$true
  $info.StandardOutputEncoding=[Text.Encoding]::UTF8
  $info.StandardErrorEncoding=[Text.Encoding]::UTF8
  $process.StartInfo=$info
  $started=[DateTime]::UtcNow
  [void]$process.Start()
  $outRead=$process.StandardOutput.ReadToEndAsync()
  $errRead=$process.StandardError.ReadToEndAsync()
  try{$process.PriorityClass='High';$process.ProcessorAffinity=[IntPtr]65535}catch{if(-not $process.HasExited){throw}}
  $process.WaitForExit()
  $exitCode=[int]$process.ExitCode
  [IO.File]::WriteAllText((Join-Path $output ($Name+'.stdout.log')),$outRead.GetAwaiter().GetResult(),(New-Object Text.UTF8Encoding($false)))
  [IO.File]::WriteAllText((Join-Path $output ($Name+'.stderr.log')),$errRead.GetAwaiter().GetResult(),(New-Object Text.UTF8Encoding($false)))
  $receipt=[ordered]@{name=$Name;host='DANS1';pid=$process.Id;node=$Node;args=$Arguments;source=$source;startedAt=$started.ToString('o');finishedAt=[DateTime]::UtcNow.ToString('o');exitCode=$exitCode;processExited=$process.HasExited}
  $receipt | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $output ($Name+'.json')) -Encoding utf8
  $script:receipts+=$receipt
  $process.Dispose()
  if($exitCode -ne 0){throw "$Name failed: exit $exitCode"}
}
$server=$null
$failure=$null
$cleanup='not-started'
try{
  Invoke-RecordedNode 'generate' @('scripts/build-full-dashboard.mjs')
  Invoke-RecordedNode 'validate' @('scripts/validate-dashboard.mjs')
  Invoke-RecordedNode 'generate-repeat' @('scripts/build-full-dashboard.mjs',(Join-Path $output 'repeat-dashboard.html'))
  if((Get-FileHash -LiteralPath (Join-Path $source 'XRAY-STATUS-AND-PROOF-DASHBOARD.html') -Algorithm SHA256).Hash -cne (Get-FileHash -LiteralPath (Join-Path $output 'repeat-dashboard.html') -Algorithm SHA256).Hash){throw 'Repeated generation from the same inputs was not byte-identical'}
  Invoke-RecordedNode 'scenario' @('proof/growth/2026-09-19-dashboard-refresh/build-scenario.mjs')
  $html=Join-Path $source 'XRAY-STATUS-AND-PROOF-DASHBOARD.html'
  Copy-Item -LiteralPath $html -Destination (Join-Path $output 'XRAY-STATUS-AND-PROOF-DASHBOARD.html')
  foreach($port in @(8090,9338)){if(@(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue).Count){throw "Isolated port occupied: $port"}}
  $serverScript=Join-Path $source 'proof/growth/2026-09-19-dashboard-refresh/preview-built-dashboard.mjs'
  $server=Start-Process -FilePath $Node -ArgumentList @($serverScript,$source,'8090') -WorkingDirectory $source -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $output 'static-server.stdout.log') -RedirectStandardError (Join-Path $output 'static-server.stderr.log')
  $serverIdentity=Get-CimInstance Win32_Process -Filter "ProcessId=$($server.Id)"
  $serverIdentity | Select-Object ProcessId,CreationDate,ExecutablePath,CommandLine | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $output 'static-server.process.json') -Encoding utf8
  $deadline=[DateTime]::UtcNow.AddSeconds(20)
  do{
    if($server.HasExited){throw 'Static server exited before readiness'}
    try{$response=Invoke-WebRequest -Uri 'http://127.0.0.1:8090/' -UseBasicParsing -TimeoutSec 2;if($response.StatusCode -eq 200){break}}catch{}
    if([DateTime]::UtcNow -ge $deadline){throw 'Static server readiness deadline'}
    Start-Sleep -Milliseconds 100
  }while($true)
  $listeners=@(Get-NetTCPConnection -State Listen -LocalPort 8090)
  if($listeners.Count -ne 1 -or $listeners[0].LocalAddress -ne '127.0.0.1' -or $listeners[0].OwningProcess -ne $server.Id){throw 'Static server listener is not owned loopback process'}
  $served=Invoke-WebRequest -Uri 'http://127.0.0.1:8090/XRAY-STATUS-AND-PROOF-DASHBOARD.html' -UseBasicParsing
  $servedBytes=$served.RawContentStream.ToArray()
  $hasher=[Security.Cryptography.SHA256]::Create()
  $servedHash=([BitConverter]::ToString($hasher.ComputeHash($servedBytes))).Replace('-','').ToLowerInvariant()
  if($servedHash -cne (Get-FileHash -LiteralPath $html -Algorithm SHA256).Hash.ToLowerInvariant()){throw 'Served HTML differs from generated source'}
  & (Join-Path $source 'scripts/run-fast-cdp.ps1') -Scenario (Join-Path $source 'proof/growth/2026-09-19-dashboard-refresh/dashboard-refresh.scenario.json') -Output (Join-Path $output 'browser') -Workspace $source -Node $Node -RunId ($manifest.runId+'-browser') -PreviewPort 8090 -CdpPort 9338 -UseExistingPreview
}catch{$failure=$_}finally{
  if($server){
    $current=Get-CimInstance Win32_Process -Filter "ProcessId=$($server.Id)" -ErrorAction SilentlyContinue
    if($current){
      if($current.CreationDate -ne $serverIdentity.CreationDate -or $current.CommandLine -ne $serverIdentity.CommandLine -or $current.ExecutablePath -ne $serverIdentity.ExecutablePath){$cleanup='identity-mismatch';if(-not $failure){$failure='Static cleanup refused process identity mismatch'}}
      else{Stop-Process -Id $server.Id -Force;$server.WaitForExit();$cleanup='stopped-owned-server'}
    }else{$cleanup='already-exited'}
    $server.Dispose()
  }
  $changes=@($manifest.entries | Where-Object {(Get-FileHash -LiteralPath (Join-Path $source $_.path) -Algorithm SHA256).Hash.ToLowerInvariant() -cne $_.sha256} | ForEach-Object {$_.path})
  if($changes.Count -and -not $failure){$failure='Immutable source snapshot changed'}
  $result=[ordered]@{host='DANS1';runId=$manifest.runId;sourceDigest=$manifest.sourceDigest;source=$source;node=$Node;nodeSha256=(Get-FileHash -LiteralPath $Node -Algorithm SHA256).Hash.ToLowerInvariant();commands=$receipts;sourceChanges=$changes;serverCleanup=$cleanup;error=if($failure){[string]$failure}else{$null};verdict=if($failure){'FAIL'}else{'PASS'};limitations=@('Static generated dashboard only, not app or deployment qualification.','Curated historical image decoding proves asset availability, not the behaviour depicted.',"Only the two named source markdown documents and $($manifest.curatedImages) curated images are staged; other repository evidence links are syntax-checked, not navigated.")}
  $result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $output 'results.json') -Encoding utf8
  Copy-Item -LiteralPath (Join-Path $campaignFull 'source-manifest.json') -Destination $output
  $prefix=$output+'\'
  $files=@(Get-ChildItem -LiteralPath $output -Recurse -File | ForEach-Object {[ordered]@{path=$_.FullName.Substring($prefix.Length).Replace('\','/');bytes=$_.Length;sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()}})
  $files | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $output 'sha256-manifest.json') -Encoding utf8
  Write-Output ($result | ConvertTo-Json -Depth 8 -Compress)
}
if($failure){exit 1}
exit 0
