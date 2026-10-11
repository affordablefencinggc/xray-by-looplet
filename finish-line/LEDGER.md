# Finish-Line Ledger — Conveyor Belt Pipeline

*Companion to `LEDGER.json` (machine-readable) and `AUDIT.md`.*

The release path is rolled into **controlled small sections**. Each section is one
commit unit that rides the belt through fixed stations:

```
[SECTION] → GATES → COMMIT → PUSH → (PRODUCTION) → ledger updated → next section
              │
              └─ any gate fails ⇒ belt HALTS, section stays pending, report emitted
```

## Belt rules
1. **Default is dry-run.** Nothing touches git/remote until `--live` is passed.
2. **Production is doubly gated:** requires `--live --deploy` together.
3. **Halt on first failure** — no section is skipped; the belt never force-pushes.
4. **Scoped staging** — only the section's declared `files` are staged; the belt
   refuses to run if unrelated dirty files exist (keeps commits surgical).
5. Every run appends one row to `ACTIONS.csv` and updates `state.json`.

## Sections

| ID | Title | Gates | Commit | Push | Production |
|----|-------|-------|--------|------|------------|
| FL-01 | Lockfile regen + typecheck fixes | typecheck | chore(release) | ✔ | — |
| FL-02 | Local CAD takeoff scripts | typecheck | feat(cad) | ✔ | — |
| FL-03 | Vendor pdf.js bundles | typecheck | feat(vendor) | ✔ | — |
| FL-04 | Finish-line audit + ledger docs | — | docs(finish-line) | ✔ | — |
| FL-05 | Conveyor-belt pipeline runner | typecheck | feat(pipeline) | ✔ | — |
| FL-06 | **Production release gate** | typecheck, tests, audit, build | — | — | ✔ (`--deploy`) |

## Station definitions (implemented by `scripts/finish-line.mjs`)
- **GATES** — run each gate command from `LEDGER.json` (`gates` map) for the section's `gates` list; stream output; nonzero exit ⇒ HALT.
- **COMMIT** — `git add <section.files>` (exact paths only) → `git commit -m <section.commit>` with clean working-tree precondition for unrelated files.
- **PUSH** — `git push origin main` (fast-forward only; no force, ever).
- **PRODUCTION** — full gate chain (typecheck → tests → audit → build) and emit release artifact; the Vercel deploy itself is platform-triggered (see `.grok/references/deploy-target.md`).
- **LEDGER** — write `state.json` (section → status/commit sha/timestamp) + append `ACTIONS.csv`.

## Operating the belt
```powershell
node scripts/finish-line.mjs                 # dry-run: full plan preview, no writes
node scripts/finish-line.mjs --section=FL-01 # dry-run a single section
node scripts/finish-line.mjs --live          # belt ON: gates→commit→push per section
node scripts/finish-line.mjs --live --max=2  # ride only the next 2 sections
node scripts/finish-line.mjs --live --deploy # include FL-06 production gate chain
node scripts/finish-line.mjs --status        # belt position report
```