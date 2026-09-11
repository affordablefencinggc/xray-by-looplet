$ErrorActionPreference='Stop'
if($env:COMPUTERNAME -ne 'DANS1'){throw 'Wrong host'}
$root='C:\Users\danie\XRayBuilds'
$id='cb57e869a84f'
Copy-Item -LiteralPath ($root+'\incoming\8e14ac427997\node-runtime.tar') -Destination ($root+'\incoming\'+$id+'\node-runtime.tar')
$runtimeHash=(Get-FileHash -LiteralPath ($root+'\incoming\'+$id+'\node-runtime.tar')).Hash.ToLowerInvariant()
& ($root+'\bottom-height-20260911\dans1-build-worker.ps1') -RunId $id -SourceHash 'cb57e869a84ff7d1c61290ef41bcfd946e41943de303c3b4f5c926268f0fb528' -RuntimeHash $runtimeHash -NativeHash '4cd3f21e42fabfb3aba370f32488c0e5c8a9b943e06360fc5fc0c605de6c0d3a' -WebOnly
