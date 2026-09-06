# X Ray construction reconstruction research and implementation direction

Research date: 5 September 2026. Prepared for Daniel.

## Recommendation

Build a drawing evidence and component inventory system whose geometry, wireframe, quantities and reports are different views of the same revisioned data. Preserve the source files and attach evidence to individual properties. Expand from reliable takeoffs and component reconstruction into editable authoring and engineering integrations.

The major technical problem is identifying what the drawings collectively describe. A renderer cannot recover information the documents omit. A line can represent a wall edge, dimension extension, hidden object, hatch or demolition annotation. One physical component can appear on several sheets. A typical detail can apply to many physical instances. These relationships must be resolved before a complete count is meaningful.

## Leading commercial reference points

These are relevant advanced platforms, not a verified ranking by market share or enterprise contract value. Prices below are displayed US list prices where confirmed, not Australian quotes or comparable whole-company costs. Vendor descriptions establish advertised scope, not independently measured accuracy.

| Platform | Useful capabilities and product lesson | Pricing evidence |
| --- | --- | --- |
| Bluebeam Revu and Max | Drawing measurements, markup data, collaboration, PDF and BIM coordination. Max adds MCP, stitching and connected Revit sessions. Smart Review and Smart Overlay are in preview. Study how drawing actions retain location and metadata. | Complete US$440 per user per year; Max US$590 introductory annual price. [Pricing](https://www.bluebeam.com/pricing/), [Max](https://www.bluebeam.com/bluebeam-max/) |
| Autodesk Revit and AEC Collection | Parametric building authoring and coordinated drawings. Study relationships that propagate changes through views and schedules. | AEC Collection displayed US$3,675 per year. [Collection](https://www.autodesk.com/collections/architecture-engineering-construction/overview), [Parametric relationships](https://help.autodesk.com/cloudhelp/2024/ENU/Revit-GetStarted/files/GUID-71F2C8EE-2A90-4076-A6C7-702082566DDF.htm) |
| Autodesk Forma Takeoff | Combines 2D measurements with model quantities, classifications, formulas and snapshots. Study how 2D and 3D contributions reconcile in one inventory. | Separate product; no price verified here. [Product](https://construction.autodesk.com/tools/construction-takeoff-software/) |
| Trimble Tekla Structures | Detailed parts, bolts and manufacturing assemblies. Study typed components, assemblies and fabrication information. Its API includes bolt arrays and hierarchical assemblies. | Carbon, Graphite and Diamond subscriptions; no numeric quote verified. [Subscriptions](https://www.trimble.com/en/products/tekla/structures/subscription), [Model API](https://developer.tekla.com/doc/tekla-structures/2026/tekla-structures-model-70705) |
| RIB CostX | Drawing and BIM takeoff, linked estimating workbooks, design revisions and reporting. Study quantity provenance and revision impact. | Custom pricing. [Product](https://www.rib-software.com/en/rib-costx) |
| Solibri | Component information takeoff, room and door relationships, grouping and spreadsheet output. Study information checking alongside geometry. | No current numeric price verified. [Information takeoff](https://www.solibri.com/articles/understanding-information-takeoff-ito) |
| Bentley iTwin and SYNCHRO | Federated engineering data, change history, construction sequencing and model quantity takeoff. Study model federation and phased construction. | No comparable bundle price verified. [iTwin Synchronizer](https://www.bentley.com/software/itwin-synchronizer/), [SYNCHRO](https://www.bentley.com/software/synchro/) |
| CSI ETABS and SAP2000 | Structural analysis and design. ETABS distinguishes analytical and physical models and supports loads, combinations and nonlinear analysis. Integrate with this class of solver as a separate capability. | No current numeric price verified. [Products](https://www.csiamerica.com/products), [ETABS capabilities](https://www.csiamerica.com/products/etabs/compare-levels) |
| Togal | Automated takeoffs and image or symbol searches. A direct comparison for drawing interpretation and estimator workflow. | Growth US$299 per user per month billed yearly, equivalent to US$3,588 annually. [Pricing](https://www.togal.ai/pricing) |
| Procore | Enterprise construction platform; useful reference for project delivery and organisational workflows. | Annual product fees depend on annual construction volume; no universal seat price. [Pricing](https://www.procore.com/pricing) |

MCP itself is already present in commercial and open-source BIM workflows. Differentiation requires reliable identification, reconstruction, quantities, correction tools and traceability across a project's documents.

## Findings from the current repository

This was targeted code inspection, not a full application acceptance test.

- The Ruffles model is a prepared, hash-bound reconstruction. Its output contains 272 objects, including 74 labelled traced and 198 labelled inferred. It establishes a working viewer and evidence inspector, not general automatic PDF reconstruction.
- `engine/python/xray/engine.py` already orchestrates source adapters, text interpretation, scale checks, table extraction and trade-specific quantity modules. PDF, DXF, SVG and IFC source modules exist. Their existence does not prove complete support across production files.
- `engine/python/xray/ifc.py` implements a custom STEP parser and extracts element information. Its current scope should be compared with a complete IFC geometry and relationship implementation before it becomes the foundation for broad BIM interoperability.
- `engine/server/mcp_server.py` already exposes engine_info, run_takeoff, run_takeoff_calibrated, quote_draft, marked_pdf and wireframe_scene. Live MCP integration was not exercised in this research.
- `engine/python/xray/source_wireframe.py` extracts bounded page linework, explicitly for presentation. It is not the semantic building model. It has 30 MiB and 100-page limits.
- Running that extractor against the downloaded 230-page NIST report produced `WireframeError: Page limit exceeded.` This is an executed finding.
- The browser plan import contract caps files at 100 MiB. The downloaded 309 MB drawing package exceeds that as well as the wireframe extractor's limits. The general Python preflight has a separate 300 MiB ceiling.
- `src/studio/wtcModel.ts` contains a procedural tower preset with fixed statistics and normalized coordinates. That file must never count as proof of reconstruction from newly imported WTC drawings.

## The required information model

Use a hierarchy of project, building, storey, zone, assembly and component, with separate relationships for spatial containment, adjacency and system membership. Preserve source occurrences separately from physical instances.

Each physical instance needs a stable internal ID, editable display mark, type, dimensions and units, material, parent assembly, location, phase, revision, source references, property-level evidence, review state and quantity basis. Keep source extraction, reconstruction assumptions and user edits distinct.

Example: B1 is a user-facing bolt mark. Internally the record belongs to a particular connection and storey, with its specification and source detail attached. Its appearance on a plan, section and connection detail is three pieces of evidence for one instance. Stable identity cannot depend on screen position or an AI-generated label alone.

For a hypothetical detail specifying four bolts at each of twelve explicitly identified connections, the result is 48 bolts. That is a rule-derived quantity supported by the connection occurrences and detail, not 48 visually detected symbols. A confirmed count, a rule-derived count, an inference and an unresolved item need distinct labels. A missing diameter can remain unresolved even when the count is known.

Rendering should be derived from this information. Full thread geometry is unnecessary for bolt counting. Use lightweight instances or simplified geometry for navigation, while retaining exact metadata and quantity logic. Quantities must not be calculated by counting mesh triangles, outlines or repeated sheet appearances.

## Development sequence and acceptance criteria

| Stage | Required work | Evidence needed to move forward |
| --- | --- | --- |
| 1 Project ingestion | Multi-file packages, sheet index, revisions, superseded sheets, vector and raster classification, OCR, text and table extraction, resumable jobs and bounded processing | Every PDF page has a recorded result or explicit failure; interrupted ingestion resumes without loss or duplicate pages |
| 2 Source and component register | Stable instances and types, source occurrences, room and system relationships, metadata editor, cross-sheet references, units and per-view calibration | Selecting a component exposes its evidence; repeated views reconcile to the same instance; conflicting facts remain visible |
| 3 Reliable 2D takeoff | Symbol searches, room boundaries, schedule joins, lengths and areas, opening deductions, manual correction and deterministic formulas | Counts match independently checked reference scopes; geometry tolerances are agreed per trade; totals reconcile to their member IDs |
| 4 Reconstruction | Register plans, sections and elevations; establish levels; build constrained wall, slab, opening, roof and connection geometry; preserve unresolved regions | Geometry overlays align with source views; missing heights remain unresolved or explicitly assumed; quantities do not silently depend on visual assumptions |
| 5 Assembly quantities | Type and instance libraries, repeated details, bolt groups, reinforcement, MEP fittings, rule-based subordinate parts and quantity provenance | Known assembly fixtures produce exact expected counts; revisions update affected quantities without duplicates |
| 6 Large-model workbench | Isolation, section boxes, clipping, spatial filters, storey and trade filters, model federation, instancing, progressive loading and spatial indexes | Selection and navigation remain usable on a declared hardware target; performance is measured alongside completeness |
| 7 MCP operations | Typed query, inspect, calculate, propose-edit, apply-edit and export operations; revision checks, idempotency, job progress and audit records | The same scope and source revision produce matching results through UI and MCP; failed operations cannot claim success; edits invalidate affected results |
| 8 Authoring and engineering | Parametric edits, constraints, dimensions, generated drawings, schedules, IFC export, issue exchange and analytical-model adapters | Changes propagate consistently; exports survive round trips; solver results trace to loads, materials, supports, assumptions and model revision |

These are proposed stages and exit criteria, not completed work or delivery-date commitments. Quantified accuracy and runtime targets should be fixed after the first independently checked benchmark scope.

## Components to evaluate for reuse

Evaluate IfcOpenShell for IFC geometry and semantics rather than extending the bespoke parser indefinitely. Its geometry iterator supports multicore processing, caching and reuse. Its current documentation also describes IfcMCP for querying and editing IFC models. These are candidates for integration, not dependencies installed or tested in this session. [Geometry iterator](https://docs.ifcopenshell.org/ifcopenshell/geometry_iterator.html), [IfcMCP](https://docs.ifcopenshell.org/ifcmcp.html).

For native DWG or DGN support, evaluate a licensed adapter such as ODA Drawings SDK. PDF, DXF, DWG and IFC require different import paths; they are not interchangeable containers for equally rich data. [ODA Drawings](https://www.opendesign.com/products/drawings).

Use IFC for model interchange, BCF for model issues and viewpoints, and IDS for machine-readable information requirements. IDS does not replace all geometric or engineering checks. [BCF](https://technical.buildingsmart.org/standards/bcf/), [IDS](https://technical.buildingsmart.org/projects/information-delivery-specification-ids/).

An engineering model requires more than a visible building: analytical connectivity, material behaviour, load cases, combinations, supports and boundary conditions must be explicitly defined. A bolt count does not establish connection capacity. The early product should prepare and exchange evidence with established analysis tools before claiming their scope.

## Recent research relevant to the architecture

Handoff-H1, submitted in August 2026, describes specialised computer vision, tool-using agents and a persistent project representation for blueprint takeoff. Its study uses ten residential sets. Its reported quantity metric accepts a 25 percent tolerance, and the evaluation includes an LLM judge. The results support investigating a hybrid architecture; they do not demonstrate exact high-rise or bolt-level accuracy. Dataset access is by request, and no request was sent. [Paper](https://arxiv.org/abs/2608.15032).

MCP4IFC describes querying and editing IFC using language-model tools. It is a useful implementation reference for agent interaction with structured models; it does not demonstrate complete reconstruction of arbitrary drawings. [Paper](https://arxiv.org/abs/2511.05533).

## Verified difficult source candidates

### Public hospital construction package

Downloaded the DGS Atascadero reroof, HVAC replacement and electrical upgrade main PDF: **425 pages and 308,555,080 bytes**. Inspected pages 1, 31, 151 and 301, covering the index, plan linework, structural enlarged plans and a mechanical demolition roof plan. The procurement listing also provides three specification volumes, supplementary drawing packages and an addendum. This is a renovation package, not a complete fabrication model of the hospital. The cover includes restrictions on reuse; public availability is not a product redistribution or training licence. [Official listing](https://www.dgs.ca.gov/OBAS/Bid-Opportunities), [Main PDF](https://www.dgs.ca.gov/-/media/Divisions/OBAS/Plans-and-Specs/24-235656/4-142452--Main-3319-Plans.pdf).

### World Trade Center evidence

Downloaded and verified **NCSTAR 1-2A, 230 pages**, and **NCSTAR 1-1A volume 2 appendices, 392 pages**. These provide structural investigation evidence and reproduced supporting documents. They are not a verified complete set of tower construction and shop drawings, and cannot establish a count of every bolt. The latter includes documents reproduced with permission, so original rights notices remain relevant. [Reference structural models](https://nvlpubs.nist.gov/nistpubs/Legacy/NCSTAR/ncstar1-2a.pdf), [Structural appendices](https://nvlpubs.nist.gov/nistpubs/Legacy/NCSTAR/ncstar1-1av2.pdf).

### Large coordinated model

West Riverside Hospital is a useful federation and navigation candidate. Xeokit's published examples describe seven discipline models, and its published performance table lists 50,895 objects. These are publisher figures, not measurements made here. An existing BIM model tests import and interrogation, not raw PDF reconstruction. Confirm the original model's permissions and exact version before adopting it as a permanent corpus. [Examples](https://xeokit.io/examples/bimviewer.html), [Published table](https://github.com/xeokit/xeokit.io/blob/master/whitepaper.html).

### Controlled correctness fixtures

Use buildingSMART's certification datasets for focused format tests. Treat the separate community collection as additional input diversity: its maintainers explicitly warn that many samples do not pass validation. Neither collection should automatically be treated as correct ground truth. [Certification](https://github.com/buildingSMART/Certification-datasets), [Community](https://github.com/buildingsmart-community/Community-Sample-Test-Files).

## Recommended first proof

Use a small, fully documented structural connection package for exact part counts, one real multidisciplinary drawing subset for semantic reconstruction, the 425-page package for ingestion and revision handling, and the hospital IFC model for scale. Each answers a different question.

The first end-to-end acceptance scenario should import previously unseen drawings, identify and reconstruct one independently checked scope, isolate it in 2D and 3D, count its components without cross-sheet duplication, expose evidence and unknowns, and reproduce the same takeoff through MCP. Then issue a drawing revision and prove that only affected results change.

A large model that merely renders is a scale demonstration. The desired product is established when its inventory, evidence, measurements and revision behaviour agree with independently checked source information.

## Evidence saved with this report

The three downloaded PDFs, source URLs, SHA-256 hashes, byte sizes and page counts are saved in this directory. DGS candidate links are recorded separately. Visual inspection sheets are under `screenshots/construction-research/`. Only the NIST page-limit rejection was executed through X-Ray during this research; no whole-package reconstruction or quantity acceptance is claimed.
