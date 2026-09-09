# Skill guardrails as harness hooks (SC-09, 2026-09-09 01:50–02:00)

Daniel: "all our skills for this repo should be added and used as guard rails for any model selected?" → "go".

## What changed

- `.claude/settings.json` (new, project scope, committed with the repo): three hooks that call `scripts/guardrails/hook.mjs`
  - `SessionStart` → injects the five non-negotiable rules and the paths of `.agents/skills/{ledger,xray-engine,fast-cdp-testing}/SKILL.md` into every new session, whatever model is selected.
  - `PreToolUse` (matcher `Bash|PowerShell|Write|Edit`) → **deny** `git add -A` / `git add .` / `--all`; **ask** for `git commit|push|merge|rebase|stash|worktree add|reset --hard|checkout --` unless the command carries `# checkpoint: <name>` (Daniel names every checkpoint); **ask** for `taskkill|Stop-Process|kill|pkill|killall` unless invoked through a `cleanup*.ps1|mjs|sh` script (identity-checked shutdown, 10-minute rule); **ask** for any Write/Edit of `LATEST-VERIFIED-BUILD.md`.
  - `Stop` → reads the last assistant message from the transcript; if it claims done/complete/verified/passed without citing a runner report, screenshot path or executed test output, the turn is blocked once with the proof-standard reason (`stop_hook_active` prevents loops; a missing transcript never blocks).
- `scripts/guardrails/hook.mjs` (new, ~5 KB, no dependencies).

Skills stay the guidance; the hook is the enforcement layer the harness applies before the model's tool call runs.

## Proof

- Pipe tests (`pipe-tests.sh` → `pipe-tests.log`): 2 deny, 3 ask, 1 Stop block, allow cases (`git add <path>`, checkpointed commit, cleanup script, `ls`, proof-bearing completion, `stop_hook_active`) return `{}`; settings parsed by node with all three commands printed.
- Live: the hook fired in the authoring session before the pipe tests existed — a Bash tool call whose text contained the literal `git add -A` (the first pipe-test attempt) was refused by the harness with `Blocked by X-Ray guardrails: "git add -A/." stages the shared tree. Stage explicit paths (ledger skill).` The tests were then moved into a script file so their payloads are not in the tool command text.
- Test transcripts live in `.temp/guardrail-transcript-*.jsonl` (gitignored).

## Limitations

- The Stop check is a text heuristic; it catches bare "done" claims, not misleading evidence. Adversarial refutation still needs verifier agents.
- Pattern-based: a kill hidden inside a script the model writes is not inspected. Extend `hook.mjs` as new rules appear.
- `jq` is not installed on this machine; schema validation used node.
- `.claude/skills/ledger` and `.claude/skills/xray-engine` are byte-identical copies of `.agents/skills/*` and were not deduplicated here.
