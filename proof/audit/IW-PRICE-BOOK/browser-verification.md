# Executed pricing browser proof

Fresh isolated browser session: `xray-pricing-wave2`, development build at `http://127.0.0.1:8080/`. The user's normal desktop profile was never mutated.

## Passing evidence

- `fresh.json` actually performed supplier CSV upload, user column mapping, metadata entry, review/save, rate selection, quantity entry and reviewed application. Its complete command output in `fresh.log` records one book and one priced line. The first browser-daemon connection kept the runner's inherited output pipe open, so the process ended with `ETIMEDOUT` after all actions. This log is **not** a clean process-exit pass.
- `reload-final.log` is a clean exit-0 follow-up. It reloads the app, waits for a new hydrated document, opens Cost, checks one book / one worksheet line and `AUD 24.69`. The project ID before and after is `job-60434cc1-465c-44b4-9aac-2c2df9ff591d`. Browser errors are empty; console contains only development connection/React informational output.
- `library-final.log` is exit 0. It renames the book to **Engineering and trades supplier QA**, archives it, reveals archived books, restores it and checks that the applied amount is unchanged.
- `revision-final.log` is exit 0. It imports an explicit second revision with steel rate 20, then verifies that the previously applied revision-1 rate 12.345 and quantity 2 still produce **AUD 24.69**. The UI explicitly flags that newer pricing exists. Browser errors are empty.
- `tests.log`: 10 focused unit tests pass, covering invalid input/provenance, fixed-decimal amounts, revision semantics, corruption/quota/stale-write handling, exports and separate subtotals.

## Screenshots visually inspected

- `screenshots/price-book/import-review-desktop.png`: named import, three rates, supplier/currency/tax/effective-date/source preview and explicit save action.
- `screenshots/price-book/worksheet-desktop.png`: reviewed rate applied and exact line/subtotal amount.
- `screenshots/price-book/archived-desktop.png`: renamed archived book with revision/export/restore controls.
- `screenshots/price-book/new-revision-retains-applied-rate.png`: newer-revision notice alongside preserved applied amount and source revision.
- `screenshots/price-book/worksheet-mobile.png`: 390 × 844 layout, no document horizontal overflow, price buttons at least 44px high. Content scrolls inside the workspace.
- `screenshots/price-book/worksheet-mobile-bottom.png`: lower worksheet and removal summary remain readable. At maximum scroll the bottom 14.5px of the 44px summary target overlaps the shared Live assistant bar; parent notified to improve bottom scroll clearance.

## Problems found and resolved / bounded

The first pricing-only project had no plan and exposed an existing initial-job persistence defect: a newly generated project ID was not saved until a job mutation. Price-book raw data remained stored under its original ID but the next startup generated a different ID. Parent fixed initial job persistence under a cross-window lock and blocked Cost on failed project persistence. The fresh session above verifies the fix. The old `xray-pricing-wave` session is historical failed-identity evidence, not a recovery claim.

Earlier `import.log`, `import-final.log` and `reload.log` reflect exploratory runs before that fix and automation corrections. CSS `:has-text` selectors were unsupported by this browser backend despite reporting successful actions, and direct date filling did not change native date inputs. Final scenarios use semantic locators, standard CSS and native date input/change events. Readiness now waits for a new document and hydrated application rather than clicking the server-rendered shell.

All sample rates are QA fixtures, not market or live supplier prices. Original CSV bytes are **not embedded** in price libraries or project backups; imports retain their SHA-256, filename, byte count, column mapping and source references. Price-book/worksheet data is included through the parent's backup-v2 integration, whose proof is owned by the parent. Production/native build and installed-app verification are also parent-owned gates.

Session handoff: `xray-pricing-wave2` left open for parent backup testing with one active book, two revisions and one unchanged applied line. No further session actions by this agent after handoff.
