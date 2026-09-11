// Requirement statements and acceptance cases are X-Ray's proposed product scope,
// not a claim that a benchmark vendor supplies every item in a category.
export const researchedAt = '2026-09-07';
export const sources = [
  ['ACAD','Autodesk AutoCAD','https://www.autodesk.com/products/autocad','2D/3D drafting and seven discipline toolsets, including plant and raster workflows.'],
  ['REVIT','Autodesk Revit MEP documentation','https://help.autodesk.com/cloudhelp/2026/ENU/Revit-MEPEng/files/GUID-195C2C6C-5E2C-422E-A44D-FB3FDFDE276A.htm','Ducts, circuits, piping and connected building-services systems.'],
  ['ARCHICAD','Graphisoft Archicad Collaborate','https://www.graphisoft.com/en-us/plans-and-products/archicad-collaborate/','Architecture and MEP authoring, BIMcloud teamwork and BIMx presentation.'],
  ['BIMCLOUD','Graphisoft BIMcloud teams','https://helpcenter.graphisoft.com/user-guide/134439/','Teams and permissions across project participants.'],
  ['OPENBUILD','Bentley OpenBuildings Designer','https://www.bentley.com/software/openbuildings-designer/','Multidiscipline building modeling, documentation and analysis workflows.'],
  ['CIVIL','Autodesk Civil 3D','https://www.autodesk.com/uk/products/civil-3d/features','Survey, surfaces, corridors, pressure networks and civil documentation.'],
  ['OPENSITE','Bentley OpenSite Designer','https://www.bentley.com/software/opensite-designer/','Site layout, grading, earthworks and site utility design.'],
  ['TRIMBLE','Trimble Business Center','https://civilconstruction.trimble.com/en/products/software/trimble-business-center','Field data, earthwork takeoff, corridors and machine-control models.'],
  ['TBC','Trimble Business Center command matrix','https://help.fieldsystems.trimble.com/tbc/pdf/tbc-command-matrix-editions-modules.pdf','Published edition matrix, October 2025: network adjustment, COGO, surfaces and survey drafting.'],
  ['GIS','Esri ArcGIS Pro','https://www.esri.com/en-us/arcgis/products/arcgis-pro/features','Spatial analysis, imagery, geoprocessing and extensibility.'],
  ['ETABS','CSI ETABS','https://www.csiamerica.com/products/etabs','Building structural modeling, analysis, design and reporting.'],
  ['TEDDS','Tekla Tedds','https://www.tekla.com/products/tekla-tedds','Documented structural calculations across materials.'],
  ['PLAXIS','Bentley PLAXIS 3D','https://www.bentley.com/products/plaxis-3d','Soil/structure interaction, staged excavation, groundwater and dynamic analysis.'],
  ['WATER','Bentley OpenFlows Water','https://www.bentley.com/products/openflows-water','Water-network scenarios, fire flow, water quality and transient analysis.'],
  ['LANDMARK','Vectorworks Design Suite','https://www.vectorworks.net/en-GB/design-suite','Architecture, landscape and entertainment design disciplines.'],
  ['RIGGING','Vectorworks Braceworks','https://www.vectorworks.net/en-CA/braceworks','Temporary entertainment structure load analysis and engineer review workflows.'],
  ['SOLID','SOLIDWORKS Design','https://www.solidworks.com/product/solidworks-design','Parts, assemblies, drawings, sheet metal, weldments and manufacturing connections.'],
  ['NX','Siemens NX Manufacturing','https://blogs.sw.siemens.com/nx-manufacturing/whats-new-in-nx-for-manufacturing-2606-june-2026/','June 2026 release covers CAM, additive manufacturing, probing and production data management.'],
  ['EPLAN','Eplan Electric P8','https://www.eplan.com/de-en/products/eplan-electric-p8/','Electrical schematics, cross references, device data, wire lists and ERP/PDM connections.'],
  ['AVEVA','AVEVA Unified Engineering','https://www.aveva.com/en/products/unified-engineering/','Shared 1D/2D/3D engineering information and continuous asset handover.'],
  ['IES','IES Virtual Environment','https://www.iesve.com/software/virtual-environment','Building energy and environmental performance, daylight and lighting design.'],
  ['LCA','One Click LCA','https://oneclicklca.com/en-be/software/design-construction','Embodied-carbon assessment from early design through construction.'],
  ['LCC','One Click LCA life-cycle costing','https://oneclicklca.com/en-gb/software/design-construction/life-cycle-costing','Construction, operating, maintenance and replacement cost assessment.'],
  ['COSTX','RIB CostX','https://www.rib-software.com/en/rib-costx','2D/3D takeoff, revision comparison, rate databases and linked estimating workbooks.'],
  ['BLUEBEAM','Bluebeam markups and data','https://www.bluebeam.com/product/markups-and-data/','Measurements and markups with statuses, custom fields and structured exports.'],
  ['PROCORE','Procore Project Management','https://www.procore.com/project-management','Drawings, RFIs, submittals, daily reporting and team workflows.'],
  ['FORMA','Autodesk Forma construction document management','https://construction.autodesk.com/workflows/construction-document-management/','Document organization, distribution and permission controls. Current page notes the Autodesk Construction Cloud name transition.'],
  ['ACONEX','Oracle Aconex','https://www.oracle.com/construction-engineering/aconex/','Document packages connected to reviews, communications, approvals and history.'],
  ['MAXIMO','IBM Maximo','https://www.ibm.com/products/maximo','Asset history, maintenance, inspections, condition and investment planning.'],
  ['BCF','buildingSMART BCF','https://www.buildingsmart.org/standards/bsi-standards/bim-collaboration-format/','Open model-issue exchange. This is a standard, not a competing application.'],
  ['IDS','buildingSMART IDS','https://www.buildingsmart.org/standards/bsi-standards/information-delivery-specification-ids/','Machine-readable information requirements and IFC checking.'],
  ['FIRECRAWL','Firecrawl v2 search API','https://docs.firecrawl.dev/api-reference/endpoint/search','Search with optional page scraping, geographic filters and bounded result counts. Supplier prices still require interpretation and review.'],
  ['DWG','ACadSharp','https://github.com/DomCR/ACadSharp','MIT-licensed CAD library evaluated locally for bounded Windows DWG exchange.'],
];

