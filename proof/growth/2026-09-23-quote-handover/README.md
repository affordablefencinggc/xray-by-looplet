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

## Follow-up: Share and Write email tried in the desktop app (same day)
- **Share PDF…** failed in the desktop app with "Share failed": the Windows web view reports file sharing (`navigator.canShare` true) but rejects it (`s1-share-result.png`). It is now offered in browsers only; the desktop shows PDF, ZIP, Save to folder and Write email (`shots/u1-desktop-handover-buttons.png`).
- **Write email** did nothing on desktop: the web view blocks `mailto:` navigation. First fix (explorer.exe) opened a stray Documents window and a "Pick an app" prompt; both were closed. Final fix: `xray_open_mail_draft` (mailto-only, ≤ 8000 chars, no spaces/quotes/control characters) calls Windows `ShellExecuteW`, the same path as clicking an email link. Native result on build 4b9d247a3600 (r2): the app reported "Opened your mail app with quote Q-QA-EMAIL-2…" and the default mail app (new Outlook, `olk`) started with no stray windows.
- On this PC the new Outlook was still at its first-run "synced to the Microsoft Cloud" screen, so no draft could appear; that consent was left for the owner and Outlook was closed. A direct `Start-Process mailto:` test on this PC showed Windows' "Pick an app" prompt, so the mailto default needs confirming in Windows Settings → Default apps.
- Tests: TS 1939/1939 (`test-src-r2.log`); cargo `cargo-test-r3.log` (includes `only_prepared_mail_links_can_be_opened`); typecheck 0. Dans1 build 4b9d247a3600 r2 (web ID unchanged; earlier r1 kept as `runs\4b9d247a3600-r1-explorer-mail` on Dans1 and `attempt-4b9d247a3600/` here). Installed: installer 07d4c291…, exit 0, engine e4693d8f….
- Observed, not fixed: after the Share/Write email runs the test copy did not close on a window-close request and was stopped by identity-checked PID (runs 2–4); earlier runs closed normally.
