#!/usr/bin/env bash
# az6: the assistant-surface journeys (SC-14/15/16) on the candidate preview 8096 (desktop + tablet, own sessions) and on the native app (CDP 9281).
cd "C:/Users/danie/repo/xray-by-looplet"
export FAST_CDP_TIMEOUT_MS=600000
N=proof/growth/2026-09-09-az6-release; S=$N/scenarios
run(){ echo "== $1 $2 $(date -Is)"; node scripts/fast-cdp-test.mjs "$1" "$S/$2.json" $3 $4 2>&1 | tail -1 | grep -o '"exitCode":[0-9a-z]*\|"commands":[0-9]*\|"log":"[^"]*"'; }
run az6-prod-surface-desktop prod-warm-long; run az6-prod-surface-desktop prod-warm-long
run az6-prod-surface-desktop prod-surface-desktop
run az6-prod-surface-tablet prod-warm-long; run az6-prod-surface-tablet prod-surface-tablet
run az6-native native-surface --cdp 9281
echo "== SURFACE_QA_DONE $(date -Is)"
