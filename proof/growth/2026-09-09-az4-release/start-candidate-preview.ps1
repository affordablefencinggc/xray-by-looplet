param([Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{12}$')][string]$RunId)
# Serve the collected, hash-verified web artifacts of the candidate on a QA-only port.
# The user-facing preview on 8095 and the dev server on 8080 are never touched here.
$ErrorActionPreference='Stop'
$base=Join-Path (Get-Location) "proof/growth/2026-09-09-az4-release/release-$RunId"
$identity=Get-Content -LiteralPath (Join-Path $base 'build-identity-verified.json') -Raw | ConvertFrom-Json
if($identity.status -ne 'pass' -or $identity.runId -ne $RunId){throw 'Build identity is not verified for this run'}
if(Get-NetTCPConnection -LocalPort 8096 -State Listen -ErrorAction SilentlyContinue){throw 'Port 8096 already occupied; existing server preserved'}
$artifacts=Join-Path $base 'web-artifacts'
New-Item -ItemType Directory -Force -Path (Join-Path $artifacts 'scripts') | Out-Null
Copy-Item -LiteralPath 'scripts/preview-built.mjs' -Destination (Join-Path $artifacts 'scripts/preview-built.mjs')
$envFile=Join-Path (Get-Location) '.env.local'
$env:PREVIEW_PORT='8096'
$env:PREVIEW_HOST='127.0.0.1'
$node=(Get-Command node).Source
$child=Start-Process -FilePath $node -ArgumentList @("--env-file=$envFile",'scripts/preview-built.mjs') -WorkingDirectory $artifacts -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $base 'candidate-preview.stdout.log') -RedirectStandardError (Join-Path $base 'candidate-preview.stderr.log')
$healthy=$false
for($i=0;$i -lt 20;$i++){ try{ $r=Invoke-WebRequest -Uri 'http://127.0.0.1:8096/' -UseBasicParsing -TimeoutSec 2; if($r.StatusCode -eq 200){$healthy=$true;break} }catch{}; Start-Sleep -Milliseconds 500 }
$record=@{runId=$RunId;pid=$child.Id;createdAt=(Get-CimInstance Win32_Process -Filter "ProcessId=$($child.Id)").CreationDate.ToUniversalTime().ToString('o');url='http://127.0.0.1:8096/';healthy=$healthy;envFile='.env.local loaded by node --env-file (keys never copied into artifacts or logs)';purpose='candidate production preview for az4 release QA';startedAt=[DateTime]::UtcNow.ToString('o')}
$record | ConvertTo-Json | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $base 'candidate-preview.json')
Write-Output ($record | ConvertTo-Json -Compress)
if(-not $healthy){throw 'Candidate preview did not become healthy; logs retained'}
