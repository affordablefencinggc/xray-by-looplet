#!/usr/bin/env bash
# Native QA of the az5 candidate over CDP 9281: az4 regressions, then the SC-12 unlock journeys (real provider; render must refuse natively).
cd "C:/Users/danie/repo/xray-by-looplet"
N=proof/growth/2026-09-09-az5-release; S=$N/scenarios
run(){ echo "== $1 $(date -Is)"; node scripts/fast-cdp-test.mjs az5-native "$S/$1.json" --cdp 9281 2>&1 | tail -1 | grep -o '"exitCode":[0-9]*\|"commands":[0-9]*\|"log":"[^"]*"'; }
for s in native-saves-1 native-sheets-0-import native-hardened native-wireframe native-workbench native-workbench-continue native-workbench-verify; do run $s; done
for s in native-unlock-a-design-edit native-unlock-b-takeoff native-unlock-c-price-import native-unlock-d-export native-unlock-e-render; do run $s; done
echo "== NATIVE_QA_DONE $(date -Is)"
