$ErrorActionPreference='Stop'
if($env:COMPUTERNAME -ne 'DANS1'){throw 'Wrong host'}
$root='C:\Users\danie\XRayBuilds\navigation-20260911\source'
$node='C:\Users\danie\XRayBuilds\runs\8e14ac427997\runtime\node.exe'
$before=(Get-FileHash ($root+'\PROFESSIONAL-A-Z-CHECKLIST.md')).Hash
& $node ($root+'\planning\professional-coverage\generate.mjs')
if($LASTEXITCODE -ne 0){throw 'Generation failed'}
$first=(Get-FileHash ($root+'\public\industry-coverage\index.html')).Hash
& $node ($root+'\planning\professional-coverage\generate.mjs')
if($LASTEXITCODE -ne 0){throw 'Repeated generation failed'}
$after=(Get-FileHash ($root+'\PROFESSIONAL-A-Z-CHECKLIST.md')).Hash
$second=(Get-FileHash ($root+'\public\industry-coverage\index.html')).Hash
if($before -ne $after -or $first -ne $second){throw 'Generator changed reviewed source or was not deterministic'}
@{host='DANS1';pass=$true;checklistSHA256=$after;reportSHA256=$second;repeatOutputIdentical=$true;reviewedChecklistUnchanged=$true}|ConvertTo-Json|Set-Content C:\Users\danie\XRayBuilds\project-library-20260911\report-generation.json
