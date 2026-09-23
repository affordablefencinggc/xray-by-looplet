param([int]$Count=1,[string]$Run='baseline')
$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue'
if($env:COMPUTERNAME -ne 'DANS1'){throw 'DANS1 required'}
$exe='C:\Users\danie\XRayBuilds\runs\8a6226fc93a6\source\src-tauri\target\release\xray-by-looplet.exe'
$root="C:\Users\danie\XRayBuilds\v1-stability-20260924\native-$Run"
if(Test-Path $root){throw 'Evidence exists'}
New-Item -ItemType Directory $root | Out-Null
$results=@()
for($i=1;$i -le $Count;$i++){
  $env:WEBVIEW2_USER_DATA_FOLDER=Join-Path $root "profile-$i"
  $cdpPort=9360+$i
  if(Get-NetTCPConnection -State Listen -LocalPort $cdpPort -ErrorAction SilentlyContinue){throw 'CDP port occupied'}
  $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--remote-debugging-port=$cdpPort --remote-debugging-address=127.0.0.1"
  $app=Start-Process -FilePath $exe -WindowStyle Hidden -PassThru
  $identity=Get-CimInstance Win32_Process -Filter "ProcessId=$($app.Id)"
  $record=[ordered]@{host='DANS1';run=$i;pid=$app.Id;created=$identity.CreationDate.ToString('o');exe=$exe;sha256=(Get-FileHash $exe -Algorithm SHA256).Hash;purpose='isolated native graceful-close reproduction';lastActivity=[DateTime]::UtcNow.ToString('o')}
  $record | ConvertTo-Json | Set-Content (Join-Path $root "launch-$i.json")
  try {
    $deadline=[DateTime]::UtcNow.AddSeconds(45)
    $targets=$null
    do {try {$targets=Invoke-RestMethod "http://127.0.0.1:$cdpPort/json/list";if($targets){break}}catch{Start-Sleep -Milliseconds 100}} while([DateTime]::UtcNow -lt $deadline)
    if(-not $targets){throw 'CDP unavailable'}
    $listeners=@(Get-NetTCPConnection -State Listen -LocalPort $cdpPort)
    if(@($listeners | Where-Object {$_.LocalAddress -notin @('127.0.0.1','::1')}).Count){throw 'Non-loopback CDP'}
    foreach($listener in $listeners){
      $owner=Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
      $chain=@($owner.ProcessId)
      while($owner -and $owner.ProcessId -ne $app.Id -and $chain -notcontains $owner.ParentProcessId){$owner=Get-CimInstance Win32_Process -Filter "ProcessId=$($owner.ParentProcessId)";if($owner){$chain+=$owner.ProcessId}}
      if(-not $owner -or $owner.ProcessId -ne $app.Id){throw 'CDP outside owned app process tree'}
    }
    & 'C:\Users\danie\XRayBuilds\runs\8a6226fc93a6\runtime\node.exe' 'C:\Users\danie\XRayBuilds\v1-stability-20260924\native-probe.mjs' $root $i $cdpPort *> (Join-Path $root "probe-$i.log")
    if($LASTEXITCODE -ne 0){throw 'Native probe failed'}
    $app.Refresh()
    $record.hwnd=$app.MainWindowHandle.ToInt64()
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
    if($again){
      if($again.CreationDate -ne $identity.CreationDate -or $again.ExecutablePath -ne $identity.ExecutablePath){throw 'Process identity changed; preserved'}
      $record.remainingWindow=(Get-Process -Id $app.Id).MainWindowHandle.ToInt64()
      Stop-Process -Id $app.Id
      $record.forced=$true
    }
    $record.lastActivity=[DateTime]::UtcNow.ToString('o')
    $results+= [pscustomobject]$record
    $results | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $root 'close-results.json')
  }
}
$results | ConvertTo-Json -Depth 6
if(@($results | Where-Object {$_.error -or $_.forced -or -not $_.exited}).Count){exit 1}
