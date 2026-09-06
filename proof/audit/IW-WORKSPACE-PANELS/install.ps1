$ErrorActionPreference='Stop'
$workspace='C:\Users\danie\repo\xray-by-looplet'
$proofDir=Join-Path $workspace 'proof\audit\IW-WORKSPACE-PANELS'
$qa=Get-Content -LiteralPath (Join-Path $proofDir 'native-qa.json') -Raw | ConvertFrom-Json
$buildExe=Join-Path $workspace 'src-tauri\target\release\xray-by-looplet.exe'
$installer=Join-Path $workspace 'src-tauri\target\release\bundle\nsis\X-Ray by Looplet_0.1.0_x64-setup.exe'
$buildHash=(Get-FileHash -LiteralPath $buildExe -Algorithm SHA256).Hash
if(-not $qa.ok -or $buildHash -ne $qa.sha256){throw 'Package differs from verified native build.'}
$installDir=Join-Path $env:LOCALAPPDATA 'X-Ray by Looplet'
$installedExe=Join-Path $installDir 'xray-by-looplet.exe'
$oldHash=(Get-FileHash -LiteralPath $installedExe -Algorithm SHA256).Hash
$backup=Join-Path $proofDir ('previous-installed-'+$oldHash.Substring(0,12).ToLowerInvariant()+'.exe')
if(-not (Test-Path -LiteralPath $backup)){Copy-Item -LiteralPath $installedExe -Destination $backup}
$closed=@()
foreach($app in Get-Process -Name 'xray-by-looplet' -ErrorAction SilentlyContinue){if($app.Path -eq $installedExe){$closed+=$app.Id;$null=$app.CloseMainWindow();if(-not $app.WaitForExit(2000)){$app.Kill();$app.WaitForExit()}}}
$setup=Start-Process -FilePath $installer -ArgumentList @('/S',"/D=$installDir") -WindowStyle Hidden -Wait -PassThru
if($setup.ExitCode -ne 0){throw "Installer failed: $($setup.ExitCode)"}
@{buildSha256=$buildHash.ToLowerInvariant();installerSha256=(Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash.ToLowerInvariant();previousSha256=$oldHash.ToLowerInvariant();installedSha256=(Get-FileHash -LiteralPath $installedExe -Algorithm SHA256).Hash.ToLowerInvariant();installedExe=$installedExe;backup=$backup;closedProcessIds=$closed;installerExit=$setup.ExitCode;installedAt=[DateTime]::UtcNow.ToString('o');profile='Retained existing application data. No reset, deletion or test annotations in user profile.'}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $proofDir 'install.json') -Encoding utf8
Write-Output 'Installed verified update; existing profile retained.'
