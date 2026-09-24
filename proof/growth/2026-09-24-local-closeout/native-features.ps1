param([ValidateRange(1,10)][int]$Count=1,[ValidatePattern('^[a-z0-9-]+$')][string]$Run='native-features01')
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
if ($env:COMPUTERNAME -ne 'DANIEL') { throw 'Explicitly authorized DANIEL campaign only.' }
$workspace=(Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$exe=Join-Path $workspace 'src-tauri/target/release/xray-by-looplet.exe'
$root=Join-Path $PSScriptRoot $Run
$private=Join-Path 'C:\Users\danie\XRayPrivateProof\v1-local-build' $Run
if ((Test-Path -LiteralPath $root) -or (Test-Path -LiteralPath $private)) { throw 'Existing evidence/profile must be preserved.' }
$audit=Get-Content (Join-Path $PSScriptRoot 'stage1-audit.json') -Raw | ConvertFrom-Json
$expected=($audit.artifacts | Where-Object {$_.path -eq 'src-tauri/target/release/xray-by-looplet.exe'}).sha256
if ((Get-FileHash -LiteralPath $exe).Hash.ToLowerInvariant() -ne $expected) { throw 'Native artifact changed after build audit.' }
if ((Get-FileHash -LiteralPath (Join-Path $workspace 'src-tauri/target/release/engine/bin/xray-engine.exe')).Hash.ToLowerInvariant() -ne 'e4693d8f2c84f125f87c316505866e23ea57aaf6e5bbc0315b0cc5360d09a49d') { throw 'Bundled engine resource mismatch.' }
New-Item -ItemType Directory -Path $root,$private | Out-Null
$env:XRAY_ENGINE_PATH=$null
$results=@()
Set-Location $workspace
for ($i=1;$i -le $Count;$i++) {
  $env:WEBVIEW2_USER_DATA_FOLDER=Join-Path $private "profile-$i"
  $port=9360+$i
  if (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) { throw 'Native test port is occupied.' }
  $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--remote-debugging-port=$port --remote-debugging-address=127.0.0.1"
  $app=Start-Process -FilePath $exe -WorkingDirectory $private -WindowStyle Hidden -PassThru
  $identity=Get-CimInstance Win32_Process -Filter "ProcessId=$($app.Id)"
  $record=[ordered]@{host='DANIEL';run=$i;pid=$app.Id;created=$identity.CreationDate.ToUniversalTime().ToString('o');exe=$exe;command=$identity.CommandLine;sha256=$expected;profile=$env:WEBVIEW2_USER_DATA_FOLDER;purpose='Native stock, hardware, quote issue/revision and reload qualification';lastActivity=[DateTime]::UtcNow.ToString('o');defaultBundledEngine=$true;emailAction=$false}
  $record | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $root "launch-$i.json") -Encoding UTF8
  try {
    $deadline=[DateTime]::UtcNow.AddSeconds(45)
    $targets=$null
    do { try { $targets=Invoke-RestMethod "http://127.0.0.1:$port/json/list"; if ($targets) { break } } catch { Start-Sleep -Milliseconds 100 } } while ([DateTime]::UtcNow -lt $deadline)
    if (-not $targets) { throw 'Native CDP endpoint unavailable.' }
    foreach ($listener in @(Get-NetTCPConnection -State Listen -LocalPort $port)) {
      if ($listener.LocalAddress -notin @('127.0.0.1','::1')) { throw 'Non-loopback native CDP endpoint.' }
      $owner=Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
      $seen=@($owner.ProcessId)
      while ($owner -and $owner.ProcessId -ne $app.Id -and $seen -notcontains $owner.ParentProcessId) { $owner=Get-CimInstance Win32_Process -Filter "ProcessId=$($owner.ParentProcessId)"; if ($owner) { $seen+=$owner.ProcessId } }
      if (-not $owner -or $owner.ProcessId -ne $app.Id -or $owner.CreationDate -ne $identity.CreationDate) { throw 'Native CDP endpoint is outside the verified app tree.' }
    }
    $email='false'
    & node (Join-Path $PSScriptRoot 'native-feature-probe.mjs') $root $i $port $email *> (Join-Path $root "probe-$i.log")
    if ($LASTEXITCODE -ne 0) { throw 'Native UI workload failed.' }
    $record.workloadOperations=137
    $app.Refresh()
    $watch=[Diagnostics.Stopwatch]::StartNew()
    $record.requested=$app.CloseMainWindow()
    $record.exited=$app.WaitForExit(5000)
    $record.elapsedMs=$watch.Elapsed.TotalMilliseconds
    $record.forced=$false
  } catch {
    $record.error=$_.Exception.Message
    $app.Refresh()
    $record.cleanupCloseRequested=$app.CloseMainWindow()
    $record.cleanupGraceful=$app.WaitForExit(5000)
  } finally {
    $again=Get-CimInstance Win32_Process -Filter "ProcessId=$($app.Id)"
    if ($again) {
      if ($again.CreationDate -ne $identity.CreationDate -or $again.ExecutablePath -ne $identity.ExecutablePath -or $again.CommandLine -ne $identity.CommandLine) { throw 'Owned app PID changed identity; cleanup refused.' }
      Stop-Process -Id $app.Id
      $record.forced=$true
    }
    $record.lastActivity=[DateTime]::UtcNow.ToString('o')
    $results+=[pscustomobject]$record
    @($results) | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $root 'close-results.json') -Encoding UTF8
    Write-Output ($record | ConvertTo-Json -Compress)
  }
  if ($record.error -or $record.forced -or -not $record.exited) { throw 'Native gate failed; preserved partial evidence.' }
}
