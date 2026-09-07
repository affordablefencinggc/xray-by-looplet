# Navigation release worker - 8 September 2026

Latest candidate: `aa8d81a110ac`, for the subsequent tablet navigation-hint clearance correction. Its independent release record is under `release-aa8d81a110ac/`. The `049d8ae830ee` evidence below is retained as the prior functional-pass candidate; see its `superseded.md` for the precise visual boundary. Earlier candidate evidence is not overwritten.

Final frozen candidate: `049d8ae830ee`. Source SHA-256 `049d8ae830ee3879139f3b686c3fd9f86aac3b0fc2aadaba33a82c67bbff62a2` (516 files); native source SHA-256 `9e85e6501cbe8e92b7f504ba1b9b41b3be8268059955e065a852a1f032b2f6d7` (101 files).

Dans1 dependency restore, source-wide typecheck, 110 focused tests, web production build and sequential native NSIS build all passed. Tests include `FirstPersonNavigation.test.ts` and `walkStartPlacement.test.ts` plus the earlier 95-test persistence/backup/sheet/pricing suite. Web build took 4.40 seconds; native build took 145.79 seconds. These are measurements of this cached run, not general performance guarantees.

Every step records its actual observed child PriorityClass as High, with 16 Rayon/Cargo workers. A separate descendant query was attempted after this final worker had already exited, so there is no extra live-process snapshot for this run. The previously verified dedicated Windows job-object policy remains the build configuration.

`transfer-final/` retains exact web/native manifests and archives. `source-delta-final/` preserves before/after source copies and the exact ten-path change against the last tablet release `c32e640187e9`; code diff SHA-256 is `b3df265d0449798e1b93e41ecb374228c9631d26513392c44fec9a57ee8d9d19`. Final post-build local verification matched all 617 source files with zero drift, recorded in `release-049d8ae830ee/source-drift.json`.

## Artifacts and production preview

- Executable SHA-256: `d108fd57a447e90b5478add9661f51e594be6fbaad471e156b269db6506194a2` (271,053,312 bytes).
- NSIS SHA-256: `90ba49a346fac1a05941ee8dc7eb560d7d77444cd0c68d9c56e23135a568c6a2` (263,129,145 bytes).
- Artifact archive SHA-256: `6a45399851298b75dd4b21791bb637788fb6cac4c2052e87e27ae8d6f072dd4a` (535,905,792 bytes).

Independent local archive verification, safe extraction and all 10 individual-artifact hash checks passed in `release-049d8ae830ee/artifacts-verified.json`. Root owns browser/native functional and visual QA; builds or HTTP200 alone do not establish navigation acceptance. This worker performed no application launch or installation.

The final production preview is served on Dans1 loopback8088 and forwarded locally, with its owning SSH session retained. Prior previews, source runs, artifacts and normal user profiles are preserved. The successful but visually superseded `527de32b75e2` candidate was not previewed or installed. Its native target was independently copied into the new run only after source/completion/executable hash checks; no cache directory is shared or moved.

## Retained failures and scope

The first candidate was superseded because live tablet QA found undersized upper Fly/Walk controls. Final source includes the scoped toolbar and walk-dialog button corrections. See `release-527de32b75e2/superseded.md` for the retained boundary.

Movement tooling's initial readiness predicate was corrected to wait for a rendered frame after arrival before reading yaw; that was a test timing issue, not a movement defect. One repeated source-walk screenshot prefix replaced earlier ground movement images; the distinct ground interior image and executed logs remain, and the missing images are not claimed as retained. All subsequent runs must use unique platform/floor/attempt prefixes. See `movement-tooling.md`.

R-02 remains bounded: working navigation/start/fallback does not establish collision avoidance where the app explicitly allows passing through walls. Target devices are tablet/laptop/desktop, with phone QA excluded. Windows-native and separately exercised browser behavior do not establish native macOS/Linux support: the current `build:cad` path throws on non-Windows platforms and remains an open build dependency. No CRM code changes, staff transmission, installation or overall professional-register readiness claim is made here.
