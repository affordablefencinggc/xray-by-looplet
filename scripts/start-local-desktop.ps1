param([switch]$PassThru)

$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
$settingsPath = Join-Path $workspace '.env.local'
$installDirectory = Join-Path $env:LOCALAPPDATA 'X-Ray by Looplet'
$applicationPath = Join-Path $installDirectory 'xray-by-looplet.exe'
$allowedNames = @('GEMINI_API_KEY', 'XRAY_AI_MODEL')
$previous = @{}

try {
    foreach ($name in $allowedNames) {
        $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
    }
    if (Test-Path -LiteralPath $settingsPath) {
        foreach ($line in [System.IO.File]::ReadAllLines($settingsPath)) {
            if ($line -match '^\s*(?:export\s+)?(GEMINI_API_KEY|XRAY_AI_MODEL)\s*=\s*(.*?)\s*$') {
                $name = $Matches[1]
                $value = $Matches[2].Trim().Trim('"').Trim("'")
                if ($name -eq 'GEMINI_API_KEY' -and $value -notmatch '^AIza[0-9A-Za-z_-]{20,100}$') {
                    throw 'Invalid local AI credential format.'
                }
                if ($name -eq 'XRAY_AI_MODEL' -and $value -notmatch '^gemini-[A-Za-z0-9._-]{1,100}$') {
                    throw 'Invalid local AI model name.'
                }
                [Environment]::SetEnvironmentVariable($name, $value, 'Process')
            }
        }
    }
    if (-not (Test-Path -LiteralPath $applicationPath)) { throw 'Installed application not found.' }
    # Only the child app inherits these settings. Credentials never enter command-line arguments.
    $application = Start-Process -FilePath $applicationPath -WorkingDirectory $installDirectory -PassThru
    if ($PassThru) { $application }
} catch {
    throw 'X-Ray could not start with its local settings. Check the installed app and .env.local.'
} finally {
    foreach ($name in $allowedNames) {
        [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process')
    }
    $value = $null
    $line = $null
    $Matches = $null
}
