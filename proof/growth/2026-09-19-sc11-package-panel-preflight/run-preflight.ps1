param([Parameter(Mandatory=$true)][string]$Campaign,[Parameter(Mandatory=$true)][string]$Baseline,[Parameter(Mandatory=$true)][string]$Node)
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$hostName=([Net.Dns]::GetHostName().Trim() -split '\.')[0].ToLowerInvariant()
if($hostName -cne 'dans1'){throw "DANS1 host guard failed: $hostName"}
$campaignFull=[IO.Path]::GetFullPath($Campaign)
if($campaignFull -notmatch '^C:\\Users\\danie\\XRayBuilds\\preflight\\sc11-panel-[a-f0-9]{12}$'){throw 'Unexpected campaign target.'}
if([IO.Path]::GetFullPath($Baseline) -cne 'C:\Users\danie\XRayBuilds\preflight\4c87a0de13b6\source'){throw 'Unexpected baseline.'}
$source=Join-Path $campaignFull 'source'
$output=Join-Path $campaignFull 'output'
if((Test-Path -LiteralPath $source) -or (Test-Path -LiteralPath $output)){throw 'Snapshot/output already exists; refusing to mix evidence.'}
New-Item -ItemType Directory -Path $source,$output | Out-Null
$manifest=Get-Content -LiteralPath (Join-Path $campaignFull 'input\source-manifest.json') -Raw | ConvertFrom-Json
foreach($entry in $manifest.entries){
  $inputFile=Join-Path (Join-Path $campaignFull 'input\overlay') $entry.path
  if((Get-FileHash -LiteralPath $inputFile -Algorithm SHA256).Hash.ToLowerInvariant() -cne $entry.sha256){throw "Transferred hash mismatch: $($entry.path)"}
}
function SourceManifest([string]$Root){
  $paths=@(Get-ChildItem -LiteralPath (Join-Path $Root 'src'),(Join-Path $Root 'scripts') -Recurse -File)
  $paths+=Get-Item -LiteralPath (Join-Path $Root 'package.json'),(Join-Path $Root 'package-lock.json'),(Join-Path $Root 'tsconfig.json')
  return @($paths | Sort-Object FullName | ForEach-Object {[ordered]@{path=$_.FullName.Substring($Root.Length+1).Replace('\','/');sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()}})
}
$baselineBefore=SourceManifest $Baseline
$baselineBefore | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $output 'baseline-before.json') -Encoding utf8
& robocopy $Baseline $source /E /XD node_modules .git .output .tanstack .cache dist build target /R:0 /W:0 /NFL /NDL /NJH /NJS /NP ("/LOG:"+(Join-Path $output 'source-copy.log')) | Out-Null
if($LASTEXITCODE -ge 8){throw "Read-only baseline copy failed: $LASTEXITCODE"}
# Tests compile transient CommonJS under node_modules/.cache. Keep that cache
# snapshot-local instead of writing through a whole node_modules junction.
$dependencies=Join-Path $Baseline 'node_modules'
$localDependencies=Join-Path $source 'node_modules'
New-Item -ItemType Directory -Path $localDependencies | Out-Null
$dependencyLinks=@()
foreach($item in Get-ChildItem -LiteralPath $dependencies -Force){
  if($item.Name -in @('.cache','.vite','.vite-temp')){continue}
  $link=Join-Path $localDependencies $item.Name
  if($item.PSIsContainer){New-Item -ItemType Junction -Path $link -Target $item.FullName | Out-Null; $mode='read-only-use junction'}
  else{Copy-Item -LiteralPath $item.FullName -Destination $link; $mode='copied metadata'}
  $dependencyLinks+=[ordered]@{name=$item.Name;target=$item.FullName;mode=$mode}
}
$dependencyLinks | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $output 'dependency-links.json') -Encoding utf8
foreach($entry in $manifest.entries){
  $from=Join-Path (Join-Path $campaignFull 'input\overlay') $entry.path
  $target=[IO.Path]::GetFullPath((Join-Path $source $entry.path))
  if(-not $target.StartsWith($source+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Overlay target escaped snapshot.'}
  New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null
  Copy-Item -LiteralPath $from -Destination $target
  if((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -cne $entry.sha256){throw "Staged hash mismatch: $($entry.path)"}
}
$before=SourceManifest $source
$before | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $output 'source-before.json') -Encoding utf8
$lintPaths=@('src/studio/industries/quantity-surveying/QSCostPlanPackagePanel.tsx','src/studio/industries/quantity-surveying/QSCostPlanPackagePanel.test.ts','src/studio/industries/hvac/ductMaterialBasis.ts','src/studio/industries/hvac/ductMaterialBasis.test.ts','src/studio/industries/quantity-surveying/qsRateBook.ts','src/studio/industries/quantity-surveying/report.ts','src/studio/pricing/PriceBookPanel.tsx','scripts/fast-cdp.mjs','scripts/fast-cdp.test.mjs')
$commands=@(
  [ordered]@{name='panel-and-hvac';args=@('--experimental-strip-types','--test','src/studio/industries/quantity-surveying/QSCostPlanPackagePanel.test.ts','src/studio/industries/hvac/ductMaterialBasis.test.ts')},
  [ordered]@{name='runner';args=@('--test','scripts/fast-cdp.test.mjs')},
  [ordered]@{name='typecheck';args=@('node_modules/typescript/bin/tsc','--noEmit')},
  [ordered]@{name='scoped-lint';args=@('node_modules/eslint/bin/eslint.js')+$lintPaths}
)
$receipts=@()
foreach($command in $commands){
  $started=[DateTime]::UtcNow
  $process=New-Object Diagnostics.Process
  $startInfo=New-Object Diagnostics.ProcessStartInfo
  $startInfo.FileName=$Node
  $startInfo.Arguments=($command.args -join ' ')
  $startInfo.WorkingDirectory=$source
  $startInfo.UseShellExecute=$false
  $startInfo.CreateNoWindow=$true
  $startInfo.RedirectStandardOutput=$true
  $startInfo.RedirectStandardError=$true
  $startInfo.StandardOutputEncoding=[Text.Encoding]::UTF8
  $startInfo.StandardErrorEncoding=[Text.Encoding]::UTF8
  $process.StartInfo=$startInfo
  if(-not $process.Start()){throw "Process failed to start: $($command.name)"}
  $stdoutRead=$process.StandardOutput.ReadToEndAsync()
  $stderrRead=$process.StandardError.ReadToEndAsync()
  $process.PriorityClass='High'
  $process.ProcessorAffinity=[IntPtr]65535
  $identity=[ordered]@{owner='/root/sc09_review';pid=$process.Id;createdAt=$process.StartTime.ToUniversalTime().ToString('o');executable=$Node;arguments=$command.args;priority=[string]$process.PriorityClass;affinity=[string]$process.ProcessorAffinity;purpose=$command.name;lastActivity=$started.ToString('o')}
  $identity | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $output ($command.name+'.process.json')) -Encoding utf8
  $timedOut=-not $process.WaitForExit(300000)
  if($timedOut){
    $live=Get-Process -Id $identity.pid -ErrorAction SilentlyContinue
    if($live -and $live.StartTime.ToUniversalTime().ToString('o') -ceq $identity.createdAt -and $live.Path -ceq $Node){& taskkill /PID $identity.pid /T /F | Out-Null}
    $process.WaitForExit()
  }
  $exit=[int]$process.ExitCode
  $stdout=Join-Path $output ($command.name+'.stdout.log')
  $stderr=Join-Path $output ($command.name+'.stderr.log')
  [IO.File]::WriteAllText($stdout,$stdoutRead.GetAwaiter().GetResult(),(New-Object Text.UTF8Encoding($false)))
  [IO.File]::WriteAllText($stderr,$stderrRead.GetAwaiter().GetResult(),(New-Object Text.UTF8Encoding($false)))
  $receipt=[ordered]@{name=$command.name;command=@($Node)+$command.args;host='DANS1';workingDirectory=$source;startedAt=$started.ToString('o');completedAt=[DateTime]::UtcNow.ToString('o');elapsedMs=([DateTime]::UtcNow-$started).TotalMilliseconds;exitCode=$exit;timedOut=$timedOut;process=$identity;processExited=$process.HasExited;stdout=$stdout;stderr=$stderr}
  $receipt | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $output ($command.name+'.json')) -Encoding utf8
  $receipts+=$receipt
  Write-Output ($receipt | ConvertTo-Json -Depth 8 -Compress)
  $process.Dispose()
}
$after=SourceManifest $source
$baselineAfter=SourceManifest $Baseline
$after | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $output 'source-after.json') -Encoding utf8
$baselineAfter | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $output 'baseline-after.json') -Encoding utf8
$changed=@(Compare-Object ($before | ConvertTo-Json -Depth 5) ($after | ConvertTo-Json -Depth 5))
$baselineChanged=@(Compare-Object ($baselineBefore | ConvertTo-Json -Depth 5) ($baselineAfter | ConvertTo-Json -Depth 5))
$overlayChanges=@($manifest.entries | Where-Object {(Get-FileHash -LiteralPath (Join-Path $source $_.path) -Algorithm SHA256).Hash.ToLowerInvariant() -cne $_.sha256} | ForEach-Object {$_.path})
$result=[ordered]@{host='DANS1';owner='/root/sc09_review';campaign=$campaignFull;baselineSource=$Baseline;sourceSnapshot=$source;dependencyDirectory=$dependencies;dependencyUse='Read-only-use per-entry junctions; snapshot-local transient .cache; no installs or build';node=$Node;nodeSha256=(Get-FileHash -LiteralPath $Node -Algorithm SHA256).Hash.ToLowerInvariant();packageLockSha256=(Get-FileHash -LiteralPath (Join-Path $source 'package-lock.json') -Algorithm SHA256).Hash.ToLowerInvariant();overlayManifest=$manifest;sourceChangesAfterChecks=$changed;baselineChangesAfterChecks=$baselineChanged;overlayChangesAfterChecks=$overlayChanges;commands=$receipts;verdict=if(@($receipts | Where-Object {$_.exitCode -ne 0 -or $_.timedOut}).Count -eq 0 -and $changed.Count -eq 0 -and $baselineChanged.Count -eq 0 -and $overlayChanges.Count -eq 0){'PASS'}else{'FAIL'};limitations=@('Source diagnostics only. Panel remains unmounted; no browser/screenshot or download readback proof.','No full build, app server or browser started. All recorded test processes exited.')}
$result | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $output 'results.json') -Encoding utf8
@(Get-ChildItem -LiteralPath $output -File | ForEach-Object {[ordered]@{path=$_.Name;bytes=$_.Length;sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()}}) | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $output 'sha256-manifest.json') -Encoding utf8
Write-Output ($result | ConvertTo-Json -Depth 12 -Compress)
if($result.verdict -ne 'PASS'){exit 1}
exit 0
