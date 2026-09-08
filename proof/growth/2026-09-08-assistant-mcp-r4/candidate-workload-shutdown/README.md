# Native workload shutdown comparison - 71f5b012342b

**PASS for this bounded reproduction:** all 97 feature commands passed; the isolated native process then exited after a normal window close. The original hang is not explained or declared fixed.

- Exact executable SHA-256: `38c673ae5591c79ffda0fa283c6dc292118cfd2e6c1823b0f4660170ff474f3c`.
- Fresh process 23120; CDP 9276; isolated profile `C:\Users\danie\repo\xray-by-looplet\.temp\candidate-workload-shutdown-1788841898406`. No installation or normal user data used.
- Original status 11 commands: 0.5804883 s, exit 0.
- Original desktop model controls 34 commands: 2.0749992 s, exit 0.
- Original architectural drawing/undo/redo/reload 52 commands: 2.4047948 s, exit 0.
- Total feature execution: 5.0602823 s. Scenarios retain original order and predicates; only screenshot paths changed. No viewport emulation.
- CloseMainWindow accepted; WaitForExit true; process absent; zero remaining direct children. Request-to-observation approximately 515 ms. No force termination. Numeric process exit code was unavailable.

## Evidence

[Machine-readable result](acceptance.json), [launch identity](launch.json), [normal-close observation](normal-close.json), [scenario identities and screenshot paths](scenario-manifest.json). Original run reports and logs are referenced in acceptance.json. All five screenshots were visually inspected: workspace renders; tower and independent controls are present; the drawn line survives the tested undo/redo/reload sequence. The assistant shot captures its opening transition and is not a settled layout claim.

## Interpretation and limits

Earlier separate startup-only comparisons for previous build 38a64f0b8c2b and final build 71f5b012342b also exited normally. This fuller comparison omits the original failed viewport-emulation attempt. That difference is a possible factor, not proof of causation. The original process 53296 and its diagnostics were left untouched. No source edits or new build were made. PNG/PDF downloads were tested in production browser; native export downloads and physical tablet hardware were not accepted by this sequence. Tablet layout evidence uses browser viewport emulation.