// Letter | category | benchmark IDs | required capability => observable acceptance result
const blocks = [
['A','Administration, accounts and access','BIMCLOUD,FORMA,ACONEX',`
Organization workspaces => Two companies cannot read each other's project records
Individual sign-in and sign-out => Sign-out removes access and cached private views
Staff invitations => An accepted invitation grants only the invited role
Project roles => Viewer cannot edit; estimator cannot approve engineering
Document and field permissions => Restricted rates remain hidden in screens and exports
External guest access => Guest sees only explicitly shared packages
Access revocation => Previously valid links and sessions lose access when revoked
Multi-factor and enterprise identity => Enforced identity policy survives account recovery
Staff directory and teams => Reassignment preserves historical authorship
Audit trail => Actor, time, action and affected revision are recorded
Account recovery and offboarding => Removed staff cannot retain active organization access
Regional settings => Units, currency, date and timezone are explicit per project
Custom fields and classifications => Required fields validate and survive export/import
Organization templates => Template revisions do not silently alter existing projects
`],
['B','Backups, saving and project lifecycle','FORMA,ACONEX',`
Create and name projects => Unique IDs survive duplicate display names
Automatic save feedback => Saved appears only after durable storage succeeds
Save As and duplicate => Copy gets new identity without sharing mutable records
Reopen recent projects => Latest saved revision and source sheets return after restart
Offline local storage => Airplane-mode restart restores drawings and attached originals
Cross-device project storage => Authorized second device opens the same confirmed revision
Archive and restore projects => Archived jobs leave the active list and restore intact
Recycle bin => Accidental removal is recoverable with links and history intact
Portable complete backup => Restore on a clean profile includes sources, models, rates and evidence
Backup integrity preview => Corrupt or missing assets block replacement before any write
Crash and interrupted-write recovery => Last confirmed snapshot survives forced termination
Concurrent edit protection => Stale writer cannot silently overwrite a newer revision
Storage failure recovery => Full disk/quota error preserves previous data and supports retry
Migration and retention => Older supported backups upgrade with a reversible audit record
`],
['C','CAD precision and drawing tools','ACAD',`
Lines, polylines, arcs and circles => Exact coordinates survive save and CAD exchange
Splines and curves => Control points and curve tolerance survive supported exchanges
Object snaps and tracking => Endpoint, midpoint, perpendicular and intersection picks are correct
Numeric and relative entry => Typed distance/angle yields the expected measured geometry
Coordinate systems and origins => Local and project origins transform without drift
Layers and visibility => Hidden, locked and isolated layers retain correct entity membership
Selection and properties => Window/crossing selection and batch edits affect intended objects only
Move, rotate, scale and copy => Transform and undo preserve dimensions and IDs
Offset, trim, extend and fillet => Edge cases retain valid connected geometry
Blocks and reusable symbols => Definition update changes intended instances without broken attributes
Constraints and parameters => Driving dimension regenerates dependent geometry consistently
Dimensions, leaders and text => Annotation values update and plot legibly at scale
Hatches, lineweights and plot styles => Screen and exported output agree on declared styles
Undo, redo and transaction history => One user operation undoes atomically without losing active context
`],
['D','Documents, sheets and drawing registers','ACAD,BLUEBEAM,ACONEX',`
Multi-file and multi-page import => PDFs with different page sizes preserve every original page
Sheet names and numbers => Rename changes labels without breaking evidence references
Add and duplicate drawing sheets => New sheet receives an independent identity and layout
Remove with impact preview => Review lists dependent takeoffs, links and viewports before removal
Restore removed sheets => Restored sheet recovers annotations, scale and original ordering
Reorder and group sheets => Discipline groups and order persist after restart and export
Title blocks and templates => Project metadata updates linked fields without clipping
Viewports and per-view scale => Independent scales measure correctly in exported PDF
Drawing revisions and supersession => Old revision remains retrievable and visibly superseded
Revision overlay and slip-sheeting => Added/deleted geometry is inspectable with alignment controls
OCR and sheet indexing => Suggested names are reviewable and uncertainty is visible
Cross-sheet references and hyperlinks => Detail callout opens the intended sheet revision
Batch printing and issue sets => Selected sheets export in reviewed order with an issue register
Bookmarks and saved views => Personal navigation restores the correct page and viewport
Visual and vector revision delta => Two issued revisions report added, removed and changed geometry with a quantity variance table
`],
['E','Estimation, pricing and commercial work','COSTX,LCC',`
Pricing workbook import => XLSX/CSV sheets preview without executing spreadsheet formulas
Column and worksheet mapping => SKU, description, unit and rate map with row-level errors
Named price books and revisions => Supplier revisions coexist and old estimates remain reproducible
Currency, tax and effective dates => Mixed currencies never total without a reviewed conversion
Unit and pack normalization => Each/metre/square-metre/pack conversion shows its dimensional basis
Apply and remove a price book => Impact preview preserves manual overrides and supports undo
Supplier quote comparison => Equal specifications compare landed cost and exclusions
Material, labour and plant build-ups => Assembly rate reconciles to separately editable components
Waste, yield and productivity => Assumptions remain separate from measured net quantities
Discount, margin and contingency => Formula order is explicit and totals independently reconcile
Tender alternates and scenarios => Base and options compare without altering the accepted baseline
Escalation and exchange rates => Source and effective date bind each applied factor
Quote approval and issue => Issued estimate freezes rates, quantities, exclusions and revision
Cost-to-complete and variations => Approved changes reconcile original budget to current forecast
Preliminaries and site allowances => Time-related and site-wide costs are built up separately from measured rates and carry into the estimate without double counting
`],
['F','Field work, construction and site delivery','PROCORE,BLUEBEAM',`
Offline field packages => Required drawings and checklists open without connectivity
RFIs => Question links to exact drawing revision and tracks response/closure
Submittals and shop drawing review => Review route, due date and resubmission history persist
Daily site reports => Labour, plant, weather and work records retain author and attachments
Tasks and punch lists => Assigned location-based defect closes only with recorded evidence
Inspection and test plans => Hold points prevent progression until authorized release
Photos, videos and geolocation => Original media and capture context survive synchronization
Field markups and as-built capture => Redline links to source and proposed changed object
Delivery docket and receiving => Received quantities reconcile order and damaged/rejected goods
Crew timesheets and productivity => Approved hours reconcile work package quantities
Permits and safety observations => Expired permits and unresolved hazards remain visible
Temporary works and lift planning => Reviewed configuration links to checked calculation package
Progress quantities and claims => Claimed installed work reconciles verified measured evidence
Offline synchronization conflicts => Conflicting field edits require review without losing either copy
`],
['G','Geospatial, surveying and reality capture','GIS,TBC,TRIMBLE',`
CRS, datum and geoid management => Known survey control transforms within stated tolerance
Survey points and coding => Point IDs, descriptions and units survive field-data import
Traverses and network adjustment => Closure and residuals match an independent benchmark
GNSS and total-station exchange => Supported observation metadata and quality flags persist
COGO and boundaries => Bearings, distances and closure reproduce the survey input
Terrain surfaces and breaklines => Triangulation respects boundaries, breaklines and holes
Contours and spot elevations => Labels and contours match the underlying surface
Point-cloud import and indexing => Large dataset streams with declared coordinate accuracy
Registration and control fitting => Residuals and excluded control points are reported
Scan-to-model review => Derived object retains source region and uncertainty
Drone imagery and orthophotos => Ground control and image resolution remain traceable
GIS layers and spatial queries => Attribute filters and spatial selections return known fixtures
Stakeout and machine-control export => Independent device/parser verifies coordinates and units
Change and deformation surveys => Time-stamped comparisons separate movement from registration error
`],
['H','HVAC, hydraulics, plumbing and fire services','REVIT,WATER',`
Connected system topology => Equipment, terminals and branches form a validated network
Duct routing and fittings => Size, elevation, clearance and fitting rules persist
Airflow and pressure calculations => Known network matches checked design calculation
Heating and cooling loads => Zone assumptions and weather input reproduce benchmark results
Equipment selection schedules => Selected duty reconciles specified performance and source data
Water supply and sanitary routing => Pipe size, fall and connection direction are inspectable
Hydraulic networks and pumps => Flow, head and operating point match reference cases
Stormwater and roof drainage => Catchment, design event and outlet capacity remain linked
Sprinkler and hydrant systems => Reviewed coverage and demand calculations retain edition/jurisdiction
Gas and process services => Service compatibility and design conditions are explicit
Insulation and supports => Quantities distinguish bare pipe, insulation and support spacing
Plantroom access and coordination => Maintenance clearances are checked against actual geometry
Risers, schematics and schedules => Changes propagate consistently between representations
Commissioning and balancing records => As-tested performance links to installed equipment revision
`],
['I','Interoperability, imports and integrations','ACAD,DWG,BCF,IDS',`
DXF import/export => Independent reader verifies supported geometry, layers and units
Native Windows DWG exchange => Binary file opens independently; unsupported objects are disclosed
IFC geometry and property exchange => Declared schema validates with correct object identity
BCF issue exchange => Viewpoint, object references and discussion survive a second application
LandXML and civil exchange => Alignments, surfaces and units pass independent readback
STEP, IGES and manufacturing exchange => Declared solids and tolerances survive a second kernel
Point-cloud and GIS formats => LAS/E57/GeoJSON support is explicit and independently checked
PDF, image and vector export => Clipping, scale, fonts and transparency render correctly
Spreadsheet and tabular export => Column types, escaping and formulas are handled predictably
Referenced file management => Missing external dependencies are reported before issue
Connector authentication => Provider permissions and token revocation are tested
Versioned API and webhooks => Retries use idempotency and durable acknowledgement
Import preview and cancellation => Invalid/cancelled import leaves current project unchanged
Compatibility and loss reports => Every conversion lists supported scope and detected losses
`],
['J','Jobs, programmes and commercial administration','PROCORE,ACONEX',`
Client, site and contact records => Project links remain valid when contact details change
Brief and requirements register => Each requirement links to a responsible person and deliverable
Scope, exclusions and assumptions => Issued scope is immutable and changes are revisioned
Work breakdown and cost codes => Tasks, quantities and costs roll up without duplicates
Programme and dependencies => Date changes recalculate dependent tasks and reveal conflicts
Design deliverables and milestones => Overdue deliverables remain assigned and visible
Resources and capacity => Overallocated people and equipment are identifiable
Contracts and commitments => Approved scope and committed amount reconcile to supplier records
Change events and approvals => Proposed variation cannot enter approved totals prematurely
Procurement schedule => Required-on-site dates reconcile lead time and order status
Meeting decisions and actions => Decision links to affected document and assigned follow-up
Progress payment evidence => Claimed work links to approved measurement and period
Portfolio search and reporting => User only sees permitted jobs and correct aggregate totals
Closeout and lessons learned => Complete record archives and reopens with its issue history
`],
['K','Knowledge, libraries and reusable standards','ACAD,SOLID,EPLAN',`
Component and assembly libraries => Reuse preserves source, units and revision identity
Manufacturer product catalogues => Model/specification maps to an identifiable product
Detail and symbol libraries => Inserted detail retains attribution and discipline metadata
Organization naming conventions => Invalid drawing/asset names produce actionable validation
Classification mapping => Local codes map explicitly to selected classification systems
Specification clauses => Object properties link to the issued specification revision
Calculation templates => Inputs, formulas and validated range remain visible
Custom property sets => Type-safe fields survive import, duplication and export
Search and tags => Material, detail and project search returns permission-filtered results
Favourite tool palettes => User presets restore without changing project data
Library change control => Updating master content offers review before replacing instances
Content provenance and licensing => Restricted content cannot be silently redistributed
Training and contextual help => New user can complete a fixture workflow without hidden steps
Organization template portability => Import checks dependencies and conflicting identifiers
`],
['L','Landscape, land development and public realm','LANDMARK,OPENSITE',`
Site constraints and setbacks => Mapped constraints remain visible in design and issue sheets
Grading and drainage design => Surface edits produce consistent slopes and catchments
Cut/fill and earthworks => Independent volumes reconcile existing and proposed surfaces
Planting and species schedules => Counts, spacing, maturity and stock sizes reconcile plans
Irrigation networks => Zones, demand and equipment link to checked hydraulic inputs
Hardscape and paving patterns => Edge cuts and net areas reconcile layout geometry
Retaining walls and terraces => Height/level changes update quantities and sections
Accessible paths and ramps => Slopes and landings report measured values against selected criteria
Street furniture and lighting => Location schedule matches placed assets
Arboriculture and tree protection => Surveyed trees retain condition, exclusion zone and decision history
Erosion, sediment and water-sensitive design => Staging and treatment assumptions remain recorded
Playgrounds, parks and sports facilities => Equipment clearances and maintenance needs are traceable
Habitat and biodiversity schedules => Habitat areas and stated assessment method remain inspectable
Landscape maintenance handover => Planting, irrigation and warranty records follow installed assets
`],
['M','Manufacturing, mechanical design and fabrication','SOLID,NX,EPLAN',`
Parametric parts and feature history => Dimension change regenerates a valid part or explains failure
Assemblies, mates and interference => Assembly motion and collision checks match known fixtures
Tolerances and GD&T => Drawing annotations bind to intended datum and feature
Sheet metal and flat patterns => Bend allowance and unfolded dimensions match fabrication reference
Weldments and structural frames => Cut list reconciles lengths, end treatments and members
Joinery and cabinet manufacture => Panels, edging, hardware and drilling reconcile assembly
Part numbers, BOM and configurations => Variant BOM contains exactly the selected components
Nesting and stock optimization => Kerf, grain and remnants are respected in material yield
CAM toolpaths and posts => Independent simulation validates chosen machine/post combination
Additive manufacturing preparation => Wall limits, supports and build orientation are checked
Tooling, jigs and fixtures => Setup constraints and reference positions are documented
Weld maps and traceability => Weld procedure and inspection link to material and serial identity
Quality inspection and metrology => Measured deviations reconcile nominal geometry and tolerance
Engineering change and release => Released manufacturing package remains reproducible after changes
`],
['N','Networks, electrical, controls and communications','REVIT,EPLAN',`
Single-line and circuit diagrams => Circuit identity is consistent across drawings and schedules
Electrical load schedules => Diversity and connected demand reconcile checked inputs
Cable sizing and voltage drop => Selected assumptions reproduce a checked calculation
Protection and fault coordination => Device curves and fault assumptions are version-bound
Lighting layout and calculations => Fixture data and measured illuminance match reference cases
Earthing and lightning protection => Conductors and test points link to reviewed design criteria
Panel and switchboard schedules => Ways, phases and equipment reconcile connected circuits
Cable tray and containment routes => Lengths, fill and clearances follow actual routing
Controls, PLC and I/O schedules => Each tag maps consistently to device, terminal and channel
Telecommunications and fibre => Ports, fibres, splices and loss budgets remain traceable
Security, CCTV and access systems => Device coverage and restricted credentials stay separate
Solar, batteries and EV charging => Equipment, demand and connection assumptions are explicit
Instrumentation and loop diagrams => Tag and loop changes propagate through affected documents
Testing and electrical handover => Test results link to installed circuit and equipment revision
`],
['O','Operations, facilities and asset management','MAXIMO,AVEVA',`
Asset register and location hierarchy => Installed asset is findable by ID, space and system
O&M manuals and warranties => Exact asset links to current manual and warranty dates
Commissioning and practical completion => Open defects remain visible at handover
Preventive maintenance plans => Recurrence generates the correct due work orders
Reactive work orders => Request progresses through assignment, execution and verification
Condition inspection and history => Condition scores retain method, date and supporting evidence
Spare parts and maintenance inventory => Consumption links to work order and stock balance
QR/barcode field lookup => Scan resolves correct asset and permitted records
Space and occupancy management => Space changes reconcile floor area and assigned occupancy
Metering and performance trends => Time-series units, gaps and calibration are explicit
Sensor/BMS integrations => Disconnected or stale feed cannot appear current
Service contractors and SLAs => Escalations respect priority, business hours and contract
Lifecycle renewal and budgets => Replacement forecasts retain condition and cost assumptions
Decommissioning and disposal => Retired assets preserve records and disposal evidence
`],
['P','Procurement, products and pricing research','FIRECRAWL,COSTX,PROCORE',`
User-initiated Firecrawl search => Explicit query returns bounded real source links or honest failure
Supplier and regional filters => Results show selected country, supplier and search timestamp
Structured product extraction => SKU, specification, price basis and source excerpt are reviewable
Variant and product matching => Different grade/size/finish cannot silently substitute requested item
Price basis and availability => Ex-tax/inc-tax, pack size, stock and delivery conditions remain explicit
Missing and quoted-only prices => Unknown price remains unknown instead of zero or invented value
Price freshness and provenance => Each rate retains retrieval time, source URL and quoted currency
Review before rate application => Unreviewed research never changes project costs
Provider budgets and credentials => Secrets remain server/native-only and requests respect limits
Search cancellation and retry => Cancel stops application; rate limits retain existing data
RFQ preparation and comparisons => Supplier offers compare matched scope and exclusions
Purchase orders and approvals => Only approved quantities/rates enter issued orders
Lead times, alternates and substitutions => Approved alternative retains original specification and decision
Receiving, returns and reconciliation => Ordered, delivered, returned and invoiced quantities reconcile
`],
['Q','Quality, checking, compliance and proof','IDS,ETABS,BLUEBEAM',`
Requirement-to-evidence traceability => Each acceptance item points to exact fixture and output
Smoke tests per delivered change => Actual screen renders with no uncaught runtime failures
Screenshot and code-diff proof => Completed UI row has inspected PNG plus matching source diff
Model geometry validation => Invalid solids, overlaps and missing faces are detected and explained
Information requirement checking => Missing required properties fail the selected rule set
Clash and clearance checking => Known hard and clearance clashes are detected without duplicates
Drawing/model/quantity consistency => Edit updates all linked outputs or marks them stale
Engineering benchmark validation => Independent known cases verify results and supported range
Jurisdiction and edition register => Every compliance claim identifies applicable published criteria
Review and professional sign-off => Checker identity and limitations remain attached to issued result
Evidence integrity and reproducibility => Hashes bind source, app build, fixture and result
Regression and adversarial tests => Malformed files, cancellations and stale edits preserve data
Release and installed-app verification => Installed binary and packaged resources match tested build
Honest capability states => Planned, partial, failed and verified remain visibly distinct
`],
['R','Review, visualization and coordination','ARCHICAD,BCF,BLUEBEAM',`
Orbit, pan, zoom and fit => Model remains reachable at different scales and aspect ratios
Walk and fly navigation => Movement direction, collision and floor levels match visible controls
Section boxes and clipping => Clipped geometry and caps reveal intended interior sections
Visibility by discipline and phase => Saved views reproduce selected object sets
Source-linked 3D inspection => Picked object opens matching source evidence and assumptions
Roof and facade integrity => Gables join roof slopes without floating faces or hidden duplicate surfaces
Materials, lighting and render views => Export matches saved camera and material settings
Viewpoint snapshots => Snapshot retains camera, selection, model revision and annotation
Measurement in 3D => Picked distance reports coordinates and units with known accuracy
Markups and threaded issues => Issue preserves author, status, due date and model references
Design options and comparisons => Alternative model changes are inspectable against baseline
Federated model coordination => Different origins, versions and disciplines align explicitly
Client presentations and approval => Viewer comments bind to the exact presented revision
Image/video export and accessibility => Output is legible and controls support keyboard operation
`],
['S','Structural and specialist engineering','ETABS,TEDDS,PLAXIS',`
Analytical model and connectivity => Nodes, releases and offsets reproduce intended load path
Materials, sections and member libraries => Selected values retain source and design units
Loads, combinations and mass => Applied load totals and combination factors reconcile
Linear and second-order analysis => Reference frame forces and displacements match independent results
Dynamic, seismic and wind studies => Modes, damping and hazard assumptions remain inspectable
Steel and cold-formed design => Utilization and governing checks match benchmark calculations
Reinforced and prestressed concrete => Reinforcement, serviceability and detailing remain traceable
Timber, masonry and composite design => Declared material method and limitations accompany results
Connections, base plates and anchors => Connection forces link to verified member/load case
Foundations and soil interaction => Bearing, settlement and pile assumptions match geotechnical inputs
Retaining structures and excavations => Stages and groundwater conditions bind each result
Bridges, tanks, towers and specialty assets => Selected solver scope explicitly supports the asset type
Fabrication detailing and reinforcement schedules => Marks, quantities and geometry reconcile issued drawings
Calculation reports and check signatures => Inputs, equations, units, solver version and reviewer are retained
`],
['T','Takeoff, measurement and quantities','COSTX,BLUEBEAM,TRIMBLE',`
Scale calibration per sheet => Known distance measures correctly after rotation and reload
Separate axes and distorted scans => Calibration records anisotropy or blocks unsupported measurement
Lengths, perimeters and counts => Totals match independently measured fixture values
Areas, holes and net deductions => Openings subtract once and self-intersections are rejected
Volumes, slopes and elevations => 3D quantity basis distinguishes projected from actual surface
Trade and work-package classification => Reclassification updates totals without duplicate measurements
Assembly breakdowns => Element quantity decomposes into explicit materials and assumptions
Duplicate detection and exclusions => Overlapping takeoffs are reviewable before totaling
Revision quantity comparison => Additions, removals and changed quantities reconcile prior issue
Measurement source links => Each quantity opens exact page, region and source revision
Stock lengths, packs and wastage => Purchased quantities remain distinct from net measured demand
Manual, model and AI quantity provenance => User can distinguish and review each quantity origin
Reconciliation and audit exports => Summary totals reproduce detailed rows with units and rounding
Bulk edit, undo and recovery => Batch operation restores all affected quantities and associations
Cost code and classification binding => Every measured item maps to a user-definable classification hierarchy and reports with no unclassified residue
`],
['U','Usability, performance and everyday flexibility','BLUEBEAM,ACAD',`
Role-specific workspace presets => Architect and estimator get useful tools without separate data copies
Search, command palette and shortcuts => Common commands work from keyboard and show discoverable labels
Resizable panels and saved layouts => Layout restores on the user's monitor without hiding actions
Large plan/model navigation => Representative heavy fixture meets recorded load and interaction budget
Accessible focus, contrast and labels => Core workflow is usable without pointer or color alone
Touch and small-screen field use => Critical actions remain reachable without horizontal clipping
Multi-monitor and high-DPI desktop => Dialogs and text remain visible at tested scaling levels
Progress, cancellation and background jobs => Long operation shows honest status and can be stopped
Useful validation and empty states => User can recover from invalid input without losing edits
Bulk operations and multi-selection => Preview clearly reports affected items before applying changes
Per-user preferences and units => Preference changes do not reinterpret existing geometry
Localization and terminology => Industry-specific terms do not change underlying data meaning
Onboarding and sample isolation => Sample work cannot be mistaken for the user's source project
Support diagnostics and recovery guidance => Export omits secrets and includes reproducible failure context
`],
['V','Versioning, collaboration and staff handoff','BIMCLOUD,BCF,ACONEX,FORMA',`
Named project versions => Saved milestone reopens exact drawing, sources and commercial state
Change comparisons => Reviewer can inspect changed objects, quantities, documents and rates
Staff handoff package => Fresh recipient profile restores complete reviewed project context
Selective package content => Private rates and unrelated documents are excluded by review
Recipient and distribution list => Intended staff and access level are visible before sending
Transmittals and receipts => Sent status requires durable receipt rather than button click
Download links and expiry => Revoked or expired link cannot fetch protected documents
Assignments and notifications => Task owner receives only relevant authorized information
Comments and review decisions => Replies retain authorship and referenced revision
Checkout/reservation and live collaboration => Concurrent edits resolve without silent last-writer loss
Merge and conflict review => Both versions remain recoverable until explicit resolution
Approval stages and issued status => Work-in-progress cannot appear as approved construction issue
External consultant exchanges => Returned package reconciles identity and reported differences
Organization boundaries and activity logs => Cross-company sharing exposes only authorized content
`],
['W','Whole-life performance, sustainability and risk','IES,LCA,LCC',`
Energy modeling exchange => Geometry, zones and envelope properties reconcile source model
Thermal and operational simulation => Weather, occupancy and plant assumptions reproduce benchmark
Daylight, glare and solar studies => Location, time and optical assumptions are recorded
Natural ventilation and airflow => Openings and boundary conditions match checked scenario
Acoustic and vibration assessments => Declared model and frequency range accompany predictions
Embodied carbon and EPD mapping => Material quantities map to sourced factors and declared life stages
Lifecycle cost comparison => Discount, replacement and maintenance assumptions remain explicit
Circularity and material reuse => Reuse options retain recoverability and quality assumptions
Water consumption and reuse => Demand, supply and treatment assumptions balance
Climate and resilience scenarios => Scenario source and time horizon bind results
Design risk register => Risk links to owner, mitigation and unresolved assumptions
Hazard and emergency planning => Evacuation/access proposals remain linked to professional review
Performance targets and dashboards => Targets compare with attributable measured/calculated results
As-designed versus in-use review => Operational evidence compares against matching model revision
`],
['X','Extensibility, automation and AI assistance','FIRECRAWL,IDS,AVEVA',`
Plugin and adapter boundaries => Extension failure cannot corrupt the project store
Versioned data schema => Unsupported schema is rejected with original bytes preserved
Custom workflows and forms => Organization can add fields and stages without source-code edits
Rules and calculation extensions => Execution is bounded and results identify rule version
Batch processing queue => Jobs are resumable, cancellable and individually diagnosed
AI extraction from source plans => Suggested object retains exact source region and uncertainty
AI layout/design proposals => Proposal is separately reviewable before modifying authored design
Voice and natural-language actions => Intended edit is understandable and reversible
AI pricing research assistant => Source evidence accompanies suggested supplier match and rate
Tool permission and secret boundaries => AI cannot reveal keys or issue unapproved external mutations
Usage limits and cost reporting => Provider usage is capped and reported per operation
Human review and rejection => Rejected proposal leaves authoritative design unchanged
Automation provenance => Prompt/input version, tool and accepted changes are traceable
Integration health and retries => Unavailable service is visible and retry does not duplicate work
`],
['Y','Yards, infrastructure, industrial and specialist assets','CIVIL,AVEVA,TRIMBLE',`
Road alignments and corridors => Stationing, profiles and sections reconcile corridor geometry
Intersections and swept paths => Design vehicle envelope follows the selected path and assumptions
Rail and transit infrastructure => Chainage, cant and clearance data remain version-bound
Airports, ports and marine works => Asset-specific geometry and design criteria are explicit
Water, sewer and utility networks => Connectivity, levels and asset IDs reconcile GIS and design
Plant P&IDs and isometrics => Tags and line lists remain consistent across representations
Piping stress and support design => Load cases and boundary conditions match checked solver inputs
Mining, quarries and bulk materials => Survey surfaces and stockpile volumes retain survey dates
Power generation and transmission => Equipment, routes and reviewed clearances remain traceable
Telecom and linear utility corridors => Route changes update crossings, lengths and access constraints
Warehouses and logistics yards => Vehicle movements, storage and pedestrian zones are inspectable
Agricultural and rural infrastructure => Fencing, sheds, irrigation and access reconcile site records
Temporary events and modular facilities => Reusable configuration retains load and installation reviews
Brownfield retrofit and decommissioning => Existing/removed/new assets stay distinct with source evidence
`],
['Z','Zero-loss delivery, release and business continuity','FORMA,MAXIMO',`
Reproducible build identity => Proof records commit, dirty diff and artifact hashes
Desktop install and upgrade => Upgrade retains real user profile and compatible project data
Offline cold start => Installed app opens source and design without development services
Web production parity => Built site completes the same declared workflows as development
Dependency and license inventory => Bundled components carry required notices and versions
Security and tenant isolation => Adversarial access tests cannot cross project permissions
Backup/restore disaster drill => Clean machine restoration proves complete recoverability
Observability without secrets => Error reports omit keys, private prompts and unauthorized documents
Performance and resource limits => Oversized files fail safely without freezing or partial writes
Rollback and forward compatibility => Failed upgrade can recover last confirmed data revision
Support and incident handling => Reproducible ticket links diagnostics, affected build and recovery
Proof expiry after changes => Dependency changes reopen affected completed acceptance rows
Release notes and capability contract => Users see delivered limits and verified platform support
Full working-day acceptance => Named industry scenario completes create-to-handover-to-reopen with proof
`],
// SO and PH were added 2026-09-11 from the first six industry specifications in
// planning/industry-specs/. Both hold requirements that no existing A-Z row held:
// converting measurement into a buildable arrangement, and distinguishing existing
// fabric from new work. Proposal and rationale: planning/PROPOSED-REGISTER-EXPANSIONS.md
['SO','Set-out and discrete optimisation','ACAD,COSTX,SOLID',`
Modular division and bay set-out => A run divides into bays within a maximum spacing and the remainder is resolved by a stated rule
Stock nesting and cut-list packing => Required lengths pack into orderable stock with reported offcuts and no silent rounding
Sheet, panel and roll layout => Surface elements set out for cover width, laps and staggered joints with cut waste reported
True surface geometric development => Plan projections develop to true lengths and areas for a stated pitch, including unequal-pitch intersections
Slope set-out and clearance solver => Stepping or raking is chosen against a stated threshold and resulting ground gaps are reported
`],
['PH','Phasing, existing fabric and demolition','ARCHICAD,REVIT,PROCORE',`
Element lifecycle status => Existing, demolished, new and repaired elements stay visually and quantitatively distinct
Demolition and strip-out scheduling => Removed work reports disposal, salvage and hazardous allowances separately from new work
Existing interface and tie-in matching => Legacy profiles and tie-in points are recorded with any substitution mismatch disclosed
`],
];

export const categories = blocks.map(([id,title,benchmarks,body]) => ({
  id,title,benchmarks:benchmarks.split(','),
  items:body.trim().split('\n').map((line,i)=>{
    const [name,acceptance]=line.split(' => ');
    return {id:`${id}-${String(i+1).padStart(2,'0')}`,name,acceptance,state:'not-assessed',delivery:'open',evidence:[],code:[]};
  }),
}));
