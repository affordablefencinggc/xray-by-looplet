$ErrorActionPreference='Stop'
if($env:COMPUTERNAME -ne 'DANS1'){throw 'Wrong host'}
$root='C:\Users\danie\XRayBuilds'
$id='eebf4bae66d0'
Copy-Item -LiteralPath ($root+'\incoming\8e14ac427997\node-runtime.tar') -Destination ($root+'\incoming\'+$id+'\node-runtime.tar')
$runtimeHash=(Get-FileHash -LiteralPath ($root+'\incoming\'+$id+'\node-runtime.tar')).Hash.ToLowerInvariant()
& ($root+'\contrast-20260911\dans1-build-worker.ps1') -RunId $id -SourceHash 'eebf4bae66d05d3cc02525214b64b0e45ef52394d7781ac203b034e21a826b6d' -RuntimeHash $runtimeHash -NativeHash '4cd3f21e42fabfb3aba370f32488c0e5c8a9b943e06360fc5fc0c605de6c0d3a' -WebOnly

