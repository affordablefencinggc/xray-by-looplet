# Finish-Line Runbook

## One-time setup (already done)
- `finish-line/LEDGER.json` — section manifest (source of truth for the belt)
- `finish-line/LEDGER.md` — human-readable belt contract
- `finish-line/AUDIT.md` — full application audit
- `finish-line/ACTIONS.csv` — append-only run log
- `scripts/finish-line.mjs` — the conveyor runner

## Daily operation
1. **Preview the belt** (always safe): `node scripts/finish-line.mjs`
2. **Start the belt**: `node scripts/finish-line.mjs --live --max=1` — ride one
   section at a time until you trust it, then remove `--max`.
3. **Check position anytime**: `node scripts/finish-line.mjs --status`
4. **Production**: only when `--live --deploy` are both present does FL-06 run
   the full gate chain (typecheck → tests → audit → build).

## Failure recovery
- A failed gate halts the belt; fix the issue and re-run the same command.
  The belt resumes from the first pending section (state in `state.json`).
- A "unrelated dirty files" halt means something is modified outside the
  current section's declared files. Either finish/commit that work yourself
  or move it into a section in `LEDGER.json`.

## Extending the belt
Add a section object to `LEDGER.json`:
```json
{
  "id": "FL-07",
  "title": "Short description",
  "kind": "feature",
  "files": ["path/one", "path/two"],
  "commit": "feat(scope): message",
  "gates": ["typecheck"],
  "push": true,
  "production": false,
  "status": "pending"
}
```
Gates available in the `gates` map: `typecheck`, `tests`, `audit`, `build`.

## Autonomy ladder
| Level | Command | Human consent |
|-------|---------|---------------|
| 0 | `node scripts/finish-line.mjs` | none needed (read-only) |
| 1 | `--live --max=1` | one section per approval |
| 2 | `--live` | blanket approval for the whole ledger |
| 3 | `--live --deploy` | production release consent |