// Preserve historical worker/proof files; publish a new operational worker.
import fs from 'node:fs';
const historical = 'proof/audit/IW-PROFESSIONAL-NEXT/remote/worker-delta.ps1';
let worker = fs.readFileSync(historical, 'utf8');
worker = worker.replace("[Diagnostics.Process]::GetCurrentProcess().PriorityClass='BelowNormal'", ". 'C:\\Users\\danie\\XRayBuilds\\dans1-resource-policy.ps1'");
worker = worker.replace("$env:RAYON_NUM_THREADS='6'", "$env:RAYON_NUM_THREADS=[string]$dansWorkers");
worker = worker.replace("$env:CARGO_BUILD_JOBS='6'", "$env:CARGO_BUILD_JOBS=[string]$dansWorkers");
worker = worker.replace("$child.PriorityClass='BelowNormal'", "$child.PriorityClass='High'");
worker = worker.replace('rayonWorkers=6;cargoJobs=6', 'rayonWorkers=$dansWorkers;cargoJobs=$dansWorkers');
worker = worker.replaceAll('a790fd92663d', '44c9a5bdd386');
worker = worker.replaceAll('e108d3780cd52707bb684b294cac649104e40c653ab6701223b8dd895193c323', 'b4e7683b095ccc9c04c01c933db70a205c2eaff05ee85ba62355df98eda80a83');
if (worker.includes('BelowNormal') || worker.includes('rayonWorkers=6')) throw Error('Old resource limit remains');
fs.writeFileSync('scripts/dans1-build-worker.ps1', worker);
