$ErrorActionPreference='Stop'
if($env:COMPUTERNAME -ne 'DANS1'){throw 'Wronghost'}
$root='C:\Users\danie\XRayBuilds\industry-visible-20260913'
$runtime='C:\Users\danie\XRayBuilds\runs\3e041c91ca5e\runtime'
$source=Join-Path $root 'concurrency-source'
if((Get-FileHash "$root/qs-regression-pdfs.tar" -Algorithm SHA256).Hash.ToLowerInvariant() -ne '601f414cf43d26b76f2645d305758187b9efdb01a7e095e6b3cfc5aa3c5558c3'){throw 'Archive mismatch'}
& tar -xf "$root/qs-regression-pdfs.tar" -C $source
if($LASTEXITCODE -ne 0){throw "Extraction failed"}
foreach($item in (Get-Content "$root/qs-regression-pdfs-manifest.json" -Raw | ConvertFrom-Json)){if((Get-FileHash (Join-Path $source $item.path) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $item.sha256){throw "Mismatch $($item.path)"}}
$env:PATH=$runtime+';'+$env:PATH
$p=Start-Process -FilePath "$runtime/node.exe" -ArgumentList "$runtime/node_modules/npm/bin/npm-cli.js",'test' -WorkingDirectory $source -WindowStyle Hidden -PassThru -RedirectStandardOutput "$root/qs-full-regression-final.stdout.log" -RedirectStandardError "$root/qs-full-regression-final.stderr.log"
$handle=$p.Handle;$p.PriorityClass='High'
Get-CimInstance Win32_Process -Filter "ProcessId=$($p.Id)" | Select-Object ProcessId,ExecutablePath,CommandLine,@{n='created';e={$_.CreationDate.ToString('o')}},@{n='purpose';e={'Industry shared regression tests'}},@{n='lastActivity';e={(Get-Date).ToString('o')}} | ConvertTo-Json | Set-Content "$root/qs-full-regression-final-owned.json"
$p.WaitForExit()
@{host=$env:COMPUTERNAME;exitCode=$p.ExitCode;completed=(Get-Date).ToString('o')} | ConvertTo-Json | Tee-Object -FilePath "$root/qs-full-regression-final-result.json"
Get-Content "$root/qs-full-regression-final.stdout.log" -Tail 14
Get-Content "$root/qs-full-regression-final.stderr.log" -Tail 14
exit $p.ExitCode
