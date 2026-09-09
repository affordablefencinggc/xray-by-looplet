# Production pricing verification

Build supplied by parent: Dans1 run `a790fd92663d`, production preview `http://127.0.0.1:8084/`. Independent browser session `xray-pricing-production`; no installed-app profile touched. No product source changed during this verification.

All three final scenarios exit **0**:

- `production-fresh.log`: fresh project, actual CSV upload, mapped columns, supplier/currency/tax/effective-date/source review, saved named book, selected steel fixture rate 12.345/kg, entered quantity 2 and explicitly applied **AUD 24.69**.
- `production-reload.log`: real reload into a new hydrated document. Project identity stays `job-9c3a136a-6217-487b-bf0c-1f63f79b0dc4`; one book and one priced line remain; amount stays AUD24.69. Mobile390×844 has no document horizontal overflow and all price buttons measure at least44px high.
- `production-backup.log`: actual Backups UI saves and inspects **Production pricing QA backup**. Read-only IndexedDB assertion confirms `xray.workspace-backup/v2`, matching project ID, one price book and one worksheet line, original book revision1, quantity2, rate12.345, unitkg, currencyAUD, tax excluded10%, and exact source CSV SHA-256 `fb337a2df3de29c5ca5705fec38a4112934ef5794bbeb472c6d355008f675c52`.

Browser errors and console are empty in the final production reload and backup scenarios.

Visually inspected screenshots: `production-import-review-desktop.png`, `production-worksheet-desktop.png`, `production-worksheet-mobile.png`, `production-backup-v2.png` under `screenshots/price-book/`.

The initial two navigation attempts returned `ERR_EMPTY_RESPONSE` while the remote preview's owning SSH connection had ended. Parent restored the preview. Those attempts performed no application mutations; final flows above ran successfully afterward.

The sample steel, concrete and electrical rates are explicitly QA fixtures, not live supplier prices. The backup embeds the validated price library/worksheet and source provenance; original supplier CSV bytes are not embedded. This proof does not claim automatic takeoff binding, tax additions, currency conversion, live supplier search or editing-workspace backup restore.

The shared mobile assistant-bottom-clearance observation remains documented in the earlier browser-verification note; parent owns the subsequent layout delta. The production session is left open on the backup contents view with one book, one applied line and one verified backup.
