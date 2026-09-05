// Explicit semantic allocation. No keyword classifier and no historical-status promotion.
export const profiles = {
  shell: ['reusable-universal', 'IW-010', 'Generic source and measurement workbench', 'Keep accessible responsive interaction and truthful states across workpackages; replace any fence-only routing or labels.'],
  source: ['reusable-universal', 'IW-005', 'Source identity, transforms and inspection', 'Retain source bytes, page identities and transform invariants across multiple document revisions; a page number alone is never identity.'],
  calibration: ['reusable-universal', 'IW-005', 'Verified geometry calibration', 'Retain explicit units and source-bound calibration; count evidence does not require a scale and geometry cannot borrow a different document calibration.'],
  area: ['reusable-universal', 'IW-011', 'Area and evidenced volume', 'Area is required by the approved industry scope; the old optional-area removal branch is superseded. Add explicit depth/native-volume evidence and unit-safe deductions.'],
  measurement: ['reusable-universal', 'IW-010', 'Count and length measurement interaction', 'Carry focus, snapping, viewport and edit invariants into count and length tools with revision-safe commands; fence-specific entity names are not universal requirements.'],
  fencing: ['compatibility-fencing', 'IW-013', 'Optional fencing pack and legacy preservation', 'Retain this fence/run/gate/recipe behavior only in a versioned optional fencing module; never make it a prerequisite or schema field for other trades.'],
  bridge: ['compatibility-fencing', 'IW-016', 'Frozen fencing host protocol', 'Preserve xray.job-to-bom/v1 and xray.bom/v1 without relabelling them industry-wide. Reuse boundary safety principles in a separately versioned generic protocol only after its own proof.'],
  review: ['reusable-universal', 'IW-012', 'Revision-aware quantity review and lineage', 'Rebind review to measurement, source, evidence, calibration and workpackage revisions, retaining immutable decisions and blockers; old run/gate/BOM evidence is not generic approval.'],
  proof: ['reusable-universal', 'IW-015', 'Verified local estimate and evidence export', 'Retain deterministic bounded proof, source locators and original-byte policies; expand inventory to all measurement kinds and separate quantity, purchase and price revisions.'],
  pricing: ['reusable-universal', 'IW-014', 'Exact AUD estimate and purchasing', 'Apply to reviewed generic quantities with separate purchase conversions, sourced rates, exact decimal rates and integer AUD minor units. Preserve blockers and never infer labour, depth, waste or missing prices.'],
  storage: ['reusable-universal', 'IW-022', 'Atomic local construction persistence', 'Use local revision-aware atomic commands and retain originals plus historical fencing extensions without rewriting old snapshots or requiring sign-in.'],
  continuity: ['reusable-universal', 'IW-017', 'Local archive and restart continuity', 'Extend complete-byte, transaction, quota and recovery requirements to multi-source and multi-trade jobs; preserve old versions and distinguish reload from cold offline proof.'],
  desktop: ['reusable-universal', 'IW-017', 'Source-built native package and transport', 'Retain packaged runtime, manifest, cancellation and clean-machine requirements; run a generic journey plus isolated fencing compatibility. Source tests cannot satisfy packaged proof.'],
  pipeline: ['reusable-universal', 'IW-013', 'Versioned isolated pack registry', 'Enable only explicitly proven pack versions and truthful capabilities; universal manual quantities remain available independently of detection or any optional pack.'],
  adapter: ['reusable-universal', 'IW-005', 'Bounded PDF/DXF/SVG source adapters', 'Preserve format-specific geometry, text, transforms, units and uncertainty with representative corpus proof. Imported proposals never silently become reviewed quantities.'],
  advisor: ['reusable-universal', 'IW-012', 'Source-bound advisory extraction', 'Retain evidence, confidence, ambiguity and deterministic limits; extraction and advice are non-authoritative until an attributed review explicitly accepts them.'],
  electrical: ['pending-analysis', 'IW-013', 'Proven electrical schedule pack', 'Industry-wide scope now includes electrical; define supported symbols/schedules, duplicate-count policy and a representative corpus before enabling this specialised pack. Manual electrical count must not wait for it.'],
  envelope: ['pending-analysis', 'IW-013', 'Proven residential envelope pack', 'Resolve non-rectangular topology, openings and reconciliation corpus for this specialised pack; manual floor/wall area and evidenced volume are already required scope.'],
  structural: ['pending-analysis', 'IW-013', 'Proven structural quantity pack', 'Specify layer/element semantics, units, supported outputs and representative corpus; quantity provenance cannot imply structural design certification.'],
  shed: ['pending-analysis', 'IW-013', 'Proven shed quantity pack', 'Resolve actual adapter support and bounded recipe outputs against representative projects; an existing fixture or fencing release gate does not establish capability.'],
  survey: ['pending-analysis', 'IW-013', 'Proven survey and terrain pack', 'Define CRS, units, point/mesh/elevation semantics and supported formats before terrain quantities are authoritative; generic volume cannot assume terrain depth.'],
  ifc: ['pending-analysis', 'IW-005', 'Explicit IFC source adapter subset', 'Specify IFC subset, units, placements, property identity and geometry corpus. A core model locator or native-volume type does not prove an IFC importer.'],
  ocr: ['pending-analysis', 'IW-005', 'Bounded local OCR source evidence', 'Resolve supported runtime, languages, confidence calibration and offline package budget before enabling OCR; scanned documents may still be measured manually.'],
  assembly: ['pending-analysis', 'IW-013', 'Proven assembly recipes', 'Define layers, openings, units, waste and explicit inputs with representative proof before publishing assembly quantities; no default multiplication can stand in for evidence.'],
  floor: ['pending-analysis', 'IW-013', 'Explicit floor replication and exceptions', 'Define level identity, transforms, repetition exceptions and review before automatic rollup; manual multi-floor workpackages must not be mistaken for recognised floors.'],
  integration: ['pending-analysis', 'IW-019', 'Optional Looplet handoff and receipt boundary', 'Retain this integration requirement conditionally; exact owner contracts, identity/storage design and sandbox receipts require separate analysis. It never blocks local source-to-estimate work or enables auth/database by implication.'],
  mcp: ['pending-analysis', 'IW-019', 'Optional bounded agent or HTTP service', 'Determine tool trust, operating ownership and path/capability policy before exposing a service; local actor attribution requires no login and no existing tool registration proves a supported product.'],
  off: ['reusable-universal', 'IW-019', 'Local-first auth and database invariant', 'Auth/database stay OFF for local work. Preserve the explicit decision boundary for optional integration without introducing reauthentication into the generic workbench.'],
  security: ['reusable-universal', 'IW-018', 'Fresh evidence and safe automation', 'Retain bounded non-disclosing diagnostics, source-bound evidence and command authority; stale logs, hashes alone and permissive automation cannot establish verified outcomes.'],
  release: ['reusable-universal', 'IW-020', 'Industry-wide release and provenance proof', 'Require current source-bound executed and visual evidence across universal count/length/area/volume, supported packs and declared platforms; historical checkmarks and unknown binaries are not release evidence.'],
  reconciliation: ['reusable-universal', 'IW-002', 'Historical source reconciliation', 'Preserve the historical source and its assertion verbatim while mapping current intent; do not import its completion state or delete its audit trail.'],
  retired: ['superseded-scope', 'IW-018', 'Retire misleading or unreachable legacy surfaces', 'Keep this as a historical requirement and account for removal/quarantine with proof. Demo geometry, fake progress, invented rates and dead controls have no authority in a source-to-estimate workflow.'],
  offline: ['pending-analysis', 'IW-017', 'Optional cold web offline capability', 'Separate normal local reload and packaged offline work from browser cold startup. Resolve service-worker/cache/update support explicitly; no offline claim follows from localStorage.'],
};

