#!/usr/bin/env bash
# Attempt 2: same frozen archives (run 5dfc922f097f); worker list corrected (materialAi.server.test.ts needs a proof fixture absent from the snapshot).
set -euo pipefail
cd "C:/Users/danie/repo/xray-by-looplet"
export PATH="/c/Windows/System32:$PATH"
S=proof/growth/2026-09-09-az3-release
ID=$(cat $S/run-id.txt)
echo "== run id $ID (attempt 2) $(date -Is)"
echo "== transfer $(date -Is)"; node $S/remote-orchestrator.mjs transfer "$ID"
echo "== build $(date -Is)"; node $S/remote-orchestrator.mjs build "$ID"
echo "== collect $(date -Is)"; node $S/remote-orchestrator.mjs collect "$ID"
echo "== verify artifacts $(date -Is)"; node $S/release-verify-artifacts.mjs "$ID"
echo "== build identity $(date -Is)"; node $S/release-build-identity.mjs "$ID"
echo "== PIPELINE_COMPLETE $(date -Is)"
