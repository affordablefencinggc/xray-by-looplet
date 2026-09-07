$ErrorActionPreference='Stop'
$workspace='C:\Users\danie\repo\xray-by-looplet'
$proof=Join-Path $workspace 'proof\audit\IW-DWG'
$buildExe=Join-Path $workspace 'src-tauri\target\release\xray-by-looplet.exe'
$installer=Join-Path $workspace 'src-tauri\target\release\bundle\nsis\X-Ray by Looplet_0.1.0_x64-setup.exe'
$identity=Get-Content -LiteralPath (Join-Path $proof 'native-launch.json') -Raw | ConvertFrom-Json
$buildHash=(Get-FileHash -LiteralPath $buildExe -Algorithm SHA256).Hash.ToLowerInvariant()
if($identity.sha256 -ne $buildHash){throw 'Native proof does not match the current executable.'}
$log=Get-Content -LiteralPath (Join-Path $proof 'native-final.log') -Raw
if($log -match '✗|Evaluation error|timed out' -or $log -notmatch 'Redo restored imported references'){throw 'Native acceptance has not passed.'}
if((Get-Content -LiteralPath (Join-Path $proof 'native-build-final.log') -Raw) -notmatch 'Finished 1 bundle'){throw 'Installer has not completed.'}
$installDir=Join-Path $env:LOCALAPPDATA 'X-Ray by Looplet'
$installedExe=Join-Path $installDir 'xray-by-looplet.exe'
$oldHash=(Get-FileHash -LiteralPath $installedExe -Algorithm SHA256).Hash.ToLowerInvariant()
$backup=Join-Path $workspace ('.temp\previous-installed-'+$oldHash.Substring(0,12)+'.exe')
if(-not(Test-Path -LiteralPath $backup)){Copy-Item -LiteralPath $installedExe -Destination $backup}
$closed=@()
foreach($p in Get-Process -Name 'xray-by-looplet' -ErrorAction SilentlyContinue){
 if($p.Path -eq $installedExe){
  $closed+=$p.Id
  $null=$p.CloseMainWindow()
  if(-not $p.WaitForExit(10000)){throw 'The running app did not close; no installer started.'}
 }
}
$setup=Start-Process -FilePath $installer -ArgumentList @('/S',"/D=$installDir") -WindowStyle Hidden -Wait -PassThru
if($setup.ExitCode -ne 0){throw "Installer failed with exit $($setup.ExitCode)."}
@{buildSha256=$buildHash;installerSha256=(Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash.ToLowerInvariant();previousSha256=$oldHash;installedSha256=(Get-FileHash -LiteralPath $installedExe -Algorithm SHA256).Hash.ToLowerInvariant();installedExe=$installedExe;backup=$backup;closedProcessIds=$closed;installerExit=$setup.ExitCode;installedAt=[DateTime]::UtcNow.ToString('o');profile='Existing application data retained; QA uses separate WebView2 profiles.'}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $proof 'install.json') -Encoding utf8
node (Join-Path $proof 'verify-installed.mjs')
if($LASTEXITCODE -ne 0){throw 'Installed identity verification failed.'}
