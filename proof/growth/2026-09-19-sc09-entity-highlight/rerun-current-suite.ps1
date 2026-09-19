param(
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{12}$')][string]$RunId,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$SourceHash
)
$ErrorActionPreference='Stop'
if($env:COMPUTERNAME -ne 'DANS1'){throw 'DANS1 required'}
. 'C:\Users\danie\XRayBuilds\dans1-resource-policy.ps1'
$incoming="C:\Users\danie\XRayBuilds\incoming\$RunId"
$run="C:\Users\danie\XRayBuilds\preflight\$RunId"
$source=Join-Path $run 'source'
$runtime=Join-Path $run 'runtime'
$web=Get-Content -LiteralPath (Join-Path $incoming 'source-manifest.json') -Raw | ConvertFrom-Json
$native=Get-Content -LiteralPath (Join-Path $incoming 'native-manifest.json') -Raw | ConvertFrom-Json
if($web.archiveSha256 -cne $SourceHash){throw 'Unexpected source manifest'}
function Verify-Sources {
  foreach($entry in @($web.entries)+@($native.entries)) {
    $target=[IO.Path]::GetFullPath((Join-Path $source $entry.path))
    if(-not $target.StartsWith($source+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Source escaped snapshot'}
    if((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -cne $entry.sha256){throw "Source changed: $($entry.path)"}
  }
}
Verify-Sources
$name='full-tests-auth-environment-corrected'
$log=Join-Path $run ($name+'.stdout.log')
if(Test-Path -LiteralPath $log){throw 'Preserve historical logs'}
$env:PATH=$runtime+';'+$env:PATH
$env:VITE_AUTH_ENABLED=$null
$started=Get-Date
$child=Start-Process -FilePath (Join-Path $runtime 'node.exe') -ArgumentList @((Join-Path $runtime 'node_modules\npm\bin\npm-cli.js'),'test') -WorkingDirectory $source -WindowStyle Hidden -PassThru -RedirectStandardOutput $log -RedirectStandardError (Join-Path $run ($name+'.stderr.log'))
$childHandle=$child.Handle
$child.PriorityClass='High'
$child.WaitForExit()
Verify-Sources
$result=[pscustomobject]@{host=$env:COMPUTERNAME;step=$name;exitCode=$child.ExitCode;seconds=((Get-Date)-$started).TotalSeconds;priority='High';sourceSha256=$SourceHash;VITE_AUTH_ENABLED='unset (suite controls both states)';sourceHashesUnchanged=$true}
$result | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $run ($name+'.json')) -Encoding UTF8
$result | ConvertTo-Json -Compress
exit $child.ExitCode
