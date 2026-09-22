# Material register → priced worksheet link — 23 September 2026

Closes the manual step found in the tiered tests: BOM quantities had to be typed into the priced worksheet, and a revision left prices stale.

## Change
- `src/studio/pricing/priceBooks.ts`: library gains optional `bomMappings` (material key → saved rate, decimal factor, exact/round-up) and worksheet lines gain an optional `bom` link (key, register commit, material quantity, factor, rounding). Validation: mapped rates must exist, one mapping and one linked line per material. CSV export adds "Quantity source".
- `src/studio/pricing/bomPricing.ts` (new): exact-decimal `derivedQuantity`, `setBomMapping`/`clearBomMapping`, `syncBomPricedLines` — adds/updates/removes only linked lines, keeps their identity, never touches manual lines, no-op when unchanged.
- `PriceBookPanel.tsx`: "Price from material register" table (rate, factor, round up, Save/Clear per material); linked lines resync automatically when a new material register is committed; a stale register shows a warning and never changes prices. `Studio.tsx` passes the committed BOM snapshot. `priceBooks.css` table layout.
- Tests: `bomPricing.test.ts` (4 tests) added to `test:src`; full suite 1932/1932; typecheck 0.

## Native proof (Dans1 build 631c9371ccc3, qualified engine e4693d8f…, isolated profile, CDP 9295)
1. Redburn sheet 12 at 1:250, timber paling run with 2 m double gate, approvals, BOM register 1 (11 lines).
2. Imported the 8 confirmed AFGC Looplet CRM rates; mapped 6 materials (palings, line/end/gate posts, rail cuts, gate leaves). Worksheet priced itself: AUD 4,088.00 ex GST, 6 lines, no quantity typed (`shots/p2-mapped-priced.png`).
3. Extended the run 51.59 → 73.40 m: approvals reset; pricing section warned "The takeoff changed after material register 2…" and prices held (`shots/p3-stale-after-revision.png`).
4. Re-approved and regenerated: notice "Priced lines updated from material register 3: TP-PALING 561 → 815; TP-POST-ORD 20 → 29; TP-RAIL-CUT 44 → 62."; worksheet AUD 5,196.50 (`shots/p5-auto-updated-worksheet.png`).
5. Linked quantities equal the app's TypeScript reference BOM for the final job (`parity.json`, matches: true). Mapping table fits without horizontal overflow (`shots/p6-register-mapping-table.png`).
Earlier attempts 6fba4ee25c09 and 0694fb2bf7a5 (layout fixes) are kept under `attempt-*` and `build-*`.

Installed over the user's app: installer e380c05f…, exit 0; installed engine e4693d8f…; installed exe differs from tested exe only in the 3-byte bundle marker. `LATEST-VERIFIED-BUILD.md` unchanged (no full release campaign).
