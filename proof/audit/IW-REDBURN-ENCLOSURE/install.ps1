$ErrorActionPreference='Stop'
[Diagnostics.Process]::GetCurrentProcess().PriorityClass='BelowNormal'
$workspace='C:\Users\danie\repo\xray-by-looplet'
Set-Location -LiteralPath $workspace
$proof=Join-Path $workspace 'proof\audit\IW-REDBURN-ENCLOSURE'
$verified=Get-Content -Raw -LiteralPath (Join-Path $proof 'native-verified.json') | ConvertFrom-Json
$build=Get-Content -Raw -LiteralPath (Join-Path $proof 'native-completion.json') | ConvertFrom-Json
$exe=Join-Path $workspace '.temp\dans1-native\xray-by-looplet.exe'
$installer=Join-Path $workspace '.temp\dans1-native\X-Ray by Looplet_0.1.0_x64-setup.exe'
if (-not $verified.ok -or (Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash.ToLowerInvariant() -ne $verified.sha256) { throw 'Native proof does not match executable' }
$setupHash=(Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash.ToLowerInvariant()
if (-not ($build.artifacts | Where-Object { $_.sha256 -eq $setupHash -and $_.path.EndsWith('-setup.exe') })) { throw 'Installer differs from remote build' }
$installDir=Join-Path $env:LOCALAPPDATA 'X-Ray by Looplet'
$installedExe=Join-Path $installDir 'xray-by-looplet.exe'
# A running user app is a hard stop: this installer never force-closes it.
if (Get-Process -Name 'xray-by-looplet' -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $installedExe }) { throw 'Installed X-Ray is running; preserve active work and defer update' }
$backup=Join-Path $workspace ('.temp\before-redburn-update-'+[DateTime]::UtcNow.ToString('yyyyMMddHHmmss'))
New-Item -ItemType Directory -Path $backup | Out-Null
& robocopy $installDir (Join-Path $backup 'application') /E /XJ /R:1 /W:1 /NP /NFL /NDL /NJH /NJS
if ($LASTEXITCODE -gt 7) { throw 'Previous application backup failed' }
$profile=Join-Path $env:LOCALAPPDATA 'com.looplet.xray'
& robocopy $profile (Join-Path $backup 'profile') /E /XJ /R:1 /W:1 /NP /NFL /NDL /NJH /NJS
if ($LASTEXITCODE -gt 7) { throw 'Existing profile backup failed' }
function ProfileIdentity {
  @(Get-ChildItem -LiteralPath $profile -File -Recurse | Sort-Object FullName | ForEach-Object { [pscustomobject]@{path=$_.FullName.Substring($profile.Length);hash=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash} }) | ConvertTo-Json -Compress
}
$before=ProfileIdentity
$setup=Start-Process -FilePath $installer -ArgumentList @('/S',"/D=$installDir") -WindowStyle Hidden -PassThru
$handle=$setup.Handle
$setup.WaitForExit()
if ($setup.ExitCode -ne 0) { throw "Installer failed: $($setup.ExitCode)" }
node (Join-Path $proof 'verify-installed.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Installed identity verification failed' }
$after=ProfileIdentity
if ($before -ne $after) { throw 'Profile changed during installation; backup retained, inspect before launch' }
@{ok=$true;installedExe=$installedExe;installerSha256=$setupHash;backup=$backup;profilePreserved=$true;forcedProcessClosures=0;installedAt=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $proof 'install.json') -Encoding UTF8
Write-Output 'Installed verified update. Existing profile hashes unchanged; no app forcibly closed.'
