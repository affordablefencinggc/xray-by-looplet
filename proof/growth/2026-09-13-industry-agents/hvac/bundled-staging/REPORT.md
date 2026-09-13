# Verified bundled engine staging

Helper scripts/stage-bundled-engine.ps1 SHA b09d1e02c2bc52039108aa16bfd7220ebbfa8613e3f8442efe632dab7fcdc55f. Exported function Invoke-VerifiedBundledEngineStage(PackageDir, ExpectedSha256, SourceRoot, ProofPath) returns only the qualified digest; does not mutate environment or execute engine/build commands.

DANS1: PowerShell AST accepted; ten functional positive/negative checks passed (result.json). Actual qualified package copied only into a disposable fixture. Invalid source bytes, unmanifested files, unsafe/duplicate manifest entries, wrong engine hash, failed fixture/parity evidence, paths outside XRayBuilds, and existing destination were rejected. Original qualified package was not modified. Failed-qualification tests mutate a separate disposable copy. All test processes exited.

Helper enforces DANS1 and absolute XRayBuilds-contained paths, reparse-free ancestry, manifest identity against both package source and current source, complete engine source inventory, successful build plus six exact named fixture checks and parity, pinned executable SHA, create-only output and proof. Copies exact binary to engine/bin/xray-engine.exe. Root owns manifest-qualified worker invocation, compile-time hash setting, resource map, and real installed-default acceptance.

Qualification JSON is trusted build evidence, not an independent rerun of fixtures; executable bytes are additionally pinned. This stage does not claim byte-reproducible PyInstaller builds or deployed installer readiness. No native package build was run by these tests.
