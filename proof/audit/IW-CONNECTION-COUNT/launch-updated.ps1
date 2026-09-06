$ErrorActionPreference = 'Stop'
$workspace = 'C:\Users\danie\repo\xray-by-looplet'
$proofDir = Join-Path $workspace 'proof\audit\IW-CONNECTION-COUNT'
$qa = Get-Content -LiteralPath (Join-Path $proofDir 'native-qa.json') -Raw | ConvertFrom-Json
if (-not $qa.ok) { throw 'Native package verification must pass before installation.' }
$installer = Join-Path $workspace 'src-tauri\target\release\bundle\nsis\X-Ray by Looplet_0.1.0_x64-setup.exe'
$buildExe = Join-Path $workspace 'src-tauri\target\release\xray-by-looplet.exe'
$installDir = Join-Path $env:LOCALAPPDATA 'X-Ray by Looplet'
$installedExe = Join-Path $installDir 'xray-by-looplet.exe'
$buildHash = (Get-FileHash -LiteralPath $buildExe -Algorithm SHA256).Hash
if ($buildHash -ne $qa.sha256) { throw 'Executable changed since native verification.' }
$identity = Get-Content -LiteralPath (Join-Path $proofDir 'bundle-identity.json') -Raw | ConvertFrom-Json
if (-not $identity.equal -or $identity.buildSha256 -ne $buildHash) { throw 'NSIS bundle identity has not been verified.' }
$expectedHash = $identity.expectedInstalledSha256
$installedQA = Get-Content -LiteralPath (Join-Path $proofDir 'installed-qa.json') -Raw | ConvertFrom-Json
if (-not $installedQA.ok -or $installedQA.sha256 -ne $expectedHash) { throw 'Installed native app must pass verification.' }
$installedHash = (Get-FileHash -LiteralPath $installedExe -Algorithm SHA256).Hash
if ($installedHash -ne $expectedHash) { throw 'Installed executable does not match verified build.' }
$desktopDir = [Environment]::GetFolderPath('DesktopDirectory')
$shortcutPath = Join-Path $desktopDir 'X-Ray by Looplet.lnk'
$shortcutShell = New-Object -ComObject WScript.Shell
$shortcut = $shortcutShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $installedExe
$shortcut.WorkingDirectory = $installDir
$shortcut.IconLocation = "$installedExe,0"
$shortcut.Description = 'X-Ray by Looplet — Crown Wharf, first-person navigation and location maps'
$shortcut.Save()
$checkShortcut = $shortcutShell.CreateShortcut($shortcutPath)
if ($checkShortcut.TargetPath -ne $installedExe) { throw 'Desktop shortcut target verification failed.' }
$appProcess = Start-Process -FilePath $installedExe -WorkingDirectory $installDir -PassThru
@{
  installedExe = $installedExe
  sha256 = $installedHash.ToLowerInvariant()
  shortcut = $shortcutPath
  shortcutTarget = $checkShortcut.TargetPath
  shortcutIcon = $checkShortcut.IconLocation
  processId = $appProcess.Id
  installedAt = [DateTime]::UtcNow.ToString('o')
  userData = 'Existing application data retained; no profile deletion or reset.'
} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $proofDir 'installed.json') -Encoding utf8
Write-Output 'Updated installed app, verified executable hash, created desktop icon and launched X-Ray.'

