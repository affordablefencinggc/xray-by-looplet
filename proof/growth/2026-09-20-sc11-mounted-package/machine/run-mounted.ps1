param([Parameter(Mandatory=$true)][string]$SourceRun,[Parameter(Mandatory=$true)][string]$RunId)
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
if(([Net.Dns]::GetHostName() -split '\.')[0].ToLowerInvariant() -cne 'dans1'){throw 'DANS1 required'}
if($SourceRun -notmatch '^sc11-[a-f0-9]{12}$' -or $RunId -notmatch '^sc11-[a-f0-9]{12}-mounted-dev[1-9]$'){throw 'Unsafe campaign identity'}
$sourceRoot='C:\Users\danie\XRayBuilds\preflight\'+$SourceRun
$source=Join-Path $sourceRoot 'source'
$campaign='C:\Users\danie\XRayFastCdp\runs\'+$RunId
$inputRoot=Join-Path $campaign 'input'
$output=Join-Path $campaign 'output'
if(Test-Path -LiteralPath $output){throw 'Preserve existing receipt'}
$manifest=Get-Content -Raw (Join-Path $sourceRoot 'source-manifest.json')|ConvertFrom-Json
function Verify-Application {
  foreach($entry in $manifest.entries){if((Get-FileHash -LiteralPath (Join-Path $source $entry.path) -Algorithm SHA256).Hash.ToLowerInvariant() -cne $entry.sha256){throw ('Application changed: '+$entry.path)}}
}
Verify-Application
$inputManifest=Get-Content -Raw (Join-Path $inputRoot 'input-manifest.json')|ConvertFrom-Json
foreach($entry in $inputManifest){
  if($entry.name -notmatch '^[a-zA-Z0-9._-]+$'){throw 'Unsafe input name'}
  if((Get-FileHash -LiteralPath (Join-Path $inputRoot $entry.name) -Algorithm SHA256).Hash.ToLowerInvariant() -cne $entry.sha256){throw ('Input transfer mismatch: '+$entry.name)}
}
$runtime=Join-Path $source ('.temp/'+$RunId)
if(Test-Path -LiteralPath $runtime){throw 'Preserve prior generated runner'}
New-Item -ItemType Directory -Path $runtime|Out-Null
Copy-Item -LiteralPath (Join-Path $source 'scripts/run-fast-cdp.ps1') -Destination (Join-Path $runtime 'run-fast-cdp.ps1')
$node=Join-Path $sourceRoot 'runtime/node.exe'
$env:PATH=(Join-Path $sourceRoot 'runtime')+';'+$env:PATH
& $node (Join-Path $inputRoot 'build-download-runner.mjs') (Join-Path $source 'scripts/fast-cdp.mjs') (Join-Path $runtime 'fast-cdp.mjs')
if($LASTEXITCODE -ne 0){throw 'Runner generation failed'}
& $node (Join-Path $inputRoot 'build-mounted-scenario.mjs') (Join-Path $inputRoot 'sc10-qs-rate-delta.scenario.json') (Join-Path $runtime 'sc11-mounted.scenario.json')
if($LASTEXITCODE -ne 0){throw 'Scenario generation failed'}
$failure=$null
try {
  & (Join-Path $runtime 'run-fast-cdp.ps1') -Scenario (Join-Path $runtime 'sc11-mounted.scenario.json') -Output $output -Workspace $source -RunId $RunId -PreviewPort 8080 -CdpPort 9337 -Node $node
  if($LASTEXITCODE -ne 0){throw 'Browser campaign failed'}
}catch{$failure=$_}finally{
  Verify-Application
  if(Test-Path -LiteralPath $output){
    Copy-Item -LiteralPath (Join-Path $runtime 'fast-cdp.mjs.extension.json') -Destination (Join-Path $output 'runner-extension.json')
    Copy-Item -LiteralPath (Join-Path $inputRoot 'input-manifest.json') -Destination (Join-Path $output 'input-manifest.json')
    [ordered]@{host='DANS1';runId=$RunId;applicationSource=$source;sourceDigest=$manifest.sourceDigest;sourceFiles=$manifest.entries.Count;head=$manifest.head;applicationUnchanged=$true;sourceManifest=Join-Path $sourceRoot 'source-manifest.json';error=if($failure){[string]$failure}else{$null}}|ConvertTo-Json -Depth 4|Set-Content -LiteralPath (Join-Path $output 'application-binding.json') -Encoding utf8
  }
}
if($failure){throw $failure}
