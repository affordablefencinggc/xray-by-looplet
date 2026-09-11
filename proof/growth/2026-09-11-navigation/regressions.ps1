$ErrorActionPreference='Stop'
if($env:COMPUTERNAME -ne 'DANS1'){throw 'Wrong host'}
Set-Location C:\Users\danie\XRayBuilds\navigation-20260911\source
& C:\Users\danie\XRayBuilds\runs\8e14ac427997\runtime\node.exe --experimental-strip-types --test src/studio/shortcuts.test.ts src/studio/workspacePanels.test.ts src/studio/projectBackup.test.ts src/studio/assistant/projectSwitch.test.ts *> ..\regressions.log
$code=$LASTEXITCODE
Get-Content ..\regressions.log -Tail 12
exit $code
