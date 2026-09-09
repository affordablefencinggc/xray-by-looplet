#!/usr/bin/env bash
cd "C:/Users/danie/repo/xray-by-looplet"
N=proof/growth/2026-09-09-az4-release; S=$N/scenarios
run(){ echo "== $1 $(date -Is)"; node scripts/fast-cdp-test.mjs az4-native "$S/$1.json" --cdp 9281 2>&1 | tail -1 | cut -c1-260; }
for s in native-saves-1 native-sheets-0-import native-sheets-a-rename native-hardened native-wireframe native-wireframe-undo native-workbench native-workbench-continue; do run $s; done
echo "== NATIVE_QA_DONE $(date -Is)"
