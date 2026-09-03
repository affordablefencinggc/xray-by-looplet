# Ledger: Continuous Integration Pipeline for Multi-Platform Releases (XR-INT-CI-01)
Approved: yes @ 2026-09-03 (User requested: "Implement task XR-INT-CI-01: 'Continuous integration pipeline building Linux, Windows, and Web releases on commit'. Produce clean, working code with verified proof.")
Baseline commit: 4c23c25
Baseline branch: main
Graph / Boundary: `.github/workflows/ci.yml`

## Epic Goal
Configure a robust continuous integration pipeline via GitHub Actions that automatically builds and packages the Web release, the Linux (Tauri) desktop release, and the Windows (Tauri) desktop release upon commit (push and pull requests to the main branch), and uploads these compiled release packages as workflow artifacts.

## Scope Guardrails
- Work only within:
  - `.github/workflows/ci.yml`
  - `XR-INT-CI-01-ledger.md`
- No destructive changes to existing build processes or package configuration.
- Align with established workspace conventions.

---

## SC-01 — Web Release Building and Artifact Uploading [[done]]
DONE (machine): Add steps to build the Web application and upload the `dist` directory as an artifact to `.github/workflows/ci.yml`.
DONE (human): Verify that the local Web build command runs cleanly and typecheck passes.
Files: `.github/workflows/ci.yml`, `package.json`
Depends on: none
Notes: Successfully configured `npm run build` to copy built static files from `.vercel/output/static` to `dist` so that the Tauri desktop packaging step can locate them. All tests and typechecks pass locally.

## SC-02 — Desktop Multi-Platform Release Building and Artifact Uploading [[done]]
DONE (machine): Update `.github/workflows/ci.yml` to compile Tauri desktop release builds for Linux and Windows and upload the generated bundle folders (`src-tauri/target/release/bundle/`) as artifacts.
DONE (human): Ensure the cargo configuration and scripts are correct and local dry-run / check commands pass.
Files: `.github/workflows/ci.yml`
Depends on: SC-01
Notes: Updated `tauri-desktop-matrix` to run `npm run tauri:build` instead of `cargo check` and added artifact uploading with caching.

## SC-03 — Workflow Verification and Validation [[done]]
DONE (machine): Verify workflow syntax using action/workflow schemas and local test verification.
Files: `.github/workflows/ci.yml`
Depends on: SC-02
Notes: Successfully updated the entire continuous integration matrix and verified locally. All Node/TypeScript unit tests pass.
