#!/usr/bin/env bash
# Pipe-tests for scripts/guardrails/hook.mjs — run from the repo root: bash proof/growth/2026-09-09-guardrails/pipe-tests.sh
cd "$(dirname "$0")/../../.."
export CLAUDE_PROJECT_DIR="$PWD"
H="scripts/guardrails/hook.mjs"
echo "## pipe tests $(date -u +%FT%TZ)"
t(){ echo; echo "\$ $1 | node $H $2"; echo "$1" | node $H $2; echo "  [exit $?]"; }
t '{"tool_name":"Bash","tool_input":{"command":"git add -A"}}' pre-tool
t '{"tool_name":"Bash","tool_input":{"command":"git add ."}}' pre-tool
t '{"tool_name":"Bash","tool_input":{"command":"git add src/studio/store.ts"}}' pre-tool
t '{"tool_name":"Bash","tool_input":{"command":"git commit -m x"}}' pre-tool
t '{"tool_name":"Bash","tool_input":{"command":"git commit -m x # checkpoint: az3-release"}}' pre-tool
t '{"tool_name":"PowerShell","tool_input":{"command":"Stop-Process -Id 1234"}}' pre-tool
t '{"tool_name":"PowerShell","tool_input":{"command":"powershell -File proof/growth/2026-09-09-az3-release/cleanup-owned.ps1"}}' pre-tool
t '{"tool_name":"Bash","tool_input":{"command":"ls"}}' pre-tool
t '{"tool_name":"Edit","tool_input":{"file_path":"C:/x/LATEST-VERIFIED-BUILD.md"}}' pre-tool
t '{}' session-start
mkdir -p .temp
printf '{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"SC-09 is done."}]}}\n' > .temp/guardrail-transcript-noproof.jsonl
printf '{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"SC-09 is done; runner proof/growth/runner/x.json exit 0."}]}}\n' > .temp/guardrail-transcript-proof.jsonl
t "{\"transcript_path\":\"$(pwd -W)/.temp/guardrail-transcript-noproof.jsonl\"}" stop
t "{\"transcript_path\":\"$(pwd -W)/.temp/guardrail-transcript-proof.jsonl\"}" stop
t "{\"transcript_path\":\"$(pwd -W)/.temp/guardrail-transcript-noproof.jsonl\",\"stop_hook_active\":true}" stop
echo; echo "## settings schema check (node; jq is not installed here)"
node -e 'const s=JSON.parse(require("fs").readFileSync(".claude/settings.json","utf8"));const p=s.hooks.PreToolUse.find(h=>h.matcher==="Bash|PowerShell|Write|Edit").hooks[0];if(p.type!=="command")throw Error("bad type");console.log("PreToolUse:",p.command);console.log("SessionStart:",s.hooks.SessionStart[0].hooks[0].command);console.log("Stop:",s.hooks.Stop[0].hooks[0].command)'; echo "  [exit $?]"
