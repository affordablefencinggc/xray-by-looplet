# SC-09 pricing and quote-composition acceptance contract

Status: **planned; not started**
Scope: reviewed `xray.bom/v1` snapshot → local supplier catalog and purchase mapping → deterministic priced quote snapshot → local quote export
Depends on: SC-08 immutable reviewed BOM/proof snapshot
Outside SC-09: Looplet transport/receipt (SC-10), packaged-native parity (SC-11F), whole-job archive (SC-12), accounts/cloud sync, live inventory, purchase orders and fabricated supplier lookup.

This is the build-and-proof contract for SC-09. A row is complete only when its named deterministic test passes and its named human/browser behavior is captured. Source presence, a plausible total or a disabled control is not proof.

## Non-negotiable boundaries

- SC-07 remains physical quantities only. Rates, amounts, tax, discounts, markup, margin, supplier IDs, order quantities, quote state, Looplet IDs and receipts must never enter `xray.job-to-bom/v1` or `xray.bom/v1`.
- SC-09 consumes a current immutable SC-08-reviewed BOM/proof binding. Editable, stale, blocked or merely generated BOMs cannot be priced.
- Measured BOM quantity is immutable evidence. Adjusted/purchase quantity, packs, cut plans, kerf, spare and remnant are separate derived records.
- Money never uses JavaScript/Python binary floating-point. Rates are bounded canonical decimal strings; monetary amounts are integer minor units. Every rounding point and operation stage is frozen and visible.
- Catalog import is local, explicit and previewed. Unknown, ambiguous, expired or unit-incompatible prices remain blockers; they never become zero or a guessed nearby SKU.
- Overrides are attributed, revision-checked and immutable in history. Pricing cannot override measured quantity, evidence or review decisions.
- Export handlers re-check current readiness. UI disabled state is not the safety boundary.
- No SC-09 action claims send, sync, receipt, purchase or Looplet success. Those belong to SC-10.

## Existing evidence and disposition

| Existing surface | SC-09 disposition |
|---|---|
| `BomPanel.tsx` and Cost workbench | Preserve the cream/charcoal flat quantity register and evidence drill-down. Add a distinct commercial composer only behind the reviewed-BOM gate. |
| `quoteReadiness.ts` | Keep as upstream job/original readiness. Add separately named review, catalog, mapping, quote and export readiness; never let this function imply price readiness. |
| `engine/python/xray/orders.py` | Reuse its bounded physical stock/cut concepts after a versioned application boundary is frozen. It may not calculate money. Decide TypeScript parity port versus packaged-host use before SC-09C. |
| `test_orders.py` | Retain as physical-kernel evidence. Add BOM-line-to-purchase cross-runtime/application fixtures; existing tests do not prove persistence, UI or pricing. |
| `engine/server/quote_lines.py` | Legacy reference only: it consumes old `TakeoffResult`, exposes a path and uses float rate/amount fields. It cannot feed production SC-09. |
| `fence_bom.py --prices` | Broken legacy hook importing absent `pricing.costing`. Keep unreachable and delete/quarantine after replacement proof; never restore it. |
| current Proof manifest export | Remains evidence-only. SC-09 creates a separate strict quote artifact bound to the SC-08 proof digest. |
| `QUOTE-001…005`, `ENG-015`, `ENG-028`, `ENG-029`, `LEG-005` | Replace partial/stub/broken/dead behavior only as matching PR rows gain proof; old feature labels prove nothing. |

## Ordered caterpillar slices

