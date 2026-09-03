# System Errors, Migrations & Worker Trajectory Audit

**Updated:** 2026-09-03  
**Repository:** `c:\Users\danie\repo\xray-by-looplet`  
**Linked Ecosystem:** `c:\Users\danie\repo\Looplet-main` (Cloudflare Workers & Supabase Backend)  
**Author:** Antigravity / Sweeper Agent  

---

## 1. Documented System Errors & Technical Debt

### A. Autopilot & CLI Execution Errors
| Error Identifier | Root Cause | Impact | Resolution / State |
|---|---|---|---|
| **`Cannot use both a positional prompt and the --prompt (-p) flag together`** | `powershell.exe -Command "& gemini.ps1 ..."` interpolated multi-line strings. Newlines split the prompt across multiple arguments, causing yargs in `gemini-cli` to interpret subsequent lines as positional `query` arguments alongside `-p`. | Autopilot crashed on task launch (`Process exited with code 1`). | **FIXED**: [`scripts/autopilot.mjs`](file:///c:/Users/danie/repo/xray-by-looplet/scripts/autopilot.mjs) now invokes `node.exe` directly targeting the bundled entrypoint (`C:/Users/danie/tools/nodejs/node_modules/@google/gemini-cli/bundle/gemini.js`), passing clean, unescaped `argv` arrays. |
| **`Gemini CLI is not running in a trusted directory`** | Workspace folder not pre-trusted by Gemini CLI in headless mode. | Execution halts requiring interactive prompt confirmation. | **FIXED**: Added `--skip-trust` flag and `GEMINI_CLI_TRUST_WORKSPACE=true` environment variable to spawn config. |
| **Playwright Driver CDN 404 (`playwright-1.57.0-win32_x64.zip`)** | Playwright CDN returned 404 for driver binary download during headless browser subagent initialization on Windows. | Headless browser QA tool failed during test pass. | Handled via standalone dev server HTTP probing (`http://127.0.0.1:8080/`) and browser audit scripts. |
| **Windows PATH: Python Not Found** | System Python 3 alias not mapped in PowerShell PATH (`python` / `py` unlinked). | Direct shell invocation of Python takeoff scripts requires absolute interpreter path or virtualenv activation. | FastMCP server runs via Node or direct venv invocation; Python scripts in `engine/python/xray` remain self-contained. |

### B. Test Suite & Codebase Syntax Errors
| Surface | Finding / Error | Details & Blame | Action Required |
|---|---|---|---|
| **`scripts/grok-pwa-plugin.test.mjs`** | 4 assertion failures on injected metadata | Tests assert generic titles (`Solo`, `Wild Race`, `Cats & Dogs`), but production plugin now correctly injects branding `X-Ray by Looplet`. | Pre-existing test assertion mismatch against updated brand configuration. |
| **`scripts/with-app-env.test.mjs`** | `EPERM: operation not permitted, symlink` | Windows non-elevated shells forbid creating temporary directory symlinks without Developer Mode enabled. | Pre-existing OS restriction on Windows temp symlinks. |
| **`npm run check:auth`** | `could not read the dev server's resolved VITE_AUTH_ENABLED` | Auth invariant check script requires an active Vite dev server listening on `0.0.0.0:8080`. | Server was offline during test; starts automatically via `npm run dev` or `startup.sh`. |
| **`src/routes/__root.tsx`** | Query parameter import: `../styles.css?url` | Vite import query parameter `?url` flags as non-existent file in naive static path scanners. | **FIXED** in Sweeper import parser: query parameters are stripped before filesystem existence resolution. |

---

## 2. External Work & Cloudflare Worker Trajectory Shifts

### A. Production Web Worker (`looplet-crm-production`)
- **Account Cutover (2026-09-01 / 2026-09-02)**:
  - Daniel migrated all GitHub (`affordablefencinggc`) and Cloudflare accounts.
  - Production frontend is **not** Vercel and **not** Cloudflare Pages; it is Cloudflare **Worker** `looplet-crm-production`.
  - Deployment is driven by GitHub Actions (`.github/workflows/deploy-looplet-production.yml`) upon merging a PR into `main` (gated by `CLOUDFLARE_PRODUCTION_DEPLOY_ENABLED == 'true'`).
- **Worker Assets Routing Trap**:
  - Cloudflare Workers Assets rejects `public/_redirects` (triggers a 404 SPA loop).
  - The deployment workflow strips `dist/_redirects` before deploying. Manual wrangler deploys must explicitly remove `dist/_redirects`.

### B. MCP Worker (`cloudflare-workers/looplet-mcp`)
- **Name & Endpoints**:
  - Deploys as `looplet-remote-mcp` across custom domains:
    - `https://mcp.looplet.com.au/mcp`
    - `https://connect.looplet.com.au`
- **Authentication & Ticket Signing**:
  - Relies on encrypted Cloudflare Worker secrets:
    - `SUPABASE_ANON_KEY`
    - `SUPABASE_SERVICE_ROLE_KEY`
    - `MCP_BOOTSTRAP_TICKET_SIGNING_KEY`
  - Uses `BOOTSTRAP_TICKET_RATE_LIMITER` (10 requests / 60 seconds).
- **Course Alteration**:
  - The preview MCP Worker (`looplet-remote-mcp-preview.affordablefencinggc.workers.dev`) deploys via PR merge into `V4`.
  - The production MCP worker and DNS zone cutover to the new Cloudflare account was completed on 2026-09-02.

### C. Authentication & API Key Gates
- **Legacy Supabase Keys**:
  - Production `app.looplet.com.au` bundle still references the legacy anon key.
  - Disabling legacy keys in the Supabase dashboard immediately causes 401s on client bundles. Legacy keys must remain active until the client bundle is refreshed.
- **Outbound Send Mode Gate**:
  - If outbound messaging mode is set to `"hold"`, SMS, emails, and quote links are silently held without throwing an error. Always verify send mode before diagnosing messaging failures.

---

## 3. Database Migrations Audit & Drift Register

### A. Looplet Production Database (`afytnccutuurafmeymud`)
> [!CAUTION]
> **A naive `supabase db push` is STRICTLY FORBIDDEN.**  
> The production database and local migration directories have drifted bidirectionally. Running a blind push double-applies DDL and corrupts schema state.

1. **Timestamp Drift (Physically present in prod — DO NOT re-apply)**:
   - `message_reactions`: Production timestamp `20260831161648` vs local `20260901000000`.
   - `org_ai_key_model_selection`: Production timestamp `20260831184610` vs local `20260901050000` (`org_ai_keys.model` column already exists).
2. **Production-Only Migration (Missing local file)**:
   - `remove_tradify_columns` (`20260831145934`): Applied directly to prod DB; absent from local repository files.
3. **Pending / Untracked WIP Migrations (Do NOT auto-apply)**:
   - `document_library_folder_pin_locks` + `docbox_common_default_folders` (Docbox workspace).
   - `reconcile_browser_navigation_redelivery_cap` (P0 browser navigation command queue cap).
   - `staff_private_profiles` (permission isolation).
4. **Already Deployed MCP Features**:
   - `queue_mcp_browser_navigation`, `claim_mcp_browser_navigation_commands`, and `mcp_device_commands` are already in production. Stale docs claiming they are missing must be disregarded.

### B. X-Ray Takeoff Studio Migrations (`xray-by-looplet`)
- **Migrator**: [`scripts/migrate.mjs`](file:///c:/Users/danie/repo/xray-by-looplet/scripts/migrate.mjs).
- **Rule**:
  - Applies migrations on `npm run build` using node-postgres `pg`.
  - Non-recursive directory read: `migrations/auth/0001_auth.sql` is strictly opt-in and is **not** applied unless user accounts / auth are explicitly enabled.
  - In local development without `DATABASE_URL`, PGLite (`@electric-sql/pglite`) handles client-side embedded state.

---

## 4. Sweeper Verification & Remediation Checkpoints

The Sweeper ([`scripts/sweeper.mjs`](file:///c:/Users/danie/repo/xray-by-looplet/scripts/sweeper.mjs)) continuously monitors these surfaces:
1. **Conflict Markers (`<<<<<<<`)**: Scanned via `git diff --check` before every commit.
2. **Untracked File Salvage**: Untracked files logged to prevent drop sweeps.
3. **Import Graph**: All relative paths in `src/` and `scripts/` verified.
4. **Mind Map Progress**: Reconciled against [`XRAY-TOPDOWN-MINDMAP-TODO.md`](file:///c:/Users/danie/repo/xray-by-looplet/XRAY-TOPDOWN-MINDMAP-TODO.md).
