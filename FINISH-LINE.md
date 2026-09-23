# X-Ray v1.0 — strict finish line

Written 23 September 2026 from the repo's own ledgers: `XRAY-PRODUCTION-CLOSEOUT-LEDGER.md`, 21 `*-TODO.md` files (98 open lines), `PROFESSIONAL-A-Z-CHECKLIST.md` (375 rows), `LATEST-VERIFIED-BUILD.md`, and this week's proof folders.

## The finish line (all must be true; nothing else counts)

v1.0 is finished on the day **every** one of these is true and has proof on disk:

1. **Closeout ledger:** SC-01 to SC-20 all `[[done]]`. Today 14 are done; SC-09, SC-12, SC-13 and SC-14 are partial, and SC-18 and SC-20 are pending.
2. **Signed install:** a code-signed Windows installer, installed over the normal app, passes daily-use journeys DAY-01 to DAY-08 at 1024×768 and 768×1024. That also clears A–Z row Q-13, currently failed.
3. **Clean shutdown:** the installed app closes cleanly every time. The native graceful-shutdown gate currently fails, and test copies ignore close requests.
4. **Verified build:** `LATEST-VERIFIED-BUILD.md` points at that signed build. It currently still points at 8e14ac427997 from 9 September.
5. **Fence to quote:** trace fence and gate → material counts → real rates → revised quote → draft handover passes on the signed build with a real job's price list, including gate hardware. The chain works now; hardware prices and the stated acceptance cases are missing.
6. **In-scope TODOs:** every in-scope TODO line below is ticked with proof. Everything else is moved to `POST-V1-BACKLOG` in writing, not left open.

**Not part of v1.0**, moved to the backlog:
- accounts, sync and collaboration (15 A–Z rows blocked on an account-service decision)
- web product search (needs a live Firecrawl key)
- the 11 A–Z engine categories that are entirely gaps: geospatial, services, programme, libraries, landscape, manufacturing, electrical, operations, structural, whole-life, specialist assets
- CI, SBOM and auto-update channel
- 3D walk physics
- the 1,260-page materials reconciliation
- the remaining interop gaps

## Sections and timeline

Working days are Monday to Friday, excluding the Queensland King's Birthday holiday on Monday 5 October. Each section ends on its exit check, not its date. If a section slips, later dates move by the same amount.

| # | Section | Dates | Exit check |
|---|---|---|---|
| 0 | Ledger hygiene and scope freeze | Thu 24 Sep | Stale ticks fixed. The A–Z CSV is regenerated; it currently shows 247 gaps against the register's 239. `POST-V1-BACKLOG.md` is written and every open TODO line is either in scope or moved there. |
| 1 | Stability blockers | Fri 25 Sep – Wed 30 Sep | The development-reload hydration defect is fixed: SC-09 passes 135/135 and HVAC passes 46/46 on dev. The installed app and test copies close cleanly 10 times out of 10, and the native graceful-shutdown gate passes. |
| 2 | Industry worksheets closeout | Thu 1 Oct – Mon 12 Oct | SC-09 (QS), SC-12 (HVAC, after your velocity ruling), SC-13 and SC-14 are all `[[done]]`. HVAC pressure-loss and clash results are labelled "estimate — not engineering sign-off". |
| 3 | Fencing and estimating chain | Tue 13 Oct – Thu 22 Oct | The six FENCING-IMPROVEMENTS items are done: bay-division acceptance, stock nesting with saw kerf, slope and rake from a reviewed schedule, gate hardware journey, repair journey, full walkthrough. Gate hardware is priced from your list. Quote issue (A–Z E-13) has a draft→issued state. The fence → quote run is repeated on a real job. |
| 4 | Everyday workspace and recovery | Fri 23 Oct – Tue 3 Nov | These are done: the INDUSTRY-WIDE precision set, pointer-mode repair and 10-tab audit; DAY-TO-DAY SC-01..08, minus SC-05 (Firecrawl) and SC-06 (staff handoff), which go to the backlog; PROJECT-BACKUP SC-04 (apply a package); DAILY-RECOVERY DR-01..03. |
| 5 | Assistant reliability | Wed 4 Nov – Tue 10 Nov | The MiniMax roofing and QS turns that fail today pass. ASSISTANT-MCP SC-02..07 are done. The capability matrix is published. The AI-MATERIALS live benchmark has run on the drawings. |
| 6 | Release | Wed 11 Nov – Wed 18 Nov | Signed exe, NSIS installer and MSI (SC-18). Installed-app verification and upgrade over the normal profile (Q-13, Z-02). Full Dans1 release campaign. DAY-01..08 at both sizes. Release notes (Z-13). SC-20 sign-off. `LATEST-VERIFIED-BUILD.md` promoted. |

