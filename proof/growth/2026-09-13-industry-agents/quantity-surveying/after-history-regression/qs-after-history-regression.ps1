$ErrorActionPreference='Stop'
if($env:COMPUTERNAME -ne 'DANS1'){throw 'Wronghost'}
$root='C:\Users\danie\XRayBuilds\industry-visible-20260913'
$runtime='C:\Users\danie\XRayBuilds\runs\3e041c91ca5e\runtime'
$source=Join-Path $root 'concurrency-source'
if((Get-FileHash "$root/qs-regression-history.tar" -Algorithm SHA256).Hash.ToLowerInvariant() -ne '49bf9061304de4ed65c6391dd58f71033b419b781d7ad505e6bd1c74b61d14e0'){throw 'Archive mismatch'}
& tar -xf "$root/qs-regression-history.tar" -C $source
if($LASTEXITCODE -ne 0){throw "Extraction failed"}
foreach($item in (Get-Content "$root/qs-regression-history-manifest.json" -Raw | ConvertFrom-Json)){if((Get-FileHash (Join-Path $source $item.path) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $item.sha256){throw "Mismatch $($item.path)"}}
$env:PATH=$runtime+';'+$env:PATH
$p=Start-Process -FilePath "$runtime/node.exe" -ArgumentList "$runtime/node_modules/npm/bin/npm-cli.js",'test' -WorkingDirectory $source -WindowStyle Hidden -PassThru -RedirectStandardOutput "$root/qs-after-history-regression.stdout.log" -RedirectStandardError "$root/qs-after-history-regression.stderr.log"
$handle=$p.Handle;$p.PriorityClass='High'
Get-CimInstance Win32_Process -Filter "ProcessId=$($p.Id)" | Select-Object ProcessId,ExecutablePath,CommandLine,@{n='created';e={$_.CreationDate.ToString('o')}},@{n='purpose';e={'Industry shared regression tests'}},@{n='lastActivity';e={(Get-Date).ToString('o')}} | ConvertTo-Json | Set-Content "$root/qs-after-history-regression-owned.json"
$p.WaitForExit()
@{host=$env:COMPUTERNAME;exitCode=$p.ExitCode;completed=(Get-Date).ToString('o')} | ConvertTo-Json | Tee-Object -FilePath "$root/qs-after-history-regression-result.json"
Get-Content "$root/qs-after-history-regression.stdout.log" -Tail 14
Get-Content "$root/qs-after-history-regression.stderr.log" -Tail 14
exit $p.ExitCode