| Slice | Rows | Build outcome | Entry gate | Exit gate |
|---|---:|---|---|---|
| SC-09A — contracts | PR-001…PR-010 | Strict catalog, mapping, rules, quote, blocker and persistence contracts | SC-08 contracts frozen | Canonical fixtures/digests, strict rejection, migrations and SC-07 leakage audit pass |
| SC-09B — import/mapping | PR-011…PR-019 | Bounded CSV/JSON preview, atomic catalog commit, deterministic/manual mapping | SC-09A complete | Valid import and ambiguity flow pass; unmatched item stays blocked; rollback/reload proven |
| SC-09C — pricing engine | PR-020…PR-030 | Physical purchase conversion and exact pricing pipeline | SC-09B complete | Independent stage/golden/reconciliation tests pass; no UI claim |
| SC-09D — overrides/staleness | PR-031…PR-036 | Attributed revision-safe overrides, immutable audit and retained stale quotes | SC-09C complete | Concurrency, invalidation, rollback and reload pass |
| SC-09E — Cost UI/export | PR-037…PR-045 | Locked composer, blockers, evidence drill-down and exact local exports | SC-09D complete | Dev/production desktop/mobile flow and export reparse/reconciliation pass |

The caterpillar does not advance just because later code could be drafted independently. Each earlier exit gate must be captured first. SC-11 may prepare packaging in parallel, but native Cost parity waits for SC-09E and remains SC-11F evidence.

## Acceptance matrix

Proposed test names are stable acceptance identifiers. Implementations may group tests, but output and proof manifests must retain each `PR-nnn` ID.

### SC-09A — contracts

| ID | Requirement | Build target | Deterministic machine proof | Human/browser proof | Depends on |
|---|---|---|---|---|---|
| PR-001 | Accept only exact strict versions for catalog, mapping, pricing rules, quote snapshot/result and blockers; reject missing/legacy/future schemas and recursive unknown fields. | `pricingContract.ts`, JSON schemas, frozen fixtures | `PR-001 all_pricing_contract_versions_and_unknown_fields_are_exact` plus schema/TS parity | Field-by-field inspector shows the actual schema/version, never an inferred label | SC-08 schemas |
| PR-002 | Supplier ID/name/source and catalog positive revision, canonical digest and original-byte digest are explicit; filename never supplies identity; shuffled normalized input is byte/digest stable. | Supplier/catalog contract and canonicalizer | `PR-002 supplier_catalog_identity_revision_and_digest_goldens` | Preview requires supplier confirmation and displays revision/full digest | PR-001 |
| PR-003 | Effective interval, currency and tax policy are explicit: valid RFC 3339 bounds, one supported ISO 4217 currency per quote, declared tax mode/rate/source; expired, mixed or invalid values block. | Catalog/readiness and pricing-rules schemas | `PR-003 date_currency_tax_boundary_matrix` at boundary−1/exact/+1 | Current/future/expired status and currency/tax source remain visible | PR-002; D-01…03 |
| PR-004 | SKU normalization/uniqueness, closed sell/purchase units and explicit positive rational compatible-unit conversions are frozen; descriptions/fuzzy text are not identity. | Catalog item/unit schemas and index | `PR-004 sku_confusable_duplicate_unit_and_conversion_matrix` | Duplicate/confusable SKU and unit conversion appear as explicit rows/blockers | PR-001; D-04…05 |
| PR-005 | Pack size, minimum order, stocked length, kerf and availability are positive/bounded typed purchasing fields, separate from BOM; zero quantity/rate remains distinct from missing data. | Purchase-profile schema | `PR-005 purchasing_profile_boundaries_and_bom_separation` | Line detail separates measured, adjusted and purchase values | PR-004; `orders.py` concepts |
| PR-006 | Rates are bounded canonical non-negative decimals with explicit basis/scale; amounts are integer minor units; exponent, NaN/infinity, negative zero, excess precision and overflow fail. | Exact-money primitives | `PR-006 decimal_rate_minor_unit_precision_and_overflow` | Entered rate precision and rounded extension display separately | D-06 |
| PR-007 | Pricing rules have stable ID/revision/digest and freeze operation order, rounding, tax, mutually exclusive markup/margin and allowed adjustment capabilities. | Pricing-rules contract/canonicalizer | `PR-007 pricing_rules_digest_capabilities_and_operation_order` | Inspector lists numbered stages and exact rules version | PR-003, PR-006; D-02/D-07 |
| PR-008 | Pricing input accepts only a current immutable SC-08-reviewed BOM/proof and binds BOM input/output, review, proof, catalog, mapping and rules digests. | Quote-input compiler | `PR-008 editable_stale_unreviewed_or_misbound_input_never_compiles` | Blocker navigates to exact Review/Proof/catalog owner | SC-08; PR-002/007 |
| PR-009 | Quote snapshot/result is strict and immutable with stable quote ID/revision, source bindings, canonical lines/totals, attribution and closed safe error/blocker vocabulary; local persistence/migrations are atomic and reject corrupt/future state. | Quote schemas, canonicalizer, local persistence | `PR-009 quote_roundtrip_digest_error_vocabulary_migration_and_rollback` | Reload restores one coherent quote or actionable recovery, never mixed revisions | PR-001…008; D-10 |
| PR-010 | Every commercial field is rejected at every SC-07 nesting level; old takeoff/path/float/invented-rate hooks stay unreachable and absent from new imports. | Cross-contract and source/dependency audit | `PR-010 sc07_commercial_leakage_and_legacy_path_corpus` | Quantity register stays “quantities only” until separate composer is ready | SC-07 frozen |

