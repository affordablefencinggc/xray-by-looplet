$ErrorActionPreference='Stop'
if($env:COMPUTERNAME -ne 'DANS1'){throw 'Wrong host'}
Set-Location C:\Users\danie\XRayBuilds\tool-audit-20260910\source
$env:PATH='C:\Users\danie\XRayBuilds\runs\8e14ac427997\runtime;'+$env:PATH
& node node_modules/typescript/bin/tsc --noEmit *> ..\provider-typecheck.log
if($LASTEXITCODE -ne 0){Get-Content ..\provider-typecheck.log;exit 1}
& npm.cmd test *> ..\provider-full-tests.log
$code=$LASTEXITCODE
Get-Content ..\provider-full-tests.log -Tail 14
exit $code
