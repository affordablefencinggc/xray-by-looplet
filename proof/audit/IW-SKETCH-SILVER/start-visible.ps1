$ErrorActionPreference='Stop'
$exe=Join-Path $env:LOCALAPPDATA 'X-Ray by Looplet/xray-by-looplet.exe'
foreach($app in Get-Process -Name 'xray-by-looplet' -ErrorAction SilentlyContinue){if($app.Path -eq $exe){$null=$app.CloseMainWindow();if(-not $app.WaitForExit(2500)){$app.Kill();$app.WaitForExit()}}}
$previousDebug=[Environment]::GetEnvironmentVariable('WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS','Process')
try {
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS='--remote-debugging-port=9238'
$app=& ./scripts/start-local-desktop.ps1 -PassThru
@{processId=$app.Id;path=$exe;profile='Existing user profile';debugPort=9238}|ConvertTo-Json|Set-Content proof/audit/IW-SKETCH-SILVER/demo-process.json -Encoding utf8
}finally{[Environment]::SetEnvironmentVariable('WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS',$previousDebug,'Process')}
