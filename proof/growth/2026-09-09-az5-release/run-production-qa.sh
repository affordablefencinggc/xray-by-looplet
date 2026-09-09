#!/usr/bin/env bash
# Production QA of the az5 candidate on 127.0.0.1:8096: az4 regressions, then the SC-12 unlock journeys (real provider).
cd "C:/Users/danie/repo/xray-by-looplet"
N=proof/growth/2026-09-09-az5-release; S=$N/scenarios
run(){ echo "== $1 $2 $(date -Is)"; node scripts/fast-cdp-test.mjs "$1" "$S/$2.json" 2>&1 | tail -1 | grep -o '"exitCode":[0-9]*\|"commands":[0-9]*\|"log":"[^"]*"'; }
run az5-prod-regress prod-warm-long; run az5-prod-regress prod-warm-long
for s in prod-warm prod-saves-1 prod-sheets-scenario-0-import production-hardened-layout production-hardened-guards prod-wireframe-desktop prod-workbench-desktop prod-workbench-continue; do run az5-prod-regress $s; done
run az5-prod-unlock prod-warm-long; run az5-prod-unlock prod-warm-long
for s in prod-unlock-a-design-edit prod-unlock-b-takeoff prod-unlock-c-price-import prod-unlock-d-export prod-unlock-e-render; do run az5-prod-unlock $s; done
echo "== PRODUCTION_QA_DONE $(date -Is)"