### SC-09B — catalog import and mapping

| ID | Requirement | Build target | Deterministic machine proof | Human/browser proof | Depends on |
|---|---|---|---|---|---|
| PR-011 | Accept only explicitly versioned UTF-8 CSV/JSON by content, not extension/MIME; freeze BOM/CRLF/LF/quoting/embedded-newline/delimiter behavior and reject invalid encoding/truncation. | Catalog byte importer/parsers | `PR-011 format_content_encoding_and_csv_grammar_matrix` | Picker names formats; renamed/bad row content fails visibly with row/column | SC-09A; D-08 |
| PR-012 | Bound bytes, rows, columns, field bytes and parse duration before retention; test empty and boundary−1/exact/+1 without freezing UI. | Shared import limits | `PR-012 every_import_limit_minus_exact_plus_one` | Safe limit/progress/error/retry copy at desktop/mobile | PR-011; D-09 |
| PR-013 | CSV headers/JSON keys map through one strict template/version; missing/duplicate/unknown fields, duplicate SKU/mapping keys and conflicting rows block the whole import. | Template adapters/import validator | `PR-013 template_structure_duplicate_conflict_and_atomic_failure` | Preview groups structural/conflict failures and claims no partial success | PR-004, PR-011…012 |
| PR-014 | Formula prefixes, control characters, dangerous Unicode and spreadsheet payloads are inert/rejected on import and later CSV export. | Import/export sanitizer corpus | `PR-014 formula_injection_control_and_unicode_corpus` | Malicious cells never become formulas, links or executed preview content | PR-011/013 |
| PR-015 | Parse creates a deterministic non-durable full preview with supplier/revision/date/currency/digest and valid/blocking counts; commit requires explicit confirmation of exact preview digest; cancel/changed bytes commit nothing. | Import preview/state machine | `PR-015 preview_non_durable_confirm_cancel_and_toctou` | Inspect valid preview, cancel once, then changed file requires re-preview | PR-002/003, PR-011…014 |
| PR-016 | Automatic mapping uses stable BOM `itemCode` plus compatible unit/profile keys only; conversion applies once; descriptions, input order and fuzzy/cheapest guesses cannot select. | Mapping/conversion kernel | `PR-016 exact_mapping_conversion_shuffle_and_no_fuzzy_selection` | Auto row shows exact matching keys and before/after conversion | SC-07 IDs; PR-004/005 |
| PR-017 | Multiple catalog/supplier matches follow a frozen explicit selection/precedence or remain canonical bounded ambiguity; latest/cheapest is never silently chosen. | Catalog selection/mapping result | `PR-017 multi_catalog_precedence_candidate_bound_and_order` | Candidate comparison shows supplier/date/rate and why no winner exists | PR-003/016; D-11 |
| PR-018 | Manual mapping requires actor/time/reason and expected BOM/catalog/mapping revisions; chosen SKU/unit/profile is revalidated. Unmatched, expired, unavailable and incompatible states remain distinct blockers; zero price is valid. | Mapping command/history/readiness | `PR-018 attributed_stale_safe_manual_mapping_and_blocker_kinds` | Resolve one ambiguity while one unknown remains blocked | PR-003…005, PR-017 |
| PR-019 | Catalog commit and automatic/manual mappings are job-scoped and atomic; parse/storage/quota failure rolls back; reload verifies digests and never invents completion. | Catalog/mapping persistence transaction | `PR-019 import_mapping_rollback_quota_corruption_and_reload` | Valid catalog survives reload; simulated failure preserves prior catalog/mappings | PR-009, PR-015…018 |

