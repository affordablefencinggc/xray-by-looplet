$ErrorActionPreference='Stop'
if($env:COMPUTERNAME -ne 'DANS1'){throw 'Wrong host'}
$run='C:\Users\danie\XRayBuilds\runs\c484f17f2b4d'
$root='C:\Users\danie\XRayBuilds\restore-20260911'
Push-Location ($run+'\source')
try {
& ($run+'\runtime\node.exe') --experimental-strip-types --test src/studio/workspaceRestore.test.ts src/studio/projectBackup.test.ts src/studio/backupRestorePreflight.test.ts *> ($root+'\restore-tests.log')
if($LASTEXITCODE -ne 0){throw 'Restore tests failed'}
foreach($name in @('dev','interrupted','corrupt','peer','asset-conflict','fresh','library','report')) {
& ($run+'\runtime\node.exe') ($root+'\cdp.mjs') ($root+'\'+$name+'-production.json') ($root+'\'+$name+'-production')
if($LASTEXITCODE -ne 0){throw ('Browser failed: '+$name)}
}
} finally { Pop-Location }
