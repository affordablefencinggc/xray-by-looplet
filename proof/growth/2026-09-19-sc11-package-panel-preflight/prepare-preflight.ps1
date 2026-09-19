param([string]$RunId=('sc11-panel-'+[guid]::NewGuid().ToString('N').Substring(0,12)))
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
if($RunId -notmatch '^sc11-panel-[a-f0-9]{12}$'){throw 'Use a unique sc11-panel-<12 hex> run identifier.'}
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$hostOutput=@(& ssh tonys-test-pc hostname)
if($LASTEXITCODE -ne 0 -or (($hostOutput -join '').Trim().ToLowerInvariant()) -cne 'dans1'){throw 'DANS1 SSH host guard failed.'}
$campaign=Join-Path $PSScriptRoot $RunId
if(Test-Path -LiteralPath $campaign){throw 'Local campaign exists; historical evidence must remain immutable.'}
$overlay=Join-Path $campaign 'input\overlay'
New-Item -ItemType Directory -Path $overlay | Out-Null
$files=@(
  'src/studio/industries/quantity-surveying/QSCostPlanPackagePanel.tsx',
  'src/studio/industries/quantity-surveying/QSCostPlanPackagePanel.css',
  'src/studio/industries/quantity-surveying/QSCostPlanPackagePanel.test.ts',
  'src/studio/industries/hvac/ductMaterialBasis.ts',
  'src/studio/industries/hvac/ductMaterialBasis.test.ts',
  'proof/growth/2026-09-19-sc12-hvac-qualification/AUDIT.md',
  'src/studio/industries/quantity-surveying/qsRateBook.ts',
  'src/studio/industries/quantity-surveying/report.ts',
  'src/studio/pricing/PriceBookPanel.tsx',
  'scripts/fast-cdp.mjs',
  'scripts/fast-cdp.test.mjs'
)
$entries=@()
foreach($file in $files){
  $original=Join-Path $repo $file
  $destination=Join-Path $overlay $file
  New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
  Copy-Item -LiteralPath $original -Destination $destination
  $hash=(Get-FileHash -LiteralPath $original -Algorithm SHA256).Hash.ToLowerInvariant()
  if((Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant() -cne $hash){throw "Local staging changed bytes: $file"}
  $entries+=[ordered]@{path=$file;bytes=(Get-Item -LiteralPath $destination).Length;sha256=$hash}
}
$baseline='C:\Users\danie\XRayBuilds\preflight\4c87a0de13b6\source'
$runtime='C:\Users\danie\XRayBuilds\preflight\4c87a0de13b6\runtime\node.exe'
$manifest=[ordered]@{schemaVersion=1;runId=$RunId;owner='/root/sc09_review';createdAt=[DateTime]::UtcNow.ToString('o');localBranch=(& git -C $repo branch --show-current);localHead=(& git -C $repo rev-parse HEAD);baseline=$baseline;entries=$entries}
$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $campaign 'input\source-manifest.json') -Encoding utf8
$worker=Join-Path $PSScriptRoot 'run-preflight.ps1'
Copy-Item -LiteralPath $worker -Destination (Join-Path $campaign 'input\run-preflight.ps1')
$workerHash=(Get-FileHash -LiteralPath $worker -Algorithm SHA256).Hash.ToLowerInvariant()
$remote='C:\Users\danie\XRayBuilds\preflight\'+$RunId
$create=@'
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
if(([Net.Dns]::GetHostName().Trim().ToLowerInvariant()) -cne 'dans1'){throw 'DANS1 guard failed'}
$target='__REMOTE__'
if(Test-Path -LiteralPath $target){throw 'Remote campaign exists'}
New-Item -ItemType Directory -Path $target | Out-Null
'@
$encoded=[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($create.Replace('__REMOTE__',$remote)))
& ssh tonys-test-pc powershell -NoProfile -NonInteractive -EncodedCommand $encoded
if($LASTEXITCODE -ne 0){throw 'Could not allocate unique remote campaign.'}
& scp -r -- (Join-Path $campaign 'input') ('tonys-test-pc:'+$remote.Replace('\','/')+'/input')
if($LASTEXITCODE -ne 0){throw 'Source transfer failed.'}
$execute=@'
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$worker='__REMOTE__\input\run-preflight.ps1'
if((Get-FileHash -LiteralPath $worker -Algorithm SHA256).Hash.ToLowerInvariant() -cne '__WORKERHASH__'){throw 'Worker transfer hash mismatch'}
& $worker -Campaign '__REMOTE__' -Baseline '__BASELINE__' -Node '__RUNTIME__'
exit $LASTEXITCODE
'@
$execute=$execute.Replace('__REMOTE__',$remote).Replace('__WORKERHASH__',$workerHash).Replace('__BASELINE__',$baseline).Replace('__RUNTIME__',$runtime)
$encoded=[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($execute))
& ssh tonys-test-pc powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand $encoded 1> (Join-Path $campaign 'remote.stdout.log') 2> (Join-Path $campaign 'remote.stderr.log')
$remoteExit=$LASTEXITCODE
& scp -r -- ('tonys-test-pc:'+$remote.Replace('\','/')+'/output') $campaign
$retrievalExit=$LASTEXITCODE
$localChanges=@($entries | Where-Object {(Get-FileHash -LiteralPath (Join-Path $repo $_.path) -Algorithm SHA256).Hash.ToLowerInvariant() -cne $_.sha256} | ForEach-Object {$_.path})
$receipt=[ordered]@{runId=$RunId;host='DANS1';owner='/root/sc09_review';remoteCampaign=$remote;localCampaign=$campaign;remoteExitCode=$remoteExit;retrievalExitCode=$retrievalExit;workerSha256=$workerHash;sourceManifest=$manifest;localSourceChangedSinceStaging=$localChanges;completedAt=[DateTime]::UtcNow.ToString('o')}
$receipt | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $campaign 'invocation-results.json') -Encoding utf8
Write-Output ($receipt | ConvertTo-Json -Depth 10 -Compress)
if($remoteExit -ne 0 -or $retrievalExit -ne 0){exit 1}
exit 0
