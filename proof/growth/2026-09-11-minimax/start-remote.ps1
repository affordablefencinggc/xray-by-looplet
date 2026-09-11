$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
if ($env:COMPUTERNAME -ne 'DANS1') { throw 'Wrong host' }
$auditRoot = 'C:\Users\danie\XRayBuilds\minimax-20260911'
$source = 'C:\Users\danie\XRayBuilds\navigation-20260911\source'
if ((Get-FileHash (Join-Path $source 'src\studio\Studio.tsx')).Hash -ne 'DACA0F059256CD2A393ACF5D486F2120B0300F59B0DF7CBA07181D87ABB2E7C6') { throw 'Studio source hash mismatch' }
$runtime = 'C:\Users\danie\XRayBuilds\runs\8e14ac427997\runtime'
if (!(Test-Path $source)) {
  New-Item -ItemType Directory $source | Out-Null
  tar -xf (Join-Path $auditRoot 'source.tar') -C $source
  if ($LASTEXITCODE -ne 0) { throw 'Extraction failed' }
  New-Item -ItemType Junction -Path (Join-Path $source 'node_modules') -Target 'C:\Users\danie\XRayBuilds\runs\8e14ac427997\source\node_modules' | Out-Null
}
# Credentials arrive only over encrypted SSH stdin and are inherited by the dev process.
# Never write them to evidence or source files.
$settings = '{}' | ConvertFrom-Json
foreach ($p in $settings.PSObject.Properties) {
  if ($p.Name -notmatch '^(GEMINI_API_KEY|GOOGLE_API_KEY|MINIMAX_API_KEY|MINIMAX_MODEL|MINIMAX_BASE_URL|XRAY_AI_WEB_ENABLED)$') { throw 'Unexpected setting' }
  [Environment]::SetEnvironmentVariable($p.Name, [string]$p.Value, 'Process')
}
$env:VITE_AUTH_ENABLED = 'false'
$env:PATH = $runtime + ';' + $env:PATH
$owned = @()
if (Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue) { throw '8080 already owned' }
$dev = Start-Process -FilePath (Join-Path $runtime 'node.exe') -ArgumentList @((Join-Path $runtime 'node_modules\npm\bin\npm-cli.js'),'run','dev') -WorkingDirectory $source -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $auditRoot 'dev.stdout.log') -RedirectStandardError (Join-Path $auditRoot 'dev.stderr.log')
$owned += @{owner='codex-minimax';pid=$dev.Id;created=$dev.StartTime.ToUniversalTime().ToString('o');executable=$dev.Path;purpose='isolated X-Ray development server';lastActivity=[DateTime]::UtcNow.ToString('o')}
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
if (Get-NetTCPConnection -LocalPort 9337 -State Listen -ErrorAction SilentlyContinue) { throw '9337 already owned' }
$browser = Start-Process -FilePath $chrome -ArgumentList @('--headless=new','--enable-automation','--remote-debugging-address=127.0.0.1','--remote-debugging-port=9337',('--user-data-dir='+$auditRoot+'\browser-profile'),'--no-first-run','--no-default-browser-check','about:blank') -WindowStyle Hidden -PassThru
$owned += @{owner='codex-minimax';pid=$browser.Id;created=$browser.StartTime.ToUniversalTime().ToString('o');executable=$browser.Path;purpose='isolated Fast CDP tool audit';lastActivity=[DateTime]::UtcNow.ToString('o')}
foreach ($p in $owned) { $actual = Get-CimInstance Win32_Process -Filter "ProcessId=$($p.pid)"; $p.command=$actual.CommandLine }
$owned | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $auditRoot 'processes.json')
Write-Output 'host=DANS1 Studio source verified; test processes recorded'
# Keep the SSH job alive: Windows OpenSSH terminates its children on session exit.
Wait-Process -Id $dev.Id

