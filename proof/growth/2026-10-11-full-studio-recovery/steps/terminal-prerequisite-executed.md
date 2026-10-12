# Terminal prerequisite: separate executed worker and verifier

Date: October 12, 2026. Tested source:
`280c61a04886564dfba3f3918d6921e5a71a07e6` on
`recovery/full-studio-20261011`. This is local prerequisite proof only, **not
fresh engine qualification, full artifact authentication or app acceptance**.
No visual state changed; no new screenshot was required or captured.

## Requirement and unchanged code

Require a successful clean capped execution of the final 25 terminal-record
tests, then a separate independent execution. Relevant implementation was
committed in `067105e9`; authorization/handoff-only changes reached the tested
source above. Historical producer/helper, pin and phase-1 receipts stayed intact.

| Check | Worker `b212a4926b37` | Verifier `3b9ba15119a4` |
| --- | --- | --- |
| Actor | foreground-worker | independent-terminal-verifier |
| Preflight tests | 21 | 21 in 3.756 s |
| Preserved source/helper audit | 109 / 4 | 109 / 4 |
| Terminal-record tests | 25 | 25 in 11.081 s |
| Queried aggregate CPU cap | 20% | 20%, flags 5 / rate 2000 |
| Terminal / supervised child exits | 0 / 0 | 0 / 0 |
| Independently observed supervisor exit | supervisor terminal / absent | actual process exit 0 |
| Relevant source bytes | unchanged | seven before/after hashes unchanged |
| Worktree | clean | clean before and after |
| Cleanup | owner-only job accounting, observed owners absent | owner-only; all seven observed process identities absent twice |

The verifier retained a separate observer of the real supervisor process, rather
than treating its terminal JSON as proof of its own exit. No manual kills.
Verifier monitor/supervisor/runner PIDs: 88828 / 52632 / 97624. CIM's microsecond
timestamps and retained-handle 100ns timestamps were preserved without pretending
they had identical precision. One missing launch executable field was supplemented
by live CIM command/executable observation, documented in the independent report.

## Retained evidence

Absolute parent:
`C:\Users\danie\Documents\Codex\2026-10-03\qu\work\az-web-bundle-r2\xray-recovery-evidence`.

- Worker: `terminal-records-b212a4926b37`,
  `terminal-supervised-b212a4926b37.*`, `terminal-worker-b212a4926b37-verified.json`.
- Verifier: `terminal-records-3b9ba15119a4`,
  `terminal-supervised-3b9ba15119a4.*`,
  `terminal-independent-3b9ba15119a4.verification.json`,
  `terminal-independent-3b9ba15119a4.evidence-hashes.json`,
  `terminal-independent-3b9ba15119a4-report.md`.
- Human verifier report SHA-256, checked by the foreground:
  `6922ed2c63ed4b47704512bb9493f255cb87b0641dd1856010a6a7978a1fc0b1`.
- Reviewed external 360-second supervisor SHA-256:
  `1758f27ffd5c70a6e85ea749d939ff6dc23126e716452dcd65ffface9938eeac`.

## Limits and next engineering

The previous preflight timeouts were **not reproduced; their cause is unknown**.
No assertion failed in those timeout attempts. No claim of fixing their cause and
no deadline extension to the preserved preflight. Failed evidence remains retained.

Legacy owner exit JSON still lacks attempt/owner/hash binding. These synthetic
tests cannot authenticate engine execution or live DANS1 cleanup. An additive
artifact consistency validator and separately pinned trusted collection are next.
Root phase-1 ledger acceptance/status is not expanded by this proof. No DANS1
qualification, push, merge, promotion or installation occurred in these test runs.