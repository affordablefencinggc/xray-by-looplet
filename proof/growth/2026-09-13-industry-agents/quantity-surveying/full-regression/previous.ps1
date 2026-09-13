$ErrorActionPreference='Stop'
if($env:COMPUTERNAME -ne 'DANS1'){throw 'Wronghost'}
$root='C:\Users\danie\XRayBuilds\industry-visible-20260913'
$runtime='C:\Users\danie\XRayBuilds\runs\3e041c91ca5e\runtime'
$source=Join-Path $root 'concurrency-source'
if((Get-FileHash "$root/industry-test-support.tar" -Algorithm SHA256).Hash.ToLowerInvariant() -ne '751fb6ec629d97bc66a770cc330813a6b13873f5717666c59944d6b81e85bfc4'){throw 'Archive mismatch'}
foreach($item in (Get-Content "$root/industry-test-support-manifest.json" -Raw | ConvertFrom-Json)){if((Get-FileHash (Join-Path $source $item.path) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $item.sha256){throw "Mismatch $($item.path)"}}
$env:PATH=$runtime+';'+$env:PATH
$p=Start-Process -FilePath "$runtime/node.exe" -ArgumentList "$runtime/node_modules/npm/bin/npm-cli.js",'test' -WorkingDirectory $source -WindowStyle Hidden -PassThru -RedirectStandardOutput "$root/full-regression-complete-support.stdout.log" -RedirectStandardError "$root/full-regression-complete-support.stderr.log"
$handle=$p.Handle;$p.PriorityClass='High'
Get-CimInstance Win32_Process -Filter "ProcessId=$($p.Id)" | Select-Object ProcessId,ExecutablePath,CommandLine,@{n='created';e={$_.CreationDate.ToString('o')}},@{n='purpose';e={'Industry shared regression tests'}},@{n='lastActivity';e={(Get-Date).ToString('o')}} | ConvertTo-Json | Set-Content "$root/full-regression-complete-support-owned.json"
$p.WaitForExit()
@{host=$env:COMPUTERNAME;exitCode=$p.ExitCode;completed=(Get-Date).ToString('o')} | ConvertTo-Json | Tee-Object -FilePath "$root/full-regression-complete-support-result.json"
Get-Content "$root/full-regression-complete-support.stdout.log" -Tail 14
Get-Content "$root/full-regression-complete-support.stderr.log" -Tail 14
exit $p.ExitCode