### SC-09C — deterministic purchase and pricing engine

| ID | Requirement | Build target | Deterministic machine proof | Human/browser proof | Depends on |
|---|---|---|---|---|---|
| PR-020 | Pricing deep-reads but never mutates/rounds/replaces BOM measured quantities, units, line IDs, group keys or evidence. BOM line → purchase conversion has a versioned boundary and approved `orders.py` parity; money stays outside it. | Input/purchase adapter and fixtures | `PR-020 bom_immutable_and_purchase_conversion_cross_runtime_goldens` | Compare measured BOM and purchase result side-by-side | SC-08; `ENG-029`; D-12 |
| PR-021 | Physical allowances apply in declared order, then pack/minimum once; stock/cut choice reports kerf, reusable remnant and unopened spare; exact-search bound fails without claiming optimality, and sum-only input is labeled estimate. | Physical purchase kernel | `PR-021 allowance_pack_minimum_cutlist_counterexample_bound_and_shuffle` | Detail shows measured → allowance → cut/pack/minimum plus kerf/remnant/spare | PR-005/007/020 |
| PR-022 | Material extension uses purchase quantity × exact rate basis with its named rounding point; no float or early-rounding drift. | Exact-money material stage | `PR-022 material_extension_fractional_rate_and_rounding_goldens` | Line shows expression, unrounded basis and rounded amount | PR-006, PR-021 |
| PR-023 | Labour lines require explicit code, basis, quantity/unit, rate/source and productivity assumptions; no labour is inferred from materials or geometry. | Labour schema/calculator | `PR-023 labour_basis_productivity_rate_and_missing_assumption` | Every labour line expands to its rule/source | PR-007; D-13 |
| PR-024 | Delivery, demolition/removal and plant are separate explicit sourced lines with declared applicability/unit/duration/minimums; removal consumes reviewed BOM only; absent required source blocks rather than zero/percentage guess. | Ancillary line calculators | `PR-024 delivery_removal_plant_source_applicability_and_minimums` | Each section explains included/excluded basis and evidence | PR-007/008/020; D-14 |
| PR-025 | Discounts/adjustments require allowed type, exact bounded value, actor/reason and rule permission; they cannot make totals negative. Direct extension/subtotal/total edits fail. | Adjustment stage | `PR-025 adjustment_permission_attribution_bounds_and_no_direct_totals` | Before/after subtotal and provenance preview before confirm | PR-007/009 |
| PR-026 | Markup and gross margin use distinct formulas, are mutually exclusive under v1 and reject denominator zero or margin ≥100%; labels never collapse to ambiguous “%”. | Profit stage | `PR-026 markup_margin_non_commutativity_and_boundaries` | UI displays selected mode and full formula | PR-006/007; D-07 |
| PR-027 | Exclusive tax applies to frozen taxable bases; inclusive tax extracts exact tax and reconciles gross = net + tax; exempt/mixed/invalid modes are explicit. | Tax stages | `PR-027 inclusive_exclusive_exempt_tax_goldens_and_reconciliation` | Tax mode, taxable/exempt subtotals and tax source are visible | PR-003/006/025/026 |
| PR-028 | Frozen pipeline is physical conversion → materials/labour/delivery/removal/plant → adjustments → profit → tax → total; changed order changes rules digest/fails. | Pricing pipeline executor | `PR-028 operation_order_non_commutativity_stage_goldens` | Inspector lists numbered stages and their inputs/outputs | PR-021…027 |
| PR-029 | Lines, sections, subtotals, adjustments, tax and total reconcile exactly in minor units with deterministic residual allocation; zero is explicit and negative/precision/multiplication/size overflow fails closed. | Reconciliation/numeric guards | `PR-029 awkward_cent_reconciliation_zero_negative_overflow_and_limits` | Human adds displayed rows to exact displayed total/currency | PR-006, PR-028; D-06 |
| PR-030 | Identical bound input yields byte-identical quote body/totals/digest regardless of input order/retry; output rejects unknown fields and preserves every source/evidence binding. | Pure quote kernel/goldens | `PR-030 deterministic_shuffle_retry_strict_output_and_binding` | Recalculate unchanged shows identical digest and “no changes” | PR-008/009, PR-020…029 |