// Every feature is explicitly assigned; omissions and duplicate assignments fail generation.
export const featureGroups = {
  shell: 'UI-001 UI-003', retired: 'UI-002 UI-004 UI-005 SITE-005 TAKE-004 QUOTE-002 QUOTE-003 ENG-015 ENG-022 ENG-033 ENG-034 MCP-007 WEB-004 LEG-001 LEG-002 LEG-003 LEG-004 LEG-005 LEG-006 LEG-007 LEG-009',
  source: 'UI-006 UI-007 SITE-001 TRACE-001', storage: 'SITE-003 DATA-001 DATA-005',
  review: 'SITE-002 SITE-004 TAKE-002 TAKE-003 TAKE-005 ENG-032',
  fencing: 'TRACE-002 TRACE-003 TRACE-014 TRACE-015 TAKE-001 QUOTE-001 ENG-010 ENG-011 ENG-012 ENG-013 ENG-014',
  area: 'TRACE-004', measurement: 'TRACE-005 TRACE-006 TRACE-008 TRACE-009 TRACE-010 TRACE-011 TRACE-012 TRACE-013 TRACE-016', calibration: 'TRACE-007 ENG-006 MCP-005',
  proof: 'QUOTE-005 ENG-026 ENG-027', integration: 'QUOTE-004 ENG-028 MCP-004 CRM-001 CRM-002 CRM-003 SYNC-001 SYNC-002 AUTH-001 COLLAB-001 INT-001 INT-002 INT-003',
  adapter: 'DATA-002 ENG-002 ENG-003 ENG-021 ENG-023', off: 'DATA-003 SEC-001', pipeline: 'ENG-001 ENG-009', advisor: 'ENG-004 ENG-005 ENG-007 ENG-008 ENG-031',
  electrical: 'ENG-016', envelope: 'ENG-017', structural: 'ENG-018', shed: 'ENG-019', survey: 'ENG-020', ifc: 'ENG-024', ocr: 'ENG-025', pricing: 'ENG-029', assembly: 'ENG-030', floor: 'ENG-035', bridge: 'ENG-036 DESK-003 DESK-004',
  mcp: 'MCP-001 MCP-002 MCP-003 MCP-006 MCP-008', desktop: 'DESK-001 DESK-002 DESK-005 DESK-006 DESK-007 DESK-008 DESK-009 DESK-010 DESK-011',
  release: 'WEB-001 WEB-002 CI-001 CI-002 CI-003 CI-004 CI-005 CI-006 CI-007 CI-008 CI-009 REL-001 REL-002 REL-003 REL-004',
  offline: 'WEB-003 OFF-003', continuity: 'OFF-001 OFF-002 DATA-004', security: 'SEC-002', reconciliation: 'LEG-008',
};

