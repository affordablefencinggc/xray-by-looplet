$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
$observed=((& ssh tonys-test-pc hostname) -join '').Trim().ToLowerInvariant()
if($LASTEXITCODE -ne 0 -or ($observed -split '\.')[0] -cne 'dans1'){throw 'SSH DANS1 host guard failed'}
Push-Location $repo
try{
  $packageText=& node (Join-Path $PSScriptRoot 'package-static.mjs')
  if($LASTEXITCODE -ne 0){throw 'Explicit source packaging failed'}
  $package=($packageText -join [Environment]::NewLine) | ConvertFrom-Json
  $runId=[string]$package.runId
  if($runId -notmatch '^dash-[a-f0-9]{12}$'){throw 'Unexpected package identity'}
  $stage=[string]$package.staging
  $archive=Join-Path $stage 'source.tar.gz'
  & tar -czf $archive -C $stage source source-manifest.json
  if($LASTEXITCODE -ne 0){throw 'Source archive failed'}
  $archiveHash=(Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
  $remote="C:\Users\danie\XRayBuilds\dashboard\$runId"
  $local=Join-Path $PSScriptRoot ('campaigns\'+$runId)
  if(Test-Path -LiteralPath $local){throw 'Local campaign exists'}
  New-Item -ItemType Directory -Path $local | Out-Null
  $setup="`$ErrorActionPreference='Stop'; if((([Net.Dns]::GetHostName() -split '\.')[0]).ToLowerInvariant() -cne 'dans1'){throw 'Host guard'}; if(Test-Path -LiteralPath '$remote'){throw 'Remote campaign exists'}; New-Item -ItemType Directory -Path '$remote' | Out-Null"
  $encoded=[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($setup))
  & ssh tonys-test-pc powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand $encoded
  if($LASTEXITCODE -ne 0){throw 'Remote campaign creation failed'}
  & scp -- $archive ("tonys-test-pc:"+$remote.Replace('\','/')+'/source.tar.gz')
  if($LASTEXITCODE -ne 0){throw 'Source archive transfer failed'}
  $execute=@'
$ErrorActionPreference='Stop'
if((([Net.Dns]::GetHostName() -split '\.')[0]).ToLowerInvariant() -cne 'dans1'){throw 'Host guard'}
$campaign='__REMOTE__'
$archive=Join-Path $campaign 'source.tar.gz'
if((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -cne '__HASH__'){throw 'Archive hash mismatch'}
& tar -xzf $archive -C $campaign
if($LASTEXITCODE -ne 0){throw 'Archive extraction failed'}
& (Join-Path $campaign 'source\proof\growth\2026-09-19-dashboard-refresh\run-static.ps1') -Campaign $campaign -Node 'C:\Users\danie\XRayBuilds\preflight\84cadc02ab35\runtime\node.exe'
exit $LASTEXITCODE
'@
  $execute=$execute.Replace('__REMOTE__',$remote).Replace('__HASH__',$archiveHash)
  $encoded=[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($execute))
  $remoteExit=$null
  $retrieveExit=$null
  try{
    & ssh tonys-test-pc powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand $encoded 1> (Join-Path $local 'remote.stdout.log') 2> (Join-Path $local 'remote.stderr.log')
    $remoteExit=$LASTEXITCODE
  }finally{
    & scp -r -- ("tonys-test-pc:"+$remote.Replace('\','/')+'/output') $local
    $retrieveExit=$LASTEXITCODE
    $receipt=[ordered]@{host='DANS1';runId=$runId;remote=$remote;sourceDigest=$package.sourceDigest;sourceArchiveSha256=$archiveHash;remoteExit=$remoteExit;retrievalExit=$retrieveExit;completedAt=[DateTime]::UtcNow.ToString('o')}
    $receipt | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $local 'transfer-results.json') -Encoding utf8
  }
  if($retrieveExit -ne 0){throw 'Evidence retrieval failed; remote evidence preserved'}
  $manifest=Get-Content -LiteralPath (Join-Path $local 'output\sha256-manifest.json') -Raw | ConvertFrom-Json
  foreach($entry in $manifest){
    if((Get-FileHash -LiteralPath (Join-Path (Join-Path $local 'output') $entry.path) -Algorithm SHA256).Hash.ToLowerInvariant() -cne $entry.sha256){throw "Retrieved evidence hash mismatch: $($entry.path)"}
  }
  if($remoteExit -ne 0){throw "DANS1 static dashboard qualification failed: exit $remoteExit"}
  Write-Output ($receipt | ConvertTo-Json -Compress)
}finally{Pop-Location}
