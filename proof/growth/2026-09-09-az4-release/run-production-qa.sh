#!/usr/bin/env bash
cd "C:/Users/danie/repo/xray-by-looplet"
N=proof/growth/2026-09-09-az4-release; S=$N/scenarios
run(){ echo "== $1 $2 $(date -Is)"; node scripts/fast-cdp-test.mjs "$1" "$S/$2.json" 2>&1 | tail -1 | cut -c1-260; }
run az4-prod-regress prod-warm-long; run az4-prod-regress prod-warm-long
for s in prod-warm prod-saves-1 prod-sheets-scenario-0-import prod-sheets-scenario-a-rename-desktop production-hardened-layout production-hardened-guards prod-pricing-a-desktop; do run az4-prod-regress $s; done
run az4-prod-assist prod-warm-long; run az4-prod-assist prod-warm-long
for s in prod-wireframe-desktop prod-wireframe-tablet prod-workbench-desktop prod-workbench-continue; do run az4-prod-assist $s; done
echo "== PRODUCTION_QA_DONE $(date -Is)"
