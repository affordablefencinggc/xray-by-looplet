# SC-08 Review and Proof Acceptance Contract

Status: **planned; execution waits for SC-07G**
Parent: `XRAY-MASTER-LEDGER.md` SC-08
Design boundary: `XRAY-WORKBENCH-CONTRACT.md`

This file is the proof checklist for the next caterpillar segment. A row is complete only when the implementation diff and the named executed or visual evidence both exist. Existing review, readiness and photo helpers are inputs, not proof that these requirements are complete.

## Frozen boundaries

- Review and proof consume the current verified job, original-asset readiness, canonical BOM snapshot, recipe decisions and their immutable bindings.
- A retained stale result remains inspectable but cannot be approved, exported as current, priced or sent.
- Review decisions are append-only records. Rejection always requires a reason; approval always records actor, time and exact bound revisions/digests.
- Proof export is local and deterministic. It is not a price, quote, external handoff or receipt.
- Manifest-only export never implies originals are included. Requested missing or corrupt originals fail the export closed.
- Workbench sheets are zero-based internally; marked PDF pages are one-based at the PDF boundary. SVG/DXF overlays remain their own artifact type.
- No authentication, database or external service is introduced by SC-08.

## Acceptance matrix

| ID | Feature / invariant | Build target | Machine proof | Human / visual proof |
|---|---|---|---|---|
| RP-001 | Strict versioned review-record schema | `src/studio/reviewContract.ts` | Round-trip, wrong-version, unknown-field and malformed-time tests | Inspector shows every persisted field |
| RP-002 | Review binding captures job/entity revision | Review contract | Changed job or entity revision rejects decision/restore | Stale badge identifies the changed entity |
| RP-003 | Review binding captures document SHA-256 | Review contract | One-byte source-hash change rejects current binding | Source hash visible in decision detail |
| RP-004 | Review binding captures BOM request/input/output identity | Review contract | Request ID/input digest/output digest mismatch table | BOM binding readable without raw JSON |
| RP-005 | Review binding captures recipe/ruleset revisions and digests | Review contract | Every changed binding field invalidates current review | Recipe and ruleset provenance visible |
| RP-006 | Canonical review bytes and digest | Review contract | Deterministic rerun and changed-byte goldens | Exported record can be inspected independently |
| RP-007 | Immutable approve history | `reviewCommands.ts` | Prior approvals remain unchanged after later decisions | Timeline displays both decisions |
| RP-008 | Immutable reject history with mandatory reason | Review commands | Blank reason rejected before mutation; reason round-trips | Reject action explains required reason |
| RP-009 | Optimistic concurrency on every decision | Review commands/store | Stale entity/job/review sequence rejects with no mutation | Stale action offers refresh, not silent retry |
| RP-010 | BOM issues become canonical blockers | Readiness adapter | Every BOM issue code/entity maps deterministically | Blocker opens exact issue and evidence |
| RP-011 | Every `needs-human` assumption remains a blocker | Readiness adapter | Accepted/reopened/stale assumption transition table | Blocker opens exact assumption decision |
| RP-012 | Transactional bulk approval | Review commands/store | Hidden/stale/blocking item aborts entire batch | Confirmation lists exact eligible items |
| RP-013 | Deterministic revision-diff schema | `revisionDiff.ts` | Canonical add/update/delete fixtures | Before/after layout is readable |
| RP-014 | Geometry and specification diffs | Revision diff | Run/gate vertex, length and field change table | Measure navigation selects affected entity |
| RP-015 | Evidence link/order/content diffs | Revision diff | Link/unlink/reorder/remove/hash-change fixtures | Photo and link changes are explicit |
| RP-016 | BOM binding and decision diffs | Revision diff | Current/stale/rebuild/decision fixtures | Cost and Review cross-navigation works |
| RP-017 | Bounded diff history | Revision diff/store | Limit boundary, deterministic truncation and reload | UI explains omitted older history |
| RP-018 | Strict proof-manifest/file/export schemas | `proofContract.ts` | Round-trip, version and unknown-field rejection | Field-by-field manifest inspector |
| RP-019 | Manifest binds all source and derived hashes | Proof builder | Changed source/photo/BOM/review byte fails verification | Hash status visible per artifact |
| RP-020 | Formula, assumption, issue, decision and diff inventory | Proof builder | Exact inclusion fixture with no orphan reference | Drill-down reaches every referenced record |
| RP-021 | Explicit included/omitted original policy | Proof builder | Manifest-only and originals-included goldens | Export selector names what will be omitted |
| RP-022 | Deterministic archive bytes | Proof writer | Two runs produce byte-identical bytes/hash | Independently list archive and inspect manifest |
| RP-023 | Safe archive names | Proof writer | Traversal, absolute, reserved, duplicate and case-collision table | Unsafe filename error names the source record safely |
| RP-024 | Export byte/count limits | Proof writer | Exact boundary and boundary-plus-one tests before write | Limit error preserves last valid export |
| RP-025 | Atomic interrupted export | Proof writer | Injected interruption leaves old target intact and no temp files | Retry succeeds without duplicate output |
| RP-026 | Missing/corrupt requested original fails closed | Proof builder/writer | Missing, hash mismatch and unreadable-byte tests | Actionable error points to the exact asset |
| RP-027 | PDF page mapping is exactly zero-to-one based | `markedSource.ts` | First, middle, last and out-of-range tests | Visual comparison labels correct PDF page |
| RP-028 | PDF crop/rotation transforms are deterministic | Marked source | 0/90/180/270°, CropBox/MediaBox fixtures | Overlay aligns with rendered source |
| RP-029 | PDF annotation output is deterministic | Marked source writer | Repeated output hash, stable IDs/times/order | Open rendered first/last annotated pages |
| RP-030 | SVG/DXF use standalone overlays | Marked source adapters | Correct artifact type and source binding; never PDF-labelled | Source and overlay inspected together |
| RP-031 | Review workspace supports blocker-to-entity repair loop | `ReviewPanel.tsx` / store | Browser flow: blocker → entity → repair → regenerate → reapprove | Desktop/mobile screenshots at each boundary |
| RP-032 | Review shows immutable timeline and revision diff | Review UI | Interaction/reload audit | Readable desktop/mobile comparisons |
| RP-033 | Proof workspace selects export policy | `ProofPanel.tsx` | Manifest-only/originals toggle and validation tests | Selection summary fits desktop/mobile |
| RP-034 | Export progress, cancel, error and retry are truthful | Proof UI/controller | Held writer, cancel race, failure retention and retry tests | No fake completion or blocked controls |
| RP-035 | Current/stale/corrupt/reload states are distinct | Review/Proof UI | Dev and built browser audit at 1280×800 and 390×844 | Screenshots for all four states |
| RP-036 | Commercial/external boundary stays explicit | Review/Proof UI and contracts | Forbidden price/quote/send/receipt field scan | Visible “not priced / not sent” statement |

## Ordered implementation slices

1. **SC-08A:** RP-001–006 and RP-018 contract schemas and canonical fixtures.
2. **SC-08B:** RP-007–012 review state machine, blockers and persistence.
3. **SC-08C:** RP-013–017 deterministic revision diff.
4. **SC-08D:** RP-019–026 manifest/archive generation and atomic export.
5. **SC-08E:** RP-027–030 marked-source adapters.
6. **SC-08F:** RP-031–036 Review/Proof UI, browser flows and visual proof.

## Required final evidence

- Focused TypeScript test log with every RP row mapped to a passing test.
- Canonical fixture hashes and independent archive verification log.
- Development and production browser verdict JSON.
- Desktop/mobile screenshots for current, stale, corrupt-original and reload states.
- Clean full `npm test`, typecheck, production build and `git diff --check`.
- A generated SC-08 proof manifest that reports zero partial/open rows before SC-09 starts.
