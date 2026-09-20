param([string]$RunId='sc09rr-fc02f13bc904')
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
if ([Net.Dns]::GetHostName().ToLowerInvariant() -cne 'dans1') { throw 'DANS1 required' }
. 'C:/Users/danie/XRayBuilds/dans1-resource-policy.ps1'
[Diagnostics.Process]::GetCurrentProcess().ProcessorAffinity=[IntPtr]65535
$root="C:/Users/danie/XRayBuilds/preflight/$RunId"
$source=Join-Path $root 'source'
$output=Join-Path $root 'attempts/css-build-1'
if(Test-Path $output){throw 'Preserve existing build evidence'}
New-Item -ItemType Directory -Path $output | Out-Null
$manifest=Get-Content "$root/source-manifest.json" -Raw | ConvertFrom-Json
$node=Join-Path $root 'runtime/node.exe'
$env:PATH=(Join-Path $root 'runtime')+';'+$env:PATH
$env:VITE_AUTH_ENABLED='false'
$env:VITE_XRAY_BUILD_ID=$RunId
$env:DATABASE_URL=$null
$receipts=[Collections.Generic.List[object]]::new()
$allSteps=[Collections.Generic.List[object]]::new()
$failure=$null
$tokens=$null;$parseErrors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile("$root/qualify.ps1",[ref]$tokens,[ref]$parseErrors)
if($parseErrors.Count){throw 'Qualification helper parse failed'}
foreach($function in $ast.FindAll({param($a) $a -is [Management.Automation.Language.FunctionDefinitionAst]},$false)){
  . ([scriptblock]::Create($function.Extent.Text))
}
try{
  Assert-SourceUnchanged
  $npm=Join-Path $root 'runtime/node_modules/npm/bin/npm-cli.js'
  $step=Start-OwnedStep 'web-build' @($npm,'run','build') 900000 'serial'
  Wait-OwnedWave @($step)
  $receipt=Complete-OwnedStep $step
  if($receipt.verdict -cne 'PASS'){throw 'Web build failed'}
  Assert-SourceUnchanged
}catch{$failure=$_}finally{
  foreach($step in $allSteps){
    try{Stop-OwnedStep $step 'final build cleanup'}catch{if(-not $failure){$failure=$_}}
    $step.process.Dispose()
  }
}
$result=[ordered]@{host='DANS1';runId=$RunId;sourceDigest=$manifest.sourceDigest;commands=@($receipts);verdict=$(if($failure){'FAIL'}else{'PASS'});error=$(if($failure){[string]$failure}else{$null});limits='Web build only, no deployment/native acceptance'}
$result | ConvertTo-Json -Depth 10 | Set-Content "$output/results.json" -Encoding utf8
Get-ChildItem $output -File -Recurse | ForEach-Object {[pscustomobject]@{path=$_.FullName.Substring($output.Length+1);sha256=(Get-FileHash $_.FullName).Hash.ToLowerInvariant()}} | ConvertTo-Json | Set-Content "$output/sha256-manifest.json" -Encoding utf8
$result | Select-Object host,runId,verdict,error | ConvertTo-Json
if($failure){exit 1}