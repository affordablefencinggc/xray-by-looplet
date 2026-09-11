$ErrorActionPreference='Stop'
if($env:COMPUTERNAME -ne 'DANS1'){throw 'Wrong host'}
$root='C:\Users\danie\XRayBuilds'
$id='ece8d5585289'
Copy-Item -LiteralPath ($root+'\incoming\8e14ac427997\node-runtime.tar') -Destination ($root+'\incoming\'+$id+'\node-runtime.tar')
$runtimeHash=(Get-FileHash -LiteralPath ($root+'\incoming\'+$id+'\node-runtime.tar')).Hash.ToLowerInvariant()
& ($root+'\workspace-clean-20260911\dans1-build-worker.ps1') -RunId $id -SourceHash 'ece8d5585289795b7940860d3c18b0045ece111c04cdc303a90ac9e4d9caf684' -RuntimeHash $runtimeHash -NativeHash '4cd3f21e42fabfb3aba370f32488c0e5c8a9b943e06360fc5fc0c605de6c0d3a' -WebOnly