### SC-09D — overrides and staleness

| ID | Requirement | Build target | Deterministic machine proof | Human/browser proof | Depends on |
|---|---|---|---|---|---|
| PR-031 | Override record is strict: ID/revision, closed target/type, actor, reason, timestamp, canonical before/after and source bindings. Measured quantity/evidence/review/direct totals are never targets. | Override schema/policy | `PR-031 override_attribution_strictness_and_target_allowlist` | Quantity is read-only and attribution is never anonymous | SC-09C |
| PR-032 | Command requires expected quote/target revision and rejects stale, duplicate or concurrent writes without partial mutation. | Override reducer/store | `PR-032 stale_duplicate_concurrent_override_commands` | Race/conflict retains latest quote and shows resolution | PR-031 |
| PR-033 | Mapping/stock/rate/labour/ancillary/adjustment/profit/tax-rule overrides revalidate inputs and rerun the full pipeline; preview shows all affected before/after values. | Override commands/recalculator | `PR-033 every_allowed_override_revalidates_and_recalculates` | Apply mapping and rate overrides; packs/subtotals/total preview updates | PR-018, PR-021…030 |
| PR-034 | History is append-only/canonically ordered and retains superseded/reverted entries; undo is a new attributed inverse record. | Override audit log | `PR-034 immutable_history_revert_reload_and_shuffle_order` | Timeline explains current value and survives reload | PR-031…033 |
| PR-035 | Any bound BOM/review/proof/catalog/mapping/rules change retains but marks prior quote read-only stale with exact reasons; presentation-only changes do not. Current export blocks; regeneration creates a new revision and preserves diff/history. | Invalidation classifier/state machine | `PR-035 targeted_full_staleness_export_block_regenerate_and_diff` | Change catalog then BOM; inspect reasons, old/new diff and regeneration | PR-008/019/030/034 |
| PR-036 | Override/quote commits are atomic and job-scoped; storage/quota failure rolls back; reload recovers interrupted pending work without false completion. | Pricing persistence/store | `PR-036 override_quote_atomic_rollback_recovery_and_reload` | Failure preserves last valid quote; reload reports current/stale accurately | PR-009, PR-032…035 |

### SC-09E — Cost UI and export

