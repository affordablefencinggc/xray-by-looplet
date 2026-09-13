$ErrorActionPreference = 'Stop'
if ((hostname).Trim().ToLower() -ne 'dans1') { throw 'Wrong host' }
$campaign = 'C:/Users/danie/XRayBuilds/industry-visible-20260913'
$snapshot = "$campaign/concurrency-source"
tar -xf "$campaign/assistant-recovery.tar" -C $snapshot
if ($LASTEXITCODE) { throw 'Transfer extraction failed' }
$manifest = Get-Content "$campaign/assistant-recovery-manifest.json" -Raw | ConvertFrom-Json
foreach ($entry in $manifest.PSObject.Properties) {
  if ((Get-FileHash -Algorithm SHA256 -LiteralPath "$snapshot/$($entry.Name)").Hash.ToLower() -ne $entry.Value) { throw "Hash mismatch $($entry.Name)" }
}
$node = 'C:/Users/danie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
$proof = "$campaign/assistant-recovery-check"
New-Item -ItemType Directory -Force -Path $proof | Out-Null
Set-Location $snapshot
& $node --experimental-strip-types --test src/studio/assistant/conversation.test.ts src/studio/assistant/namedToolRetry.test.ts src/studio/assistant/finalToolClaims.test.ts src/studio/assistant/shortInteraction.test.ts src/studio/assistant/contextWiring.test.ts src/studio/industries/quantity-surveying/classification.test.ts src/studio/industries/quantity-surveying/assistantTool.test.ts *> "$proof/tests.txt"
$tests = $LASTEXITCODE
& $node node_modules/typescript/bin/tsc --noEmit *> "$proof/typecheck.txt"
$types = $LASTEXITCODE
@{ host = (hostname); tests = $tests; typecheck = $types; source = $manifest } | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 "$proof/result.json"
Get-Content "$proof/result.json"
if ($tests -or $types) { exit 1 }
