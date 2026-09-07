# Architectural drafting roadmap

Source: sascscsc.md supplied by the user on 2026-09-06. This expands the product direction; listed capabilities are requirements, not claims that they are implemented.

1. [ ] Shared parametric assemblies: layered walls, stable physical IDs, clean wall junctions, hosted openings with healing/swing/sill/head, roof footprints/edge pitches/eaves/fascia/gutters, slabs and level offsets. Assembly decomposition must feed the same material register used by drawing takeoff.
2. [ ] Precision CAD: endpoint/midpoint/center/intersection/perpendicular/tangent/extension snaps, direct millimetre entry, polar/ortho/custom angles, offset/trim/extend/fillet/mirror. Audit existing controls before extending them.
3. [ ] Associative documentation: linked dimensions, grids/datums, room polygons/area/perimeter/height, standard hatching, door/window schedules.
4. [ ] Live floor/elevation/section views and scaled A1/A3 sheets, title blocks, revisions, north arrows and scale bars.
5. [ ] Interoperability: verify existing DXF support, choose a supported DWG implementation/license, IFC export and vector PDF with correct scales and lineweights. Roundtrip proofs are required.
6. [ ] Cost-as-you-draw: derive quantities from assemblies; bind real supplier rate revisions and explicit waste/allowances without double counting. Unsupported pricing remains unknown.
7. [ ] AI-assisted layout: convert a prompt to a reviewable parametric proposal; require geometric constraints, source/design assumptions and jurisdiction-specific checks. AI does not establish regulatory compliance.

Current delivery status: the architectural Sketch workspace now implements layered walls, hosted openings, slabs and roof presets/trim profiles; precision reference editing; linked plans, elevations, sections, schedules and scaled sheets; material-register synchronization; and reviewed Gemini layout proposals. Executed coverage and remaining delivery gates are tracked in ARCHITECT-SKETCH-TODO.md. This does not close every broad requirement above: final installed DWG verification, jurisdiction-specific compliance checks, and fabrication-complete assembly coverage remain open. Dependencies prevent a visual model from being treated as a fabrication-complete material list. Competitor pricing/exclusivity statements in the source document are unverified marketing claims and are not product guarantees.


Professional expansion: PROFESSIONAL-A-Z-CHECKLIST.md now contains the researched 364-requirement register across 68 industry/professional profiles, with daily workflows, benchmark sources and proof requirements. See DAY-TO-DAY-TODO.md for execution order. Native Windows DWG uses the selected MIT-licensed ACadSharp translator; full installed closeout remains tracked in DWG-TODO.md.
