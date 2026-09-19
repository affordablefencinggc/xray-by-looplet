param([Parameter(Mandatory=$true)][string]$RunId,[Parameter(Mandatory=$true)][string]$ArchiveHash)
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
if(([Net.Dns]::GetHostName() -split '\.')[0].ToLowerInvariant() -cne 'dans1'){throw 'DANS1 required'}
if($RunId -notmatch '^sc10-[a-f0-9]{12}$'){throw 'Invalid run ID'}
$root='C:\Users\danie\XRayBuilds\preflight\'+$RunId
$source=Join-Path $root 'source'
$output=Join-Path $root 'output'
$baseline='C:\Users\danie\XRayBuilds\preflight\9abf4c807030'
if((Test-Path -LiteralPath $source) -or (Test-Path -LiteralPath $output)){throw 'Preserve existing campaign'}
if((Get-FileHash -LiteralPath (Join-Path $root 'source.tar') -Algorithm SHA256).Hash.ToLowerInvariant() -cne $ArchiveHash){throw 'Archive hash mismatch'}
$entries=& tar -tf (Join-Path $root 'source.tar')
if($LASTEXITCODE -ne 0){throw 'Archive listing failed'}
foreach($entry in $entries){if($entry -match '(^[/\\]|:|(^|[/\\])\.\.([/\\]|$))'){throw 'Unsafe archive entry'}}
New-Item -ItemType Directory -Path $source,$output|Out-Null
& tar -xf (Join-Path $root 'source.tar') -C $source
if($LASTEXITCODE -ne 0){throw 'Extraction failed'}
$manifest=Get-Content -LiteralPath (Join-Path $root 'source-manifest.json') -Raw|ConvertFrom-Json
function Verify-Source {
  foreach($entry in $manifest.entries){if((Get-FileHash -LiteralPath (Join-Path $source $entry.path) -Algorithm SHA256).Hash.ToLowerInvariant() -cne $entry.sha256){throw ('Source mismatch: '+$entry.path)}}
}
Verify-Source
if((Get-FileHash (Join-Path $source 'package-lock.json')).Hash -cne (Get-FileHash (Join-Path $baseline 'source/package-lock.json')).Hash){throw 'Dependency lock differs; cannot reuse dependencies'}
New-Item -ItemType Junction -Path (Join-Path $source 'node_modules') -Target (Join-Path $baseline 'source/node_modules')|Out-Null
New-Item -ItemType Junction -Path (Join-Path $root 'runtime') -Target (Join-Path $baseline 'runtime')|Out-Null
$node=Join-Path $root 'runtime/node.exe'
$env:PATH=(Join-Path $root 'runtime')+';'+$env:PATH
$env:VITE_AUTH_ENABLED=$null
$checks=@(
  @{name='qs-focused';args=@('--experimental-strip-types','--test')+@(Get-ChildItem (Join-Path $source 'src/studio/industries/quantity-surveying') -Filter '*.test.ts'|Sort-Object Name|ForEach-Object {'src/studio/industries/quantity-surveying/'+$_.Name})+@('proof/growth/2026-09-19-sc10-qs-rate-delta/preflight/state-boundary.test.ts')},
  @{name='typecheck';args=@('node_modules/typescript/bin/tsc','--noEmit')}
)
$receipts=@()
$failure=$null
try {
  foreach($check in $checks){
    $started=[DateTime]::UtcNow
    $process=Start-Process -FilePath $node -ArgumentList $check.args -WorkingDirectory $source -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $output ($check.name+'.stdout.log')) -RedirectStandardError (Join-Path $output ($check.name+'.stderr.log'))
    $null=$process.Handle
    $identity=Get-CimInstance Win32_Process -Filter "ProcessId=$($process.Id)"
    $identity|Select-Object ProcessId,CreationDate,ExecutablePath,CommandLine|ConvertTo-Json|Set-Content (Join-Path $output ($check.name+'.process.json')) -Encoding utf8
    $process.PriorityClass='High'; $process.ProcessorAffinity=[IntPtr]65535
    if(-not $process.WaitForExit(240000)){
      if($process.CloseMainWindow()){$null=$process.WaitForExit(1500)}
      $current=Get-CimInstance Win32_Process -Filter "ProcessId=$($process.Id)" -ErrorAction SilentlyContinue
      if($current -and $current.CreationDate -eq $identity.CreationDate -and $current.CommandLine -ceq $identity.CommandLine){Stop-Process -Id $process.Id -Force}
      throw ('Check deadline: '+$check.name)
    }
    $receipt=[ordered]@{name=$check.name;host='DANS1';command=@($node)+$check.args;exitCode=$process.ExitCode;startedAt=$started.ToString('o');finishedAt=[DateTime]::UtcNow.ToString('o');processExited=$process.HasExited}
    $receipts+=$receipt
    $receipt|ConvertTo-Json -Depth 5|Set-Content (Join-Path $output ($check.name+'.json')) -Encoding utf8
    Write-Output ($receipt|ConvertTo-Json -Depth 5 -Compress)
    $process.Dispose()
    if($receipt.exitCode -ne 0){throw ('Check failed: '+$check.name)}
  }
  Verify-Source
}catch{$failure=$_}
$result=[ordered]@{host='DANS1';runId=$RunId;head=$manifest.head;archiveSha256=$ArchiveHash;source=$source;sourceFiles=$manifest.entries.Count;commands=$receipts;verdict=if($failure){'FAIL'}else{'PASS'};error=if($failure){[string]$failure}else{$null};limits='Focused source tests and full TypeScript only; no browser/build/native acceptance.'}
$result|ConvertTo-Json -Depth 8|Set-Content (Join-Path $output 'results.json') -Encoding utf8
Get-ChildItem $output -File|ForEach-Object {[ordered]@{path=$_.Name;sha256=(Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()}}|ConvertTo-Json|Set-Content (Join-Path $output 'sha256-manifest.json') -Encoding utf8
Write-Output ($result|ConvertTo-Json -Depth 8 -Compress)
if($failure){exit 1}
