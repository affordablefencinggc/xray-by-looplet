#!/usr/bin/env bash
# SC-17 showcase driver: start (fresh profile, sketch attached, brief sent), then "continue" rounds until the
# assistant replies DONE (max 10), then finish (verification, screenshots, real-life view, exports).
# Usage: run-showcase.sh <session> [resume]   — "resume" skips the start scenario (the session already holds the design).
# Each round may take several minutes of provider tool work, so the runner's per-scenario cap is raised here.
cd "C:/Users/danie/repo/xray-by-looplet"
export FAST_CDP_TIMEOUT_MS=900000
N=proof/growth/2026-09-09-assistant-surface; S=$N/scenarios; SESSION=${1:-showcase-desktop}; MODE=${2:-fresh}
run(){ echo "== $1 $(date -Is)"; node scripts/fast-cdp-test.mjs $SESSION "$S/$1.json" 2>&1 | tail -1 | grep -o '"exitCode":[0-9a-z]*\|"commands":[0-9]*\|"log":"[^"]*"'; }
lastlog(){ ls proof/growth/runner/ | grep "$SESSION" | grep '\.log$' | sort | tail -1; }
if [ "$MODE" != "resume" ]; then
  run showcase-start
  L=proof/growth/runner/$(lastlog)
  if grep -q '^✗' "$L"; then echo "== START FAILED; see $L"; exit 1; fi
fi
for round in 1 2 3 4 5 6 7 8 9 10; do
  L=proof/growth/runner/$(lastlog)
  if grep -q '"done": true' "$L"; then echo "== DONE after $((round-1)) continue rounds"; break; fi
  echo "== continue round $round"
  run showcase-round
done
L=proof/growth/runner/$(lastlog)
grep -q '"done": true' "$L" || echo "== WARNING: assistant never replied DONE; running finish anyway"
run showcase-finish
echo "== SHOWCASE_DONE $(date -Is)"
