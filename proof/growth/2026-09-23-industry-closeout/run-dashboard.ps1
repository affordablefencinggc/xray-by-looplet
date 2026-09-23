param([ValidatePattern('^[a-z0-9-]+$')][string]$RunId='closeout-dashboard-60454ec3-02')
$ErrorActionPreference='Stop'
$base='proof/growth/2026-09-23-industry-closeout'
$dashboard='XRAY-STATUS-AND-PROOF-DASHBOARD.html'
$hash=(Get-FileHash -LiteralPath $dashboard).Hash.ToLowerInvariant()
$scenario=@'
[["set","viewport","1600","1000"],["open","{{ORIGIN}}/v1-dashboard-60454ec3.html"],["wait","--fn","document.body?.textContent.includes('18 / 20 DONE')&&document.body?.textContent.includes('18 Done, 0 Partial, 0 Blocked, 2 Pending')",20000],["eval","(()=>{const values=[...document.querySelectorAll('.kpi-card')].map(e=>e.innerText);if(document.documentElement.scrollWidth>innerWidth+1)throw Error('Page overflow');return {kpis:values}})()"],["screenshot","captures/dashboard-18-of-20.png"],["errors"]]
'@
[IO.File]::WriteAllText((Join-Path $base 'scenarios/dashboard-current.json'),$scenario,[Text.UTF8Encoding]::new($false))
$scenarioHash=(Get-FileHash -LiteralPath (Join-Path $base 'scenarios/dashboard-current.json')).Hash.ToLowerInvariant()
scp -q $dashboard 'tonys-test-pc:C:/Users/danie/XRayBuilds/v1-industry-fencing-20260923/public/v1-dashboard-60454ec3.html'
if($LASTEXITCODE -ne 0){throw 'Dashboard transfer failed'}
scp -q (Join-Path $base 'scenarios/dashboard-current.json') 'tonys-test-pc:C:/Users/danie/XRayFastCdp/dashboard-current.json'
if($LASTEXITCODE -ne 0){throw 'Scenario transfer failed'}
$remote=@"
`$ErrorActionPreference='Stop';`$ProgressPreference='SilentlyContinue';if(`$env:COMPUTERNAME -ne 'DANS1'){throw 'Wrong worker'};
`$w='C:/Users/danie/XRayBuilds/v1-industry-fencing-20260923';
if((Get-FileHash -LiteralPath (`$w+'/public/v1-dashboard-60454ec3.html')).Hash.ToLowerInvariant() -ne '$hash'){throw 'Dashboard hash mismatch'};
if((Get-FileHash -LiteralPath 'C:/Users/danie/XRayFastCdp/dashboard-current.json').Hash.ToLowerInvariant() -ne '$scenarioHash'){throw 'Scenario hash mismatch'};
`$env:PATH='C:/Users/danie/XRayBuilds/runs/8a6226fc93a6/runtime;'+`$env:PATH;
& (`$w+'/scripts/run-fast-cdp.ps1') -Scenario 'C:/Users/danie/XRayFastCdp/dashboard-current.json' -Output 'C:/Users/danie/XRayFastCdp/runs/$RunId' -Workspace `$w -RunId '$RunId' -CdpPort 9352 -PreviewPort 8082 -PreviewMode dev
"@
ssh tonys-test-pc powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ([Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($remote)))
$code=$LASTEXITCODE
scp -q -r "tonys-test-pc:C:/Users/danie/XRayFastCdp/runs/$RunId" $base
if($code -ne 0 -or $LASTEXITCODE -ne 0){throw 'Dashboard proof failed; evidence retained'}
