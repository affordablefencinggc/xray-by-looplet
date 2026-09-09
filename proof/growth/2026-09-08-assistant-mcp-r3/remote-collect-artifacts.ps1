param([Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{12}$')][string]$RunId)
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
if ($env:COMPUTERNAME -ne 'DANS1') { throw 'Dans1 only.' }
$run=Join-Path 'C:\Users\danie\XRayBuilds\runs' $RunId
$source=Join-Path $run 'source'
$completion=Get-Content -LiteralPath (Join-Path $run 'native-completion.json') -Raw | ConvertFrom-Json
if (($completion.results | Where-Object {$_.step -eq 'native-build'}).exitCode -ne 0) { throw 'Successful native build required.' }
$files=[Collections.Generic.List[string]]::new()
foreach($artifact in $completion.artifacts) {
  $absolute=[IO.Path]::GetFullPath($artifact.path)
  if (-not $absolute.StartsWith($source+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Artifact outside source run.' }
  if ((Get-FileHash -LiteralPath $absolute -Algorithm SHA256).Hash.ToLowerInvariant() -ne $artifact.sha256) { throw 'Native artifact hash mismatch.' }
  $files.Add($absolute.Substring($source.Length+1).Replace('\','/'))
}
foreach($file in (Get-ChildItem -LiteralPath (Join-Path $source 'engine\cad\bin') -Recurse -File)) {
  $files.Add($file.FullName.Substring($source.Length+1).Replace('\','/'))
}
$entries=@($files | ForEach-Object { $absolute=Join-Path $source $_; @{path=$_;sha256=(Get-FileHash -LiteralPath $absolute -Algorithm SHA256).Hash.ToLowerInvariant();bytes=(Get-Item -LiteralPath $absolute).Length} })
$list=Join-Path $run 'artifact-files.txt'
$files | Set-Content -LiteralPath $list -Encoding ASCII
$archive=Join-Path $run 'native-artifacts.tar'
if (Test-Path -LiteralPath $archive) { throw 'Artifact archive already exists; existing copy preserved.' }
& tar -cf $archive -C $source -T $list
if ($LASTEXITCODE -ne 0) { throw 'Artifact archive failed.' }
$manifest=@{run=$run;sourceSha256=$completion.sourceSha256;nativeSourceSha256=$completion.nativeSourceSha256;entries=$entries;archive=@{path=$archive;sha256=(Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant();bytes=(Get-Item -LiteralPath $archive).Length}}
$manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $run 'artifact-manifest.json') -Encoding UTF8
Write-Output ($manifest.archive | ConvertTo-Json -Compress)
$webCompletion=Get-Content -LiteralPath (Join-Path $run 'completion.json') -Raw | ConvertFrom-Json
if (($webCompletion.results | Where-Object {$_.step -eq 'web-build'}).exitCode -ne 0 -or $webCompletion.sourceSha256 -ne $completion.sourceSha256) { throw 'Matching successful web build required.' }
$webRoot=Join-Path $source '.vercel\output'
$webFiles=@(Get-ChildItem -LiteralPath $webRoot -Recurse -File | ForEach-Object {
  if ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Web artifact symlink rejected.' }
  $_.FullName.Substring($source.Length+1).Replace('\','/')
})
$webEntries=@($webFiles | ForEach-Object { $absolute=Join-Path $source $_; @{path=$_;sha256=(Get-FileHash -LiteralPath $absolute -Algorithm SHA256).Hash.ToLowerInvariant();bytes=(Get-Item -LiteralPath $absolute).Length} })
$webList=Join-Path $run 'web-artifact-files.txt'
$webFiles | Set-Content -LiteralPath $webList -Encoding ASCII
$webArchive=Join-Path $run 'web-artifacts.tar'
if (Test-Path -LiteralPath $webArchive) { throw 'Web artifact archive exists; preserved.' }
& tar -cf $webArchive -C $source -T $webList
if ($LASTEXITCODE -ne 0) { throw 'Web artifact archive failed.' }
$webManifest=@{run=$run;sourceSha256=$completion.sourceSha256;nativeSourceSha256=$completion.nativeSourceSha256;entries=$webEntries;archive=@{path=$webArchive;sha256=(Get-FileHash -LiteralPath $webArchive -Algorithm SHA256).Hash.ToLowerInvariant();bytes=(Get-Item -LiteralPath $webArchive).Length}}
$webManifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $run 'web-artifact-manifest.json') -Encoding UTF8
Write-Output ($webManifest.archive | ConvertTo-Json -Compress)