| ID | Requirement | Build target | Deterministic machine proof | Human/browser proof | Depends on |
|---|---|---|---|---|---|
| PR-037 | Composer and every calculate/export handler recompute readiness from current reviewed BOM/proof/catalog/mapping/rules. Preserve the approved cream/charcoal ten-mode flat workbench; no stepper, green funnel, card stack or fixed action bar. | Cost controller/layout/styles | `PR-037 readiness_toctou_and_forbidden_ui_regression` plus render/style assertions | Inspect blocked/ready 1280×800 and 390×844 captures against references | SC-08; SC-09D; workbench contract |
| PR-038 | Header shows job/site, quote revision/attribution, all source revisions/digests, currency/tax and only approved estimator-authored notes/validity; no customer data is invented. | Quote header/editor/rail | `PR-038 header_binding_notes_validity_and_reload` | Owned fields edit/persist; derived bindings remain read-only | PR-009; D-15 |
| PR-039 | Each material row shows measured, adjusted and purchase quantity/unit, pack/minimum/cut method, SKU/rate basis/extension and supplier/catalog/effective metadata in distinct cells/detail. | Priced register/source inspector | `PR-039 every_display_cell_binds_exact_contract_field` | Worked fixture values and source of any rate are identifiable in two actions | PR-020…022 |
| PR-040 | Materials, labour, delivery, removal, plant, adjustments, profit, tax and total render/reconcile from snapshot; formula/allowance/assumption and BOM run/gate/photo drill-down retains selection and return path. | Quote summary/calculation/evidence inspector | `PR-040 rendered_sections_total_and_reference_integrity` | Add displayed values to exact total; priced line navigates to exact Measure evidence and back | PR-023…030; existing BOM drill-down |
| PR-041 | Typed unknown/ambiguous/expired/incompatible/calculation/persistence blockers and prior stale quote remain visible. Import UI supports choose → bounded preview → confirm/cancel/progress/error/retry; no background supplier-sync claim. | Blocker and catalog import UI | Exhaustive blocker rendering and import state-machine tests | Import valid catalog, cancel one and reject malicious/oversize input on desktop/mobile | PR-011…019, PR-035/036 |
| PR-042 | Mapping UI distinguishes auto/ambiguous/unmatched and keeps remaining blockers visible. Override UI requires actor/reason, shows before/after/conflict/history and exposes no quantity/direct-total edit. Stale UI lists reasons/diff/regenerate. | Mapping/override/stale panels | `PR-042 mapping_override_stale_ui_state_and_allowlist` | Resolve one ambiguity with one unknown left; apply/revert override; change catalog/BOM and regenerate after reload | PR-018/019, PR-031…036 |
| PR-043 | Authoritative versioned JSON export contains exact strict quote/source bindings and no originals, raw paths, secrets, SC-10 send/receipt fields or live timestamp mutation; reparse reproduces totals/digest. | JSON export contract/builder/parser | `PR-043 json_export_roundtrip_redaction_binding_and_determinism` | Download twice, independently inspect/reparse, verify declared byte identity | PR-009/010/030; D-16/17 |
| PR-044 | If retained for v1, CSV has frozen columns/order/decimal/currency/UTF-8/line-ending policy and neutralizes formulas in every text cell while reconciling with JSON. Export is atomic, size-bounded and fail-closed on stale-at-click/serialization/interruption with no partial success. | CSV/export controller | `PR-044 csv_golden_injection_reconciliation_and_export_failure_matrix` | Open/reparse CSV; malicious cells inert; stale/failure shows retry and preserves state | PR-014, PR-029, PR-035, PR-043; D-16 |
| PR-045 | Full import → preview → mapping → override → exact total → export → reload passes in development and production at desktop/mobile with keyboard/touch access, no console/page errors, overflow or network/send/receipt/purchase request. | Browser audit, production baseline and request/source audit | Audit binds script/source/fixture/export hashes and reparses totals; request log/source scan proves no external effects | Inspect success, blocker, conflict, stale and reload screenshots at 1280×800/390×844; footer says “priced locally — not sent” | PR-037…044; SC-10 not started |

## Required proof bundle

SC-09 cannot be marked complete without:

