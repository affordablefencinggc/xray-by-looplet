# Executed sheet register proof — 2026-09-07

Isolated agent-browser session: `xray-sheet-wave`, dev app `http://127.0.0.1:8080/`. This session is independent from the user's normal installed desktop profile. No installed app or user profile changes were made.

## Passed interactive checks

- Imported the original Redburn plan through the app's Model action; original SHA-256 `b57956f76b5dc893ac2b28a021f3f92e345807e326d6b1f8313e373f9145ad38`, 13 pages.
- Renamed original page 2 to `Site and drainage plan`, moved it first, then cancelled a second rename; persisted name remained intact.
- Archived that sheet: active list changed to 12 rows and its row disappeared. Original source page 2 navigation remained available.
- Archived list showed exactly one recoverable sheet. Recovery returned the active count to 13.
- Viewing the renamed sheet selected original page 2. Reload-list and full browser reload preserved name, ordering and recovery.
- Original SHA and source page count remained unchanged throughout.
- Mobile search returned the renamed sheet; reordering was disabled while filtered. Controls were at least 44px high; no page horizontal overflow at 390×844.
- `errors` returned no page errors in desktop, mobile and final mobile batches.

`desktop.log`, `mobile.log` and `mobile-final.log` record the passing commands. `desktop.json` and `mobile.json` contain the actual action scenarios; `mobile-final.json` is a clean independent persisted-state verification. The initial import completed in-browser, but its first browser-launch runner reported a subsequent `spawnSync ETIMEDOUT`; it is not counted as a clean runner pass. Existing-session scenarios completed cleanly afterwards.

## Visually inspected screenshots

- `screenshots/sheet-lifecycle/desktop.png`: renamed original page 2 first, original page index visible and page 2 selected.
- `screenshots/sheet-lifecycle/desktop-archived.png`: one archived page, Recover action, original source preview and SHA preserved.
- `screenshots/sheet-lifecycle/mobile.png`: mobile source selector, filters, search and complete sheet actions visible. All sheet controls fit the viewport.

No sheet-specific overlap or clipped action was found. The app's existing floating assistant can cover lower explanatory text while scrolling, but the checked sheet actions remain usable. Production build proof remains parent-owned.

The datetime regression now accepts source timestamps with timezone offsets, matching the existing domain schema. Final focused unit suite: **8/8 passed** (`unit-tests.log`).

## Final archive review and shared navigation update

`archive-review.json` and `final-review.json` exercise the added archive impact review with retained calibration/trace/item/annotation/linked-photo counts. Cancel preserved active navigation; Confirm archive removed only the managed sidebar entry; recovery restored its custom name and managed first position using original page index 2. Counts are calculated against the active source and photos are deduplicated. A stale project identity refuses confirmation until a new review.

Inspected `archive-review.png`, `desktop-final.png` and `mobile-archive-review.png`. Review content and Confirm archive/Cancel are visible at desktop and 390×844; mobile actions remain44px and the page has no horizontal overflow. All original source SHA/page-count assertions passed. Focused suite now **9/9 passed**, including selected-page impact isolation and photo deduplication; typecheck passed.

The final browser flows executed successfully, but the reused agent-browser error buffer retained two SSR module errors from the temporary missing `./useSheetLifecycle` import during parallel integration. `final-errors.json` preserves them explicitly; the batch `errors --clear` did not separate that historical buffer. The parent's independent fresh browser smoke then passed with desktop/mobile `pageErrors: []` in `proof/audit/IW-PROFESSIONAL-NEXT/dev-smoke-clean.log`. Use that fresh session verdict for the clean error gate, alongside these executed interaction logs. Product source for this slice is frozen.
