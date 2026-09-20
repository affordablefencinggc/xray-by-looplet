param([Parameter(Mandatory=$true)][ValidatePattern('^hvac4-[a-f0-9]{12}$')][string]$RunId)
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
if([Net.Dns]::GetHostName().ToLowerInvariant() -cne 'dans1'){throw 'DANS1 required'}
$root="C:/Users/danie/XRayBuilds/preflight/$RunId"
$source=Join-Path $root 'source'
$manifest=Get-Content "$root/source-manifest.json" -Raw | ConvertFrom-Json
$output=Join-Path $root 'attempts/worker-build1'
if(Test-Path $output){throw 'Preserve prior evidence'}
New-Item -ItemType Directory -Path $output | Out-Null
$buildId=$RunId.Substring(6)
$incoming="C:/Users/danie/XRayBuilds/incoming/$buildId"
if(Test-Path $incoming){throw 'Preserve existing incoming stage'}
New-Item -ItemType Directory -Path $incoming | Out-Null
Copy-Item "$root/source.tar","$root/source-manifest.json" $incoming
Copy-Item 'C:/Users/danie/XRayBuilds/incoming/f9fe019e7008/node-runtime.tar' $incoming
$empty=Join-Path $incoming 'empty-native'
New-Item -ItemType Directory -Path $empty | Out-Null
& tar -cf "$incoming/native-source.tar" -C $empty .
if($LASTEXITCODE -ne 0){throw 'Empty native archive failed'}
$sourceHash=(Get-FileHash "$incoming/source.tar").Hash.ToLowerInvariant()
$runtimeHash=(Get-FileHash "$incoming/node-runtime.tar").Hash.ToLowerInvariant()
$nativeHash=(Get-FileHash "$incoming/native-source.tar").Hash.ToLowerInvariant()
@{archiveSha256=$nativeHash;entries=@()} | ConvertTo-Json | Set-Content "$incoming/native-manifest.json" -Encoding UTF8
$receipts=[Collections.Generic.List[object]]::new()
$allSteps=[Collections.Generic.List[object]]::new()
$tokens=$null;$errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile("$root/qualify.ps1",[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'Safe qualification helper failed to parse'}
foreach($function in $ast.FindAll({param($a)$a -is [Management.Automation.Language.FunctionDefinitionAst]},$false)){. ([scriptblock]::Create($function.Extent.Text))}
$node=Join-Path $PSHOME 'powershell.exe'
[Diagnostics.Process]::GetCurrentProcess().ProcessorAffinity=[IntPtr]65535
$failure=$null
try {
  Assert-SourceUnchanged
  $step=Start-OwnedStep 'required-build-worker' @('-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',"$source/scripts/dans1-build-worker.ps1",'-RunId',$buildId,'-SourceHash',$sourceHash,'-RuntimeHash',$runtimeHash,'-NativeHash',$nativeHash,'-WebOnly') 1200000 'serial'
  Wait-OwnedWave @($step)
  $receipt=Complete-OwnedStep $step
  if($receipt.verdict -cne 'PASS'){throw 'Required build worker failed'}
  Assert-SourceUnchanged
}catch{$failure=$_}finally{
  foreach($step in $allSteps){try{Stop-OwnedStep $step 'final build cleanup'}catch{if(-not $failure){$failure=$_}};$step.process.Dispose()}
}
$builtSource="C:/Users/danie/XRayBuilds/runs/$buildId/source"
@{host='DANS1';runId=$RunId;sourceDigest=$manifest.sourceDigest;builtSource=$builtSource;sourceArchiveSha256=$sourceHash;runtimeArchiveSha256=$runtimeHash;nativeArchiveSha256=$nativeHash;commands=@($receipts);verdict=$(if($failure){'FAIL'}else{'PASS'});error=$(if($failure){[string]$failure}else{$null})} | ConvertTo-Json -Depth 10 | Set-Content "$output/results.json" -Encoding UTF8
if(Test-Path "C:/Users/danie/XRayBuilds/runs/$buildId/completion.json"){Copy-Item "C:/Users/danie/XRayBuilds/runs/$buildId/completion.json" "$output/worker-completion.json"}
Get-ChildItem $output -File -Recurse | ForEach-Object {@{path=$_.FullName.Substring($output.Length+1);sha256=(Get-FileHash $_.FullName).Hash.ToLowerInvariant()}} | ConvertTo-Json | Set-Content "$output/sha256-manifest.json" -Encoding UTF8
if($failure){throw $failure}