**v1.0 target: Wednesday 18 November 2026** (39 working days).

## What each section contains

**Section 0 — Ledger hygiene (1 day)**
- Tick PROJECT-BACKUP L16: the ledger already shows the under-two-second rule met.
- Cite proof paths for TOPDOWN-MINDMAP SC-07F/H.
- Update the dashboard KPI, which still says "8/20 done".
- Regenerate `public/industry-coverage/requirements.csv`.
- Write `POST-V1-BACKLOG.md`.

**Section 1 — Stability (4 days)**
- Run the hydration measurement `SC09RR-RELOAD-11` on Dans1 and fix the cause. This one fix unblocks four slices.
- Find why the app ignores a window-close request after share or email actions and after long CDP sessions, and fix the native graceful-shutdown gate.
- Production smoke 404 and hydration failure (COMPLEX-PLAN-TRIAL).

**Section 2 — Industry worksheets (7 days)**
- QS: SC-09 dev reload.
- HVAC: SC-12, which needs your ruling on the missing-velocity mass rule; SC-13 (needs SC-12 and the reload fix); SC-14 (solved pressure loss and exact round-duct clash).
- Industry-agent items: rebuild the discussion-only routing change, the roofing boundary explanation, QS CSV explanations, the roofing screenshot citation, and QS tablet acceptance.

**Section 3 — Fencing and estimating (8 days)**
- FENCING-IMPROVEMENTS SC-00..05. Reuse the roofing stock-nesting code for timber lengths.
- Gate hardware and timber double-gate rates, once you supply them.
- Quote issue state (E-13).
- Rates printed to 2 decimals on the quote.
- Master-ledger SC-08 review and proof pack, in the parts the quote needs.

**Section 4 — Everyday workspace (8 days)**
- INDUSTRY-WIDE SC-01..06: reticle, lens zoom, source-coordinate lens, palette, delivery freeze.
- Pointer-mode repair.
- Workspace navigation, diagnostics, plan switcher and header.
- The 10-tab audit.
- DAY-TO-DAY SC-01..04 and SC-07..08.
- PROJECT-BACKUP SC-04.
- DAILY-RECOVERY DR-01..03 and DR-05..06, which includes the visible build identity.
- The schedule download that stalls as `.crdownload`.

**Section 5 — Assistant (5 days)**
- TAKEOVER SC-01/02 (MiniMax roofing and QS turns).
- ASSISTANT-MCP SC-02..07.
- VISIBLE-WORKING-EXAMPLE: MiniMax repeating its checks.
- AI-MATERIALS LIVE-01.
- DWG, ARCHITECT-SKETCH and PROFESSIONAL-COVERAGE readback items that only needed installed-app proof. These land here or in Section 6.

**Section 6 — Release (6 days)**
- Sign with the certificate; SC-18.
- Install over the normal profile and verify: Q-13, Z-02, Z-03.
- Clean-machine check.
- Full Dans1 campaign.
- DAY-01..08 at 1024×768 and 768×1024.
- Release notes; SC-20; promote `LATEST-VERIFIED-BUILD.md`.
- Merge to `main`, with your approval.

## Decisions and inputs needed from you (with deadlines)

| Needed | By | Blocks |
|---|---|---|
| Buy a Windows code-signing certificate. OV takes about 1–5 business days to issue; EV about 1–2 weeks. | **Fri 25 Sep** | Section 6 and the whole finish line |
| Confirm the scope freeze: the "Not part of v1.0" list above | Fri 25 Sep | Section 0 |
| Ruling on HVAC SC-12: how to treat duct mass when velocity is missing | Wed 30 Sep | Section 2 |
| Gate hardware and timber double-gate prices, added to the Looplet CRM price list | Fri 9 Oct | Section 3 |
| A real fence job, with its drawing and site notes, for the final walkthrough | Fri 16 Oct | Section 3 exit |
| A clean Windows machine or VM for the release check | Tue 10 Nov | Section 6 |
| Standing approval to push each finished checkpoint to GitHub, or approval per section | Now | Every section |

## Risks to the date

- **Code-signing delay.** This is the only external item on the critical path. Everything else can move in parallel. Order the certificate first.
- **The reload defect runs deeper than one fix.** If Section 1 runs past 30 September, Sections 2 to 6 move day for day.
- **Engineering claims.** HVAC pressure loss and hydraulics ship as labelled estimates. Claiming engineering-grade results needs outside sign-off and would be post-v1.
- **Build throughput.** Each proven change costs about 10–15 minutes of Dans1 build plus a desktop test. Batching fixes per section keeps this inside the estimates.
