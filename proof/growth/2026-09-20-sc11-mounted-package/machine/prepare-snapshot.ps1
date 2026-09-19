param()
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$repo=(Get-Location).Path
if((git branch --show-current) -cne 'feat/architect-cad-engine'){throw 'Unexpected branch'}
$observed=((& ssh tonys-test-pc hostname)-join '').Trim().ToLowerInvariant()
if($LASTEXITCODE -ne 0 -or ($observed -split '\.')[0] -cne 'dans1'){throw 'DANS1 required'}
$own='proof/growth/2026-09-20-sc11-mounted-package'
$prior=Get-Content -Raw proof/growth/2026-09-20-sc10-use-measured/machine/verified-source-manifest.json|ConvertFrom-Json
$paths=@($prior.entries.path)+@("$own/machine/qualify.ps1","$own/machine/prepare-snapshot.ps1")
$entries=@($paths|Sort-Object -Unique|ForEach-Object{
  $file=Get-Item -LiteralPath (Join-Path $repo $_)
  [ordered]@{path=$_;bytes=$file.Length;sha256=(Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()}
})
$entryJson=$entries|ConvertTo-Json -Depth 5
$hasher=[Security.Cryptography.SHA256]::Create()
$digest=([BitConverter]::ToString($hasher.ComputeHash([Text.Encoding]::UTF8.GetBytes($entryJson)))).Replace('-','').ToLowerInvariant()
$runId='sc11-'+$digest.Substring(0,12)
$stage=Join-Path $repo ('.temp/sc11-mounted-stage/'+$runId)
if(Test-Path -LiteralPath $stage){throw 'Preserve existing snapshot; source digest already staged'}
New-Item -ItemType Directory -Path $stage|Out-Null
$source=Join-Path $stage 'source'
foreach($entry in $entries){
  $target=Join-Path $source $entry.path
  New-Item -ItemType Directory -Force -Path (Split-Path $target -Parent)|Out-Null
  Copy-Item -LiteralPath (Join-Path $repo $entry.path) -Destination $target
  if((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -cne $entry.sha256){throw 'Source changed during packaging'}
}
$manifest=[ordered]@{runId=$runId;head=(git rev-parse HEAD);sourceDigest=$digest;entries=$entries;scope='Complete prior tracked application input inventory at current working bytes plus SC11 machine helpers; not a CSS/layout overlay.'}
$manifest|ConvertTo-Json -Depth 7|Set-Content -LiteralPath (Join-Path $stage 'source-manifest.json') -Encoding utf8
$archive=Join-Path $stage 'source.tar'
& tar -cf $archive -C $source .
if($LASTEXITCODE -ne 0){throw 'Archive creation failed'}
$archiveHash=(Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
$remote='C:\Users\danie\XRayBuilds\preflight\'+$runId
$setup="`$ErrorActionPreference='Stop';if(([Net.Dns]::GetHostName() -split '\.')[0].ToLowerInvariant() -cne 'dans1'){throw 'host'};if(Test-Path -LiteralPath '$remote'){throw 'campaign exists'};New-Item -ItemType Directory -Path '$remote'|Out-Null"
& ssh tonys-test-pc powershell -NoProfile -EncodedCommand ([Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($setup)))
if($LASTEXITCODE -ne 0){throw 'Remote setup failed'}
$destination='tonys-test-pc:'+($remote.Replace('\','/'))+'/'
& scp -- $archive (Join-Path $stage 'source-manifest.json') (Join-Path $repo "$own/machine/qualify.ps1") $destination
if($LASTEXITCODE -ne 0){throw 'Transfer failed'}
$execute="& '$remote\qualify.ps1' -RunId '$runId' -ArchiveHash '$archiveHash'; exit `$LASTEXITCODE"
& ssh tonys-test-pc powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand ([Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($execute)))
$remoteExit=$LASTEXITCODE
& scp -r -- ($destination+'output') $stage
if($LASTEXITCODE -ne 0){throw 'Evidence retrieval failed'}
foreach($entry in (Get-Content -Raw (Join-Path $stage 'output/sha256-manifest.json')|ConvertFrom-Json)){
  if((Get-FileHash -LiteralPath (Join-Path $stage ('output/'+$entry.path)) -Algorithm SHA256).Hash.ToLowerInvariant() -cne $entry.sha256){throw 'Returned evidence mismatch'}
}
[ordered]@{host='DANS1';runId=$runId;remoteSource=$remote+'\source';localEvidence=$stage+'\output';archiveSha256=$archiveHash;remoteExit=$remoteExit}|ConvertTo-Json
if($remoteExit -ne 0){exit $remoteExit}
