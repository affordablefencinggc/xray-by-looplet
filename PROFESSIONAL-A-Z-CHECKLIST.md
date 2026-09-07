# Professional workspace: A–Z requirements and proof checklist

Research checked 2026-09-07. 364 requirements, 26 categories, 68 industry/professional profiles and 33 primary-source references.

User authorization: “smoke testing as you go with screenshots of proof means ticked off a list” and an extensive A–Z across relevant industries and use cases. Work continues on feat/architect-cad-engine, baseline 3e422f0084de607a775c2ede8dfecdf0b032c75e, preserving prior work and user data.

This is the expanded scope register. It does not replace the historical 150-feature ledger or promote prior evidence to current acceptance. Vendor documentation establishes benchmark coverage, not an independently ranked market-share survey or proof of X-Ray capabilities. Requirements and tests below are our synthesis. No finite catalogue guarantees every specialist use case; new disciplines, format variants and jurisdiction requirements must enter this register with explicit acceptance before a readiness claim.

**Tick rule:** a requirement remains unchecked until its complete stated behavior has a matching code diff, executed test/log, inspected screenshot where visual, source/fixture identity, tested platform/build and reviewer/date. A screenshot alone cannot prove persistence, arithmetic, access control or delivery. Historical evidence and partial implementations do not count as current full passes. Changes affecting a dependency reopen its acceptance. Industry readiness additionally requires all applicable rows and its full working-day scenario to pass.

Delivery states: not-assessed → gap / partial / in-progress / failed / dependency-blocked → verified. No implied completion from a vendor feature, an installed package, a visible button or a green build.

Read-only searchable report: public/industry-coverage/index.html. Portable CSV/JSON are beside it. Source: planning/professional-coverage/. Regenerate with node planning/professional-coverage/generate.mjs.

## Current concrete findings

| User concern | Current assessment | Evidence boundary / next acceptance |
|---|---|---|
| Saving | Code exists; fresh daily audit open | Architect design uses saveArchitect and backup/restore; other inventories have separate persistence. This does not prove one complete project backup. Relevant rows: B-02,B-04,B-09. Code: src/studio/architect/persistence.ts; src/studio/store.ts; src/studio/construction/projectMaterials.ts. |
| Archive/store away | Gap; unified lifecycle not established | Document workspaces preserve per-source work, but a user-facing whole-project archive/restore workflow still needs implementation and end-to-end proof. Relevant rows: B-07,B-08. Code: src/studio/documentWorkspaces.ts. |
| Name sheets | Partial | Architectural sheet number is editable. Source-sheet display names, drawing titles, groups and persistent rename need separate acceptance. Relevant rows: D-02. Code: src/studio/architect/ArchitectSheets.tsx. |
| Remove sheets | Gap | Viewport removal exists inside one architectural sheet; this is not source-sheet removal, impact review or a recycle bin. Relevant rows: D-04,D-05. Code: src/studio/architect/ArchitectSheets.tsx; src/studio/store.ts. |
| Multiple authored sheets | Partial | Architect model currently has one sheet with up to four viewports. A proper named sheet-set lifecycle remains open. Relevant rows: D-03,D-06,D-13. Code: src/studio/architect/model.ts; src/studio/architect/ArchitectSheets.tsx. |
| Apply pricing sheets | Partial rates; workbook workflow missing | Wall layers accept manual rates and supplier references. Workbook selection/mapping, currency/tax normalization and reviewed bulk application remain open. Relevant rows: E-01,E-02,E-04,E-06. Code: src/studio/architect/ArchitectInspector.tsx; src/studio/architect/ArchitectWorkspace.tsx. |
| Firecrawl pricing | Integration gap | Official v2 API supports search/scrape. Application integration, credential provisioning, bounded live test and rate-review proof remain open. Relevant rows: P-01,P-03,P-08,P-09. Code: planning/professional-coverage/catalogue.mjs. |
| Forward to staff | Partial exports; live handoff unavailable | Current CRM bridge explicitly returns an unavailable result. A complete portable package and authenticated transmission/receipt are separate deliverables. Relevant rows: V-03,V-05,V-06. Code: src/studio/crmBridge.ts; src/studio/TakeoffTransferPanel.tsx. |
| DWG | Implemented; bounded native checks pass | Independent readback verifies a 431-entity two-level fixture and the 412-entity UI export. Native import/cancel/undo/redo pass after correcting stale level selection. Final installation is tracked in DWG-TODO.md. Relevant rows: I-02,C-14. Code: src-tauri/src/cad.rs; src/studio/architect/ArchitectCadExchange.tsx; DWG-TODO.md. |
| Roof facade | Geometry and native visual checks pass | Redburn gables now have intersecting slopes and host-roof cutouts. Geometry regression, development and native screenshots exist. Final installed delivery remains a separate check. Relevant rows: R-06. Code: scripts/build-redburn-model.mjs; src/studio/redburnBuilding.test.ts. |
| Engineering readiness | Unassessed by discipline | A model or export does not establish a validated structural, hydraulic, electrical or geotechnical solver. Benchmark validation and qualified review remain separate gates. Relevant rows: H-03,N-03,S-04,Q-08,Q-10. Code: planning/professional-coverage/industries.mjs. |

## Delivery sequence and dependencies

1. Finish current roof/DWG fixes and their native, installed and web proof. An undo crash discovered in the new import scenario must pass regression before closure.
2. Establish one project lifecycle: stable project/document/sheet IDs, full backup asset manifest, save feedback, reopen, archive/restore and concurrent-edit protection (B, D, V).
3. Add complete named sheet sets and safe sheet removal/recovery; maintain source hashes and dependent takeoff links (D, T).
4. Build rate books, worksheet/column mapping and reviewed application with units/currency/tax/date provenance (E). Costs must not reinterpret measured quantities.
5. Integrate bounded Firecrawl search using native/server credentials; gather candidates and source evidence, then require review before applying a rate (P, X). Live provider test requires an actual configured credential; mocked responses only prove error/control paths.
6. Complete portable staff handoff, then authenticated team storage, permissions, invitations and durable delivery receipts (A, B, V). Preparing a package is distinct from sending it; external sending requires an explicit instruction naming the recipient.
7. Deliver discipline scenarios against the shared primitives. Specialist solvers, standards content, hardware formats and proprietary integrations need separately validated engines or licensed adapters (G–O, S, W, Y).
8. Run complete working-day and disaster-recovery scenarios, reopen impacted checks after changes, then close only the matching platform-specific release rows (Q, Z).

These are implementation waves, not a narrowing of the catalogue. All categories remain in scope; dependencies determine delivery order. Credentials, commercial licenses, specialist validation and live recipient access are recorded when encountered rather than represented as working features.

## Universal working-day acceptance

Every industry profile below inherits these steps. Run with a representative source fixture, two named staff roles where applicable, a supplier sheet with mixed units, a controlled revision and a fresh recovery profile. Retain before/after screenshots, assertions, outputs and hashes.

| ID | Stage | Scenario | Categories |
|---|---|---|---|
| DAY-01 | Start/reopen | Open the correct job after a full restart; confirm identity, latest revision, source availability, permissions and unsaved-change status. | A,B,D,U |
| DAY-02 | Receive work | Import a new source/revision, name and group its sheets, verify scale/origin, compare changes and retain the prior issue. | C,D,G,I |
| DAY-03 | Design/measure | Perform the profile-specific drawing, modeling or measurement; edit, undo and redo; verify associated schedules and quantities. | C,H,L,M,N,R,S,T,Y |
| DAY-04 | Check/review | Run appropriate geometric/information/calculation checks; record source, assumptions, issues and an authorized review decision. | Q,R,S,W |
| DAY-05 | Price/procure | Import a supplier workbook or request bounded pricing research; compare units and variants; approve selected rates; reconcile the estimate. | E,P,T |
| DAY-06 | Issue/handoff | Select exact drawings, evidence and commercial content; prepare package for named staff; verify recipient access/import and durable receipt where sending is implemented. | D,I,V |
| DAY-07 | Use on site | Open offline field package, record an inspection/change/photo and synchronize with conflict review when reconnected. | F,O,V |
| DAY-08 | End/recover | Save, export complete backup, archive and restore; on clean profile verify originals, design, quantities, prices and history. | B,Q,Z |

## A–Z requirements

### A — Administration, accounts and access

