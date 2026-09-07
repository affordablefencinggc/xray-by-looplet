$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
if ($env:COMPUTERNAME -ne 'DANS1') { throw 'Dans1 only' }
[Diagnostics.Process]::GetCurrentProcess().PriorityClass='BelowNormal'
$toolRoot='C:\Users\danie\XRayBuilds\toolchain'
New-Item -ItemType Directory -Force -Path $toolRoot | Out-Null
$vs=Join-Path $toolRoot 'vs_buildtools.exe'
if (-not (Test-Path 'C:\BuildTools\XRay\VC\Auxiliary\Build\vcvars64.bat')) {
  Invoke-WebRequest -UseBasicParsing -Uri 'https://aka.ms/vs/17/release/vs_buildtools.exe' -OutFile $vs
  $signature=Get-AuthenticodeSignature -LiteralPath $vs
  if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'Microsoft Corporation') { throw 'Microsoft installer signature verification failed' }
  Write-Output 'Verified Microsoft signature; installing C++ build workload on Dans1 without reboot.'
  $process=Start-Process -FilePath $vs -ArgumentList '--quiet --wait --norestart --nocache --installPath C:\BuildTools\XRay --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended' -WindowStyle Hidden -PassThru
  $handle=$process.Handle
  $process.PriorityClass='BelowNormal'
  $process.WaitForExit()
  Write-Output "Microsoft build tools installer exit: $($process.ExitCode)"
  if ($process.ExitCode -notin @(0,3010)) { throw 'Microsoft build tools installation failed' }
}
$env:CARGO_HOME=Join-Path $toolRoot 'cargo'
$env:RUSTUP_HOME=Join-Path $toolRoot 'rustup'
$rustup=Join-Path $toolRoot 'rustup-init.exe'
if (-not (Test-Path (Join-Path $env:CARGO_HOME 'bin\rustc.exe'))) {
  $rustUrl='https://static.rust-lang.org/rustup/dist/x86_64-pc-windows-msvc/rustup-init.exe'
  Invoke-WebRequest -UseBasicParsing -Uri $rustUrl -OutFile $rustup
  $checksumResponse=(Invoke-WebRequest -UseBasicParsing -Uri ($rustUrl+'.sha256')).Content
  $checksumText=if ($checksumResponse -is [byte[]]) { [Text.Encoding]::UTF8.GetString($checksumResponse) } else { [string]$checksumResponse }
  $expected=($checksumText.Trim() -split '\s+')[0]
  if ((Get-FileHash -LiteralPath $rustup -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) { throw 'Rustup checksum mismatch' }
  Write-Output 'Verified Rustup checksum; installing pinned Rust 1.98.0 in the X-Ray toolchain directory.'
  & $rustup -y --no-modify-path --profile minimal --default-host x86_64-pc-windows-msvc --default-toolchain 1.98.0
  if ($LASTEXITCODE -ne 0) { throw 'Rust installation failed' }
}
& (Join-Path $env:CARGO_HOME 'bin\rustc.exe') --version
& (Join-Path $env:CARGO_HOME 'bin\cargo.exe') --version
if (-not (Test-Path 'C:\BuildTools\XRay\VC\Auxiliary\Build\vcvars64.bat')) { throw 'C++ tools unavailable after install' }
Write-Output 'Dans1 native toolchain ready. No reboot and no system PATH changes requested.'
