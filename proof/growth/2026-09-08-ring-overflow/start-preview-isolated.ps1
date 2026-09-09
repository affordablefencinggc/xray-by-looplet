param([Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{12}$')][string]$RunId)
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
if ($env:COMPUTERNAME -ne 'DANS1') { throw 'Dans1 only.' }
[Diagnostics.Process]::GetCurrentProcess().PriorityClass='BelowNormal'
$run=Join-Path 'C:\Users\danie\XRayBuilds\runs' $RunId
$source=Join-Path $run 'source'
if (-not (Test-Path -LiteralPath (Join-Path $run 'completion.json'))) { throw 'Verified web build required.' }
if (Get-NetTCPConnection -LocalPort 8096 -State Listen -ErrorAction SilentlyContinue) { throw 'Port 8096 already occupied; existing server preserved.' }
$env:PREVIEW_HOST='127.0.0.1'
$env:PREVIEW_PORT='8096'
$env:VITE_AUTH_ENABLED='false'
$env:VITE_XRAY_BUILD_ID=$RunId
$env:PATH=(Join-Path $run 'runtime')+';'+$env:PATH
$node=Join-Path $run 'runtime\node.exe'
$npm=Join-Path $run 'runtime\node_modules\npm\bin\npm-cli.js'
$child=Start-Process -FilePath $node -ArgumentList @($npm,'run','preview') -WorkingDirectory $source -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $run 'preview.stdout.log') -RedirectStandardError (Join-Path $run 'preview.stderr.log')
$handle=$child.Handle
$identity=Get-CimInstance Win32_Process -Filter "ProcessId = $($child.Id)"
@{owner="ring-overflow";purpose="isolated production QA";pid=$child.Id;creationTime=$identity.CreationDate;executable=$identity.ExecutablePath;command=$identity.CommandLine;lastTaskActivity=[DateTime]::UtcNow.ToString("o")} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $run "preview-process.json")
$child.PriorityClass='BelowNormal'
$healthy=$false
for ($attempt=0;$attempt -lt 15;$attempt++) {
  try { $response=Invoke-WebRequest -Uri 'http://127.0.0.1:8096/' -UseBasicParsing -TimeoutSec 2; if ($response.StatusCode -eq 200) { $healthy=$true; break } } catch {}
  Start-Sleep -Seconds 1
}
$record=@{run=$run;pid=$child.Id;url='http://127.0.0.1:8096/';healthy=$healthy;startedAt=(Get-Date).ToUniversalTime().ToString('o')}
$record | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $run 'preview.json') -Encoding UTF8
Write-Output ($record | ConvertTo-Json -Compress)
if (-not $healthy) { throw 'Preview did not become healthy; logs retained.' }
# OpenSSH's Windows job closes descendants when the remote shell exits.
# Keep this owned SSH session alive for the preview's lifetime.
Wait-Process -Id $child.Id

