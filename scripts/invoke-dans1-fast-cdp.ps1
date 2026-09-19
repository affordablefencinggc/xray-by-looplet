param(
  [Parameter(Mandatory = $true)][string]$Scenario,
  [Parameter(Mandatory = $true)][string]$RemoteWorkspace,
  [Parameter(Mandatory = $true)][string]$EvidenceRoot,
  [string]$SshHost = 'tonys-test-pc',
  [ValidatePattern('^[a-zA-Z0-9_-]{1,80}$')][string]$RunId = '',
  [ValidateRange(1024, 65535)][int]$CdpPort = 9337,
  [ValidateRange(1024, 65535)][int]$PreviewPort = 8080,
  [ValidateSet('dev', 'built')][string]$PreviewMode = 'dev',
  [switch]$UseExistingPreview,
  [string]$RemoteRunsRoot = 'C:\Users\danie\XRayFastCdp\runs',
  [string]$Chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function ConvertTo-EncodedCommand([string]$Command) {
  return [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($Command))
}

function Assert-SafeRemotePath([string]$Path, [switch]$NoWhitespace) {
  if ($Path -notmatch '^[a-zA-Z]:\\' -or $Path -match '[\r\n"'';&|<>]') { throw "Unsafe remote Windows path: $Path" }
  if ($NoWhitespace -and $Path -match '\s') { throw "Remote transfer root may not contain whitespace: $Path" }
}

function ConvertTo-ScpPath([string]$Path) {
  return $Path.Replace('\', '/')
}

function Invoke-RemotePowerShell([string]$Command, [string]$Stdout = '', [string]$Stderr = '') {
  $encoded = ConvertTo-EncodedCommand $Command
  if ($Stdout) {
    & ssh $SshHost powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand $encoded 1> $Stdout 2> $Stderr
  } else {
    $remoteOutput = & ssh $SshHost powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand $encoded 2>&1
    if ($remoteOutput) { Write-Verbose ($remoteOutput -join [Environment]::NewLine) }
  }
  return $LASTEXITCODE
}

function Write-TransferManifest([string]$Root) {
  $prefix = $Root.TrimEnd('\') + '\'
  $entries = @(Get-ChildItem -LiteralPath $Root -Recurse -File | Where-Object { $_.Name -ne 'transfer-manifest.json' } | ForEach-Object {
    if (-not $_.FullName.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Transfer manifest entry escaped the campaign directory.' }
    [pscustomobject]@{
      path = $_.FullName.Substring($prefix.Length).Replace('\', '/')
      bytes = $_.Length
      sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    }
  } | Sort-Object path)
  [ordered]@{
    schemaVersion = 1
    generatedAt = [DateTime]::UtcNow.ToString('o')
    remoteHost = 'DANS1'
    entries = $entries
  } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $Root 'transfer-manifest.json') -Encoding utf8
}

$scenarioFull = [IO.Path]::GetFullPath($Scenario)
if (-not (Test-Path -LiteralPath $scenarioFull -PathType Leaf)) { throw "Scenario not found: $scenarioFull" }
if (-not $RunId) { $RunId = ([DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ') + '-' + [guid]::NewGuid().ToString('N').Substring(0, 12)) }
Assert-SafeRemotePath $RemoteWorkspace
Assert-SafeRemotePath $RemoteRunsRoot -NoWhitespace
Assert-SafeRemotePath $Chrome
if ($CdpPort -eq $PreviewPort) { throw 'CDP and preview ports must be different.' }

$hostOutput = @(& ssh $SshHost hostname)
if ($LASTEXITCODE -ne 0) { throw "Cannot reach DANS1 through SSH alias '$SshHost'." }
$observedHost = (($hostOutput -join '').Trim() -split '\.')[0].ToLowerInvariant()
if ($observedHost -cne 'dans1') { throw "SSH host guard failed; expected DANS1 and observed '$observedHost'." }

$evidenceRootFull = [IO.Path]::GetFullPath($EvidenceRoot)
if (-not (Test-Path -LiteralPath $evidenceRootFull)) { New-Item -ItemType Directory -Path $evidenceRootFull | Out-Null }
$localCampaign = Join-Path $evidenceRootFull $RunId
if (Test-Path -LiteralPath $localCampaign) { throw "Local campaign already exists; historical evidence will not be overwritten: $localCampaign" }
New-Item -ItemType Directory -Path $localCampaign | Out-Null

$remoteCampaign = Join-Path $RemoteRunsRoot $RunId
$remoteInput = Join-Path $remoteCampaign 'input'
$remoteOutput = Join-Path $remoteCampaign 'output'
$payload = [ordered]@{
  runId = $RunId
  workspace = $RemoteWorkspace
  campaign = $remoteCampaign
  input = $remoteInput
  output = $remoteOutput
  scenario = (Join-Path $remoteInput 'scenario.json')
  runScript = (Join-Path $remoteInput 'run-fast-cdp.ps1')
  cdpPort = $CdpPort
  previewPort = $PreviewPort
  previewMode = $PreviewMode
  useExistingPreview = [bool]$UseExistingPreview
  chrome = $Chrome
}
$payloadBase64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(($payload | ConvertTo-Json -Compress)))

$preflight = @'
$ErrorActionPreference='Stop'
$p=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('__PAYLOAD__')) | ConvertFrom-Json
$name=(([Net.Dns]::GetHostName() -split '\.')[0]).ToLowerInvariant()
if($name -cne 'dans1'){throw "Expected DANS1; observed $name"}
if(Test-Path -LiteralPath $p.campaign){throw "Campaign already exists: $($p.campaign)"}
if(-not (Test-Path -LiteralPath $p.workspace -PathType Container)){throw "Remote workspace missing: $($p.workspace)"}
New-Item -ItemType Directory -Path $p.input | Out-Null
'@
$preflight = $preflight.Replace('__PAYLOAD__', $payloadBase64)
$preflightExit = Invoke-RemotePowerShell $preflight
if ($preflightExit -ne 0) { throw "DANS1 campaign preflight failed with exit code $preflightExit." }

$transferFiles = [ordered]@{
  'fast-cdp.mjs' = (Join-Path $PSScriptRoot 'fast-cdp.mjs')
  'run-fast-cdp.ps1' = (Join-Path $PSScriptRoot 'run-fast-cdp.ps1')
  'invoke-dans1-fast-cdp.ps1' = (Join-Path $PSScriptRoot 'invoke-dans1-fast-cdp.ps1')
  'scenario.json' = $scenarioFull
}
$expectedHashes = [ordered]@{}
foreach ($entry in $transferFiles.GetEnumerator()) {
  if (-not (Test-Path -LiteralPath $entry.Value -PathType Leaf)) { throw "Transfer input missing: $($entry.Value)" }
  $expectedHashes[$entry.Key] = (Get-FileHash -LiteralPath $entry.Value -Algorithm SHA256).Hash.ToLowerInvariant()
  $remoteDestination = "$SshHost`:$(ConvertTo-ScpPath (Join-Path $remoteInput $entry.Key))"
  & scp -- $entry.Value $remoteDestination
  if ($LASTEXITCODE -ne 0) { throw "Failed to transfer $($entry.Key) to DANS1." }
}

$executionPayload = [ordered]@{ campaign = $payload; hashes = $expectedHashes }
$executionBase64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(($executionPayload | ConvertTo-Json -Depth 6 -Compress)))
$execute = @'
$ErrorActionPreference='Stop'
$bundle=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('__EXECUTION__')) | ConvertFrom-Json
$p=$bundle.campaign
$name=(([Net.Dns]::GetHostName() -split '\.')[0]).ToLowerInvariant()
if($name -cne 'dans1'){throw "Expected DANS1; observed $name"}
foreach($property in $bundle.hashes.PSObject.Properties){
  $path=Join-Path $p.input $property.Name
  $actual=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
  if($actual -cne [string]$property.Value){throw "Transferred source hash mismatch: $($property.Name)"}
}
$arguments=@{
  Scenario=$p.scenario
  Output=$p.output
  Workspace=$p.workspace
  CdpPort=[int]$p.cdpPort
  PreviewPort=[int]$p.previewPort
  PreviewMode=[string]$p.previewMode
  Chrome=[string]$p.chrome
  RunId=[string]$p.runId
}
if([bool]$p.useExistingPreview){$arguments.UseExistingPreview=$true}
& $p.runScript @arguments
if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
'@
$execute = $execute.Replace('__EXECUTION__', $executionBase64)
$remoteStdout = Join-Path $localCampaign 'remote.stdout.log'
$remoteStderr = Join-Path $localCampaign 'remote.stderr.log'
$remoteExit = $null
$retrievalExit = $null
$invocationError = $null
try {
  $remoteExit = Invoke-RemotePowerShell $execute $remoteStdout $remoteStderr
  if ($remoteExit -ne 0) { throw "DANS1 raw-CDP campaign failed with exit code $remoteExit." }
} catch {
  $invocationError = $_
} finally {
  $remoteOutputSpec = "$SshHost`:$(ConvertTo-ScpPath $remoteOutput)"
  & scp -r -- $remoteOutputSpec $localCampaign
  $retrievalExit = $LASTEXITCODE
  if ($retrievalExit -ne 0 -and $null -eq $invocationError) {
    $invocationError = [Management.Automation.ErrorRecord]::new(
      [InvalidOperationException]::new("Could not retrieve preserved DANS1 evidence; remote campaign remains at $remoteCampaign."),
      'EvidenceRetrievalFailed',
      [Management.Automation.ErrorCategory]::ReadError,
      $remoteCampaign
    )
  }
  $receipt = [ordered]@{
    schemaVersion = 1
    runId = $RunId
    remoteHost = 'DANS1'
    remoteCampaign = $remoteCampaign
    remoteWorkspace = $RemoteWorkspace
    localCampaign = $localCampaign
    expectedSourceHashes = $expectedHashes
    remoteExitCode = $remoteExit
    retrievalExitCode = $retrievalExit
    verdict = if ($invocationError) { 'INFRA_FAILURE' } else { 'PASS' }
    error = if ($invocationError) { $invocationError.Exception.Message } else { $null }
  }
  $receipt | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $localCampaign 'invocation-results.json') -Encoding utf8
  Write-TransferManifest $localCampaign
}

if ($invocationError) { throw $invocationError }
Write-Output ([ordered]@{
  runId = $RunId
  host = 'DANS1'
  verdict = 'PASS'
  remoteOutput = $remoteOutput
  localEvidence = (Join-Path $localCampaign 'output')
} | ConvertTo-Json -Compress)
