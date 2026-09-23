# Quote handover options — 23 September 2026

Handover is optional and tool-neutral: people keep their own quoting, accounting or file-sharing tools. X-Ray never sends anything itself.

## Change
- `src/studio/pricing/quoteHandover.ts` (new): handover JSON (`xray.quote-handover/v1`, status `draft-not-sent`), import-friendly line CSV (ContactName, Reference, Date, ExpiryDate, ItemCode, Description, Quantity, Unit, UnitAmount, LineAmount, Currency, Tax, QuantitySource, SiteAddress; formula-injection guarded; no guessed account codes or tax types), safe file names, one-ZIP package (fflate), mailto link.
- `src-tauri/src/handover.rs` (new) + `lib.rs`: `xray_save_handover` writes the files into a user-chosen folder (Dropbox/OneDrive/Google Drive or any folder); plain names, pdf/csv/json/zip only, ≤ 25 MB, never overwrites, all-or-nothing.
- `PriceBookPanel.tsx`: handover buttons: Download draft quote PDF · Download handover package (ZIP) · Save handover to a folder… (desktop, native folder picker) · Share PDF… (when the system supports file sharing) · Write email (opens the mail app with subject/body; user attaches the PDF).
- Tests: `quoteHandover.test.ts` (4) in `test:src`; full suite 1939/1939 (`test-src.log`); cargo 53/53 incl. 2 handover tests (`cargo-test.log`); typecheck 0.

## Native proof (Dans1 build 929fb8819f56, qualified engine e4693d8f…, isolated profile, CDP 9297)
- Options visible (`shots/h1-handover-options.png`).
- ZIP downloaded: `Q-QA-HANDOVER-1-draft-quote-handover.zip` (copied here) holds the PDF, `-lines.csv` and `.json`.
- Save to folder: the real Windows folder picker opened with the app's title; it was driven with Windows UI Automation (folder box + Select Folder) to `folder-handover-test/`, and the app reported "Saved 3 handover files … Nothing was sent to the customer." (`shots/h2-saved-to-folder.png`). Files checked: CSV rows, JSON schema/status/6 lines/subtotal AUD 4088.00, PDF title and text (`pdf-text.json`).
- Saving again to the same folder was refused: "Q-QA-HANDOVER-1-draft-quote.pdf already exists in that folder … nothing was saved." Files unchanged (same times) (`shots/h3-overwrite-refused.png`).

Not driven natively: Share PDF… (opens the Windows share sheet) and Write email (opens the mail app); their content is covered by unit tests. Installed over the user's app: installer 582fd10b…, exit 0, engine e4693d8f…, 3-byte bundle-marker difference only.
