# SC-06a — BOM parity in build-worker snapshots

The parity command previously compared kernels but failed while querying Git in the isolated DANS1 source snapshot. It now records `sourceState.kind=source-snapshot` with null Git identity when no checkout exists. Real checkouts retain their actual HEAD/dirty checks. All kernel, fixture and verifier hashes and all comparison predicates remain mandatory. An optional output path preserves historical receipts.

Executed [npm run test:bom-parity](../bom-parity-current/result.json): exit 0 on DANS1. [Full convergence manifest](../bom-parity-current/convergence.json) proves four fixtures match expected output in both TypeScript and Python and are byte-equivalent. The [original failure](../bom-parity.log) remains intact. [Exact implementation diff](../discussion-source.diff).

This is a nonvisual CLI change. The accompanying inspected [native material result](../../2026-09-13-industry-agents/roofing/native-ui/7a55-bundled/full-native-result.png) demonstrates the historical user-facing output of these kernels, not execution of the newly changed CLI or a new native build. The command's recorded output proves the changed snapshot behavior. [Checklist/document diff](../discussion-ledger.diff).
