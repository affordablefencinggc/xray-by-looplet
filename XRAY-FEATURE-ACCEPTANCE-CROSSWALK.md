# X-Ray feature-to-acceptance crosswalk

Status: **planning and audit only; it does not start or complete a later slice**

This is the coverage index between the 139 uniquely identified product, engine, desktop, integration, release and dead-code rows in `XRAY-MASTER-LEDGER.md` and the ordered SC-00…SC-16 build/test/proof programme. It prevents a broad feature label, existing source file or passing narrow test from disappearing between the inventory and the caterpillar.

## Authoritative partitions

| Partition | Required inventory IDs | Rows | Detail |
|---|---|---:|---|
| Product and workbench | UI-001…UI-007; SITE-001…SITE-005; TRACE-001…TRACE-016; TAKE-001…TAKE-005; QUOTE-001…QUOTE-005; DATA-001…DATA-005 | 43 | `planning/crosswalk-product.md` |
| Engine and MCP | ENG-001…ENG-036; MCP-001…MCP-008 | 44 | `planning/crosswalk-engine.md` |
| Desktop, web, integration, release and legacy | DESK-001…DESK-011; WEB-001…WEB-004; CI-001…CI-009; CRM-001…CRM-003; SYNC-001…SYNC-002; SEC-001…SEC-002; OFF-001…OFF-003; AUTH-001; COLLAB-001; INT-001…INT-003; REL-001…REL-004; LEG-001…LEG-009 | 52 | `planning/crosswalk-release.md` |
| **Total** | Every inventory ID exactly once | **139** | Machine-verified by `scripts/verify-master-plan.mjs` |

The three partitions reference 45 residual acceptance rows, FC-001…FC-045, for requirements that were not already owned by BR/RP/PR/IR/DC:

- `planning/residual-acceptance-product.md`: FC-001…FC-010;
- `planning/residual-acceptance-engine.md`: FC-011…FC-043;
- `planning/residual-acceptance-release.md`: FC-044…FC-045.

## Row contract

Every partition row must retain the master-ledger ID and current state, then name:

1. the final disposition: retain, replace, remove, intentional-off, or decision-gated;
2. exactly one ordered SC-00…SC-16 owner;
3. exact existing BR/RP/PR/IR/DC acceptance IDs and, where the first audit found a gap, its exact FC residual acceptance ID;
4. a concrete build/change target;
5. deterministic machine proof;
6. human, visual, native, remote, or executed proof appropriate to the claim; and
7. the remaining gap without promoting planning to completion.

`NEW-REQUIRED` is forbidden in a finalized data row. The initial audit exposed 45 such gaps; they are now named FC-001…FC-045. An FC row is still planning—not completion—and must receive its named code/disposition diff plus executed and human proof in caterpillar order. Existing unknown executables, sidecars and installers are never executed or promoted as evidence. Auth and database persistence remain off until the SC-13 decision rows authorize a concrete identity/storage design.

## Caterpillar rule

The crosswalk may expose later work in parallel, but implementation and completion advance only through the single active slice recorded by the master ledger. A row is not complete until its owned code diff and its named executed/visual proof both exist. The active segment remains SC-07G; every later row is preflight only.
