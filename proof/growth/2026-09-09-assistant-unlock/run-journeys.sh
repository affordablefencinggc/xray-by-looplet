#!/usr/bin/env bash
cd "C:/Users/danie/repo/xray-by-looplet"
S=proof/growth/2026-09-09-assistant-unlock/scenarios
run(){ echo "== $1 $(date -Is)"; node scripts/fast-cdp-test.mjs unlock-desktop "$S/$1.json" 2>&1 | tail -1 | grep -o '"exitCode":[0-9]*\|"commands":[0-9]*\|"log":"[^"]*"'; }
node scripts/fast-cdp-test.mjs unlock-desktop proof/growth/2026-09-09-assistant-wireframe/warm.scenario.json >/dev/null 2>&1
for s in "$@"; do run $s; done
echo "== JOURNEYS_DONE $(date -Is)"
