#!/usr/bin/env bash
# az5 native re-run: state-aware variants of the scenarios that failed on session state or user interaction (see qa/runs.md).
cd "C:/Users/danie/repo/xray-by-looplet"
N=proof/growth/2026-09-09-az5-release; S=$N/scenarios
run(){ echo "== $1 $(date -Is)"; node scripts/fast-cdp-test.mjs az5-native "$S/$1.json" --cdp 9281 2>&1 | tail -1 | grep -o '"exitCode":[0-9]*\|"commands":[0-9]*\|"log":"[^"]*"'; }
for s in native-workbench-verify-r2 native-unlock-a-design-edit-r2 native-unlock-b-takeoff-r2 native-unlock-d-export native-unlock-e-render; do run $s; done
echo "== NATIVE_QA_R2_DONE $(date -Is)"
