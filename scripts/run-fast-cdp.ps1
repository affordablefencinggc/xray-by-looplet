param(
  [Parameter(Mandatory = $true)][string]$Scenario,
  [Parameter(Mandatory = $true)][string]$Output,
  [Parameter(Mandatory = $true)][string]$Workspace,
  [ValidateRange(1024, 65535)][int]$CdpPort = 9337,
  [ValidateRange(1024, 65535)][int]$PreviewPort = 8080,
  [ValidateSet('dev', 'built')][string]$PreviewMode = 'dev',
  [switch]$UseExistingPreview,
  [string]$Chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe',
  [string]$Node = 'node',
  [ValidatePattern('^[a-zA-Z0-9_-]{1,80}$')][string]$RunId = ''
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Assert-Dans1 {
  $name = ([Net.Dns]::GetHostName() -split '\.')[0].Trim().ToLowerInvariant()
  if ($name -cne 'dans1') { throw "Raw-CDP campaigns are restricted to DANS1; observed host '$name'." }
}

function Get-ListeningConnections([int]$Port) {
  return @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
}

function Assert-LoopbackListeners([int]$Port, [string]$Purpose) {
  $listeners = @(Get-ListeningConnections $Port)
  if (-not $listeners.Count) { throw "$Purpose has no listener on port $Port." }
  $foreign = @($listeners | Where-Object { $_.LocalAddress -notin @('127.0.0.1', '::1') })
  if ($foreign.Count) { throw "$Purpose must listen only on loopback; observed $($foreign.LocalAddress -join ', ')." }
  return $listeners
}

function Get-ProcessSnapshot {
  return @(Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId, ExecutablePath, CommandLine, CreationDate)
}

function Get-TreeIds([int]$RootId, [object[]]$Snapshot) {
  $ids = [Collections.Generic.HashSet[int]]::new()
  [void]$ids.Add($RootId)
  do {
    $before = $ids.Count
    foreach ($process in $Snapshot) {
      if ($ids.Contains([int]$process.ParentProcessId)) { [void]$ids.Add([int]$process.ProcessId) }
    }
  } while ($ids.Count -ne $before)
  return @($ids | ForEach-Object { [int]$_ })
}

function Wait-HttpReady([uri]$Uri, [Diagnostics.Process]$Owner, [int]$Seconds = 90) {
  $deadline = [DateTime]::UtcNow.AddSeconds($Seconds)
  do {
    if ($Owner -and $Owner.HasExited) { throw "Preview process exited before $Uri became ready." }
    try {
      $response = Invoke-WebRequest -Uri $Uri -UseBasicParsing -TimeoutSec 2
      if ([int]$response.StatusCode -ge 200 -and [int]$response.StatusCode -lt 400) { return }
    } catch {
      if ([DateTime]::UtcNow -ge $deadline) { throw "Preview did not become ready at $Uri." }
    }
    Start-Sleep -Milliseconds 100
  } while ([DateTime]::UtcNow -lt $deadline)
  throw "Preview did not become ready at $Uri."
}

function Wait-File([string]$Path, [Diagnostics.Process]$Owner, [int]$Seconds = 30) {
  $deadline = [DateTime]::UtcNow.AddSeconds($Seconds)
  do {
    if (Test-Path -LiteralPath $Path) { return }
    if ($Owner.HasExited) { throw "Browser exited before creating $Path." }
    Start-Sleep -Milliseconds 100
  } while ([DateTime]::UtcNow -lt $deadline)
  throw "Browser did not create $Path."
}

function Stop-VerifiedTree(
  [Diagnostics.Process]$Root,
  [int]$Port,
  [string]$ExpectedExecutable,
  [string]$CommandMarker,
  [string]$Purpose
) {
  if ($null -eq $Root) { return [pscustomobject]@{ purpose = $Purpose; stopped = @(); status = 'not-owned' } }
  $snapshot = Get-ProcessSnapshot
  $rootRecord = $snapshot | Where-Object { $_.ProcessId -eq $Root.Id } | Select-Object -First 1
  if ($null -eq $rootRecord) { return [pscustomobject]@{ purpose = $Purpose; stopped = @(); status = 'already-exited' } }
  $expected = [IO.Path]::GetFullPath($ExpectedExecutable)
  if (-not [IO.Path]::GetFullPath([string]$rootRecord.ExecutablePath).Equals($expected, [StringComparison]::OrdinalIgnoreCase)) {
    throw "$Purpose root PID $($Root.Id) no longer belongs to the launched executable."
  }
  if ([string]$rootRecord.CommandLine -notlike "*$CommandMarker*") {
    throw "$Purpose root PID $($Root.Id) no longer contains its unique command marker."
  }
  if ([math]::Abs((([datetime]$rootRecord.CreationDate).ToUniversalTime() - $Root.StartTime.ToUniversalTime()).TotalSeconds) -gt 1) {
    throw "$Purpose root PID $($Root.Id) was reused; cleanup refused."
  }
  $treeIds = @(Get-TreeIds $Root.Id $snapshot)
  $listeners = @(Get-ListeningConnections $Port)
  $unexpected = @($listeners | Where-Object { $treeIds -notcontains [int]$_.OwningProcess })
  if ($unexpected.Count) { throw "$Purpose port $Port has a listener outside the owned process tree; cleanup refused." }
  # Numeric PID order is not ancestry order. Keep the root until last so its
  # shutdown cannot make a still-enumerated child's CIM identity disappear.
  $ordered = @($treeIds | Where-Object { $_ -ne $Root.Id }) + @($Root.Id)
  foreach ($id in $ordered) {
    $record = $snapshot | Where-Object { $_.ProcessId -eq $id } | Select-Object -First 1
    if ($null -eq $record) { continue }
    $current = Get-CimInstance Win32_Process -Filter "ProcessId=$id" -ErrorAction SilentlyContinue
    if ($null -eq $current) { continue }
    if ($current.CreationDate -ne $record.CreationDate -or $current.ExecutablePath -ne $record.ExecutablePath -or $current.CommandLine -ne $record.CommandLine) { throw "$Purpose descendant PID $id changed identity; cleanup refused." }
    $owned = Get-Process -Id $id -ErrorAction SilentlyContinue
    if ($owned -and $owned.CloseMainWindow()) { [void]$owned.WaitForExit(750) }
    $current = Get-CimInstance Win32_Process -Filter "ProcessId=$id" -ErrorAction SilentlyContinue
    if ($null -eq $current) { continue }
    if ($current.CreationDate -ne $record.CreationDate -or $current.ExecutablePath -ne $record.ExecutablePath -or $current.CommandLine -ne $record.CommandLine) { throw "$Purpose descendant PID $id changed identity during close; cleanup refused." }
    Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
  }
  $deadline = [DateTime]::UtcNow.AddSeconds(10)
  do {
    $remaining = @(Get-ListeningConnections $Port | Where-Object { $treeIds -contains [int]$_.OwningProcess })
    if (-not $remaining.Count) { return [pscustomobject]@{ purpose = $Purpose; stopped = $ordered; status = 'stopped' } }
    Start-Sleep -Milliseconds 100
  } while ([DateTime]::UtcNow -lt $deadline)
  throw "$Purpose owned listener did not stop on port $Port."
}

function Write-FinalManifest([string]$Root) {
  $rootPrefix = $Root.TrimEnd('\') + '\'
  $entries = @(Get-ChildItem -LiteralPath $Root -Recurse -File | Where-Object { $_.Name -ne 'sha256-manifest.json' } | ForEach-Object {
    if (-not $_.FullName.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Manifest entry escaped the evidence directory.' }
    $relative = $_.FullName.Substring($rootPrefix.Length).Replace('\', '/')
    [pscustomobject]@{
      path = $relative
      bytes = $_.Length
      sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    }
  } | Sort-Object path)
  $manifest = [ordered]@{
    schemaVersion = 1
    host = ([Net.Dns]::GetHostName()).ToLowerInvariant()
    generatedAt = [DateTime]::UtcNow.ToString('o')
    entries = $entries
  }
  $manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $Root 'sha256-manifest.json') -Encoding utf8
}

Assert-Dans1
if ($CdpPort -eq $PreviewPort) { throw 'CDP and preview ports must be different.' }
if (-not $RunId) { $RunId = [guid]::NewGuid().ToString('N') }
$scenarioFull = [IO.Path]::GetFullPath($Scenario)
$workspaceFull = [IO.Path]::GetFullPath($Workspace)
$outputFull = [IO.Path]::GetFullPath($Output)
$chromeFull = [IO.Path]::GetFullPath($Chrome)
if ($Node -eq 'node') {
  $snapshotRuntime = Join-Path (Split-Path $workspaceFull -Parent) 'runtime'
  $snapshotNode = Join-Path $snapshotRuntime 'node.exe'
  if (Test-Path -LiteralPath $snapshotNode -PathType Leaf) {
    $Node = $snapshotNode
    $env:PATH = $snapshotRuntime + ';' + $env:PATH
  }
}
if (-not (Test-Path -LiteralPath $scenarioFull -PathType Leaf)) { throw "Scenario not found: $scenarioFull" }
if (-not (Test-Path -LiteralPath $workspaceFull -PathType Container)) { throw "Workspace not found: $workspaceFull" }
if (-not (Test-Path -LiteralPath $chromeFull -PathType Leaf)) { throw "Chrome not found: $chromeFull" }
if (Test-Path -LiteralPath $outputFull) { throw "Output already exists; historical evidence will not be overwritten: $outputFull" }
New-Item -ItemType Directory -Path $outputFull | Out-Null

$previewUri = [uri]"http://127.0.0.1:$PreviewPort/"
$profile = Join-Path ([IO.Path]::GetTempPath()) "xray-fast-cdp-profile-$RunId"
if (Test-Path -LiteralPath $profile) { throw "Unique Chrome profile already exists: $profile" }
New-Item -ItemType Directory -Path $profile | Out-Null
$endpointFile = Join-Path $outputFull 'verified-cdp-endpoint.txt'
$previewRoot = $null
$browserRoot = $null
$previewToken = "XRAY_FAST_CDP_PREVIEW_$RunId"
$browserMarker = "xray-fast-cdp-profile-$RunId"
$startedAt = [DateTime]::UtcNow
$campaignError = $null
$nodeExitCode = $null
$cleanup = [Collections.Generic.List[object]]::new()

try {
  if ($UseExistingPreview) {
    $previewListeners = Assert-LoopbackListeners $PreviewPort 'Existing preview'
    foreach ($listener in $previewListeners) {
      $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
      $leaf = [IO.Path]::GetFileName([string]$process.ExecutablePath)
      if ($leaf -notin @('node.exe', 'bun.exe') -or [string]$process.CommandLine -notmatch '(with-app-env|vite|preview-built)') {
        throw "Existing preview listener PID $($listener.OwningProcess) is not a recognized X-Ray preview process."
      }
    }
    Wait-HttpReady $previewUri $null 10
  } else {
    if (@(Get-ListeningConnections $PreviewPort).Count) { throw "Preview port $PreviewPort is already occupied; choose a unique port or explicitly use -UseExistingPreview." }
    $comspec = [IO.Path]::GetFullPath($env:ComSpec)
    if ($PreviewMode -eq 'dev') {
      $previewCommand = "title $previewToken & npm.cmd run dev -- --host 127.0.0.1 --port $PreviewPort --strictPort"
    } else {
      $previewCommand = "title $previewToken & set `"PREVIEW_HOST=127.0.0.1`" & set `"PREVIEW_PORT=$PreviewPort`" & npm.cmd run preview"
    }
    $previewRoot = Start-Process -FilePath $comspec -ArgumentList @('/d', '/s', '/c', "`"$previewCommand`"") -WorkingDirectory $workspaceFull -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $outputFull 'preview.stdout.log') -RedirectStandardError (Join-Path $outputFull 'preview.stderr.log')
    Wait-HttpReady $previewUri $previewRoot 120
    $previewListeners = Assert-LoopbackListeners $PreviewPort 'Owned preview'
    $previewSnapshot = Get-ProcessSnapshot
    $previewTree = @(Get-TreeIds $previewRoot.Id $previewSnapshot)
    foreach ($listener in $previewListeners) {
      if ($previewTree -notcontains [int]$listener.OwningProcess) { throw "Preview listener is outside the launched process tree." }
      $process = $previewSnapshot | Where-Object { $_.ProcessId -eq $listener.OwningProcess } | Select-Object -First 1
      if ([IO.Path]::GetFileName([string]$process.ExecutablePath) -ne 'node.exe' -or [string]$process.CommandLine -notmatch '(with-app-env|vite|preview-built)') {
        throw "Preview listener process identity is unexpected."
      }
    }
  }

  if (@(Get-ListeningConnections $CdpPort).Count) { throw "CDP port $CdpPort is already occupied; choose a unique port." }
  $chromeArguments = @(
    '--headless=new',
    '--enable-automation',
    '--enable-features=NetworkServiceSandbox,RendererAppContainer',
    '--disable-background-networking',
    '--disable-component-update',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-address=127.0.0.1',
    "--remote-debugging-port=$CdpPort",
    "--user-data-dir=$profile",
    '--remote-allow-origins=http://127.0.0.1',
    'about:blank'
  )
  $browserRoot = Start-Process -FilePath $chromeFull -ArgumentList $chromeArguments -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $outputFull 'chrome.stdout.log') -RedirectStandardError (Join-Path $outputFull 'chrome.stderr.log')
  # Chrome writes DevToolsActivePort for dynamically allocated ports. This
  # launcher uses an explicit guarded port, so discover its browser endpoint
  # only after verifying the listener's process identity below.
  Wait-HttpReady ([uri]"http://127.0.0.1:$CdpPort/json/version") $browserRoot 30
  $cdpListeners = Assert-LoopbackListeners $CdpPort 'Chrome DevTools Protocol'
  $browserSnapshot = Get-ProcessSnapshot
  $browserTree = @(Get-TreeIds $browserRoot.Id $browserSnapshot)
  foreach ($listener in $cdpListeners) {
    if ($browserTree -notcontains [int]$listener.OwningProcess) { throw 'CDP listener is outside the launched browser process tree.' }
    $process = $browserSnapshot | Where-Object { $_.ProcessId -eq $listener.OwningProcess } | Select-Object -First 1
    if (-not [IO.Path]::GetFullPath([string]$process.ExecutablePath).Equals($chromeFull, [StringComparison]::OrdinalIgnoreCase)) { throw 'CDP listener is not owned by the requested Chrome executable.' }
    $commandLine = [string]$process.CommandLine
    if ($commandLine -notlike "*$profile*" -or $commandLine -notlike "*--remote-debugging-port=$CdpPort*" -or $commandLine -notlike '*--remote-debugging-address=127.0.0.1*') {
      throw 'CDP listener command line does not match the unique profile and loopback endpoint.'
    }
    if ($commandLine -match '--(no-sandbox|disable-setuid-sandbox|single-process|disable-seccomp-filter-sandbox|disable-gpu-sandbox)(=|\s|$)') {
      throw 'Unsafe browser sandbox flag detected.'
    }
  }
  $browserVersion = Invoke-RestMethod -Uri "http://127.0.0.1:$CdpPort/json/version" -TimeoutSec 5
  $websocket = [uri]$browserVersion.webSocketDebuggerUrl
  if ($websocket.Scheme -cne 'ws' -or $websocket.Host -cne '127.0.0.1' -or $websocket.Port -ne $CdpPort -or $websocket.AbsolutePath -notmatch '^/devtools/browser/[a-f0-9-]+$') { throw 'Browser endpoint does not match the verified loopback listener.' }
  @([string]$CdpPort, $websocket.AbsolutePath) | Set-Content -LiteralPath $endpointFile -Encoding ASCII

  & $Node (Join-Path $PSScriptRoot 'fast-cdp.mjs') --endpoint-file $endpointFile --scenario $scenarioFull --output $outputFull --origin $previewUri.AbsoluteUri --run-id $RunId --close-browser true
  $nodeExitCode = $LASTEXITCODE
  if ($nodeExitCode -ne 0) { throw "Fast CDP runner exited with code $nodeExitCode." }
} catch {
  $campaignError = $_
} finally {
  try {
    if ($browserRoot -and -not $browserRoot.HasExited) { [void]$browserRoot.WaitForExit(5000) }
    $cleanup.Add((Stop-VerifiedTree $browserRoot $CdpPort $chromeFull $browserMarker 'browser'))
  } catch {
    $cleanup.Add([pscustomobject]@{ purpose = 'browser'; status = 'cleanup-failed'; error = $_.Exception.Message })
    if ($null -eq $campaignError) { $campaignError = $_ }
  }
  try {
    if ($previewRoot) {
      $cleanup.Add((Stop-VerifiedTree $previewRoot $PreviewPort ([IO.Path]::GetFullPath($env:ComSpec)) $previewToken 'preview'))
    } else {
      $cleanup.Add([pscustomobject]@{ purpose = 'preview'; status = 'not-owned'; stopped = @() })
    }
  } catch {
    $cleanup.Add([pscustomobject]@{ purpose = 'preview'; status = 'cleanup-failed'; error = $_.Exception.Message })
    if ($null -eq $campaignError) { $campaignError = $_ }
  }
  $previewRootPid = if ($previewRoot) { $previewRoot.Id } else { $null }
  $browserRootPid = if ($browserRoot) { $browserRoot.Id } else { $null }
  $browserVerdict = $null
  $browserResultsPath = Join-Path $outputFull 'browser-results.json'
  if (Test-Path -LiteralPath $browserResultsPath) {
    try { $browserVerdict = (Get-Content -LiteralPath $browserResultsPath -Raw | ConvertFrom-Json).verdict } catch { $browserVerdict = $null }
  }
  $launcherVerdict = if ($campaignError) { if ($browserVerdict -eq 'FAIL') { 'FAIL' } else { 'INFRA_FAILURE' } } else { 'PASS' }
  $launcher = [ordered]@{
    schemaVersion = 1
    runId = $RunId
    host = ([Net.Dns]::GetHostName()).ToLowerInvariant()
    startedAt = $startedAt.ToString('o')
    completedAt = [DateTime]::UtcNow.ToString('o')
    workspace = $workspaceFull
    scenario = $scenarioFull
    output = $outputFull
    preview = @{ uri = $previewUri.AbsoluteUri; mode = $PreviewMode; existing = [bool]$UseExistingPreview; rootPid = $previewRootPid }
    browser = @{ executable = $chromeFull; rootPid = $browserRootPid; cdpPort = $CdpPort; profile = $profile }
    nodeExitCode = $nodeExitCode
    cleanup = @($cleanup)
    verdict = $launcherVerdict
    error = if ($campaignError) { $campaignError.Exception.Message } else { $null }
  }
  $launcher | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $outputFull 'launcher-results.json') -Encoding utf8
  Write-FinalManifest $outputFull
}

if ($campaignError) { throw $campaignError }
Write-Output ([ordered]@{ runId = $RunId; host = 'DANS1'; verdict = 'PASS'; output = $outputFull } | ConvertTo-Json -Compress)
