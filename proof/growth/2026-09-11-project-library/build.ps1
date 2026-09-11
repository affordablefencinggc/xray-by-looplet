$ErrorActionPreference='Stop'
if($env:COMPUTERNAME -ne 'DANS1'){throw 'Wrong host'}
$root='C:\Users\danie\XRayBuilds'
$id='43a9f6a1e178'
Copy-Item -LiteralPath ($root+'\incoming\8e14ac427997\node-runtime.tar') -Destination ($root+'\incoming\'+$id+'\node-runtime.tar')
$runtimeHash=(Get-FileHash -LiteralPath ($root+'\incoming\'+$id+'\node-runtime.tar')).Hash.ToLowerInvariant()
& ($root+'\project-library-20260911\dans1-build-worker.ps1') -RunId $id -SourceHash '43a9f6a1e17890216dc1d5fd4c3ac58c5b8c1836fe36e35c72a62dbe1a12d39b' -RuntimeHash $runtimeHash -NativeHash '4cd3f21e42fabfb3aba370f32488c0e5c8a9b943e06360fc5fc0c605de6c0d3a' -WebOnly