export function featurePolicy() {
  const map = new Map();
  for (const [profile, ids] of Object.entries(featureGroups)) for (const id of ids.split(' ')) {
    if (map.has(id)) throw Error(`Duplicate policy: ${id}`);
    map.set(id, profile);
  }
  return map;
}

export function acceptanceProfile(id, cells, features) {
  const [prefix, number] = id.split('-'); const n = Number(number);
  if (prefix === 'BR') return 'bridge';
  if (prefix === 'RP') return n <= 17 || n === 31 || n === 32 || n === 35 ? 'review' : 'proof';
  if (prefix === 'PR') return 'pricing';
  if (prefix === 'IR') {
    if (n === 19 || n === 21) return 'off';
    if (n === 20 || n === 59) return 'security';
    if (n <= 60 || n === 103) return 'integration';
    if (n === 61 || n === 110) return 'reconciliation';
    return 'release';
  }
  if (prefix === 'DC') return n < 47 ? 'desktop' : n >= 77 && n <= 81 ? 'offline' : 'continuity';
  if (prefix === 'FC') {
    const override = { 1: 'source', 2: 'area', 5: 'source', 14: 'calibration', 17: 'pipeline', 29: 'retired', 35: 'proof', 36: 'retired', 37: 'retired', 41: 'calibration', 42: 'retired', 44: 'retired', 45: 'retired' };
    return override[n] || features.get(cells[2]);
  }
  throw Error(`Unallocated acceptance: ${id}`);
}

