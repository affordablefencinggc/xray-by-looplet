# 00 — Ledger hygiene and scope freeze

**When:** Thu 24 Sep 2026 (1 day) · **Owner input:** Daniel confirms the scope freeze · **Blocks:** everything after it

## Goal
Make the ledgers tell the truth before work starts, and put everything outside v1.0 into one written backlog. That way "finished" can be measured.

## Starting state
- The TODO ledgers hold 98 unchecked lines across 21 files. Some are already done but not ticked.
- `public/industry-coverage/requirements.csv` is stale: 247 gap / 102 partial, against 239 / 110 in `PROFESSIONAL-A-Z-CHECKLIST.md`.
- The dashboard KPI in `XRAY-PRODUCTION-CLOSEOUT-LEDGER.md` / `XRAY-STATUS-AND-PROOF-DASHBOARD.html` still says "8/20 done"; 14 are done.
- `npm run test:src` cannot start on Windows because the command line is too long.

## Steps
1. Tick PROJECT-BACKUP-TODO L16. The closeout ledger already shows the under-two-second rule met; cite that proof.
2. Cite proof paths for XRAY-TOPDOWN-MINDMAP SC-07F and SC-07H, or leave them open with the reason.
3. Regenerate the A–Z CSV with `node planning/professional-coverage/generate.mjs`. Confirm the counts match the register: 6 verified / 110 partial / 239 gap / 19 blocked / 1 failed.
4. Update the dashboard KPI to the true slice count.
5. Split `test:src` so it runs on Windows. Either chunk the file list or have a small `scripts/run-src-tests.mjs` read the list and spawn `node --test` directly. Prove it with `npm run test:src` exit 0.
6. Write `POST-V1-BACKLOG.md` and move the out-of-scope open lines there, each with its source file and line:
   - account/sync/collaboration (A-01..09, A-11, V-05..07, V-14, Z-06, WORKSPACE-PANELS SC-13, DAY-TO-DAY SC-06, B-06)
   - Firecrawl search (P-01, P-03, X-09, DAY-TO-DAY SC-05)
   - A–Z categories G, H, J, K, L, M, N, O, S, W, Y
   - CI/SBOM/update channel (master ledger SC-11/15/16 EXT rows)
   - 3D walk physics (GROWTH L30)
   - PROJECT-MATERIALS 1,260-page reconciliation
   - the remaining I (interop) gaps
7. In each source TODO file, mark every moved line "moved to POST-V1-BACKLOG (v1 scope freeze 2026-09-24)" instead of deleting it.
8. List the remaining in-scope open lines in `FINISH-LINE.md` under their sections (01–06). Every open line in the repo must now belong either to a section or to the backlog.

## Exit check
- A script or grep shows every open `- [ ]` line is either tagged with a section 01–06 or marked moved.
- `npm run test:src` exits 0 on Windows.
- The CSV counts match the register.

## Proof
`proof/growth/<date>-v1-scope-freeze/`: before/after open-line counts, the CSV diff summary, the test:src log and a README.
