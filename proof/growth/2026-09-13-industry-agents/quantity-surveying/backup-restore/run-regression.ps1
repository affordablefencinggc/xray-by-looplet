$ErrorActionPreference='Stop'
if($env:COMPUTERNAME -ne 'DANS1'){throw 'Wronghost'}
$root='C:\Users\danie\XRayBuilds\industry-visible-20260913'
$runtime='C:\Users\danie\XRayBuilds\runs\3e041c91ca5e\runtime'
$source=Join-Path $root 'concurrency-source'
if((Get-FileHash "$root/full-inputs.tar" -Algorithm SHA256).Hash.ToLowerInvariant() -ne '917cdc41845517cd57711805f07d05afbb63b8b300d0b99e78da191d9fb9a2be'){throw 'Archive mismatch'}
& tar -xf "$root/full-inputs.tar" -C $source
if($LASTEXITCODE -ne 0){throw "Extraction failed"}
foreach($item in (Get-Content "$root/full-manifest.json" -Raw | ConvertFrom-Json)){if((Get-FileHash (Join-Path $source $item.path) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $item.sha256){throw "Mismatch $($item.path)"}}
$env:PATH=$runtime+';'+$env:PATH
$p=Start-Process -FilePath "$runtime/node.exe" -ArgumentList "$runtime/node_modules/npm/bin/npm-cli.js",'test' -WorkingDirectory $source -WindowStyle Hidden -PassThru -RedirectStandardOutput "$root/qs-industry-forms-final.stdout.log" -RedirectStandardError "$root/qs-industry-forms-final.stderr.log"
$handle=$p.Handle;$p.PriorityClass='High'
Get-CimInstance Win32_Process -Filter "ProcessId=$($p.Id)" | Select-Object ProcessId,ExecutablePath,CommandLine,@{n='created';e={$_.CreationDate.ToString('o')}},@{n='purpose';e={'Industry shared regression tests'}},@{n='lastActivity';e={(Get-Date).ToString('o')}} | ConvertTo-Json | Set-Content "$root/qs-industry-forms-final-owned.json"
$p.WaitForExit()
@{host=$env:COMPUTERNAME;exitCode=$p.ExitCode;completed=(Get-Date).ToString('o')} | ConvertTo-Json | Tee-Object -FilePath "$root/qs-industry-forms-final-result.json"
Get-Content "$root/qs-industry-forms-final.stdout.log" -Tail 14
Get-Content "$root/qs-industry-forms-final.stderr.log" -Tail 14
exit $p.ExitCode

