# Draft quote PDF from the priced worksheet — 23 September 2026

Completes the fence → material counts → real prices → revised quote chain with a reviewable, customer-facing draft. Nothing is sent: the app has no authenticated Looplet CRM transport (`src/studio/crmBridge.ts` stays fail-closed), so CRM push remains open.

## Change
- `src/studio/pricing/quotePdf.ts` (new): `buildQuoteDraft` builds the draft from the saved worksheet (lines, per-currency subtotals, tax only when the price book states an exclusive percentage, provenance) and refuses while material-linked lines are stale or required details are missing; `quoteDraftPdf` renders an A4 PDF with pdf-lib marked "DRAFT QUOTE — For review - not sent to the customer".
- `PriceBookPanel.tsx`: "Prepare a draft quote PDF" form in the priced worksheet (business name remembered on this device, customer, reference, validity, site address, notes).
- Tests: `quotePdf.test.ts` (3 tests incl. PDF text extraction) added to `test:src`; full suite 1935/1935 (`test-src.log`); typecheck 0.

## Native proof (Dans1 build cf4f511082d0, qualified engine e4693d8f…, isolated profile, CDP 9296)
1. Replayed Redburn fence + gate → BOM register 1 → AFGC CRM rates → 6 mapped lines, AUD 4,088.00.
2. Filled the form (`shots/q1-quote-form.png`) and downloaded `Q-QA-20260923-draft-quote.pdf` (SHA-256 a2f85b13…, copied here); status "Draft quote Q-QA-20260923 saved as a PDF for your review. Nothing was sent to the customer." (`shots/q2-quote-saved.png`).
3. PDF text extracted (`read-pdf.mjs` → `pdf-text.json`): 1 page, title "Draft quote Q-QA-20260923", all 6 lines with register provenance, subtotal AUD 4088.00 = worksheet. Rendered page inspected (`shots/q3-quote-pdf-page1.png`).
4. Extended the fence, then tried again: refused with "The materials changed after these prices. Rebuild the materials so the linked lines update, then prepare the quote." (`shots/q4-stale-refused.png`).

Installed over the user's app: installer 19afc91f…, exit 0, engine e4693d8f…, installed exe differs from tested only in the 3-byte bundle marker.

Open: rates print as stored (e.g. "3", "18.5") rather than to 2 decimals; gate hardware unpriced (not in price list); Looplet CRM push needs an authenticated app transport.
