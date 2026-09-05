---
name: ledger
description: "The authoritative Ledger Skill for executing, tracking, and verifying engineering epics with human-in-the-loop governance. Enforces slice decomposition (SC-01..SC-NN), machine-verifiable exit criteria, human visual/behavioral proof, strict git hygiene (never git add -A, no worktree sprawl), and Daniel's non-negotiable proof standard (code diff + visual/executed proof before any item is marked complete). Trigger with /ledger or when tracking complex multi-step work."
trigger: /ledger
version: 1.0.0
---

# The Ledger Skill

A disciplined, proof-first operating workflow for AI agents (Claude, Codex, Gemini, Grok) and human engineers. It turns broad initiatives into a sequence of isolated, verifiable slices recorded in a persistent, inspectable ledger.

---

## The Core Rule: Daniel's Proof Standard

> **Nothing counts as done unless it ships with BOTH a code diff and visual or executed proof.**
>
> "Must have a screenshot attached of proof and code difference attached or it's not deemed completed."

- **Where a screenshot is meaningful (UI / browser / layout / visual state):** Attach a screenshot or headless rendering result showing the exact change in action.
- **Where a screenshot is meaningless (backend / CLI / Rust / Worker / DB migrations):** Run the actual function, test suite, or CLI command with real or deterministic mock bindings and capture the exact console output.
- **Never pad or fake evidence:** If something cannot be proven in the current sandbox, mark it **open** or **blocked** with the exact blocking dependency rather than claiming it is complete.
- **Verify blame first:** Before reporting a test failure or regression, verify if it was pre-existing (e.g. stash your files, test baseline, pop stash).

---

## Ledger Operating Rules & Guardrails

1. **One repository folder. NO unapproved git worktrees.**
   Work happens on one ordinary branch off `main`. Finish → compare with `main` → merge with explicit human approval → next branch.
2. **Never `git add -A`.**
   Concurrent agents and humans share the tree. Always stage explicit file paths.
3. **Check current branch before writing.**
   Run `git branch --show-current` before mutating files.
4. **Log every branch in the Branch Ledger:**
   Record branch creation, purpose, and final disposition in `LOOPLET_BRANCH_RELEASE_LEDGER.md` (or repo branch ledger).
5. **Append finished units to the Completion Ledger:**
   Append verified units same-turn to `COMPLETE-CHECKLIST.md` with recovery references (SHA / branch / PR).
6. **Keep a Live To-Do:**
   Maintain a repo-root markdown checklist (e.g. `CLOSEOUT-TODO.md` or `XRAY-TOPDOWN-MINDMAP-TODO.md`) updated after every step so progress is visible in real-time.

---

## Slice Decomposition Structure (`SC-01` .. `SC-NN`)

Every epic tracked by this skill must initialize or update a ledger file (typically `LEDGER.md` or `.claude/scratch/ledger.md` or `docs/*-ledger.md`).

### Ledger Header
```markdown
# Ledger: [Epic Title]
Approved: yes @ [ISO timestamp] (User approved: "[exact user quote]")
Baseline commit: [SHA]
Baseline branch: [branch name]
Graph / Boundary: [notes on boundaries]

## Epic Goal
[1-2 paragraph description of the complete deliverable]

## Scope Guardrails
- [Exact file boundaries]
- [Forbidden actions: e.g. no destructive db push, no new unapproved npm packages]
- [Fail-closed security invariants]
```

### Slice Format
Each slice represents an atomic, testable milestone:
```markdown
## SC-01 — [Descriptive Title]  [[done] | [in-progress] | [pending] | [blocked]]
DONE (machine): [Concrete, automated criteria: clean typecheck, lint, passing test suite with test counts, clean git diff --check]
DONE (human): [Visual/behavioral criteria: UI inspected at mobile/desktop, keyboard navigation, focus state, zero console errors]
Files: [Explicit list of modified, added, or deleted files]
Depends on: [Preceding slices, or none]
Notes: [Actual test output summary, module counts, timings, warnings addressed]
Commit: [Commit SHA, or — if pending review]
```

---

## Execution Workflow

1. **Initialize Ledger:**
   - Create or update the ledger file.
   - Outline all slices (`SC-01` through `SC-NN`) with dependencies.
   - Request or record explicit user approval before executing modifying slices.
2. **Execute Slice-by-Slice:**
   - Mark current slice as `[in-progress]`.
   - Implement only the files within the slice boundary.
   - Run machine verification (`npm run typecheck`, test suites, diff checks).
   - Perform human/visual verification (browser inspection or execution proof).
   - Update the ledger with exact outputs and mark `[done]`.
3. **Check Blame & Pre-existing Issues:**
   - If tests fail, prove whether the failure is new or pre-existing.
4. **Handoff & Report:**
   - Summarize shipped behavior.
   - Provide diff hunks + proof screenshots/logs.
   - Explicitly list any remaining blockers or open items.

---

## Quick Reference Templates

See `references/template.md` for a ready-to-copy ledger template.
