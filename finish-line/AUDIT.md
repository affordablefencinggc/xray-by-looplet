# X-Ray by Looplet — Full Application Audit

*Generated 2026-10-11 · commit `ee4372e` · branch `main` · 358 tracked files*

---

## 1. Product definition

**X-Ray by Looplet** — a high-performance architectural construction-plan takeoff
studio. "PDF in, scale, mark, evidence, BOM — quantities never invented."
Fencing/construction company tool (affordablefencinggc): load a construction plan
(PDF/DXF/IFC/SVG), set scale, mark up quantities (length/area/count/sketch),
generate bills of materials, and push quotes into **Looplet CRM**. Ships as web
app (Vercel) and desktop app (Tauri).

## 2. Stack

| Layer | Technology |
|---|---|
| Web framework | Vite 8 + TanStack Start + TanStack Router (file routes) + nitro (`vercel` preset) |
| UI | React 19, Tailwind CSS 4, Radix UI, lucide-react, recharts, zustand (studio state) |
| Forms/validation | react-hook-form + zod |
### 3.2 Auth & gating (`src/lib/auth/`)
- `server.ts` / `client.ts` — better-auth wiring; `providers.ts` (OAuth provider catalog); `email-password.ts`.
- **Gate session layer**: `gate-session.server.ts` (12KB) — per-identity session issuance with marker (`gate-session-marker.ts`), verify (`verify.server.ts`), identity (`gate-identity.server.ts` + test), isolation (`isolation.server.ts` — per-user data separation), `middleware.ts`, `gates.tsx` (React gate components), `sign-in-gate.ts`, `popup.server.ts` (OAuth popup handled by vite middleware, not a route).
- `pglite-dialect.ts` — Kysely dialect over the shared PGLite so auth persists to the same embedded DB.
- `migrations/auth/0001_auth.sql` — auth schema; applied by `scripts/migrate.mjs` (CI runs it in build).

### 3.3 Database (`src/lib/db.ts`)
- Dual backend: **Neon** (`pg` pool) when `DATABASE_URL` set; **PGLite** WASM otherwise (preview/sandbox).
- Shared `Sql` surface (tagged template + `.query()`); type-normalization parity (OID int8→number, date→string, interval→text) so preview and prod return identical JSON-safe rows.
- Init promises on globalThis (HMR-safe); failed init clears slot for retry; atomic apply+record of migrations in a transaction; server-only guard (throws in browser).

### 3.4 App data (`src/lib/app-data/`) — viewer connector data
- Gate-served Google/Microsoft/etc. connector data; `client.server.ts` (10KB), `server-only.ts`, `login.ts`, typed `types.ts`, `errors.ts` + `app-data.test.ts` (12KB).

### 3.5 Takeoff engine (`engine/`)
- **Python `xray` package** (`engine/python/xray/`): sources (`sources/dxf.py` 19KB, `pdf.py`, `svg.py`, `ifc.py`, `base.py` — direct DXF/IFC/PDF parsing with layer extraction), `engine.py` (14KB orchestrator), `grammar.py`/`chains.py`/`orders.py`/`graph.py` (plan grammar → symbol chains → orders), `packs_*.py` (fencing/electrical/residential/structural/survey material packs), `quantify.py`, `fence_bom.py`, `assemblies.py`, `reassemble.py`, `markup_writer.py`, `wireframe.py` (15KB), `solid.py`, `scale.py`, `tables.py`, `rollup.py`, `ocr.py`, `advisor.py`, `hardening.py`, `preflight.py`, `report.py`, `cli.py`. Fixtures: 2 large PDF plans + electrical schedule + SVG.
- **FastMCP server** (`engine/server/mcp_server.py`) — exposes engine tools (`quote_lines.py`) over MCP; `test_mcp.py`. The **Rust host** (`engine/host/src/main.rs`, `lib.rs`) wraps/serves it for desktop sidecar use. `DESKTOP.md` documents the contract.
- Sidecar build: `scripts/build-sidecar.mjs` + `build-sidecar.py` → PyInstaller-style bundle for Tauri.

### 3.6 Routes & hosting glue
- `src/routes/__root.tsx` — app shell, PWA manifest, `PreviewHostBridge`, AuthProvider. `src/routes/index.tsx` — mounts Studio.
### 3.7 Tooling & automation (`scripts/`, root)
- `autopilot.mjs` — reads `- [ ] **CODE**:` tasks from `XRAY-TOPDOWN-MINDMAP-TODO.md`, spawns fresh agent sessions, verifies, ticks the list, syncs the HTML mindmap.
- `sweeper.mjs` — verification sweeper (git state, syntax, imports, stubs, TODO matrix, dev-server health); logs to `SWEEPER-VERIFICATION-LEDGER.md`.
- `with-app-env.mjs` — env merge wrapper for all dev/build commands (`.grok/app-env.json` + Vite env).
- `preview.mjs`, `browser-smoke.mjs`, `browser-guard.mjs` (loopback-only guard), `feature-audit.mjs`, `brand-check.mjs`, `check-auth-invariant.mjs`, `mcp-setup.mjs`, `migration-plan.mjs`, `write-atomic.mjs`, `preview-thumbnail.mjs` — all with colocated tests.
- `autopilot.ps1` / `sweeper.ps1` — Windows wrappers.
- **Ledger convention**: per-task ledger files (`XR-INT-CI-01-ledger.md`, `XR-ENG-IFC-01-ledger.md`, `XR-INT-CRM-02-ledger.md`).

