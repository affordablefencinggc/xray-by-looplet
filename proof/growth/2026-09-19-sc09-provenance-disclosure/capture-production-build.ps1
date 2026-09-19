param([Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{12}$')][string]$RunId)
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$name=((& ssh tonys-test-pc hostname) | Out-String).Trim().ToLowerInvariant()
if($LASTEXITCODE -ne 0 -or $name -cne 'dans1'){throw 'Expected DANS1'}
$evidence=Join-Path $PSScriptRoot "production-build\$RunId"
if(Test-Path -LiteralPath $evidence){throw 'Preserve previous build evidence'}
New-Item -ItemType Directory -Path $evidence | Out-Null
$remote=@'
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
if($env:COMPUTERNAME -cne 'DANS1'){throw 'Expected DANS1'}
$run='C:\Users\danie\XRayBuilds\runs\__ID__'
$incoming='C:\Users\danie\XRayBuilds\incoming\__ID__'
$source=Join-Path $run 'source'
$completion=Get-Content -LiteralPath (Join-Path $run 'completion.json') -Raw | ConvertFrom-Json
if(@($completion.results | Where-Object {$_.exitCode -ne 0}).Count -or -not @($completion.results | Where-Object {$_.step -eq 'web-build'}).Count){throw 'Build did not pass'}
$verified=0
foreach($name in @('source-manifest.json','native-manifest.json')){
  $manifest=Get-Content -LiteralPath (Join-Path $incoming $name) -Raw | ConvertFrom-Json
  foreach($entry in $manifest.entries){
    $target=[IO.Path]::GetFullPath((Join-Path $source $entry.path))
    if(-not $target.StartsWith($source+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Manifest escaped source'}
    if((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -cne $entry.sha256){throw "Built source changed: $($entry.path)"}
    $verified++
  }
}
foreach($artifact in $completion.artifacts){
  if($artifact.name -match '[/\\:]'){throw 'Unsafe artifact name'}
  $target=Join-Path (Join-Path $source '.vercel\output\static\assets') $artifact.name
  if((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -cne $artifact.sha256){throw "Built artifact changed: $($artifact.name)"}
}
Copy-Item -LiteralPath (Join-Path $incoming 'build-launch.json') -Destination $run
Copy-Item -LiteralPath (Join-Path $incoming 'dans1-build-worker.ps1') -Destination $run
$launch=Get-Content -LiteralPath (Join-Path $run 'build-launch.json') -Raw | ConvertFrom-Json
$active=Get-CimInstance Win32_Process -Filter "ProcessId=$($launch.pid)" -ErrorAction SilentlyContinue
$sameOwner=$active -and $active.CommandLine -ceq $launch.command -and $active.ExecutablePath -ceq $launch.executable
if($sameOwner){throw 'Original build owner is still active'}
$names=@('completion.json','results.json','build-launch.json','dans1-build-worker.ps1')
foreach($step in $completion.results){$names+=@("$($step.step).stdout.log","$($step.step).stderr.log")}
$entries=@($names | ForEach-Object {
  $file=Get-Item -LiteralPath (Join-Path $run $_)
  [pscustomobject]@{path=$_;bytes=$file.Length;sha256=(Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant();writtenAt=$file.LastWriteTimeUtc.ToString('o')}
})
[ordered]@{host=$env:COMPUTERNAME;owner='/root/sc09_review';capturedAt=[DateTime]::UtcNow.ToString('o');runId='__ID__';
 sourceSha256=$completion.sourceSha256;sourceFilesReverifiedAfterBuildAndBrowser=$verified;artifactsReverified=$completion.artifacts.Count;
 buildOwnerStillActive=$false;entries=$entries} | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $run 'build-evidence-receipt.json') -Encoding UTF8
'@
$encoded=[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($remote.Replace('__ID__',$RunId)))
& ssh tonys-test-pc powershell -NoProfile -NonInteractive -EncodedCommand $encoded
if($LASTEXITCODE -ne 0){throw 'Remote build evidence verification failed'}
$remoteRoot="tonys-test-pc:C:/Users/danie/XRayBuilds/runs/$RunId/"
& scp ($remoteRoot+'build-evidence-receipt.json') $evidence
if($LASTEXITCODE -ne 0){throw 'Build receipt transfer failed'}
$receipt=Get-Content -LiteralPath (Join-Path $evidence 'build-evidence-receipt.json') -Raw | ConvertFrom-Json
foreach($entry in $receipt.entries){
  & scp ($remoteRoot+$entry.path) $evidence
  if($LASTEXITCODE -ne 0){throw "Build artifact transfer failed: $($entry.path)"}
  if((Get-FileHash -LiteralPath (Join-Path $evidence $entry.path) -Algorithm SHA256).Hash.ToLowerInvariant() -cne $entry.sha256){throw "Returned build evidence mismatch: $($entry.path)"}
}
Write-Output "Verified/retrieved $($receipt.entries.Count) build files; $($receipt.sourceFilesReverifiedAfterBuildAndBrowser) source files and $($receipt.artifactsReverified) built assets unchanged."