1. Canonical schema/digest fixtures and strict rejection output for PR-001…010.
2. Import/mapping corpus covering valid CSV/JSON, encoding, duplicate, ambiguity, expiry, injection, exact limits and rollback.
3. Independent pricing goldens printing each stage and reconciling exact minor units for tax modes, markup/margin, packs/minimums and awkward cents.
4. Purchase-conversion parity, or an explicit single-runtime decision with packaged proof assigned to SC-11F.
5. Persistence/reload/recovery output for catalogs, mappings, overrides, quote revisions and stale history.
6. Reparsed JSON/CSV exports whose bindings/totals exactly match the rendered snapshot.
7. Dev and production browser-audit JSON plus inspected 1280×800/390×844 success, blocked, override, stale and reload captures.
8. Source/network audit proving SC-07 stays commercially sterile and SC-09 performs no external handoff.

## Decisions to freeze before SC-09A exits

| Decision | Gap | Safe default / required choice |
|---|---|---|
| D-01 Currency | Supported set unspecified. | AUD-only v1; no exchange conversion unless explicitly expanded. |
| D-02 Tax | Jurisdiction/mode semantics unspecified. | Australian GST with explicit inclusive/exclusive/exempt rules and sourced rate. |
| D-03 Effective clock | Timezone/boundary unspecified. | RFC 3339 instants, UTC comparison, `[from,to)` unless date-only local semantics are approved. |
| D-04 SKU normalization | Case/space/Unicode policy absent. | Trim + Unicode NFC, preserve case identity, flag case-confusable duplicates. |
| D-05 Units | Commercial purchase units/conversions absent. | Closed compatible dimensions and positive rational factors; no free text/float factors. |
| D-06 Money | Ledger permits decimals/minor units but does not assign fields/rounding. | Rate decimal string, amount integer minor units, named `ROUND_HALF_UP` stages unless accounting review changes it. |
| D-07 Profit | Markup/margin ordering unspecified. | Mutually exclusive v1, after pre-profit adjustments and before tax. |
| D-08 Templates | CSV columns/JSON schema absent. | One versioned JSON schema and one exact CSV header template; reject unknown templates. |
| D-09 Limits | Import/calculation/export bounds absent. | Freeze conservative shared byte/row/field/time/quote limits and test −1/exact/+1. |
| D-10 Persistence | No account/cross-device ask. | Auth/database off; job-scoped local durable atomic migrations; supplier data stays on device. |
| D-11 Multiple suppliers | Selection/precedence absent. | Explicit active catalog/supplier; never auto-pick cheapest/newest across suppliers. |
| D-12 Purchase runtime | Python kernel proven; web cannot call it directly. | Choose a TS parity port plus Python goldens, or honest packaged-only availability; never divergent formulas. |
| D-13 Labour | Bases/productivity unspecified. | Freeze supported bases and explicit productivity/rate assumptions before lines exist. |
| D-14 Delivery/plant | Applicability/minimum units unspecified. | Explicit schemas/rules; no percentage shortcut unless approved and sourced. |
| D-15 Header | Numbering, validity, customer fields/notes unspecified. | Decide copied job/site vs authored vs absent fields; never invent customer data. |
| D-16 Exports | “Quote export” format unspecified; current draft is JSON only. | JSON authoritative. Decide whether CSV is v1 and whether human-facing PDF is SC-09 or later. |
| D-17 Export time | Immutable snapshot conflicts with live export timestamp. | Store creation attribution once; repeated export does not mutate canonical bytes. Any envelope timestamp is excluded/labeled. |

## Planning gaps

- SC-08 reviewed BOM/proof schemas do not yet exist, blocking PR-008/009/037.
- No catalog, mapping, rules, exact-money, override, quote or priced-export contract/fixture exists.
- Import templates/limits, tax policy and operation order are not frozen.
- `orders.py` proves physical conversion, not its `xray.bom/v1` application boundary, web availability, persistence or priced UI.
- `quote_lines.py` and `fence_bom.py --prices` are legacy/broken and prove no PR row.
- Current `quoteReadiness` is upstream only; current Cost proof stops at quantity-only BOM.
- Current Proof export is evidence-only with a live timestamp, not a canonical priced quote.
- Native parity remains SC-11F; external send/receipt remains solely SC-10.

Until PR-001…PR-045 and the proof bundle pass, SC-09 remains **pending**.
