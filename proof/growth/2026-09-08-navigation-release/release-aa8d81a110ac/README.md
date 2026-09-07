# Final navigation hint-clearance candidate

Run `aa8d81a110ac` was built on DANS1 with the dedicated High-priority job-object policy and 16 workers. Dependencies, source-wide typecheck, all 110 focused tests, production web build and sequential Windows-native NSIS build passed. Web build: 4.36 seconds; native build: 146.15 seconds. These are measured cached-run results.

Source SHA-256: `aa8d81a110ac0aeb94a10d18d0bbd7a899737976f04725171773f60268ca8af3` (516 files). Native source SHA-256: `9e85e6501cbe8e92b7f504ba1b9b41b3be8268059955e065a852a1f032b2f6d7` (101 files). Post-build local verification reports all 617 source hashes unchanged.

Relative to `049d8ae830ee`, the only source change is `src/studio/sourceBuilding.css`, SHA-256 `d786488854b0e323dcee581c972996f58f3dac5bea4f58f505358f9231a478f9`. It adds scoped tablet navigation-hint clearance. Exact before/after copies and diff are retained in `../source-delta-hint/`; diff SHA-256 `156ce6d7291bbc3ee1680b598639c1c1e1daa348831e446b9e34340ca9d729cc`. Prior navigation functionality and evidence remain preserved; root owns final built/native clearance regression.

- Executable SHA-256: `d1a525d5b4a0abe323bb50cef803cef9236b8cda1c8e4974df0c90552c85a5d0`, 271,053,312 bytes.
- NSIS SHA-256: `605d372d1b7e374289bd4d4241f72882dcd7251cf3477b3809af1ab14ffff604`, 263,125,282 bytes.
- Artifact archive SHA-256: `8cc825cca7bedf57f6a1f656e1a4e300234ec7b47a4c459378ec1fa10c387552`, 535,901,696 bytes.

`native-completion.json`, `results.json` and `focused-tests.stdout.log` retain actual exits, counts and timings. `priority-observed.json` independently records the owned PowerShell/node/makensis process tree at High priority. `cargo-cache.json` records a verified copy from `049d8ae830ee` into an absent independent target. No shared target, moved cache, overwritten previous run or profile mutation occurred.

The final preview uses8089, retaining its SSH owner;8088 and earlier previews are preserved. Local archive verification, safe extraction and all 10 individual artifact hashes passed in `artifacts-verified.json`. No app launch or installation was performed by this worker. Root owns functional/visual acceptance.

Target scope remains tablet/laptop/desktop. No phone QA or CRM edits. R-02 collision support and native macOS/Linux packages remain open; the latter still encounter the Windows-only `build:cad` path. This candidate does not claim all-platform or full-register acceptance.
