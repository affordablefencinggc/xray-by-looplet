param(
  [Parameter(Mandatory=$true)][string]$Campaign,
  [Parameter(Mandatory=$true)][string]$Source,
  [Parameter(Mandatory=$true)][string]$BrowserOutput
)
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
if(([Net.Dns]::GetHostName() -split '\.')[0].ToLowerInvariant() -cne 'dans1'){throw 'DANS1 only'}
$campaignFull=[IO.Path]::GetFullPath($Campaign)
$sourceFull=[IO.Path]::GetFullPath($Source)
$browserFull=[IO.Path]::GetFullPath($BrowserOutput)
if($campaignFull -notmatch '^C:\\Users\\danie\\XRayBuilds\\sc11-mounted-pdf\\sc11-[a-f0-9]{12}-pdf[0-9]+$'){throw 'Unexpected PDF campaign target'}
if($sourceFull -notmatch '^C:\\Users\\danie\\XRayBuilds\\preflight\\sc11-[a-f0-9]{12}\\source$'){throw 'Unexpected frozen source path'}
if($browserFull -notmatch '^C:\\Users\\danie\\XRayFastCdp\\runs\\sc11-[a-f0-9]{12}-mounted-dev[0-9]+\\output$'){throw 'Unexpected application browser output'}
$output=Join-Path $campaignFull 'output'
$inputRoot=Join-Path $campaignFull 'input'
$runId=Split-Path $campaignFull -Leaf
$runtime=Join-Path (Split-Path $sourceFull -Parent) 'runtime'
$node=Join-Path $runtime 'node.exe'
$env:PATH=$runtime+';'+$env:PATH
if(Test-Path -LiteralPath $output){throw 'Preserve existing PDF campaign output'}
$runtimeTools=Join-Path $sourceFull ('.temp\'+$runId)
if(Test-Path -LiteralPath $runtimeTools){throw 'Preserve existing PDF runtime helper directory'}
$manifest=Get-Content -LiteralPath (Join-Path $inputRoot 'tool-manifest.json') -Raw | ConvertFrom-Json
foreach($entry in $manifest.entries){
  $path=[IO.Path]::GetFullPath((Join-Path $inputRoot $entry.path))
  if(-not $path.StartsWith($inputRoot+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Tool path escaped input directory'}
  if((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -cne $entry.sha256){throw "Transferred tool hash mismatch: $($entry.path)"}
}
$appResults=Get-Content -LiteralPath (Join-Path $browserFull 'browser-results.json') -Raw | ConvertFrom-Json
if($appResults.verdict -cne 'PASS' -or $appResults.host.ToLowerInvariant() -cne 'dans1'){throw 'Mounted application browser campaign must be PASS on DANS1 first'}
$sourceManifestPath=Join-Path (Split-Path $sourceFull -Parent) 'source-manifest.json'
$sourceManifest=Get-Content -LiteralPath $sourceManifestPath -Raw | ConvertFrom-Json
function Get-SourceChanges {
  return @($sourceManifest.entries | Where-Object {(Get-FileHash -LiteralPath (Join-Path $sourceFull $_.path) -Algorithm SHA256).Hash.ToLowerInvariant() -cne $_.sha256} | ForEach-Object {$_.path})
}
if(@(Get-SourceChanges).Count){throw 'Frozen application source changed before PDF readback'}
New-Item -ItemType Directory -Path $output,$runtimeTools | Out-Null
Copy-Item -LiteralPath $sourceManifestPath -Destination (Join-Path $output 'source-manifest.json')
Copy-Item -LiteralPath (Join-Path $inputRoot 'tool-manifest.json') -Destination (Join-Path $output 'tool-manifest.json')
foreach($name in @('build-pdf-scenario.mjs','pdf-viewer.html','serve-downloaded-pdf.mjs')){
  Copy-Item -LiteralPath (Join-Path $inputRoot $name) -Destination (Join-Path $runtimeTools $name)
}
$serverScript=Join-Path $runtimeTools 'preview-built-sc11-pdf.mjs'
Copy-Item -LiteralPath (Join-Path $runtimeTools 'serve-downloaded-pdf.mjs') -Destination $serverScript
$serverHash=(Get-FileHash -LiteralPath $serverScript -Algorithm SHA256).Hash.ToLowerInvariant()
if($serverHash -cne (Get-FileHash -LiteralPath (Join-Path $inputRoot 'serve-downloaded-pdf.mjs') -Algorithm SHA256).Hash.ToLowerInvariant()){throw 'Server alias copy changed bytes'}
$renderer=Join-Path $sourceFull 'node_modules\pdfjs-dist'
$rendererFiles=@('package.json','build/pdf.mjs','build/pdf.worker.mjs') | ForEach-Object {$path=Join-Path $renderer $_;[ordered]@{path=$_;sha256=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant();bytes=(Get-Item -LiteralPath $path).Length}}
$rendererFiles | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $output 'renderer-manifest.json') -Encoding utf8
$server=$null;$identity=$null;$errorRecord=$null;$cleanup=[ordered]@{status='not-started'};$commands=@()
$started=[DateTime]::UtcNow
try{
  $generator=Join-Path $runtimeTools 'build-pdf-scenario.mjs'
  $generationStart=[DateTime]::UtcNow
  & $node $generator $browserFull $output 1> (Join-Path $output 'build-scenario.stdout.log') 2> (Join-Path $output 'build-scenario.stderr.log')
  $generationExit=$LASTEXITCODE
  $commands += [ordered]@{name='build-pdf-scenario';executable=$node;arguments=@($generator,$browserFull,$output);startedAt=$generationStart.ToString('o');completedAt=[DateTime]::UtcNow.ToString('o');exitCode=$generationExit}
  if($generationExit -ne 0){throw "PDF scenario generator failed: $generationExit"}
  foreach($port in @(8090,9338)){if(@(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue).Count){throw "Reserved PDF port is occupied: $port"}}
  $server=Start-Process -FilePath $node -ArgumentList @($serverScript,$sourceFull,$browserFull,$output,'8090') -WorkingDirectory $sourceFull -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $output 'server.stdout.log') -RedirectStandardError (Join-Path $output 'server.stderr.log')
  $identity=Get-CimInstance Win32_Process -Filter "ProcessId=$($server.Id)"
  if(-not $identity -or $identity.CommandLine -notlike "*$serverScript*" -or [IO.Path]::GetFullPath($identity.ExecutablePath) -ine [IO.Path]::GetFullPath($node)){throw 'PDF server launch identity mismatch'}
  [ordered]@{owner='Codex /root/sc11_download_campaign';purpose='SC11 real disk-downloaded PDF readback';lastTaskActivity=[DateTime]::UtcNow.ToString('o');process=$identity | Select-Object ProcessId,CreationDate,ExecutablePath,CommandLine;serverSha256=$serverHash;aliasPreservesServerBytes=$true} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $output 'server-process.json') -Encoding utf8
  $deadline=[DateTime]::UtcNow.AddSeconds(20)
  do{
    if($server.HasExited){throw 'PDF readback server exited before readiness'}
    try{$response=Invoke-WebRequest -Uri 'http://127.0.0.1:8090/' -UseBasicParsing -TimeoutSec 2;if($response.StatusCode -eq 200){break}}catch{}
    if([DateTime]::UtcNow -gt $deadline){throw 'PDF readback server readiness timeout'}
    Start-Sleep -Milliseconds 100
  }while($true)
  $listeners=@(Get-NetTCPConnection -State Listen -LocalPort 8090)
  if($listeners.Count -ne 1 -or $listeners[0].LocalAddress -cne '127.0.0.1' -or $listeners[0].OwningProcess -ne $server.Id){throw 'PDF server loopback ownership mismatch'}
  $browserStart=[DateTime]::UtcNow
  & (Join-Path $sourceFull 'scripts/run-fast-cdp.ps1') -Scenario (Join-Path $output 'pdf-render.scenario.json') -Output (Join-Path $output 'browser') -Workspace $sourceFull -Node $node -RunId $runId -PreviewPort 8090 -CdpPort 9338 -UseExistingPreview 1> (Join-Path $output 'browser-launch.stdout.log') 2> (Join-Path $output 'browser-launch.stderr.log')
  $commands += [ordered]@{name='canonical-fast-cdp';script=(Join-Path $sourceFull 'scripts/run-fast-cdp.ps1');scenario=(Join-Path $output 'pdf-render.scenario.json');startedAt=$browserStart.ToString('o');completedAt=[DateTime]::UtcNow.ToString('o');previewPort=8090;cdpPort=9338;useExistingPreview=$true}
  $browser=Get-Content -LiteralPath (Join-Path $output 'browser/browser-results.json') -Raw | ConvertFrom-Json
  if($browser.verdict -cne 'PASS'){throw 'PDF browser campaign is not PASS'}
}catch{$errorRecord=$_}finally{
  if($server){
    try{
      $current=Get-CimInstance Win32_Process -Filter "ProcessId=$($server.Id)" -ErrorAction SilentlyContinue
      if($current){
        if(-not $identity -or $current.CreationDate -ne $identity.CreationDate -or $current.ExecutablePath -ne $identity.ExecutablePath -or $current.CommandLine -ne $identity.CommandLine){throw 'PDF cleanup refused: process identity changed'}
        $graceful=$server.CloseMainWindow()
        if($graceful){[void]$server.WaitForExit(1000)}
        $current=Get-CimInstance Win32_Process -Filter "ProcessId=$($server.Id)" -ErrorAction SilentlyContinue
        if($current){
          if($current.CreationDate -ne $identity.CreationDate -or $current.ExecutablePath -ne $identity.ExecutablePath -or $current.CommandLine -ne $identity.CommandLine){throw 'PDF cleanup refused after graceful close: identity changed'}
          $current | Select-Object ProcessId,CreationDate,ExecutablePath,CommandLine | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $output 'server-pre-stop-diagnostic.json') -Encoding utf8
          Stop-Process -Id $server.Id -Force -ErrorAction Stop
          [void]$server.WaitForExit(5000)
        }
        if(Get-CimInstance Win32_Process -Filter "ProcessId=$($server.Id)" -ErrorAction SilentlyContinue){throw 'Owned PDF server remains alive'}
        $cleanup=[ordered]@{status='stopped-owned-server';pid=$server.Id;gracefulCloseAttempted=$true;gracefulWindowAvailable=$graceful;completedAt=[DateTime]::UtcNow.ToString('o')}
      }else{$cleanup=[ordered]@{status='already-exited';pid=$server.Id}}
    }catch{$cleanup=[ordered]@{status='cleanup-failed';error=[string]$_};if(-not $errorRecord){$errorRecord=$_}}
    $server.Dispose()
  }
  $changed=@(Get-SourceChanges)
  if($changed.Count -and -not $errorRecord){$errorRecord='Frozen application source changed during PDF readback'}
  $result=[ordered]@{host='DANS1';runId=$runId;startedAt=$started.ToString('o');completedAt=[DateTime]::UtcNow.ToString('o');source=$sourceFull;sourceDigest=$sourceManifest.sourceDigest;applicationBrowserOutput=$browserFull;applicationBrowserResultsSha256=(Get-FileHash -LiteralPath (Join-Path $browserFull 'browser-results.json') -Algorithm SHA256).Hash.ToLowerInvariant();node=$node;nodeSha256=(Get-FileHash -LiteralPath $node -Algorithm SHA256).Hash.ToLowerInvariant();renderer='Existing PDF.js dependency; actual application PDF disk readback, no synthetic exporter';commands=$commands;sourceChanges=$changed;serverCleanup=$cleanup;verdict=if($errorRecord){'FAIL'}else{'PASS'};error=if($errorRecord){[string]$errorRecord}else{$null};limitations=@('Desktop/tablet browser viewport proof, not physical-device/native/deployment proof','Controlled saved-draft qualification data; PDF hash does not certify source quantities')}
  $result | ConvertTo-Json -Depth 9 | Set-Content -LiteralPath (Join-Path $output 'results.json') -Encoding utf8
  $files=@(Get-ChildItem -LiteralPath $output -Recurse -File | Where-Object {$_.Name -ne 'sha256-manifest.json'} | ForEach-Object {[ordered]@{path=$_.FullName.Substring($output.Length+1).Replace('\','/');bytes=$_.Length;sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()}})
  [ordered]@{host='DANS1';entries=$files} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $output 'sha256-manifest.json') -Encoding utf8
  Write-Output ($result | ConvertTo-Json -Depth 9 -Compress)
}
if($errorRecord){exit 1}
