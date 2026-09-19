param(
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{12}$')][string]$RunId,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$SourceHash,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$RuntimeHash,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$NativeHash
)
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
if ($env:COMPUTERNAME -ne 'DANS1') { throw 'DANS1 required.' }
. 'C:\Users\danie\XRayBuilds\dans1-resource-policy.ps1'
$incoming="C:\Users\danie\XRayBuilds\incoming\$RunId"
$run="C:\Users\danie\XRayBuilds\preflight\$RunId"
$source=Join-Path $run 'source'
$runtime=Join-Path $run 'runtime'
if(Test-Path -LiteralPath $run){throw 'Preflight exists; preserve prior evidence.'}
foreach($pair in @(@('source.tar',$SourceHash),@('node-runtime.tar',$RuntimeHash),@('native-source.tar',$NativeHash))){
  $archive=Join-Path $incoming $pair[0]
  if((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -cne $pair[1]){throw 'Archive hash mismatch.'}
  $names=& tar -tf $archive
  if($LASTEXITCODE -ne 0){throw 'Cannot inspect archive.'}
  foreach($name in $names){if($name -match '(^[/\\]|:|(^|[/\\])\.\.([/\\]|$))'){throw 'Unsafe archive entry.'}}
}
New-Item -ItemType Directory -Path $source,$runtime | Out-Null
& tar -xf (Join-Path $incoming 'source.tar') -C $source
if($LASTEXITCODE -ne 0){throw 'Source extraction failed.'}
& tar -xf (Join-Path $incoming 'node-runtime.tar') -C $runtime
if($LASTEXITCODE -ne 0){throw 'Runtime extraction failed.'}
$web=Get-Content -LiteralPath (Join-Path $incoming 'source-manifest.json') -Raw | ConvertFrom-Json
$native=Get-Content -LiteralPath (Join-Path $incoming 'native-manifest.json') -Raw | ConvertFrom-Json
foreach($entry in $native.entries){if(Test-Path -LiteralPath (Join-Path $source $entry.path)){throw 'Native snapshot overlaps web input.'}}
& tar -xf (Join-Path $incoming 'native-source.tar') -C $source
if($LASTEXITCODE -ne 0){throw 'Native fixture extraction failed.'}
function Verify-Sources {
  foreach($entry in @($web.entries)+@($native.entries)){
    $target=[IO.Path]::GetFullPath((Join-Path $source $entry.path))
    if(-not $target.StartsWith($source+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Path outside preflight.'}
    if((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -cne $entry.sha256){throw "Source mismatch: $($entry.path)"}
  }
}
Verify-Sources
$node=Join-Path $runtime 'node.exe'
$npm=Join-Path $runtime 'node_modules\npm\bin\npm-cli.js'
$env:PATH=$runtime+';'+$env:PATH
$env:npm_config_cache='C:\Users\danie\XRayBuilds\npm-cache'
# Auth tests exercise both default-enabled and explicitly-disabled states.
# The browser/build launchers set their own app configuration separately.
$env:VITE_AUTH_ENABLED=$null
$results=[Collections.Generic.List[object]]::new()
function Step([string]$Name,[string[]]$Arguments){
  $started=Get-Date
  $child=Start-Process -FilePath $node -ArgumentList $Arguments -WorkingDirectory $source -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $run "$Name.stdout.log") -RedirectStandardError (Join-Path $run "$Name.stderr.log")
  $childHandle=$child.Handle
  $child.PriorityClass='High'
  $child.WaitForExit()
  $result=[pscustomobject]@{step=$Name;exitCode=$child.ExitCode;seconds=((Get-Date)-$started).TotalSeconds;priority='High';host=$env:COMPUTERNAME}
  $results.Add($result)
  $results | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $run 'results.json') -Encoding UTF8
  Write-Output ($result | ConvertTo-Json -Compress)
  if($child.ExitCode -ne 0){throw "$Name failed; evidence preserved."}
}
Step 'dependencies' @($npm,'ci','--ignore-scripts','--no-audit','--no-fund')
Step 'sc09-focused' @('--experimental-strip-types','--test','src/lib/boot-guard.test.ts','src/studio/industries/quantity-surveying/qsItemBinding.test.ts','src/studio/industries/quantity-surveying/quantityForm.test.ts','src/studio/industries/quantity-surveying/QuantityReportView.test.ts')
Step 'typecheck' @($npm,'run','typecheck')
Step 'full-tests' @($npm,'test')
Verify-Sources
[pscustomobject]@{host=$env:COMPUTERNAME;source=$source;sourceSha256=$SourceHash;runtimeSha256=$RuntimeHash;nativeSha256=$NativeHash;results=$results;verdict='PASS'} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $run 'preflight.json') -Encoding UTF8
Write-Output 'PREFLIGHT_READY: execute development browser proof before full build.'