### 3.8 Local-only (untracked) additions present in this working copy
- `cad/` — standalone HTML/JS takeoff tools: `cad.html`, `takeoff-geom.js`, `takeoff-measure.js`, `takeoff-snap.js`, `takeoff-recipe.js`, `takeoff-fence-bom.js`.
- `src/vendor/pdf.min.mjs` + `pdf.worker.min.mjs` — vendored pdf.js (excluded from typecheck).

## 4. Health at audit time
- ✅ Typecheck passes (0 errors, after excluding vendor + one strict-mode fix in `error-component.tsx`).
- ✅ `npm audit`: 0 vulnerabilities. ✅ Windows Defender: clean.
- ✅ Tests: node --test suites under `scripts/` + colocated `src/**/*.test.ts` (8 suites).
- ⚠️ Dev server binds `0.0.0.0:8080` (sandbox contract — fine in sandbox, change to loopback for local machines).
- ⚠️ `nitro` on a beta build; `recharts` v2 deprecated branch.
- ℹ️ Working copy has uncommitted: lockfile regen, tsconfig vendor exclude, error-component guard, `cad/`, `src/vendor/`.

## 5. Finish-line conveyor
See `LEDGER.md` + `LEDGER.json` (machine-readable) and `RUNBOOK.md`.
Runner: `node scripts/finish-line.mjs` — default **dry-run**; `--live` enables the
commit/push belt; `--deploy` additionally unlocks the production gate. The belt
halts on the first failed gate and never force-pushes.
- `server/middleware/grok-pwa.ts` + `scripts/grok-pwa-plugin.mjs` — PWA middleware + install page (`public/__grok/install`).
- `vite.config.ts` contracts (must be preserved): dev on `0.0.0.0:8080`; preview pinned to `127.0.0.1:8081`; nitro only on build/preview; `serverDir: "./server"`; PGLite bootstrap at dev-server start.
- Deploy: **Vercel** by platform; `npm run build` must produce `.vercel/output/` (CI uploads as artifact).
| Auth | better-auth (email/password + OAuth) + custom gate-session layer, jose JWT |
| Database | Neon Postgres (`DATABASE_URL`) with **PGLite (WASM) fallback**; Kysely dialect for auth; `migrations/*.sql` auto-applied |
| Takeoff engine | Python package `engine/python/xray` (FastMCP server) + Rust host (`engine/host`) as Tauri sidecar |
| Desktop | Tauri 2 (`src-tauri`), bundles `engine/python` as resources, sidecar build via `scripts/build-sidecar.mjs` |
| Multiplayer | PeerJS-style P2P (`src/lib/multiplayer/p2p.ts`) |
| CI | GitHub Actions: web+engine audit (typecheck/test/build/sidecar-dry) → Tauri matrix (ubuntu/windows) |
| PWA | `scripts/grok-pwa-plugin.mjs` generates manifest/icons under `public/__grok` |

## 3. Subsystem map (fine detail)

### 3.1 Studio (`src/studio/`) — the takeoff workspace
- **`Studio.tsx` (37KB)** — main UI shell; panes: overview/sheets/measure/sketch/components/model/review/cost/proof.
- **`IsoCanvas.tsx` (27KB)** — isometric 2.5D canvas renderer; plan/iso cameras, floor stacking (up to 100 storeys), explode-floors, surfaces.
- **`store.ts`** — zustand state: panes, sheet, skin (navy/paper), tools (length/area/count/sketch), markups (id/kind/label/value/unit/sheet/points), trades, camera (az/el/dist), scaleM, zoom/pan2d, snapping. Markup math: euclidean dist × scale, shoelace poly area.
- **`wireframeGl.ts`** — raw WebGL wireframe rendering. **`geometry.ts`** — sheet kinds & SHEETS catalog. **`faces.ts`** — face extrusion math. **`snapping.ts`** — point snapping. **`elevationStack.ts`** — highrise floor stacking. **`engine.ts`** — plan→takeoff engine glue. **`sync.ts`** — mindmap sync. **`crmBridge.ts`** — Looplet CRM direct quote push (queued sync). **`shortcuts.ts`** — keyboard map. Each has colocated `*.test.ts`.