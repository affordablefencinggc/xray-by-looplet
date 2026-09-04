# X-Ray caterpillar execution map

Status: **orchestration contract; only SC-07G is active**

This map turns the feature inventory and acceptance contracts into an executable order. Parallel lanes are allowed only inside one wave after its entry gate is true. A wave closes only at its merge barrier, where the owned diffs and required machine plus human/visual/native/remote proof are reconciled. The next dependent wave cannot start because one lane finished early.

## Active-forward coverage

| Programme | Acceptance coverage | Expanded rows | Schedule |
|---|---|---:|---|
| SC-07G/I, SC-08, SC-09 | BR-001…BR-035; RP-001…RP-036; PR-001…PR-045; 22 owned FC rows | 138 | `planning/caterpillar-sc07-sc09.md` |
| SC-10, SC-11, SC-12 | IR-001…IR-018; DC-001…DC-086; 6 owned FC rows | 110 | `planning/caterpillar-sc10-sc12.md` |
| SC-13, SC-14, SC-15, SC-16 | IR-019…IR-112; 17 owned FC rows | 111 | `planning/caterpillar-sc13-sc16.md` |
| **Total** | Every BR/RP/PR/IR/DC/FC row from the active segment forward exactly once | **359** | Verified by `scripts/verify-master-plan.mjs` |

## Global ordering

```text
SC-07G transport proof
  -> SC-07I approved pack registry
  -> SC-08A source/review foundations
  -> SC-08A2..A6 dependent advisor/topology/gate/material/footing closure
  -> SC-08 Review + Proof continuation
  -> SC-09 local pricing
  -> SC-10 Looplet contract intake (external gate)
  -> SC-13 identity/storage decision
  -> SC-14 external transport

SC-07G -> SC-11 desktop package -> SC-12 continuity
SC-08  -> SC-12 archive/proof integration
SC-09  -> SC-11F native Cost parity

SC-11 + SC-12 + SC-14
  -> SC-15 current remote CI/security/provenance
  -> SC-16 signed release/update/rollback/recovery
```

SC-10 contract intake may be reviewed when owner inputs arrive, and SC-11 preparation may proceed after SC-07G, but neither bypasses its downstream merge barriers. SC-15 foundation work may be prepared without claiming remote evidence; release-candidate closure still waits for every required upstream slice.

## Parallel-lane contract

- Lane A owns schemas, domain invariants, policy and canonical fixtures.
- Lane B owns implementation and UI/runtime integration against Lane A's frozen contract.
- Lane C owns independent tests, evidence capture and proof-manifest verification.
- A file or schema owner belongs to only one lane in a wave. Cross-lane changes wait for the merge barrier and are integrated by the primary owner.
- Planning does not activate a slice. The master ledger's single active marker is authoritative.
- UI rows require inspected desktop/mobile or native captures. Backend, host and release rows require actual executed output or current external artifacts; prose and source presence are not proof.
- Existing unknown executables, sidecars and installers are never executed. GitHub, signing, external API, clean-machine and sandbox mutations require their stated authority and evidence.

## Current stop line

SC-07G remains at 34 verified, 1 partial, 0 open BR rows. The Windows BR-013 process-tree half passes; the matching current Unix execution artifact is absent. SC-07I is next and owns FC-017 only; FC-015 and FC-019–FC-022 wait for their SC-08A prerequisites. No schedule file may change those statuses.
