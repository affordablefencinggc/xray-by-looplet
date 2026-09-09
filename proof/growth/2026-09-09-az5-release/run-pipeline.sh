#!/usr/bin/env bash
# Freeze the combined tree, build on Dans1 sequentially (High/16 via the worker), collect and verify.
set -euo pipefail
cd "C:/Users/danie/repo/xray-by-looplet"
# Windows bsdtar must win over Git Bash GNU tar, which treats a C: prefix as a remote host.
export PATH="/c/Windows/System32:$PATH"
S=proof/growth/2026-09-09-az5-release
echo "== freeze web $(date -Is)"; node $S/package-web.mjs
echo "== freeze native $(date -Is)"; node $S/package-native.mjs
ID=$(node -e "console.log(require('./$S/transfer.json').source.sha256.slice(0,12))")
echo "== run id $ID"
echo "$ID" > $S/run-id.txt
echo "== transfer $(date -Is)"; node $S/remote-orchestrator.mjs transfer "$ID"
echo "== build $(date -Is)"; node $S/remote-orchestrator.mjs build "$ID"
echo "== collect $(date -Is)"; node $S/remote-orchestrator.mjs collect "$ID"
echo "== verify artifacts $(date -Is)"; node $S/release-verify-artifacts.mjs "$ID"
echo "== build identity $(date -Is)"; node $S/release-build-identity.mjs "$ID"
echo "== PIPELINE_COMPLETE $(date -Is)"