Benchmark references: [Graphisoft BIMcloud teams](https://helpcenter.graphisoft.com/user-guide/134439/), [Autodesk Forma construction document management](https://construction.autodesk.com/workflows/construction-document-management/), [Oracle Aconex](https://www.oracle.com/construction-engineering/aconex/). These references inform the category; each acceptance requirement is X-Ray's own target.

- [ ] **A-01 Organization workspaces** — Two companies cannot read each other's project records. State: not-assessed. Code/proof: pending.
- [ ] **A-02 Individual sign-in and sign-out** — Sign-out removes access and cached private views. State: not-assessed. Code/proof: pending.
- [ ] **A-03 Staff invitations** — An accepted invitation grants only the invited role. State: not-assessed. Code/proof: pending.
- [ ] **A-04 Project roles** — Viewer cannot edit; estimator cannot approve engineering. State: not-assessed. Code/proof: pending.
- [ ] **A-05 Document and field permissions** — Restricted rates remain hidden in screens and exports. State: not-assessed. Code/proof: pending.
- [ ] **A-06 External guest access** — Guest sees only explicitly shared packages. State: not-assessed. Code/proof: pending.
- [ ] **A-07 Access revocation** — Previously valid links and sessions lose access when revoked. State: not-assessed. Code/proof: pending.
- [ ] **A-08 Multi-factor and enterprise identity** — Enforced identity policy survives account recovery. State: not-assessed. Code/proof: pending.
- [ ] **A-09 Staff directory and teams** — Reassignment preserves historical authorship. State: not-assessed. Code/proof: pending.
- [ ] **A-10 Audit trail** — Actor, time, action and affected revision are recorded. State: not-assessed. Code/proof: pending.
- [ ] **A-11 Account recovery and offboarding** — Removed staff cannot retain active organization access. State: not-assessed. Code/proof: pending.
- [ ] **A-12 Regional settings** — Units, currency, date and timezone are explicit per project. State: not-assessed. Code/proof: pending.
- [ ] **A-13 Custom fields and classifications** — Required fields validate and survive export/import. State: not-assessed. Code/proof: pending.
- [ ] **A-14 Organization templates** — Template revisions do not silently alter existing projects. State: not-assessed. Code/proof: pending.

### B — Backups, saving and project lifecycle

Benchmark references: [Autodesk Forma construction document management](https://construction.autodesk.com/workflows/construction-document-management/), [Oracle Aconex](https://www.oracle.com/construction-engineering/aconex/). These references inform the category; each acceptance requirement is X-Ray's own target.

- [ ] **B-01 Create and name projects** — Unique IDs survive duplicate display names. State: not-assessed. Code/proof: pending.
- [ ] **B-02 Automatic save feedback** — Saved appears only after durable storage succeeds. State: not-assessed. Code/proof: pending.
- [ ] **B-03 Save As and duplicate** — Copy gets new identity without sharing mutable records. State: not-assessed. Code/proof: pending.
- [ ] **B-04 Reopen recent projects** — Latest saved revision and source sheets return after restart. State: not-assessed. Code/proof: pending.
- [ ] **B-05 Offline local storage** — Airplane-mode restart restores drawings and attached originals. State: not-assessed. Code/proof: pending.
- [ ] **B-06 Cross-device project storage** — Authorized second device opens the same confirmed revision. State: not-assessed. Code/proof: pending.
- [ ] **B-07 Archive and restore projects** — Archived jobs leave the active list and restore intact. State: not-assessed. Code/proof: pending.
- [ ] **B-08 Recycle bin** — Accidental removal is recoverable with links and history intact. State: not-assessed. Code/proof: pending.
- [ ] **B-09 Portable complete backup** — Restore on a clean profile includes sources, models, rates and evidence. State: not-assessed. Code/proof: pending.
- [ ] **B-10 Backup integrity preview** — Corrupt or missing assets block replacement before any write. State: not-assessed. Code/proof: pending.
- [ ] **B-11 Crash and interrupted-write recovery** — Last confirmed snapshot survives forced termination. State: not-assessed. Code/proof: pending.
- [ ] **B-12 Concurrent edit protection** — Stale writer cannot silently overwrite a newer revision. State: not-assessed. Code/proof: pending.
- [ ] **B-13 Storage failure recovery** — Full disk/quota error preserves previous data and supports retry. State: not-assessed. Code/proof: pending.
- [ ] **B-14 Migration and retention** — Older supported backups upgrade with a reversible audit record. State: not-assessed. Code/proof: pending.

### C — CAD precision and drawing tools

Benchmark references: [Autodesk AutoCAD](https://www.autodesk.com/products/autocad). These references inform the category; each acceptance requirement is X-Ray's own target.

- [ ] **C-01 Lines, polylines, arcs and circles** — Exact coordinates survive save and CAD exchange. State: not-assessed. Code/proof: pending.
- [ ] **C-02 Splines and curves** — Control points and curve tolerance survive supported exchanges. State: not-assessed. Code/proof: pending.
- [ ] **C-03 Object snaps and tracking** — Endpoint, midpoint, perpendicular and intersection picks are correct. State: not-assessed. Code/proof: pending.
- [ ] **C-04 Numeric and relative entry** — Typed distance/angle yields the expected measured geometry. State: not-assessed. Code/proof: pending.
- [ ] **C-05 Coordinate systems and origins** — Local and project origins transform without drift. State: not-assessed. Code/proof: pending.
- [ ] **C-06 Layers and visibility** — Hidden, locked and isolated layers retain correct entity membership. State: not-assessed. Code/proof: pending.
- [ ] **C-07 Selection and properties** — Window/crossing selection and batch edits affect intended objects only. State: not-assessed. Code/proof: pending.
- [ ] **C-08 Move, rotate, scale and copy** — Transform and undo preserve dimensions and IDs. State: not-assessed. Code/proof: pending.
- [ ] **C-09 Offset, trim, extend and fillet** — Edge cases retain valid connected geometry. State: not-assessed. Code/proof: pending.
- [ ] **C-10 Blocks and reusable symbols** — Definition update changes intended instances without broken attributes. State: not-assessed. Code/proof: pending.
- [ ] **C-11 Constraints and parameters** — Driving dimension regenerates dependent geometry consistently. State: not-assessed. Code/proof: pending.
- [ ] **C-12 Dimensions, leaders and text** — Annotation values update and plot legibly at scale. State: not-assessed. Code/proof: pending.
- [ ] **C-13 Hatches, lineweights and plot styles** — Screen and exported output agree on declared styles. State: not-assessed. Code/proof: pending.
- [ ] **C-14 Undo, redo and transaction history** — One user operation undoes atomically without losing active context. State: not-assessed. Code/proof: pending.

### D — Documents, sheets and drawing registers

Benchmark references: [Autodesk AutoCAD](https://www.autodesk.com/products/autocad), [Bluebeam markups and data](https://www.bluebeam.com/product/markups-and-data/), [Oracle Aconex](https://www.oracle.com/construction-engineering/aconex/). These references inform the category; each acceptance requirement is X-Ray's own target.

- [ ] **D-01 Multi-file and multi-page import** — PDFs with different page sizes preserve every original page. State: not-assessed. Code/proof: pending.
- [ ] **D-02 Sheet names and numbers** — Rename changes labels without breaking evidence references. State: not-assessed. Code/proof: pending.
- [ ] **D-03 Add and duplicate drawing sheets** — New sheet receives an independent identity and layout. State: not-assessed. Code/proof: pending.
- [ ] **D-04 Remove with impact preview** — Review lists dependent takeoffs, links and viewports before removal. State: not-assessed. Code/proof: pending.
- [ ] **D-05 Restore removed sheets** — Restored sheet recovers annotations, scale and original ordering. State: not-assessed. Code/proof: pending.
- [ ] **D-06 Reorder and group sheets** — Discipline groups and order persist after restart and export. State: not-assessed. Code/proof: pending.
- [ ] **D-07 Title blocks and templates** — Project metadata updates linked fields without clipping. State: not-assessed. Code/proof: pending.
- [ ] **D-08 Viewports and per-view scale** — Independent scales measure correctly in exported PDF. State: not-assessed. Code/proof: pending.
- [ ] **D-09 Drawing revisions and supersession** — Old revision remains retrievable and visibly superseded. State: not-assessed. Code/proof: pending.
- [ ] **D-10 Revision overlay and slip-sheeting** — Added/deleted geometry is inspectable with alignment controls. State: not-assessed. Code/proof: pending.
- [ ] **D-11 OCR and sheet indexing** — Suggested names are reviewable and uncertainty is visible. State: not-assessed. Code/proof: pending.
- [ ] **D-12 Cross-sheet references and hyperlinks** — Detail callout opens the intended sheet revision. State: not-assessed. Code/proof: pending.
- [ ] **D-13 Batch printing and issue sets** — Selected sheets export in reviewed order with an issue register. State: not-assessed. Code/proof: pending.
- [ ] **D-14 Bookmarks and saved views** — Personal navigation restores the correct page and viewport. State: not-assessed. Code/proof: pending.

### E — Estimation, pricing and commercial work

Benchmark references: [RIB CostX](https://www.rib-software.com/en/rib-costx), [One Click LCA life-cycle costing](https://oneclicklca.com/en-gb/software/design-construction/life-cycle-costing). These references inform the category; each acceptance requirement is X-Ray's own target.

- [ ] **E-01 Pricing workbook import** — XLSX/CSV sheets preview without executing spreadsheet formulas. State: not-assessed. Code/proof: pending.
- [ ] **E-02 Column and worksheet mapping** — SKU, description, unit and rate map with row-level errors. State: not-assessed. Code/proof: pending.
- [ ] **E-03 Named price books and revisions** — Supplier revisions coexist and old estimates remain reproducible. State: not-assessed. Code/proof: pending.
- [ ] **E-04 Currency, tax and effective dates** — Mixed currencies never total without a reviewed conversion. State: not-assessed. Code/proof: pending.
- [ ] **E-05 Unit and pack normalization** — Each/metre/square-metre/pack conversion shows its dimensional basis. State: not-assessed. Code/proof: pending.
- [ ] **E-06 Apply and remove a price book** — Impact preview preserves manual overrides and supports undo. State: not-assessed. Code/proof: pending.
- [ ] **E-07 Supplier quote comparison** — Equal specifications compare landed cost and exclusions. State: not-assessed. Code/proof: pending.
- [ ] **E-08 Material, labour and plant build-ups** — Assembly rate reconciles to separately editable components. State: not-assessed. Code/proof: pending.
- [ ] **E-09 Waste, yield and productivity** — Assumptions remain separate from measured net quantities. State: not-assessed. Code/proof: pending.
- [ ] **E-10 Discount, margin and contingency** — Formula order is explicit and totals independently reconcile. State: not-assessed. Code/proof: pending.
- [ ] **E-11 Tender alternates and scenarios** — Base and options compare without altering the accepted baseline. State: not-assessed. Code/proof: pending.
- [ ] **E-12 Escalation and exchange rates** — Source and effective date bind each applied factor. State: not-assessed. Code/proof: pending.
- [ ] **E-13 Quote approval and issue** — Issued estimate freezes rates, quantities, exclusions and revision. State: not-assessed. Code/proof: pending.
- [ ] **E-14 Cost-to-complete and variations** — Approved changes reconcile original budget to current forecast. State: not-assessed. Code/proof: pending.

### F — Field work, construction and site delivery

Benchmark references: [Procore Project Management](https://www.procore.com/project-management), [Bluebeam markups and data](https://www.bluebeam.com/product/markups-and-data/). These references inform the category; each acceptance requirement is X-Ray's own target.

- [ ] **F-01 Offline field packages** — Required drawings and checklists open without connectivity. State: not-assessed. Code/proof: pending.
- [ ] **F-02 RFIs** — Question links to exact drawing revision and tracks response/closure. State: not-assessed. Code/proof: pending.
- [ ] **F-03 Submittals and shop drawing review** — Review route, due date and resubmission history persist. State: not-assessed. Code/proof: pending.
- [ ] **F-04 Daily site reports** — Labour, plant, weather and work records retain author and attachments. State: not-assessed. Code/proof: pending.
- [ ] **F-05 Tasks and punch lists** — Assigned location-based defect closes only with recorded evidence. State: not-assessed. Code/proof: pending.
- [ ] **F-06 Inspection and test plans** — Hold points prevent progression until authorized release. State: not-assessed. Code/proof: pending.
- [ ] **F-07 Photos, videos and geolocation** — Original media and capture context survive synchronization. State: not-assessed. Code/proof: pending.
- [ ] **F-08 Field markups and as-built capture** — Redline links to source and proposed changed object. State: not-assessed. Code/proof: pending.
- [ ] **F-09 Delivery docket and receiving** — Received quantities reconcile order and damaged/rejected goods. State: not-assessed. Code/proof: pending.
- [ ] **F-10 Crew timesheets and productivity** — Approved hours reconcile work package quantities. State: not-assessed. Code/proof: pending.
- [ ] **F-11 Permits and safety observations** — Expired permits and unresolved hazards remain visible. State: not-assessed. Code/proof: pending.
- [ ] **F-12 Temporary works and lift planning** — Reviewed configuration links to checked calculation package. State: not-assessed. Code/proof: pending.
- [ ] **F-13 Progress quantities and claims** — Claimed installed work reconciles verified measured evidence. State: not-assessed. Code/proof: pending.
- [ ] **F-14 Offline synchronization conflicts** — Conflicting field edits require review without losing either copy. State: not-assessed. Code/proof: pending.

### G — Geospatial, surveying and reality capture

Benchmark references: [Esri ArcGIS Pro](https://www.esri.com/en-us/arcgis/products/arcgis-pro/features), [Trimble Business Center command matrix](https://help.fieldsystems.trimble.com/tbc/pdf/tbc-command-matrix-editions-modules.pdf), [Trimble Business Center](https://civilconstruction.trimble.com/en/products/software/trimble-business-center). These references inform the category; each acceptance requirement is X-Ray's own target.

- [ ] **G-01 CRS, datum and geoid management** — Known survey control transforms within stated tolerance. State: not-assessed. Code/proof: pending.
- [ ] **G-02 Survey points and coding** — Point IDs, descriptions and units survive field-data import. State: not-assessed. Code/proof: pending.
- [ ] **G-03 Traverses and network adjustment** — Closure and residuals match an independent benchmark. State: not-assessed. Code/proof: pending.
- [ ] **G-04 GNSS and total-station exchange** — Supported observation metadata and quality flags persist. State: not-assessed. Code/proof: pending.
- [ ] **G-05 COGO and boundaries** — Bearings, distances and closure reproduce the survey input. State: not-assessed. Code/proof: pending.
- [ ] **G-06 Terrain surfaces and breaklines** — Triangulation respects boundaries, breaklines and holes. State: not-assessed. Code/proof: pending.
- [ ] **G-07 Contours and spot elevations** — Labels and contours match the underlying surface. State: not-assessed. Code/proof: pending.
- [ ] **G-08 Point-cloud import and indexing** — Large dataset streams with declared coordinate accuracy. State: not-assessed. Code/proof: pending.
- [ ] **G-09 Registration and control fitting** — Residuals and excluded control points are reported. State: not-assessed. Code/proof: pending.
- [ ] **G-10 Scan-to-model review** — Derived object retains source region and uncertainty. State: not-assessed. Code/proof: pending.
- [ ] **G-11 Drone imagery and orthophotos** — Ground control and image resolution remain traceable. State: not-assessed. Code/proof: pending.
- [ ] **G-12 GIS layers and spatial queries** — Attribute filters and spatial selections return known fixtures. State: not-assessed. Code/proof: pending.
- [ ] **G-13 Stakeout and machine-control export** — Independent device/parser verifies coordinates and units. State: not-assessed. Code/proof: pending.
- [ ] **G-14 Change and deformation surveys** — Time-stamped comparisons separate movement from registration error. State: not-assessed. Code/proof: pending.

### H — HVAC, hydraulics, plumbing and fire services

Benchmark references: [Autodesk Revit MEP documentation](https://help.autodesk.com/cloudhelp/2026/ENU/Revit-MEPEng/files/GUID-195C2C6C-5E2C-422E-A44D-FB3FDFDE276A.htm), [Bentley OpenFlows Water](https://www.bentley.com/products/openflows-water). These references inform the category; each acceptance requirement is X-Ray's own target.

- [ ] **H-01 Connected system topology** — Equipment, terminals and branches form a validated network. State: not-assessed. Code/proof: pending.
- [ ] **H-02 Duct routing and fittings** — Size, elevation, clearance and fitting rules persist. State: not-assessed. Code/proof: pending.
- [ ] **H-03 Airflow and pressure calculations** — Known network matches checked design calculation. State: not-assessed. Code/proof: pending.
- [ ] **H-04 Heating and cooling loads** — Zone assumptions and weather input reproduce benchmark results. State: not-assessed. Code/proof: pending.
- [ ] **H-05 Equipment selection schedules** — Selected duty reconciles specified performance and source data. State: not-assessed. Code/proof: pending.
- [ ] **H-06 Water supply and sanitary routing** — Pipe size, fall and connection direction are inspectable. State: not-assessed. Code/proof: pending.
- [ ] **H-07 Hydraulic networks and pumps** — Flow, head and operating point match reference cases. State: not-assessed. Code/proof: pending.
- [ ] **H-08 Stormwater and roof drainage** — Catchment, design event and outlet capacity remain linked. State: not-assessed. Code/proof: pending.
- [ ] **H-09 Sprinkler and hydrant systems** — Reviewed coverage and demand calculations retain edition/jurisdiction. State: not-assessed. Code/proof: pending.
- [ ] **H-10 Gas and process services** — Service compatibility and design conditions are explicit. State: not-assessed. Code/proof: pending.
- [ ] **H-11 Insulation and supports** — Quantities distinguish bare pipe, insulation and support spacing. State: not-assessed. Code/proof: pending.
- [ ] **H-12 Plantroom access and coordination** — Maintenance clearances are checked against actual geometry. State: not-assessed. Code/proof: pending.
- [ ] **H-13 Risers, schematics and schedules** — Changes propagate consistently between representations. State: not-assessed. Code/proof: pending.
- [ ] **H-14 Commissioning and balancing records** — As-tested performance links to installed equipment revision. State: not-assessed. Code/proof: pending.

### I — Interoperability, imports and integrations

Benchmark references: [Autodesk AutoCAD](https://www.autodesk.com/products/autocad), [ACadSharp](https://github.com/DomCR/ACadSharp), [buildingSMART BCF](https://www.buildingsmart.org/standards/bsi-standards/bim-collaboration-format/), [buildingSMART IDS](https://www.buildingsmart.org/standards/bsi-standards/information-delivery-specification-ids/). These references inform the category; each acceptance requirement is X-Ray's own target.

- [ ] **I-01 DXF import/export** — Independent reader verifies supported geometry, layers and units. State: not-assessed. Code/proof: pending.
- [ ] **I-02 Native Windows DWG exchange** — Binary file opens independently; unsupported objects are disclosed. State: not-assessed. Code/proof: pending.
- [ ] **I-03 IFC geometry and property exchange** — Declared schema validates with correct object identity. State: not-assessed. Code/proof: pending.
- [ ] **I-04 BCF issue exchange** — Viewpoint, object references and discussion survive a second application. State: not-assessed. Code/proof: pending.
- [ ] **I-05 LandXML and civil exchange** — Alignments, surfaces and units pass independent readback. State: not-assessed. Code/proof: pending.
- [ ] **I-06 STEP, IGES and manufacturing exchange** — Declared solids and tolerances survive a second kernel. State: not-assessed. Code/proof: pending.
- [ ] **I-07 Point-cloud and GIS formats** — LAS/E57/GeoJSON support is explicit and independently checked. State: not-assessed. Code/proof: pending.
- [ ] **I-08 PDF, image and vector export** — Clipping, scale, fonts and transparency render correctly. State: not-assessed. Code/proof: pending.
- [ ] **I-09 Spreadsheet and tabular export** — Column types, escaping and formulas are handled predictably. State: not-assessed. Code/proof: pending.
- [ ] **I-10 Referenced file management** — Missing external dependencies are reported before issue. State: not-assessed. Code/proof: pending.
- [ ] **I-11 Connector authentication** — Provider permissions and token revocation are tested. State: not-assessed. Code/proof: pending.
- [ ] **I-12 Versioned API and webhooks** — Retries use idempotency and durable acknowledgement. State: not-assessed. Code/proof: pending.
- [ ] **I-13 Import preview and cancellation** — Invalid/cancelled import leaves current project unchanged. State: not-assessed. Code/proof: pending.
- [ ] **I-14 Compatibility and loss reports** — Every conversion lists supported scope and detected losses. State: not-assessed. Code/proof: pending.

### J — Jobs, programmes and commercial administration

Benchmark references: [Procore Project Management](https://www.procore.com/project-management), [Oracle Aconex](https://www.oracle.com/construction-engineering/aconex/). These references inform the category; each acceptance requirement is X-Ray's own target.

- [ ] **J-01 Client, site and contact records** — Project links remain valid when contact details change. State: not-assessed. Code/proof: pending.
- [ ] **J-02 Brief and requirements register** — Each requirement links to a responsible person and deliverable. State: not-assessed. Code/proof: pending.
- [ ] **J-03 Scope, exclusions and assumptions** — Issued scope is immutable and changes are revisioned. State: not-assessed. Code/proof: pending.
- [ ] **J-04 Work breakdown and cost codes** — Tasks, quantities and costs roll up without duplicates. State: not-assessed. Code/proof: pending.
- [ ] **J-05 Programme and dependencies** — Date changes recalculate dependent tasks and reveal conflicts. State: not-assessed. Code/proof: pending.
- [ ] **J-06 Design deliverables and milestones** — Overdue deliverables remain assigned and visible. State: not-assessed. Code/proof: pending.
- [ ] **J-07 Resources and capacity** — Overallocated people and equipment are identifiable. State: not-assessed. Code/proof: pending.
- [ ] **J-08 Contracts and commitments** — Approved scope and committed amount reconcile to supplier records. State: not-assessed. Code/proof: pending.
- [ ] **J-09 Change events and approvals** — Proposed variation cannot enter approved totals prematurely. State: not-assessed. Code/proof: pending.
- [ ] **J-10 Procurement schedule** — Required-on-site dates reconcile lead time and order status. State: not-assessed. Code/proof: pending.
- [ ] **J-11 Meeting decisions and actions** — Decision links to affected document and assigned follow-up. State: not-assessed. Code/proof: pending.
- [ ] **J-12 Progress payment evidence** — Claimed work links to approved measurement and period. State: not-assessed. Code/proof: pending.
- [ ] **J-13 Portfolio search and reporting** — User only sees permitted jobs and correct aggregate totals. State: not-assessed. Code/proof: pending.
- [ ] **J-14 Closeout and lessons learned** — Complete record archives and reopens with its issue history. State: not-assessed. Code/proof: pending.

### K — Knowledge, libraries and reusable standards

Benchmark references: [Autodesk AutoCAD](https://www.autodesk.com/products/autocad), [SOLIDWORKS Design](https://www.solidworks.com/product/solidworks-design), [Eplan Electric P8](https://www.eplan.com/de-en/products/eplan-electric-p8/). These references inform the category; each acceptance requirement is X-Ray's own target.

- [ ] **K-01 Component and assembly libraries** — Reuse preserves source, units and revision identity. State: not-assessed. Code/proof: pending.
- [ ] **K-02 Manufacturer product catalogues** — Model/specification maps to an identifiable product. State: not-assessed. Code/proof: pending.
- [ ] **K-03 Detail and symbol libraries** — Inserted detail retains attribution and discipline metadata. State: not-assessed. Code/proof: pending.
- [ ] **K-04 Organization naming conventions** — Invalid drawing/asset names produce actionable validation. State: not-assessed. Code/proof: pending.
- [ ] **K-05 Classification mapping** — Local codes map explicitly to selected classification systems. State: not-assessed. Code/proof: pending.
- [ ] **K-06 Specification clauses** — Object properties link to the issued specification revision. State: not-assessed. Code/proof: pending.
- [ ] **K-07 Calculation templates** — Inputs, formulas and validated range remain visible. State: not-assessed. Code/proof: pending.
- [ ] **K-08 Custom property sets** — Type-safe fields survive import, duplication and export. State: not-assessed. Code/proof: pending.
- [ ] **K-09 Search and tags** — Material, detail and project search returns permission-filtered results. State: not-assessed. Code/proof: pending.
- [ ] **K-10 Favourite tool palettes** — User presets restore without changing project data. State: not-assessed. Code/proof: pending.
- [ ] **K-11 Library change control** — Updating master content offers review before replacing instances. State: not-assessed. Code/proof: pending.
- [ ] **K-12 Content provenance and licensing** — Restricted content cannot be silently redistributed. State: not-assessed. Code/proof: pending.
- [ ] **K-13 Training and contextual help** — New user can complete a fixture workflow without hidden steps. State: not-assessed. Code/proof: pending.
- [ ] **K-14 Organization template portability** — Import checks dependencies and conflicting identifiers. State: not-assessed. Code/proof: pending.

### L — Landscape, land development and public realm

Benchmark references: [Vectorworks Design Suite](https://www.vectorworks.net/en-GB/design-suite), [Bentley OpenSite Designer](https://www.bentley.com/software/opensite-designer/). These references inform the category; each acceptance requirement is X-Ray's own target.

- [ ] **L-01 Site constraints and setbacks** — Mapped constraints remain visible in design and issue sheets. State: not-assessed. Code/proof: pending.
- [ ] **L-02 Grading and drainage design** — Surface edits produce consistent slopes and catchments. State: not-assessed. Code/proof: pending.
- [ ] **L-03 Cut/fill and earthworks** — Independent volumes reconcile existing and proposed surfaces. State: not-assessed. Code/proof: pending.
- [ ] **L-04 Planting and species schedules** — Counts, spacing, maturity and stock sizes reconcile plans. State: not-assessed. Code/proof: pending.
- [ ] **L-05 Irrigation networks** — Zones, demand and equipment link to checked hydraulic inputs. State: not-assessed. Code/proof: pending.
- [ ] **L-06 Hardscape and paving patterns** — Edge cuts and net areas reconcile layout geometry. State: not-assessed. Code/proof: pending.
- [ ] **L-07 Retaining walls and terraces** — Height/level changes update quantities and sections. State: not-assessed. Code/proof: pending.
- [ ] **L-08 Accessible paths and ramps** — Slopes and landings report measured values against selected criteria. State: not-assessed. Code/proof: pending.
- [ ] **L-09 Street furniture and lighting** — Location schedule matches placed assets. State: not-assessed. Code/proof: pending.
- [ ] **L-10 Arboriculture and tree protection** — Surveyed trees retain condition, exclusion zone and decision history. State: not-assessed. Code/proof: pending.
- [ ] **L-11 Erosion, sediment and water-sensitive design** — Staging and treatment assumptions remain recorded. State: not-assessed. Code/proof: pending.
- [ ] **L-12 Playgrounds, parks and sports facilities** — Equipment clearances and maintenance needs are traceable. State: not-assessed. Code/proof: pending.
- [ ] **L-13 Habitat and biodiversity schedules** — Habitat areas and stated assessment method remain inspectable. State: not-assessed. Code/proof: pending.
- [ ] **L-14 Landscape maintenance handover** — Planting, irrigation and warranty records follow installed assets. State: not-assessed. Code/proof: pending.

### M — Manufacturing, mechanical design and fabrication

Benchmark references: [SOLIDWORKS Design](https://www.solidworks.com/product/solidworks-design), [Siemens NX Manufacturing](https://blogs.sw.siemens.com/nx-manufacturing/whats-new-in-nx-for-manufacturing-2606-june-2026/), [Eplan Electric P8](https://www.eplan.com/de-en/products/eplan-electric-p8/). These references inform the category; each acceptance requirement is X-Ray's own target.

- [ ] **M-01 Parametric parts and feature history** — Dimension change regenerates a valid part or explains failure. State: not-assessed. Code/proof: pending.
- [ ] **M-02 Assemblies, mates and interference** — Assembly motion and collision checks match known fixtures. State: not-assessed. Code/proof: pending.
- [ ] **M-03 Tolerances and GD&T** — Drawing annotations bind to intended datum and feature. State: not-assessed. Code/proof: pending.
- [ ] **M-04 Sheet metal and flat patterns** — Bend allowance and unfolded dimensions match fabrication reference. State: not-assessed. Code/proof: pending.
- [ ] **M-05 Weldments and structural frames** — Cut list reconciles lengths, end treatments and members. State: not-assessed. Code/proof: pending.
- [ ] **M-06 Joinery and cabinet manufacture** — Panels, edging, hardware and drilling reconcile assembly. State: not-assessed. Code/proof: pending.
- [ ] **M-07 Part numbers, BOM and configurations** — Variant BOM contains exactly the selected components. State: not-assessed. Code/proof: pending.
- [ ] **M-08 Nesting and stock optimization** — Kerf, grain and remnants are respected in material yield. State: not-assessed. Code/proof: pending.
- [ ] **M-09 CAM toolpaths and posts** — Independent simulation validates chosen machine/post combination. State: not-assessed. Code/proof: pending.
- [ ] **M-10 Additive manufacturing preparation** — Wall limits, supports and build orientation are checked. State: not-assessed. Code/proof: pending.
- [ ] **M-11 Tooling, jigs and fixtures** — Setup constraints and reference positions are documented. State: not-assessed. Code/proof: pending.
- [ ] **M-12 Weld maps and traceability** — Weld procedure and inspection link to material and serial identity. State: not-assessed. Code/proof: pending.
- [ ] **M-13 Quality inspection and metrology** — Measured deviations reconcile nominal geometry and tolerance. State: not-assessed. Code/proof: pending.
- [ ] **M-14 Engineering change and release** — Released manufacturing package remains reproducible after changes. State: not-assessed. Code/proof: pending.

### N — Networks, electrical, controls and communications

Benchmark references: [Autodesk Revit MEP documentation](https://help.autodesk.com/cloudhelp/2026/ENU/Revit-MEPEng/files/GUID-195C2C6C-5E2C-422E-A44D-FB3FDFDE276A.htm), [Eplan Electric P8](https://www.eplan.com/de-en/products/eplan-electric-p8/). These references inform the category; each acceptance requirement is X-Ray's own target.

- [ ] **N-01 Single-line and circuit diagrams** — Circuit identity is consistent across drawings and schedules. State: not-assessed. Code/proof: pending.
- [ ] **N-02 Electrical load schedules** — Diversity and connected demand reconcile checked inputs. State: not-assessed. Code/proof: pending.
- [ ] **N-03 Cable sizing and voltage drop** — Selected assumptions reproduce a checked calculation. State: not-assessed. Code/proof: pending.
- [ ] **N-04 Protection and fault coordination** — Device curves and fault assumptions are version-bound. State: not-assessed. Code/proof: pending.
- [ ] **N-05 Lighting layout and calculations** — Fixture data and measured illuminance match reference cases. State: not-assessed. Code/proof: pending.
- [ ] **N-06 Earthing and lightning protection** — Conductors and test points link to reviewed design criteria. State: not-assessed. Code/proof: pending.
- [ ] **N-07 Panel and switchboard schedules** — Ways, phases and equipment reconcile connected circuits. State: not-assessed. Code/proof: pending.
- [ ] **N-08 Cable tray and containment routes** — Lengths, fill and clearances follow actual routing. State: not-assessed. Code/proof: pending.
- [ ] **N-09 Controls, PLC and I/O schedules** — Each tag maps consistently to device, terminal and channel. State: not-assessed. Code/proof: pending.
- [ ] **N-10 Telecommunications and fibre** — Ports, fibres, splices and loss budgets remain traceable. State: not-assessed. Code/proof: pending.
- [ ] **N-11 Security, CCTV and access systems** — Device coverage and restricted credentials stay separate. State: not-assessed. Code/proof: pending.
- [ ] **N-12 Solar, batteries and EV charging** — Equipment, demand and connection assumptions are explicit. State: not-assessed. Code/proof: pending.
- [ ] **N-13 Instrumentation and loop diagrams** — Tag and loop changes propagate through affected documents. State: not-assessed. Code/proof: pending.
- [ ] **N-14 Testing and electrical handover** — Test results link to installed circuit and equipment revision. State: not-assessed. Code/proof: pending.

### O — Operations, facilities and asset management

Benchmark references: [IBM Maximo](https://www.ibm.com/products/maximo), [AVEVA Unified Engineering](https://www.aveva.com/en/products/unified-engineering/). These references inform the category; each acceptance requirement is X-Ray's own target.

- [ ] **O-01 Asset register and location hierarchy** — Installed asset is findable by ID, space and system. State: not-assessed. Code/proof: pending.
- [ ] **O-02 O&M manuals and warranties** — Exact asset links to current manual and warranty dates. State: not-assessed. Code/proof: pending.
- [ ] **O-03 Commissioning and practical completion** — Open defects remain visible at handover. State: not-assessed. Code/proof: pending.
- [ ] **O-04 Preventive maintenance plans** — Recurrence generates the correct due work orders. State: not-assessed. Code/proof: pending.
- [ ] **O-05 Reactive work orders** — Request progresses through assignment, execution and verification. State: not-assessed. Code/proof: pending.
- [ ] **O-06 Condition inspection and history** — Condition scores retain method, date and supporting evidence. State: not-assessed. Code/proof: pending.
- [ ] **O-07 Spare parts and maintenance inventory** — Consumption links to work order and stock balance. State: not-assessed. Code/proof: pending.
- [ ] **O-08 QR/barcode field lookup** — Scan resolves correct asset and permitted records. State: not-assessed. Code/proof: pending.
- [ ] **O-09 Space and occupancy management** — Space changes reconcile floor area and assigned occupancy. State: not-assessed. Code/proof: pending.
- [ ] **O-10 Metering and performance trends** — Time-series units, gaps and calibration are explicit. State: not-assessed. Code/proof: pending.
- [ ] **O-11 Sensor/BMS integrations** — Disconnected or stale feed cannot appear current. State: not-assessed. Code/proof: pending.
- [ ] **O-12 Service contractors and SLAs** — Escalations respect priority, business hours and contract. State: not-assessed. Code/proof: pending.
- [ ] **O-13 Lifecycle renewal and budgets** — Replacement forecasts retain condition and cost assumptions. State: not-assessed. Code/proof: pending.
- [ ] **O-14 Decommissioning and disposal** — Retired assets preserve records and disposal evidence. State: not-assessed. Code/proof: pending.

### P — Procurement, products and pricing research

Benchmark references: [Firecrawl v2 search API](https://docs.firecrawl.dev/api-reference/endpoint/search), [RIB CostX](https://www.rib-software.com/en/rib-costx), [Procore Project Management](https://www.procore.com/project-management). These references inform the category; each acceptance requirement is X-Ray's own target.

- [ ] **P-01 User-initiated Firecrawl search** — Explicit query returns bounded real source links or honest failure. State: not-assessed. Code/proof: pending.
- [ ] **P-02 Supplier and regional filters** — Results show selected country, supplier and search timestamp. State: not-assessed. Code/proof: pending.
- [ ] **P-03 Structured product extraction** — SKU, specification, price basis and source excerpt are reviewable. State: not-assessed. Code/proof: pending.
- [ ] **P-04 Variant and product matching** — Different grade/size/finish cannot silently substitute requested item. State: not-assessed. Code/proof: pending.
- [ ] **P-05 Price basis and availability** — Ex-tax/inc-tax, pack size, stock and delivery conditions remain explicit. State: not-assessed. Code/proof: pending.
- [ ] **P-06 Missing and quoted-only prices** — Unknown price remains unknown instead of zero or invented value. State: not-assessed. Code/proof: pending.
- [ ] **P-07 Price freshness and provenance** — Each rate retains retrieval time, source URL and quoted currency. State: not-assessed. Code/proof: pending.
- [ ] **P-08 Review before rate application** — Unreviewed research never changes project costs. State: not-assessed. Code/proof: pending.
- [ ] **P-09 Provider budgets and credentials** — Secrets remain server/native-only and requests respect limits. State: not-assessed. Code/proof: pending.
- [ ] **P-10 Search cancellation and retry** — Cancel stops application; rate limits retain existing data. State: not-assessed. Code/proof: pending.
- [ ] **P-11 RFQ preparation and comparisons** — Supplier offers compare matched scope and exclusions. State: not-assessed. Code/proof: pending.
- [ ] **P-12 Purchase orders and approvals** — Only approved quantities/rates enter issued orders. State: not-assessed. Code/proof: pending.
- [ ] **P-13 Lead times, alternates and substitutions** — Approved alternative retains original specification and decision. State: not-assessed. Code/proof: pending.
- [ ] **P-14 Receiving, returns and reconciliation** — Ordered, delivered, returned and invoiced quantities reconcile. State: not-assessed. Code/proof: pending.

### Q — Quality, checking, compliance and proof

Benchmark references: [buildingSMART IDS](https://www.buildingsmart.org/standards/bsi-standards/information-delivery-specification-ids/), [CSI ETABS](https://www.csiamerica.com/products/etabs), [Bluebeam markups and data](https://www.bluebeam.com/product/markups-and-data/). These references inform the category; each acceptance requirement is X-Ray's own target.

- [ ] **Q-01 Requirement-to-evidence traceability** — Each acceptance item points to exact fixture and output. State: not-assessed. Code/proof: pending.
- [ ] **Q-02 Smoke tests per delivered change** — Actual screen renders with no uncaught runtime failures. State: not-assessed. Code/proof: pending.
- [ ] **Q-03 Screenshot and code-diff proof** — Completed UI row has inspected PNG plus matching source diff. State: not-assessed. Code/proof: pending.
- [ ] **Q-04 Model geometry validation** — Invalid solids, overlaps and missing faces are detected and explained. State: not-assessed. Code/proof: pending.
- [ ] **Q-05 Information requirement checking** — Missing required properties fail the selected rule set. State: not-assessed. Code/proof: pending.
- [ ] **Q-06 Clash and clearance checking** — Known hard and clearance clashes are detected without duplicates. State: not-assessed. Code/proof: pending.
- [ ] **Q-07 Drawing/model/quantity consistency** — Edit updates all linked outputs or marks them stale. State: not-assessed. Code/proof: pending.
- [ ] **Q-08 Engineering benchmark validation** — Independent known cases verify results and supported range. State: not-assessed. Code/proof: pending.
- [ ] **Q-09 Jurisdiction and edition register** — Every compliance claim identifies applicable published criteria. State: not-assessed. Code/proof: pending.
- [ ] **Q-10 Review and professional sign-off** — Checker identity and limitations remain attached to issued result. State: not-assessed. Code/proof: pending.
- [ ] **Q-11 Evidence integrity and reproducibility** — Hashes bind source, app build, fixture and result. State: not-assessed. Code/proof: pending.
- [ ] **Q-12 Regression and adversarial tests** — Malformed files, cancellations and stale edits preserve data. State: not-assessed. Code/proof: pending.
- [ ] **Q-13 Release and installed-app verification** — Installed binary and packaged resources match tested build. State: not-assessed. Code/proof: pending.
- [ ] **Q-14 Honest capability states** — Planned, partial, failed and verified remain visibly distinct. State: not-assessed. Code/proof: pending.

### R — Review, visualization and coordination

Benchmark references: [Graphisoft Archicad Collaborate](https://www.graphisoft.com/en-us/plans-and-products/archicad-collaborate/), [buildingSMART BCF](https://www.buildingsmart.org/standards/bsi-standards/bim-collaboration-format/), [Bluebeam markups and data](https://www.bluebeam.com/product/markups-and-data/). These references inform the category; each acceptance requirement is X-Ray's own target.

- [ ] **R-01 Orbit, pan, zoom and fit** — Model remains reachable at different scales and aspect ratios. State: partial. Navigation milestone verified 2026-09-08; full row remains open. Code/proof: [Stage07 scoped results, source diff and executed evidence](proof/growth/2026-09-08-07-walkthrough-release/index.html). Latest bounded milestone: [Stage09 clean plans, boundaries, body reach and release evidence](proof/growth/2026-09-08-09-walkthrough-polish/index.html); full row stays open.
- [ ] **R-02 Walk and fly navigation** — Movement direction, collision and floor levels match visible controls. State: partial. Navigation milestone verified 2026-09-08; full row remains open. Code/proof: [Stage07 scoped results, source diff and executed evidence](proof/growth/2026-09-08-07-walkthrough-release/index.html). Latest bounded milestone: [Stage09 clean plans, boundaries, body reach and release evidence](proof/growth/2026-09-08-09-walkthrough-polish/index.html); full row stays open.
- [ ] **R-03 Section boxes and clipping** — Clipped geometry and caps reveal intended interior sections. State: not-assessed. Code/proof: pending.
- [ ] **R-04 Visibility by discipline and phase** — Saved views reproduce selected object sets. State: not-assessed. Code/proof: pending.
- [ ] **R-05 Source-linked 3D inspection** — Picked object opens matching source evidence and assumptions. State: not-assessed. Code/proof: pending.
- [ ] **R-06 Roof and facade integrity** — Gables join roof slopes without floating faces or hidden duplicate surfaces. State: not-assessed. Code/proof: pending.
- [ ] **R-07 Materials, lighting and render views** — Export matches saved camera and material settings. State: not-assessed. Code/proof: pending.
- [ ] **R-08 Viewpoint snapshots** — Snapshot retains camera, selection, model revision and annotation. State: not-assessed. Code/proof: pending.
- [ ] **R-09 Measurement in 3D** — Picked distance reports coordinates and units with known accuracy. State: not-assessed. Code/proof: pending.
- [ ] **R-10 Markups and threaded issues** — Issue preserves author, status, due date and model references. State: not-assessed. Code/proof: pending.
- [ ] **R-11 Design options and comparisons** — Alternative model changes are inspectable against baseline. State: not-assessed. Code/proof: pending.
- [ ] **R-12 Federated model coordination** — Different origins, versions and disciplines align explicitly. State: not-assessed. Code/proof: pending.
- [ ] **R-13 Client presentations and approval** — Viewer comments bind to the exact presented revision. State: not-assessed. Code/proof: pending.
- [ ] **R-14 Image/video export and accessibility** — Output is legible and controls support keyboard operation. State: not-assessed. Code/proof: pending.

### S — Structural and specialist engineering

Benchmark references: [CSI ETABS](https://www.csiamerica.com/products/etabs), [Tekla Tedds](https://www.tekla.com/products/tekla-tedds), [Bentley PLAXIS 3D](https://www.bentley.com/products/plaxis-3d). These references inform the category; each acceptance requirement is X-Ray's own target.

- [ ] **S-01 Analytical model and connectivity** — Nodes, releases and offsets reproduce intended load path. State: not-assessed. Code/proof: pending.
- [ ] **S-02 Materials, sections and member libraries** — Selected values retain source and design units. State: not-assessed. Code/proof: pending.
- [ ] **S-03 Loads, combinations and mass** — Applied load totals and combination factors reconcile. State: not-assessed. Code/proof: pending.
- [ ] **S-04 Linear and second-order analysis** — Reference frame forces and displacements match independent results. State: not-assessed. Code/proof: pending.
- [ ] **S-05 Dynamic, seismic and wind studies** — Modes, damping and hazard assumptions remain inspectable. State: not-assessed. Code/proof: pending.
- [ ] **S-06 Steel and cold-formed design** — Utilization and governing checks match benchmark calculations. State: not-assessed. Code/proof: pending.
- [ ] **S-07 Reinforced and prestressed concrete** — Reinforcement, serviceability and detailing remain traceable. State: not-assessed. Code/proof: pending.
- [ ] **S-08 Timber, masonry and composite design** — Declared material method and limitations accompany results. State: not-assessed. Code/proof: pending.
- [ ] **S-09 Connections, base plates and anchors** — Connection forces link to verified member/load case. State: not-assessed. Code/proof: pending.
- [ ] **S-10 Foundations and soil interaction** — Bearing, settlement and pile assumptions match geotechnical inputs. State: not-assessed. Code/proof: pending.
- [ ] **S-11 Retaining structures and excavations** — Stages and groundwater conditions bind each result. State: not-assessed. Code/proof: pending.
- [ ] **S-12 Bridges, tanks, towers and specialty assets** — Selected solver scope explicitly supports the asset type. State: not-assessed. Code/proof: pending.
- [ ] **S-13 Fabrication detailing and reinforcement schedules** — Marks, quantities and geometry reconcile issued drawings. State: not-assessed. Code/proof: pending.
- [ ] **S-14 Calculation reports and check signatures** — Inputs, equations, units, solver version and reviewer are retained. State: not-assessed. Code/proof: pending.

### T — Takeoff, measurement and quantities

Benchmark references: [RIB CostX](https://www.rib-software.com/en/rib-costx), [Bluebeam markups and data](https://www.bluebeam.com/product/markups-and-data/), [Trimble Business Center](https://civilconstruction.trimble.com/en/products/software/trimble-business-center). These references inform the category; each acceptance requirement is X-Ray's own target.

- [ ] **T-01 Scale calibration per sheet** — Known distance measures correctly after rotation and reload. State: not-assessed. Code/proof: pending.
- [ ] **T-02 Separate axes and distorted scans** — Calibration records anisotropy or blocks unsupported measurement. State: not-assessed. Code/proof: pending.
- [ ] **T-03 Lengths, perimeters and counts** — Totals match independently measured fixture values. State: not-assessed. Code/proof: pending.
- [ ] **T-04 Areas, holes and net deductions** — Openings subtract once and self-intersections are rejected. State: not-assessed. Code/proof: pending.
- [ ] **T-05 Volumes, slopes and elevations** — 3D quantity basis distinguishes projected from actual surface. State: not-assessed. Code/proof: pending.
- [ ] **T-06 Trade and work-package classification** — Reclassification updates totals without duplicate measurements. State: not-assessed. Code/proof: pending.
- [ ] **T-07 Assembly breakdowns** — Element quantity decomposes into explicit materials and assumptions. State: not-assessed. Code/proof: pending.
- [ ] **T-08 Duplicate detection and exclusions** — Overlapping takeoffs are reviewable before totaling. State: not-assessed. Code/proof: pending.
- [ ] **T-09 Revision quantity comparison** — Additions, removals and changed quantities reconcile prior issue. State: not-assessed. Code/proof: pending.
- [ ] **T-10 Measurement source links** — Each quantity opens exact page, region and source revision. State: not-assessed. Code/proof: pending.
- [ ] **T-11 Stock lengths, packs and wastage** — Purchased quantities remain distinct from net measured demand. State: not-assessed. Code/proof: pending.
- [ ] **T-12 Manual, model and AI quantity provenance** — User can distinguish and review each quantity origin. State: not-assessed. Code/proof: pending.
- [ ] **T-13 Reconciliation and audit exports** — Summary totals reproduce detailed rows with units and rounding. State: not-assessed. Code/proof: pending.
- [ ] **T-14 Bulk edit, undo and recovery** — Batch operation restores all affected quantities and associations. State: not-assessed. Code/proof: pending.

### U — Usability, performance and everyday flexibility

Benchmark references: [Bluebeam markups and data](https://www.bluebeam.com/product/markups-and-data/), [Autodesk AutoCAD](https://www.autodesk.com/products/autocad). These references inform the category; each acceptance requirement is X-Ray's own target.

- [ ] **U-01 Role-specific workspace presets** — Architect and estimator get useful tools without separate data copies. State: not-assessed. Code/proof: pending.
- [ ] **U-02 Search, command palette and shortcuts** — Common commands work from keyboard and show discoverable labels. State: partial. Navigation milestone verified 2026-09-08; full row remains open. Code/proof: [Stage07 scoped results, source diff and executed evidence](proof/growth/2026-09-08-07-walkthrough-release/index.html). Latest bounded milestone: [Stage09 clean plans, boundaries, body reach and release evidence](proof/growth/2026-09-08-09-walkthrough-polish/index.html); full row stays open.
- [ ] **U-03 Resizable panels and saved layouts** — Layout restores on the user's monitor without hiding actions. State: not-assessed. Code/proof: pending.
- [ ] **U-04 Large plan/model navigation** — Representative heavy fixture meets recorded load and interaction budget. State: not-assessed. Code/proof: pending.
- [ ] **U-05 Accessible focus, contrast and labels** — Core workflow is usable without pointer or color alone. State: partial. Navigation milestone verified 2026-09-08; full row remains open. Code/proof: [Stage07 scoped results, source diff and executed evidence](proof/growth/2026-09-08-07-walkthrough-release/index.html). Latest bounded milestone: [Stage09 clean plans, boundaries, body reach and release evidence](proof/growth/2026-09-08-09-walkthrough-polish/index.html); full row stays open.
- [ ] **U-06 Touch and small-screen field use** — Critical actions remain reachable without horizontal clipping. State: partial. Navigation milestone verified 2026-09-08; full row remains open. Code/proof: [Stage07 scoped results, source diff and executed evidence](proof/growth/2026-09-08-07-walkthrough-release/index.html). Latest bounded milestone: [Stage09 clean plans, boundaries, body reach and release evidence](proof/growth/2026-09-08-09-walkthrough-polish/index.html); full row stays open.
- [ ] **U-07 Multi-monitor and high-DPI desktop** — Dialogs and text remain visible at tested scaling levels. State: not-assessed. Code/proof: pending.
- [ ] **U-08 Progress, cancellation and background jobs** — Long operation shows honest status and can be stopped. State: not-assessed. Code/proof: pending.
- [ ] **U-09 Useful validation and empty states** — User can recover from invalid input without losing edits. State: partial. Navigation milestone verified 2026-09-08; full row remains open. Code/proof: [Stage07 scoped results, source diff and executed evidence](proof/growth/2026-09-08-07-walkthrough-release/index.html). Latest bounded milestone: [Stage09 clean plans, boundaries, body reach and release evidence](proof/growth/2026-09-08-09-walkthrough-polish/index.html); full row stays open.
- [ ] **U-10 Bulk operations and multi-selection** — Preview clearly reports affected items before applying changes. State: not-assessed. Code/proof: pending.
- [ ] **U-11 Per-user preferences and units** — Preference changes do not reinterpret existing geometry. State: not-assessed. Code/proof: pending.
- [ ] **U-12 Localization and terminology** — Industry-specific terms do not change underlying data meaning. State: not-assessed. Code/proof: pending.
- [ ] **U-13 Onboarding and sample isolation** — Sample work cannot be mistaken for the user's source project. State: not-assessed. Code/proof: pending.
- [ ] **U-14 Support diagnostics and recovery guidance** — Export omits secrets and includes reproducible failure context. State: not-assessed. Code/proof: pending.

### V — Versioning, collaboration and staff handoff

Benchmark references: [Graphisoft BIMcloud teams](https://helpcenter.graphisoft.com/user-guide/134439/), [buildingSMART BCF](https://www.buildingsmart.org/standards/bsi-standards/bim-collaboration-format/), [Oracle Aconex](https://www.oracle.com/construction-engineering/aconex/), [Autodesk Forma construction document management](https://construction.autodesk.com/workflows/construction-document-management/). These references inform the category; each acceptance requirement is X-Ray's own target.

- [ ] **V-01 Named project versions** — Saved milestone reopens exact drawing, sources and commercial state. State: not-assessed. Code/proof: pending.
- [ ] **V-02 Change comparisons** — Reviewer can inspect changed objects, quantities, documents and rates. State: not-assessed. Code/proof: pending.
- [ ] **V-03 Staff handoff package** — Fresh recipient profile restores complete reviewed project context. State: not-assessed. Code/proof: pending.
- [ ] **V-04 Selective package content** — Private rates and unrelated documents are excluded by review. State: not-assessed. Code/proof: pending.
- [ ] **V-05 Recipient and distribution list** — Intended staff and access level are visible before sending. State: not-assessed. Code/proof: pending.
- [ ] **V-06 Transmittals and receipts** — Sent status requires durable receipt rather than button click. State: not-assessed. Code/proof: pending.
- [ ] **V-07 Download links and expiry** — Revoked or expired link cannot fetch protected documents. State: not-assessed. Code/proof: pending.
- [ ] **V-08 Assignments and notifications** — Task owner receives only relevant authorized information. State: not-assessed. Code/proof: pending.
- [ ] **V-09 Comments and review decisions** — Replies retain authorship and referenced revision. State: not-assessed. Code/proof: pending.
- [ ] **V-10 Checkout/reservation and live collaboration** — Concurrent edits resolve without silent last-writer loss. State: not-assessed. Code/proof: pending.
- [ ] **V-11 Merge and conflict review** — Both versions remain recoverable until explicit resolution. State: not-assessed. Code/proof: pending.
- [ ] **V-12 Approval stages and issued status** — Work-in-progress cannot appear as approved construction issue. State: not-assessed. Code/proof: pending.
- [ ] **V-13 External consultant exchanges** — Returned package reconciles identity and reported differences. State: not-assessed. Code/proof: pending.
- [ ] **V-14 Organization boundaries and activity logs** — Cross-company sharing exposes only authorized content. State: not-assessed. Code/proof: pending.

### W — Whole-life performance, sustainability and risk

Benchmark references: [IES Virtual Environment](https://www.iesve.com/software/virtual-environment), [One Click LCA](https://oneclicklca.com/en-be/software/design-construction), [One Click LCA life-cycle costing](https://oneclicklca.com/en-gb/software/design-construction/life-cycle-costing). These references inform the category; each acceptance requirement is X-Ray's own target.

- [ ] **W-01 Energy modeling exchange** — Geometry, zones and envelope properties reconcile source model. State: not-assessed. Code/proof: pending.
- [ ] **W-02 Thermal and operational simulation** — Weather, occupancy and plant assumptions reproduce benchmark. State: not-assessed. Code/proof: pending.
- [ ] **W-03 Daylight, glare and solar studies** — Location, time and optical assumptions are recorded. State: not-assessed. Code/proof: pending.
- [ ] **W-04 Natural ventilation and airflow** — Openings and boundary conditions match checked scenario. State: not-assessed. Code/proof: pending.
- [ ] **W-05 Acoustic and vibration assessments** — Declared model and frequency range accompany predictions. State: not-assessed. Code/proof: pending.
- [ ] **W-06 Embodied carbon and EPD mapping** — Material quantities map to sourced factors and declared life stages. State: not-assessed. Code/proof: pending.
- [ ] **W-07 Lifecycle cost comparison** — Discount, replacement and maintenance assumptions remain explicit. State: not-assessed. Code/proof: pending.
- [ ] **W-08 Circularity and material reuse** — Reuse options retain recoverability and quality assumptions. State: not-assessed. Code/proof: pending.
- [ ] **W-09 Water consumption and reuse** — Demand, supply and treatment assumptions balance. State: not-assessed. Code/proof: pending.
- [ ] **W-10 Climate and resilience scenarios** — Scenario source and time horizon bind results. State: not-assessed. Code/proof: pending.
- [ ] **W-11 Design risk register** — Risk links to owner, mitigation and unresolved assumptions. State: not-assessed. Code/proof: pending.
- [ ] **W-12 Hazard and emergency planning** — Evacuation/access proposals remain linked to professional review. State: not-assessed. Code/proof: pending.
- [ ] **W-13 Performance targets and dashboards** — Targets compare with attributable measured/calculated results. State: not-assessed. Code/proof: pending.
- [ ] **W-14 As-designed versus in-use review** — Operational evidence compares against matching model revision. State: not-assessed. Code/proof: pending.

### X — Extensibility, automation and AI assistance

Benchmark references: [Firecrawl v2 search API](https://docs.firecrawl.dev/api-reference/endpoint/search), [buildingSMART IDS](https://www.buildingsmart.org/standards/bsi-standards/information-delivery-specification-ids/), [AVEVA Unified Engineering](https://www.aveva.com/en/products/unified-engineering/). These references inform the category; each acceptance requirement is X-Ray's own target.

- [ ] **X-01 Plugin and adapter boundaries** — Extension failure cannot corrupt the project store. State: not-assessed. Code/proof: pending.
- [ ] **X-02 Versioned data schema** — Unsupported schema is rejected with original bytes preserved. State: not-assessed. Code/proof: pending.
- [ ] **X-03 Custom workflows and forms** — Organization can add fields and stages without source-code edits. State: not-assessed. Code/proof: pending.
- [ ] **X-04 Rules and calculation extensions** — Execution is bounded and results identify rule version. State: not-assessed. Code/proof: pending.
- [ ] **X-05 Batch processing queue** — Jobs are resumable, cancellable and individually diagnosed. State: not-assessed. Code/proof: pending.
- [ ] **X-06 AI extraction from source plans** — Suggested object retains exact source region and uncertainty. State: not-assessed. Code/proof: pending.
- [ ] **X-07 AI layout/design proposals** — Proposal is separately reviewable before modifying authored design. State: not-assessed. Code/proof: pending.
- [ ] **X-08 Voice and natural-language actions** — Intended edit is understandable and reversible. State: not-assessed. Code/proof: pending.
- [ ] **X-09 AI pricing research assistant** — Source evidence accompanies suggested supplier match and rate. State: not-assessed. Code/proof: pending.
- [ ] **X-10 Tool permission and secret boundaries** — AI cannot reveal keys or issue unapproved external mutations. State: not-assessed. Code/proof: pending.
- [ ] **X-11 Usage limits and cost reporting** — Provider usage is capped and reported per operation. State: not-assessed. Code/proof: pending.
- [ ] **X-12 Human review and rejection** — Rejected proposal leaves authoritative design unchanged. State: not-assessed. Code/proof: pending.
- [ ] **X-13 Automation provenance** — Prompt/input version, tool and accepted changes are traceable. State: not-assessed. Code/proof: pending.
- [ ] **X-14 Integration health and retries** — Unavailable service is visible and retry does not duplicate work. State: not-assessed. Code/proof: pending.

### Y — Yards, infrastructure, industrial and specialist assets

Benchmark references: [Autodesk Civil 3D](https://www.autodesk.com/uk/products/civil-3d/features), [AVEVA Unified Engineering](https://www.aveva.com/en/products/unified-engineering/), [Trimble Business Center](https://civilconstruction.trimble.com/en/products/software/trimble-business-center). These references inform the category; each acceptance requirement is X-Ray's own target.

- [ ] **Y-01 Road alignments and corridors** — Stationing, profiles and sections reconcile corridor geometry. State: not-assessed. Code/proof: pending.
- [ ] **Y-02 Intersections and swept paths** — Design vehicle envelope follows the selected path and assumptions. State: not-assessed. Code/proof: pending.
- [ ] **Y-03 Rail and transit infrastructure** — Chainage, cant and clearance data remain version-bound. State: not-assessed. Code/proof: pending.
- [ ] **Y-04 Airports, ports and marine works** — Asset-specific geometry and design criteria are explicit. State: not-assessed. Code/proof: pending.
- [ ] **Y-05 Water, sewer and utility networks** — Connectivity, levels and asset IDs reconcile GIS and design. State: not-assessed. Code/proof: pending.
- [ ] **Y-06 Plant P&IDs and isometrics** — Tags and line lists remain consistent across representations. State: not-assessed. Code/proof: pending.
- [ ] **Y-07 Piping stress and support design** — Load cases and boundary conditions match checked solver inputs. State: not-assessed. Code/proof: pending.
- [ ] **Y-08 Mining, quarries and bulk materials** — Survey surfaces and stockpile volumes retain survey dates. State: not-assessed. Code/proof: pending.
- [ ] **Y-09 Power generation and transmission** — Equipment, routes and reviewed clearances remain traceable. State: not-assessed. Code/proof: pending.
- [ ] **Y-10 Telecom and linear utility corridors** — Route changes update crossings, lengths and access constraints. State: not-assessed. Code/proof: pending.
- [ ] **Y-11 Warehouses and logistics yards** — Vehicle movements, storage and pedestrian zones are inspectable. State: not-assessed. Code/proof: pending.
- [ ] **Y-12 Agricultural and rural infrastructure** — Fencing, sheds, irrigation and access reconcile site records. State: not-assessed. Code/proof: pending.
- [ ] **Y-13 Temporary events and modular facilities** — Reusable configuration retains load and installation reviews. State: not-assessed. Code/proof: pending.
- [ ] **Y-14 Brownfield retrofit and decommissioning** — Existing/removed/new assets stay distinct with source evidence. State: not-assessed. Code/proof: pending.

### Z — Zero-loss delivery, release and business continuity

Benchmark references: [Autodesk Forma construction document management](https://construction.autodesk.com/workflows/construction-document-management/), [IBM Maximo](https://www.ibm.com/products/maximo). These references inform the category; each acceptance requirement is X-Ray's own target.

- [ ] **Z-01 Reproducible build identity** — Proof records commit, dirty diff and artifact hashes. State: not-assessed. Code/proof: pending.
- [ ] **Z-02 Desktop install and upgrade** — Upgrade retains real user profile and compatible project data. State: not-assessed. Code/proof: pending.
- [ ] **Z-03 Offline cold start** — Installed app opens source and design without development services. State: not-assessed. Code/proof: pending.
- [ ] **Z-04 Web production parity** — Built site completes the same declared workflows as development. State: not-assessed. Code/proof: pending.
- [ ] **Z-05 Dependency and license inventory** — Bundled components carry required notices and versions. State: not-assessed. Code/proof: pending.
- [ ] **Z-06 Security and tenant isolation** — Adversarial access tests cannot cross project permissions. State: not-assessed. Code/proof: pending.
- [ ] **Z-07 Backup/restore disaster drill** — Clean machine restoration proves complete recoverability. State: not-assessed. Code/proof: pending.
- [ ] **Z-08 Observability without secrets** — Error reports omit keys, private prompts and unauthorized documents. State: not-assessed. Code/proof: pending.
- [ ] **Z-09 Performance and resource limits** — Oversized files fail safely without freezing or partial writes. State: not-assessed. Code/proof: pending.
- [ ] **Z-10 Rollback and forward compatibility** — Failed upgrade can recover last confirmed data revision. State: not-assessed. Code/proof: pending.
- [ ] **Z-11 Support and incident handling** — Reproducible ticket links diagnostics, affected build and recovery. State: not-assessed. Code/proof: pending.
- [ ] **Z-12 Proof expiry after changes** — Dependency changes reopen affected completed acceptance rows. State: not-assessed. Code/proof: pending.
- [ ] **Z-13 Release notes and capability contract** — Users see delivered limits and verified platform support. State: not-assessed. Code/proof: pending.
- [ ] **Z-14 Full working-day acceptance** — Named industry scenario completes create-to-handover-to-reopen with proof. State: not-assessed. Code/proof: pending.

## Industry and professional scenarios

All profiles inherit A/B/D/E/I/J/Q/U/V/Z plus the listed discipline categories. Each starts untested. Building geometry alone does not qualify a professional solver or establish regulatory approval.

| ID | Industry and roles | Day-to-day use case | Inputs → required output | Categories | Status |
|---|---|---|---|---|---|
| IND-01 | Residential architecture; Architect / building designer | Develop an alteration with existing/new/demolished work | Survey and client brief → Coordinated plans, sections, schedules and issue set | A, B, D, E, I, J, Q, U, V, Z, C, R, T, W | not-tested |
| IND-02 | Commercial architecture; Architect / design manager | Coordinate a multi-tenant commercial fit-out | Base build, tenancy requirements and consultant models → Coordinated design, room data and consultant issues | A, B, D, E, I, J, Q, U, V, Z, C, H, N, R, W | not-tested |
| IND-03 | High-rise and mixed-use; Architect / BIM lead | Coordinate repeated floors, cores and facade variants | Tower models and level schedule → Level-aware quantities, coordinated core and issue packages | A, B, D, E, I, J, Q, U, V, Z, C, H, N, R, S | not-tested |
| IND-04 | Drafting and documentation services; Draftsperson / CAD technician | Turn approved markups into a revised drawing set | Redlines, CAD standards and prior issue → Dimensioned drawings, checked references and change register | A, B, D, E, I, J, Q, U, V, Z, C, K, R | not-tested |
| IND-05 | BIM coordination and digital engineering; BIM coordinator / information manager | Federate consultants and resolve clashes | IFC models, origins and information requirements → BCF issues, checked properties and coordinated federation | A, B, D, E, I, J, Q, U, V, Z, C, R, X | not-tested |
| IND-06 | Interior design and fit-out; Interior designer / fit-out contractor | Specify finishes, joinery and furniture for a tenancy | Room brief and measured existing shell → Finish schedules, reflected ceiling plans and procurement list | A, B, D, E, I, J, Q, U, V, Z, C, H, K, M, N, R | not-tested |
| IND-07 | Heritage and conservation; Conservation architect / heritage consultant | Document repairs while retaining existing fabric | Historic records, scans and condition survey → Fabric map, repair schedule and intervention record | A, B, D, E, I, J, Q, U, V, Z, G, K, R, W | not-tested |
| IND-08 | Urban design and planning; Urban designer / planner | Compare precinct massing and public-realm options | GIS constraints, terrain and planning brief → Option study, area schedule and consultation package | A, B, D, E, I, J, Q, U, V, Z, G, L, R, W | not-tested |
| IND-09 | Landscape architecture; Landscape architect | Design planting and hardscape around a building | Survey, planting brief and drainage plan → Planting schedule, grading and maintenance package | A, B, D, E, I, J, Q, U, V, Z, G, L, T, W | not-tested |
| IND-10 | Arboriculture and ecology; Arborist / ecologist | Review tree protection and habitat impacts | Tree survey, habitat mapping and site design → Protection zones, impact register and mitigation plan | A, B, D, E, I, J, Q, U, V, Z, G, L, W | not-tested |
| IND-11 | Surveying and cadastral work; Surveyor | Adjust survey observations and issue site control | GNSS/total-station observations and control → Checked coordinates, closure report and survey plan | A, B, D, E, I, J, Q, U, V, Z, C, G, Y | not-tested |
| IND-12 | Reality capture and scan-to-BIM; Survey technician / modeler | Record a complex existing building and review derived geometry | Point clouds, photos and control targets → Registered cloud, residual report and source-linked model | A, B, D, E, I, J, Q, U, V, Z, G, R, T | not-tested |
| IND-13 | Civil and land development; Civil engineer | Design a serviced subdivision | Terrain, boundaries and utility records → Grading, roads, services, quantities and civil sheets | A, B, D, E, I, J, Q, U, V, Z, G, L, S, Y | not-tested |
| IND-14 | Earthworks and excavation; Earthworks estimator / contractor | Price and stage a cut/fill operation | Existing/proposed surfaces and ground investigation → Volume reconciliation, haul assumptions and work packages | A, B, D, E, I, J, Q, U, V, Z, F, G, L, T, Y | not-tested |
| IND-15 | Roads and highways; Road designer / transport engineer | Revise a corridor and intersection | Alignment criteria, survey and drainage → Plans, profiles, cross-sections and quantities | A, B, D, E, I, J, Q, U, V, Z, G, H, S, Y | not-tested |
| IND-16 | Rail and transit; Rail engineer / station designer | Coordinate track, platform and station services | Rail alignment, envelope and station requirements → Chainage drawings, clearances and systems coordination | A, B, D, E, I, J, Q, U, V, Z, G, H, N, S, Y | not-tested |
| IND-17 | Airports and aviation infrastructure; Airfield engineer / terminal designer | Coordinate apron or terminal works | Airside survey, operations constraints and services → Pavement/service layouts and phased issue package | A, B, D, E, I, J, Q, U, V, Z, F, G, H, N, Y | not-tested |
| IND-18 | Ports, coastal and marine infrastructure; Marine/civil engineer | Plan a wharf retrofit with operating constraints | Bathymetry, structural survey and asset records → Coordinated marine works and inspected asset handover | A, B, D, E, I, J, Q, U, V, Z, G, H, S, Y | not-tested |
| IND-19 | Traffic and transport planning; Transport planner | Check access and circulation around a site | Site plan, vehicle assumptions and movement demand → Swept paths, access option study and assumptions report | A, B, D, E, I, J, Q, U, V, Z, G, L, Y | not-tested |
| IND-20 | Stormwater, drainage and flood studies; Hydrologist / drainage engineer | Test a drainage upgrade under defined rainfall scenarios | Catchments, rainfall data, pipes and levels → Hydraulic results, flood extents and design report | A, B, D, E, I, J, Q, U, V, Z, G, H, W, Y | not-tested |
| IND-21 | Water and wastewater utilities; Water engineer / asset operator | Upgrade a pressure or wastewater network | Asset GIS, demand and operating data → Checked network scenario and construction/operations package | A, B, D, E, I, J, Q, U, V, Z, G, H, O, Y | not-tested |
| IND-22 | Geotechnical and ground engineering; Geotechnical engineer | Assess excavation beside an existing structure | Boreholes, soil tests and groundwater → Staged analysis, displacement results and reviewed report | A, B, D, E, I, J, Q, U, V, Z, G, S, Y | not-tested |
| IND-23 | Structural steel buildings; Structural engineer / steel detailer | Design and detail a braced industrial building | Architectural geometry and design actions → Checked model, connection package and fabrication drawings | A, B, D, E, I, J, Q, U, V, Z, M, S, T | not-tested |
| IND-24 | Concrete and precast construction; Structural engineer / precast detailer | Coordinate reinforcement, embeds and erection | Structural model, member design and supplier constraints → Bar schedules, cast units and installation package | A, B, D, E, I, J, Q, U, V, Z, F, M, S, T | not-tested |
| IND-25 | Timber and mass-timber construction; Timber engineer / fabricator | Coordinate panel joints and erection | Architectural model and material/connection data → Checked panels, cut lists and assembly instructions | A, B, D, E, I, J, Q, U, V, Z, M, S, T, W | not-tested |
| IND-26 | Masonry and retaining walls; Engineer / masonry contractor | Design and quantify stepped retaining work | Survey, loads and ground properties → Checked wall details, block schedule and drainage links | A, B, D, E, I, J, Q, U, V, Z, H, L, S, T | not-tested |
| IND-27 | Bridges and specialist structures; Bridge engineer | Review staged construction of a bridge component | Survey, design loads and construction stages → Verified analysis, detailing and inspection package | A, B, D, E, I, J, Q, U, V, Z, F, G, S, Y | not-tested |
| IND-28 | Facade, glazing and envelope; Facade engineer / glazing contractor | Coordinate curtainwall modules and weatherproof junctions | Facade geometry, performance brief and supplier data → Panel schedule, junction details and reviewed performance | A, B, D, E, I, J, Q, U, V, Z, M, R, S, T, W | not-tested |
| IND-29 | Roofing and cladding; Roofing estimator / installer | Measure a roof with hips, valleys and penetrations | Roof plan, sections and product dimensions → Net/stock quantities, flashing schedule and fixing details | A, B, D, E, I, J, Q, U, V, Z, C, M, R, T | not-tested |
| IND-30 | HVAC and refrigeration; Mechanical services engineer / contractor | Route and size a multi-zone services installation | Room loads, architectural model and equipment data → Coordinated duct/pipe network and commissioning schedule | A, B, D, E, I, J, Q, U, V, Z, H, N, O, W | not-tested |
| IND-31 | Plumbing and gas services; Hydraulic designer / plumber | Coordinate supply, waste and gas in a renovation | Fixture brief, existing services and survey → Risers, layouts, checked calculations and test records | A, B, D, E, I, J, Q, U, V, Z, H, O, T | not-tested |
| IND-32 | Fire protection and life safety; Fire services engineer / specialist | Review fire-system layout and design assumptions | Building occupancy, services geometry and fire strategy → Reviewed system package and inspection/commissioning evidence | A, B, D, E, I, J, Q, U, V, Z, H, N, W | not-tested |
| IND-33 | Electrical building services; Electrical engineer / contractor | Coordinate lighting, power and distribution | Load brief, building model and device data → Circuit schedule, routes and checked calculations | A, B, D, E, I, J, Q, U, V, Z, H, N, O, T | not-tested |
| IND-34 | Controls and instrumentation; Controls engineer / systems integrator | Revise an industrial control loop | P&IDs, device data and control philosophy → Updated I/O, loop drawings, wire lists and test records | A, B, D, E, I, J, Q, U, V, Z, M, N, O, Y | not-tested |
| IND-35 | ICT, security and audiovisual; ICT/AV designer / installer | Coordinate cabling, equipment and coverage | Space brief, rack layouts and device requirements → Port/device schedules, pathways and test handover | A, B, D, E, I, J, Q, U, V, Z, N, O, T | not-tested |
| IND-36 | Renewables, batteries and EV infrastructure; Energy engineer / installer | Design a distributed energy installation | Site, demand, equipment and connection requirements → Reviewed layout, electrical package and asset handover | A, B, D, E, I, J, Q, U, V, Z, G, N, O, W, Y | not-tested |
| IND-37 | Energy, daylight and sustainability consulting; Building performance consultant | Compare envelope and systems alternatives | Thermal model, weather and occupancy assumptions → Checked simulations, carbon/cost comparison and recommendations | A, B, D, E, I, J, Q, U, V, Z, H, L, N, W | not-tested |
| IND-38 | Quantity surveying and cost consultancy; Quantity surveyor | Issue a measured cost plan with alternate options | Drawings, specifications and current rate books → Auditable estimate, assumptions and revision comparison | A, B, D, E, I, J, Q, U, V, Z, P, T, W | not-tested |
| IND-39 | Builders and general contractors; Project manager / builder | Take a tender through procurement and site delivery | Issued drawings, tender scope and programme → Reviewed estimate, work packages, RFIs and closeout | A, B, D, E, I, J, Q, U, V, Z, F, P, T | not-tested |
| IND-40 | Specialty subcontractors; Trade estimator / supervisor | Price, order and install an assigned package | Trade scope, drawings and supplier quotations → Trade takeoff, approved order and progress evidence | A, B, D, E, I, J, Q, U, V, Z, F, P, T | not-tested |
| IND-41 | Joinery, kitchens and furniture; Cabinet designer / manufacturer | Design a fitted assembly and prepare manufacture | Measured room, finishes and hardware catalogue → Panel cuts, edging, hardware BOM and installation drawings | A, B, D, E, I, J, Q, U, V, Z, C, M, P, T | not-tested |
| IND-42 | Metal fabrication, welding and sheet metal; Fabricator / workshop manager | Produce and inspect a custom metal assembly | Part/assembly model and material specifications → Cut/nest package, weld map and inspection traceability | A, B, D, E, I, J, Q, U, V, Z, M, P, S, T | not-tested |
| IND-43 | Fencing, gates and balustrades; Estimator / installer | Measure runs, gates and corner connections | Site plan, boundary measurements and product system → Source-linked takeoff, stock list and installation record | A, B, D, E, I, J, Q, U, V, Z, C, F, L, M, T | not-tested |
| IND-44 | Flooring, tiling, painting and finishes; Finishes estimator / contractor | Price net areas with openings, waste and patterns | Room dimensions, finish schedule and product packs → Reconciled net/purchase quantities and supplier order | A, B, D, E, I, J, Q, U, V, Z, F, L, P, T | not-tested |
| IND-45 | Demolition, remediation and hazardous materials; Demolition planner / specialist | Stage removal while preserving retained assets | Survey, contamination reports and service isolation plan → Removal package, waste traceability and clearance evidence | A, B, D, E, I, J, Q, U, V, Z, F, G, O, W, Y | not-tested |
| IND-46 | Modular and prefabricated construction; DFMA designer / factory coordinator | Release modules through fabrication and installation | Module configuration, interfaces and logistics limits → Revisioned BOM, manufacturing package and site acceptance | A, B, D, E, I, J, Q, U, V, Z, F, M, P, S, Y | not-tested |
| IND-47 | Manufacturing and industrial machinery; Mechanical designer / production engineer | Release a machine assembly to production | Part requirements, supplier components and design model → Checked assembly, manufacturing drawings and released BOM | A, B, D, E, I, J, Q, U, V, Z, M, N, P | not-tested |
| IND-48 | Automotive, aerospace and rail products; Mechanical engineer / quality engineer | Control a precision component design change | Part model, tolerance requirements and change request → Configuration-bound manufacturing and inspection package | A, B, D, E, I, J, Q, U, V, Z, M, N, X | not-tested |
| IND-49 | Medical devices and precision instruments; Product engineer / quality manager | Trace a component requirement through design and inspection | Requirements, CAD and verification protocol → Controlled design history and inspection evidence | A, B, D, E, I, J, Q, U, V, Z, M, X | not-tested |
| IND-50 | Industrial plant, process and chemical facilities; Process/plant engineer | Coordinate a brownfield pipe/equipment modification | P&IDs, point cloud, line list and design conditions → Consistent tags, isometrics and commissioning package | A, B, D, E, I, J, Q, U, V, Z, G, H, N, O, Y | not-tested |
| IND-51 | Mining, quarrying and materials handling; Mine surveyor / asset engineer | Measure stock and coordinate processing infrastructure | Survey surfaces, equipment layouts and asset records → Reconciled quantities and controlled plant change package | A, B, D, E, I, J, Q, U, V, Z, G, M, O, T, Y | not-tested |
| IND-52 | Power generation and transmission; Electrical/civil engineer | Coordinate a substation or transmission upgrade | Network requirements, survey and equipment data → Reviewed routes, electrical/structural package and asset records | A, B, D, E, I, J, Q, U, V, Z, G, N, O, S, Y | not-tested |
| IND-53 | Oil, gas and pipelines; Pipeline engineer / integrity manager | Review a pipeline route and integrity works | Terrain, alignment, operating conditions and inspection data → Route sheets, reviewed stress scope and maintenance record | A, B, D, E, I, J, Q, U, V, Z, G, H, N, O, Y | not-tested |
| IND-54 | Telecommunications infrastructure; Network planner / rollout manager | Plan fibre routes and equipment deployment | GIS, duct/pole records and connection demand → Route/cable schedules, splice plan and field acceptance | A, B, D, E, I, J, Q, U, V, Z, F, G, N, O, Y | not-tested |
| IND-55 | Agriculture and rural infrastructure; Rural designer / contractor | Plan sheds, fences, access and irrigation | Property survey, stock requirements and water data → Site layout, quantities and maintenance records | A, B, D, E, I, J, Q, U, V, Z, G, H, L, O, T, Y | not-tested |
| IND-56 | Events, theatre and exhibition; Production designer / rigging specialist | Coordinate a temporary stage, lighting and flown equipment | Venue geometry, rigging inventory and production brief → Layout, load-review package and installation checklist | A, B, D, E, I, J, Q, U, V, Z, F, M, N, R, S, Y | not-tested |
| IND-57 | Facilities and property management; Facility manager / building operator | Receive a building and schedule ongoing maintenance | As-built package, asset register and warranties → Searchable asset history, work orders and renewal plan | A, B, D, E, I, J, Q, U, V, Z, H, N, O, W | not-tested |
| IND-58 | Public-sector infrastructure owners; Asset manager / public works officer | Prioritize renewal across roads, buildings and utilities | Condition surveys, GIS and budget constraints → Traceable capital programme and asset handover standards | A, B, D, E, I, J, Q, U, V, Z, G, O, W, Y | not-tested |
| IND-59 | Developers, owners and project controls; Development manager / owner's representative | Compare options and track budget through handover | Brief, design options, programme and cost plans → Decision register, approved baseline and closeout package | A, B, D, E, I, J, Q, U, V, Z, F, O, P, R, W | not-tested |
| IND-60 | Building certification and inspection; Building surveyor / inspector | Review a submitted design against selected requirements | Issued documents, evidence and jurisdiction register → Recorded findings, responses and authorized determination | A, B, D, E, I, J, Q, U, V, Z, F, R, W | not-tested |
| IND-61 | Insurance, loss assessment and forensic work; Assessor / forensic engineer | Document damage and compare reinstatement scope | Pre-loss records, photos, survey and inspection findings → Evidence-linked scope, measured costs and limitations | A, B, D, E, I, J, Q, U, V, Z, G, R, S, T | not-tested |
| IND-62 | Education, research and training; Educator / research engineer | Teach or evaluate a reproducible design workflow | Anonymized fixtures and known-answer problems → Repeatable tutorial, assessment and benchmark results | A, B, D, E, I, J, Q, U, V, Z, K, X | not-tested |
| IND-63 | Healthcare, laboratories and clean facilities; Healthcare planner / specialist engineer | Coordinate rooms, specialist services and maintainability | Room data, workflow brief and equipment requirements → Room/equipment schedules and coordinated service package | A, B, D, E, I, J, Q, U, V, Z, H, N, O, W | not-tested |
| IND-64 | Data centres and critical facilities; MEP/operations engineer | Coordinate redundant systems and maintenance access | Load and resilience brief, plant models and asset data → Coordinated systems, reviewed scenarios and commissioning records | A, B, D, E, I, J, Q, U, V, Z, H, N, O, W | not-tested |
| IND-65 | Retail, hospitality and multi-site rollouts; Design manager / rollout coordinator | Adapt a standard fit-out to several sites | Brand template, surveys and local constraints → Controlled site variants, procurement and handover sets | A, B, D, E, I, J, Q, U, V, Z, H, K, M, N, P, R | not-tested |
| IND-66 | Warehousing, logistics and industrial estates; Industrial planner / operator | Coordinate storage, vehicle flows and services | Survey, racking data and operating requirements → Layout, reviewed clearances and asset/maintenance schedule | A, B, D, E, I, J, Q, U, V, Z, F, G, H, N, O, Y | not-tested |
| IND-67 | Shipbuilding and marine fabrication; Marine designer / fabricator | Coordinate equipment, piping and fabricated assemblies | Vessel geometry, system diagrams and material requirements → Controlled assembly, pipe and installation packages | A, B, D, E, I, J, Q, U, V, Z, H, M, N, O, Y | not-tested |
| IND-68 | Recycling, waste and circular construction; Resource recovery planner | Plan selective dismantling and reuse of materials | Asset survey, material inventory and condition evidence → Reuse schedule, recovered quantities and disposal records | A, B, D, E, I, J, Q, U, V, Z, F, O, P, T, W, Y | not-tested |

## Benchmark source register

Primary product documentation reviewed on the date above. Vendor performance and superiority claims are not adopted. Feature availability can vary by version, tier, module, platform and license.

- **ACAD** [Autodesk AutoCAD](https://www.autodesk.com/products/autocad) — 2D/3D drafting and seven discipline toolsets, including plant and raster workflows.
- **REVIT** [Autodesk Revit MEP documentation](https://help.autodesk.com/cloudhelp/2026/ENU/Revit-MEPEng/files/GUID-195C2C6C-5E2C-422E-A44D-FB3FDFDE276A.htm) — Ducts, circuits, piping and connected building-services systems.
- **ARCHICAD** [Graphisoft Archicad Collaborate](https://www.graphisoft.com/en-us/plans-and-products/archicad-collaborate/) — Architecture and MEP authoring, BIMcloud teamwork and BIMx presentation.
- **BIMCLOUD** [Graphisoft BIMcloud teams](https://helpcenter.graphisoft.com/user-guide/134439/) — Teams and permissions across project participants.
- **OPENBUILD** [Bentley OpenBuildings Designer](https://www.bentley.com/software/openbuildings-designer/) — Multidiscipline building modeling, documentation and analysis workflows.
- **CIVIL** [Autodesk Civil 3D](https://www.autodesk.com/uk/products/civil-3d/features) — Survey, surfaces, corridors, pressure networks and civil documentation.
- **OPENSITE** [Bentley OpenSite Designer](https://www.bentley.com/software/opensite-designer/) — Site layout, grading, earthworks and site utility design.
- **TRIMBLE** [Trimble Business Center](https://civilconstruction.trimble.com/en/products/software/trimble-business-center) — Field data, earthwork takeoff, corridors and machine-control models.
- **TBC** [Trimble Business Center command matrix](https://help.fieldsystems.trimble.com/tbc/pdf/tbc-command-matrix-editions-modules.pdf) — Published edition matrix, October 2025: network adjustment, COGO, surfaces and survey drafting.
- **GIS** [Esri ArcGIS Pro](https://www.esri.com/en-us/arcgis/products/arcgis-pro/features) — Spatial analysis, imagery, geoprocessing and extensibility.
- **ETABS** [CSI ETABS](https://www.csiamerica.com/products/etabs) — Building structural modeling, analysis, design and reporting.
- **TEDDS** [Tekla Tedds](https://www.tekla.com/products/tekla-tedds) — Documented structural calculations across materials.
- **PLAXIS** [Bentley PLAXIS 3D](https://www.bentley.com/products/plaxis-3d) — Soil/structure interaction, staged excavation, groundwater and dynamic analysis.
- **WATER** [Bentley OpenFlows Water](https://www.bentley.com/products/openflows-water) — Water-network scenarios, fire flow, water quality and transient analysis.
- **LANDMARK** [Vectorworks Design Suite](https://www.vectorworks.net/en-GB/design-suite) — Architecture, landscape and entertainment design disciplines.
- **RIGGING** [Vectorworks Braceworks](https://www.vectorworks.net/en-CA/braceworks) — Temporary entertainment structure load analysis and engineer review workflows.
- **SOLID** [SOLIDWORKS Design](https://www.solidworks.com/product/solidworks-design) — Parts, assemblies, drawings, sheet metal, weldments and manufacturing connections.
- **NX** [Siemens NX Manufacturing](https://blogs.sw.siemens.com/nx-manufacturing/whats-new-in-nx-for-manufacturing-2606-june-2026/) — June 2026 release covers CAM, additive manufacturing, probing and production data management.
- **EPLAN** [Eplan Electric P8](https://www.eplan.com/de-en/products/eplan-electric-p8/) — Electrical schematics, cross references, device data, wire lists and ERP/PDM connections.
- **AVEVA** [AVEVA Unified Engineering](https://www.aveva.com/en/products/unified-engineering/) — Shared 1D/2D/3D engineering information and continuous asset handover.
- **IES** [IES Virtual Environment](https://www.iesve.com/software/virtual-environment) — Building energy and environmental performance, daylight and lighting design.
- **LCA** [One Click LCA](https://oneclicklca.com/en-be/software/design-construction) — Embodied-carbon assessment from early design through construction.
- **LCC** [One Click LCA life-cycle costing](https://oneclicklca.com/en-gb/software/design-construction/life-cycle-costing) — Construction, operating, maintenance and replacement cost assessment.
- **COSTX** [RIB CostX](https://www.rib-software.com/en/rib-costx) — 2D/3D takeoff, revision comparison, rate databases and linked estimating workbooks.
- **BLUEBEAM** [Bluebeam markups and data](https://www.bluebeam.com/product/markups-and-data/) — Measurements and markups with statuses, custom fields and structured exports.
- **PROCORE** [Procore Project Management](https://www.procore.com/project-management) — Drawings, RFIs, submittals, daily reporting and team workflows.
- **FORMA** [Autodesk Forma construction document management](https://construction.autodesk.com/workflows/construction-document-management/) — Document organization, distribution and permission controls. Current page notes the Autodesk Construction Cloud name transition.
- **ACONEX** [Oracle Aconex](https://www.oracle.com/construction-engineering/aconex/) — Document packages connected to reviews, communications, approvals and history.
- **MAXIMO** [IBM Maximo](https://www.ibm.com/products/maximo) — Asset history, maintenance, inspections, condition and investment planning.
- **BCF** [buildingSMART BCF](https://www.buildingsmart.org/standards/bsi-standards/bim-collaboration-format/) — Open model-issue exchange. This is a standard, not a competing application.
- **IDS** [buildingSMART IDS](https://www.buildingsmart.org/standards/bsi-standards/information-delivery-specification-ids/) — Machine-readable information requirements and IFC checking.
- **FIRECRAWL** [Firecrawl v2 search API](https://docs.firecrawl.dev/api-reference/endpoint/search) — Search with optional page scraping, geographic filters and bounded result counts. Supplier prices still require interpretation and review.
- **DWG** [ACadSharp](https://github.com/DomCR/ACadSharp) — MIT-licensed CAD library evaluated locally for bounded Windows DWG exchange.

## Evidence packet template

For every accepted row: requirement ID; declared platform/scope; base SHA and exact patch; fixture paths and SHA-256; executed action sequence; expected and actual assertions; screenshot paths and visual-review notes; build/test logs; artifact hashes; reviewer/date; residual limits; related industry profiles. Backend-only rows require executed proof; visual rows also require inspected screenshots.

## 2026-09-07 acceptance addendum - bounded growth batch

Reviewed by the coordinating root and sheet/pricing agents on 2026-09-07. This dated addendum updates the initial assessment for the precise scopes below; it does not certify every industry scenario or platform. Earlier generated findings and unchecked broad rows remain historical context, not evidence that these newly verified bounded workflows are absent.

| ID | Accepted scope | Evidence and remaining boundaries |
|---|---|---|
| D-06 | Verified for source-sheet discipline groups, persistent managed order and actual ordered-register download | Development, built-browser and isolated Windows-native checks retain all original page identities and pass reload. Export is a JSON register; authored multi-sheet publishing and rewriting/reordering the source PDF are outside this acceptance. [Slice and source diff](proof/growth/2026-09-07-sheets/completion.md), [production/download proof](proof/growth/2026-09-07-sheets/production-completion.md), [native proof](proof/growth/runner/2026-09-07T13-22-13-315Z-growth-native.log). |
| D-14 | Verified for local original-page, zoom and source-relative-centre bookmarks | Actual pan/zoom, page switching, viewport restoration, resize, reload, removal and failed-write preservation passed. Views remain local project/source metadata; account synchronization and staff sharing are not delivered. [Scoped source hashes](proof/growth/2026-09-07-02-sheets-source/source-manifest.json), [native repeated reloads](proof/growth/runner/2026-09-07T13-21-06-842Z-growth-native.log), [inspected restored viewport](screenshots/growth/2026-09-07-sheets/native-final2-bookmark-reloaded.png). |
| E-01 | Verified for bounded XLSX/CSV preview with no spreadsheet formula execution | Actual worksheet preview, mapped-formula refusal despite cached values, malformed-input preservation and reload passed in the declared browser/Windows scenarios. Limits: 2 MiB source/20 MiB expanded archive; no XLS/XLSM or encrypted files. Rates are QA fixtures, not fetched supplier quotations. [Slice proof](proof/growth/2026-09-07-pricing/completion.md), [native pricing](proof/growth/runner/2026-09-07T13-18-06-335Z-growth-native.log). |
| E-02 | Verified for worksheet/heading selection and SKU/description/unit/rate mapping with row/cell errors | Explicit review precedes saving; source hash, selected worksheet and physical rows survive reload; earlier applied revisions remain unchanged. No inferred currency/unit conversion or original workbook-byte embedding in backups. [Exact source hashes](proof/growth/2026-09-07-03-pricing-source/source-manifest.json), [wave diff](proof/growth/2026-09-07-pricing/implementation.diff), [native pricing](proof/growth/runner/2026-09-07T13-18-06-335Z-growth-native.log). |
| B-10 | Partial overall; read-only integrity/restore-impact milestone verified | Packages and originals are validated before destination reads; explicit target collisions, current/incoming source identities and stale reviews are checked without changing workspace data. Built/native backup capture and preflight passed. Apply/replacement remains unavailable; this does not close B-09 complete restoration, B-11 interruption recovery or B-12 protected writers. [Preflight diff/tests](proof/growth/2026-09-07-recovery/preflight-notes.md), [native backup review](proof/growth/runner/2026-09-07T13-22-44-912Z-growth-native.log), [inspected screenshot](screenshots/growth/2026-09-07-sheets/native-backup-preflight-desktop.png). |

Acceptance identity: branch `feat/architect-cad-engine`, baseline `3e422f0084de607a775c2ede8dfecdf0b032c75e`; frozen source SHA-256 `a8a8c4946d93cafa283a7875b97337719f4c1bce8884b5b4097ab30fc5b29b84`; verified Windows executable SHA-256 `1a6486a3af6425e61996b1641f5ffdeade546df9fa549e4dcafe43209899aa8b`. [Build/test and artifact evidence](proof/growth/2026-09-07-release/README.md) records 95 tests, source-wide typecheck, sequential Dans1 web/native builds, source checks and artifact hashes. [Illustrated stage reports](proof/growth/PROGRESS.md) retain the implementation diffs and inspected evidence. Final native scenarios ran in an isolated profile only; the package was not installed over the normal application and user data remained untouched.

Latest user device scope: tablets, laptops and desktop PCs across Windows/macOS/Linux; phone use is excluded. Earlier phone evidence is retained as history, not a current requirement. This batch verifies the stated built-browser and Windows-native workflows only. Tablet-specific layout, macOS/Linux packages, remaining categories and full working-day industry scenarios require their own acceptance. No overall percentage or comprehensive readiness claim is assigned to the 364-requirement register.

Historical automation failures remain available: viewport CDP EOF after the size applied, a centre check issued before source geometry settled, and an incorrect test details-toggle action. Corrected waits/actions passed without application-source edits or an additional native build.

### Tablet scope checkpoint and pause � 2026-09-07

- [x] D-14 tablet layout sub-check: saved source view retains original page/centre at1024�768 and768�1024; eight lower controls measure at least44�44 and pass viewport/hit checks. Browser emulation evidence: proof/growth/2026-09-07-05-tablet-controls/index.html. Actual tablet hardware acceptance remains open.
- [ ] Native macOS/Linux: blocked by scripts/build-cad.mjs rejecting non-Windows while required by the native beforeBuildCommand. No platform compatibility claim.

Phones are excluded. Work paused at the user's requested safe point after staged pushes. Earlier full-application requirements remain governed by their actual pass/partial/open status; this does not complete the364-item catalogue.
