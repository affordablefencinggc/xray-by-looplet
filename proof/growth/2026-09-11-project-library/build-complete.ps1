$ErrorActionPreference='Stop'
if($env:COMPUTERNAME -ne 'DANS1'){throw 'Wrong host'}
$root='C:\Users\danie\XRayBuilds'
$id='9e2e87d46bf6'
Copy-Item -LiteralPath ($root+'\incoming\8e14ac427997\node-runtime.tar') -Destination ($root+'\incoming\'+$id+'\node-runtime.tar')
$runtimeHash=(Get-FileHash -LiteralPath ($root+'\incoming\'+$id+'\node-runtime.tar')).Hash.ToLowerInvariant()
& ($root+'\project-library-20260911\dans1-build-worker.ps1') -RunId $id -SourceHash '9e2e87d46bf659108278e4eb6ddc29b81ada7672988358bf5b4f6bd3031c5be3' -RuntimeHash $runtimeHash -NativeHash '4cd3f21e42fabfb3aba370f32488c0e5c8a9b943e06360fc5fc0c605de6c0d3a' -WebOnly





