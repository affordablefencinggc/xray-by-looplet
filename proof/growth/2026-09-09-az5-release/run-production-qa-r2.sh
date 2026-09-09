#!/usr/bin/env bash
# az5 production re-run: the workbench journey in its own session (fresh state), as in the az4 stage.
cd "C:/Users/danie/repo/xray-by-looplet"
N=proof/growth/2026-09-09-az5-release; S=$N/scenarios
run(){ echo "== $1 $2 $(date -Is)"; node scripts/fast-cdp-test.mjs "$1" "$S/$2.json" 2>&1 | tail -1 | grep -o '"exitCode":[0-9]*\|"commands":[0-9]*\|"log":"[^"]*"'; }
run az5-prod-workbench prod-warm-long; run az5-prod-workbench prod-warm-long
for s in prod-workbench-desktop prod-workbench-continue; do run az5-prod-workbench $s; done
echo "== PRODUCTION_QA_R2_DONE $(date -Is)"
