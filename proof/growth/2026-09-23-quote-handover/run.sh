#!/usr/bin/env bash
# usage: run.sh <name>   (reads scenario JSON from stdin, saves it, runs it on CDP 9292, prints log)
cd "C:/Users/danie/repo/xray-by-looplet"
D=proof/growth/2026-09-23-quote-handover; f=$D/scenarios/$1.json; cat > "$f"
FAST_CDP_TIMEOUT_MS=${T:-120000} node scripts/fast-cdp-test.mjs qh "$f" --cdp 9297 | grep -o '"exitCode":[0-9]*'
cat "$(ls -t proof/growth/runner/*-qh.log | head -1)"
