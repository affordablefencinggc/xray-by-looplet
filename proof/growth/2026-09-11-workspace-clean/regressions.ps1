$ErrorActionPreference='Stop'
if($env:COMPUTERNAME -ne 'DANS1'){throw 'Wrong host'}
Set-Location C:\Users\danie\XRayBuilds\navigation-20260911\source
& C:\Users\danie\XRayBuilds\runs\8e14ac427997\runtime\node.exe --experimental-strip-types --test src/studio/documentPreview.test.ts src/studio/sheetLifecycle.test.ts src/studio/workspacePanels.test.ts src/studio/shortcuts.test.ts *> C:\Users\danie\XRayBuilds\workspace-clean-20260911\regressions.log
$code=$LASTEXITCODE
Get-Content C:\Users\danie\XRayBuilds\workspace-clean-20260911\regressions.log -Tail 12
exit $code