export const proposals = [
  { id: 'IW002-P01', task: 'IW-022', capability: 'Multi-source transaction and legacy coexistence', problem: 'Old job/run fields and single-document assumptions cannot be the construction persistence authority.', exit: 'Create electrical and flooring workpackages with identical sheet numbers from different documents; restart and migrate a legacy fixture losslessly; inject transaction failures and stale command races.', dependsOn: ['IW-004'], historical: ['DATA-001', 'DATA-005', 'DC-048', 'DC-062', 'DC-063'] },
  { id: 'IW002-P02', task: 'IW-010', capability: 'Count and length vertical journeys', problem: 'Historical manual tools centre fence runs/gates and lack a first-class evidence-linked electrical count workflow.', exit: 'Electrical count needs no calibration; pipe length requires verified units; duplicate contributions, changed sources and rejected evidence block. Prove edit/reload/review at desktop/mobile.', dependsOn: ['IW-022', 'IW-005'], historical: ['TRACE-002', 'TRACE-009', 'FC-006', 'RP-002'] },
  { id: 'IW002-P03', task: 'IW-011', capability: 'Flooring area and concrete volume journeys', problem: 'FC-002 allows removing area and no historical row fully specifies generic volume/depth provenance.', exit: 'Floor polygon with explicit deductions and concrete area×evidenced-depth/native-property volume; wrong-source/property, invalid units, zero/underflow/overflow and revision change fail closed. Review and reload with no fencing fields.', dependsOn: ['IW-022', 'IW-005'], historical: ['FC-002', 'TRACE-004', 'FC-022', 'FC-031'] },
  { id: 'IW002-P04', task: 'IW-012', capability: 'Generic review binding and repair loop', problem: 'Run/gate approval cannot certify a changed calibration, source revision, depth specification or workpackage.', exit: 'Immutable approve/reject history with optimistic concurrency; each binding mutation makes only dependent results stale; navigate blocker→source→repair→reapprove with captured evidence.', dependsOn: ['IW-010', 'IW-011'], historical: ['RP-001', 'RP-002', 'RP-003', 'RP-009', 'RP-031'] },
  { id: 'IW002-P05', task: 'IW-013', capability: 'Proven pack manifest and fencing isolation', problem: 'Old ordering requires fencing before every other trade; disabled specialist packs cannot be advertised as working.', exit: 'Versioned capabilities, representative electrical plus one other trade corpus, deterministic outputs, isolated failure and optional legacy fencing module. Manual universal takeoff works with all specialist packs disabled.', dependsOn: ['IW-012'], historical: ['FC-017', 'FC-018', 'FC-023', 'FC-024', 'FC-025', 'FC-026', 'FC-027', 'FC-033'] },
  { id: 'IW002-P06', task: 'IW-014', capability: 'Auditable AUD estimate vertical journey', problem: 'Frozen historical pricing consumes fencing BOM; universal measured/purchase/price separation requires integration.', exit: 'Import sourced AUD catalog, explicit mapping and purchase conversion; exact minor-unit total with labour/ancillary inputs, stale overrides and export/reopen. No default price or hidden allowance.', dependsOn: ['IW-012'], historical: ['PR-006', 'PR-020', 'PR-023', 'PR-024', 'PR-045'] },
  { id: 'IW002-P07', task: 'IW-005', capability: 'Format-specific source corpus', problem: 'PDF geometry, DXF text/transforms, SVG curves and IFC units/property identity were unresolved in old sources.', exit: 'Bounded corpus with crop/rotation and two same-number sheets; distinguish supported manual rendering from automatic extraction. Declare IFC/OCR subset before enablement.', dependsOn: ['IW-004'], historical: ['FC-011', 'FC-028', 'FC-030', 'FC-031', 'FC-032'] },
  { id: 'IW002-P08', task: 'IW-017', capability: 'Source-built native schema packaging and continuity', problem: 'CLI source compatibility does not prove schema bundling, native execution or no-network restart.', exit: 'IW-PACKAGE-SCHEMA bundles exact frozen schema digest, then package source-built sidecar and prove clean no-Python install, generic local workflow, network-denied restart and archive roundtrip.', dependsOn: ['IW-016', 'IW-015'], historical: ['DC-008', 'DC-011', 'DC-016', 'DC-038', 'DC-073', 'DC-084'] },
];

export const contradictions = [
  ['SCOPE-01', 'planning/crosswalk-engine.md', 'Fencing-first ordering and SC-16G exclusion of other trades conflict with approved industry-wide scope.', 'Universal tools proceed independently; specialist packs still need technical contracts and representative proof.'],
  ['SCOPE-02', 'planning/residual-acceptance-product.md', 'FC-002 retain-or-remove area is no longer an open product choice.', 'Area and explicit evidenced volume are required; preserve the old wording as history.'],
  ['SCOPE-03', 'XRAY-CATERPILLAR-EXECUTION-MAP.md', 'Historical single active SC-07G and all-later-stop gates conflict with the current industry dependency graph.', 'Preserve all 76 historical waves/merge barriers without applying them as new delivery authority; canonical writer owns current sequencing.'],
  ['SCOPE-04', 'SC07-BRIDGE-ACCEPTANCE.md', 'Frozen fencing protocol names are not generic construction schemas.', 'Compatibility remains xray.job-to-bom/v1 and xray.bom/v1; construction-job/v1 and quantity-result/v1 stay separate.'],
  ['SCOPE-05', 'SC10-SC13-SC16-INTEGRATION-RELEASE-ACCEPTANCE.md', 'Historical auth/outbox/external gates cannot be prerequisites for local measurement and estimates.', 'Auth/database OFF locally; separately scope optional handoff and receipt proof.'],
  ['SCOPE-06', 'XRAY-MASTER-LEDGER.md', 'Historical verified-web/kernel/restored labels do not establish current generic behavior or packaged support.', 'Every mapped implementation verification state remains not-assessed; tests of this crosswalk prove reconciliation only.'],
  ['SCOPE-07', 'planning/crosswalk-release.md', 'Demo 3D removal must not be confused with rejecting legitimate evidenced native model quantities.', 'Retire misleading presentation surfaces; separately prove source/model property identity and supported quantities.'],
];
