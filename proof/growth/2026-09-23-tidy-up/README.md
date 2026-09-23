# Tidy-up batch from the tiered tests — 23 September 2026

| Issue | Change | Native proof (Dans1 build 8a6226fc93a6, isolated profile, CDP 9298) |
|---|---|---|
| A general-construction run silently hid fence materials | `Studio.tsx`: notice "Fence materials are paused" naming the general runs and what to do, when fence runs exist alongside them | Added a general Run 02 → notice "…Run 02 is a general construction run; change it to fencing or remove it in Takeoff…" (`shots/t3-fence-materials-paused.png`) |
| Drawings/Takeoff listed "Sheet 1–13" while Visualise had real titles | `sourceSheetTitles.ts` (curated titles of the four catalogue sources, test-locked to each model's `sourceSheets`); left rail shows the title while a page keeps its default name; renamed pages keep the user's name; other PDFs unchanged | Takeoff list: "01 Cover perspective … 12 Survey 1, 13 Survey 2" (`shots/t1-sheet-titles-takeoff.png`) |
| Approve could be pressed twice (duplicate history) | `evidenceCommands.ts` refuses approving an already-approved run/gate; `Studio.tsx` disables Approve with "Already approved at this revision" | After one approval the button was disabled; two more clicks left exactly 1 approve event (`shots/t2-approve-disabled.png`) |
| Run/gate "×" had no label and no confirmation | `Studio.tsx`: `aria-label`/`title` "Remove <label>" and a confirmation naming the item | Labels "Remove Run 01/Run 02/Gate 01"; cancelling kept the run; confirming removed it and fence materials returned (`shots/t4-removed-bom-back.png`) |
| "Round up" label under its checkbox | `priceBooks.css`: `.price-books .bom-round-up` now outranks `.price-books label` | Built CSS: display flex, checkbox 16 px, same row, label 19 px high |
| Worksheet tab count lagged | Not a defect: the earlier test read the label while the save was still in flight; label, list and totals read the same saved value | — |

Tests: 1943/1943 (`test-src.log`, incl. new `sourceSheetTitles.test.ts` and a double-approve regression in `evidenceCommands.test.ts`); typecheck 0 (`typecheck.log`). Dans1 gates all exit 0 (`build-8a6226fc93a6/`). Installed: installer 5fb53905…, exit 0, engine e4693d8f…, 3-byte bundle-marker difference only.

Open: the confirmation dialog was exercised with `window.confirm` stubbed over CDP (message and cancel/confirm branches), not by clicking the native dialog. The test copy again ignored a window-close request at the end and was stopped by identity-checked PID.
