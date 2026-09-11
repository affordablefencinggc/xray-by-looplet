$ErrorActionPreference='Stop'
if($env:COMPUTERNAME -ne 'DANS1'){throw 'Wrong host'}
$run='C:\Users\danie\XRayBuilds\runs\f59a593750f0'
$audit='C:\Users\danie\XRayBuilds\project-library-20260911'
Push-Location ($run+'\source')
try {
  & ($run+'\runtime\node.exe') --experimental-strip-types --test src/studio/projectArchive.test.ts src/studio/projectRegistry.test.ts src/studio/assistant/projectSwitch.test.ts planning/professional-coverage/assessment.test.mjs *> ($audit+'\focused-tests.log')
  if($LASTEXITCODE -ne 0){Get-Content ($audit+'\focused-tests.log');throw 'Focused regression tests failed'}
  Get-Content ($audit+'\focused-tests.log') | Select-Object -Last 8
} finally {Pop-Location}
