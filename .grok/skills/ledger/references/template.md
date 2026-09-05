# Ledger Template

```markdown
# Ledger: [Feature or Epic Name]
Approved: yes @ YYYY-MM-DDTHH:MM:SSZ (User said: "[Exact User Quote]")
Baseline commit: [SHA]
Baseline branch: [branch-name]
Graph: n/a

## Epic goal

[Clear, concise statement of what this work accomplishes and why.]

## Scope guardrails

- Work only within the specified files and their supporting tests.
- Do not add unapproved npm dependencies.
- Never run `git add -A`. Stage explicit paths only.
- Fail-closed error handling; no silent catch-and-continue.
- Evidence required for every slice before marking complete.

## SC-01 — [Baseline Verification]  [done]
DONE (machine): clean build, typecheck, lint, and baseline test suite pass.
DONE (human): verify initial environment and routes render.
Files: [Explicit file paths]
Depends on: —
Notes: [Machine output, warnings, test numbers]
Commit: —

## SC-02 — [Core Implementation]  [in-progress]
DONE (machine): unit tests pass, typecheck exit 0, git diff --check clean.
DONE (human): interactive check or executed log verification.
Files: [Explicit file paths]
Depends on: SC-01
Notes: [Pending test execution]
Commit: —

## SC-03 — [Integration & Proof Pass]  [pending]
DONE (machine): full test suite, regression contracts pass.
DONE (human): visual proof captured (screenshot / CDP) or headless behavior proof.
Files: [Explicit file paths]
Depends on: SC-02
Notes: —
Commit: —
```
