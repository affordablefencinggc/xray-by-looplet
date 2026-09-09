# Governed project memory — implementation contract

Requested by Daniel, 2026-09-09. Replaces chat-as-project-memory. The operating architecture is: versioned rules → live project registry and evidence graph → per-task work packet → short interaction window → deterministic assurance and human issue authority. Chat is a surface, never governing evidence.

## Delivery sequence and acceptance

- GP-01: Persist project-bound work packets and unabridged task events; refresh project/design/source identities before each model call and tool action; checkpoint before stopping; retain through chat clearing/reload. Unknown revision/status/role must stay unknown. No professional issuance. Local storage foundation first; shared deployment requires a selected service and verified project membership.
- GP-02: Relational project registry, locations, discipline membership and delegated authorities; immutable source artefacts, revision lineage and status records; source selection by purpose and explicit authority. Connect current imports, hashing, PDF extraction, OCR and models rather than replacing original bytes.
- GP-03: Evidence graph and registers (issues, RFIs, decisions, assumptions, risks, actions, approvals), structured findings/calculations/takeoffs, actionable citations and source-location navigation. No claim of observed/calculated without validated supporting references and methods.
- GP-04: Task workflow and acceptance tests, human review UX, revision-impact invalidation, draft packages and controlled exports. Authorisation bound to exact content hash, source versions, recipient, action and expiry; project permissions rechecked at execution. Source changes invalidate approvals. External actions use an idempotent transactional outbox.
- GP-05: IFC/IDS information checks, separate geometric clash engines, reproducible calculations and rule packs from licensed authoritative sources. Deterministic gates are mandatory; model-based agents may assist but cannot grant authority.
- GP-06: Supervised revision monitoring, targeted work queues, authorised CDE integrations and accountable issue delivery. Preserve X-Ray standalone scope; CRM is an optional finished-output boundary.

Each item needs source diff, executable evidence, failure cases and user-visible proof. These are planned slices, not completed claims.

## Model corrections

Keep evidence basis (observed/calculated/inferred/assumed), lifecycle (draft/current/review-required/superseded/blocked), review (unreviewed/approved/rejected), and confidence separate. Approval never changes an assumption into an observation. A hash proves identity, not correctness or authority.

No universal precedence ordering is assumed: a project's purpose and approved information-management rules resolve governing sources. Upload time never implies approval. Distinguish IFC file format from issued-for-construction status. Missing fields stay null with explicit blockers; do not invent authors, reviewers, coordinates, datum or standards.

Rules are immutable per version, superseded through controlled updates. Every event records the policy version. Local hash chains can expose modification relative to a retained anchor; they are not server-enforced immutability or authenticated signatures. Production audit needs protected append-only storage and trusted identity/time.

Raw artefacts and task events have explicit retention, access and backup policies. No silent 500-row eviction. Retrieval is project-filtered before relevance ranking; vector search supplements relational revision and relationship checks. A model-supplied project ID never grants access.

Separate model-input, live-interaction and storage/retrieval budgets. At 65% of the configured safe input allowance persist a semantic checkpoint and rebuild from stores. Never discard the in-flight tool call/receipt pair. Interrupted or uncertain mutations are reconciled before retry. A packet that cannot fit is durably blocked with an actionable reason.

## Standards scope

ISO 19650-1 provides an information-management framework covering exchange, recording, versioning and organisation through an asset lifecycle. This design is informed by that framework; implementation alone does not establish compliance. Official overview: https://www.iso.org/standard/68078.html

buildingSMART IDS validates IFC information requirements. It does not perform geometric clash detection; geometric and engineering checks need separate engines. Official scope: https://www.buildingsmart.org/standards/bsi-standards/information-delivery-specification-ids/

## Interface contract

Keep the user's current right assistant rail, square full-height edges, flush bottom, resize/collapse and matching seam controls. Add a compact work-packet status/evidence surface beside the existing canvas, with expandable detail; do not make chat take over the screen. All new top rows use AdjustableTopRow. Source links expose identity, revision, location, basis, review and dependencies.
