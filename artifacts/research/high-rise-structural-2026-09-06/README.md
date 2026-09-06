# High-rise structural sources — downloaded and inspected

Research: 6 September 2026. This supplies replacement sources for the Altitude design-review PDF; it does not claim a new model has been built.

## Recommended real-project source: Crown Wharf, Canning Town

[Arup structural basis of design, part 2 and drawing appendix](https://docs.planning.org.uk/20260225/208/TAEHTIJYHRL00/qkrdx8m88c4v5zqq.pdf). Local copy: [PDF](crown-wharf-a4-structural.pdf), 36 pages, 17,334,014 bytes. Includes multiple Block A buildings; **pages 26–36 are the A4 tower drawings**.

Inspected text throughout and rendered pages 1, 26, 34–36. Page 34 supplies the levels 18–30 plan, grid dimensions, storey elevations, column/beam/wall/upstand schedules, slab thicknesses and concrete grades. Pages 35–36 cover level 31 and roof. This is a useful basis for dimensioned structural reconstruction and bounded concrete takeoff. [Inspected drawing](../../../screenshots/high-rise-sources/crown-wharf-a4-structural-page-34.png).

Scope: the report and sheets reference additional structural notes, reinforcement drawings, architectural/MEP documents and specialist pile design. The title block says S5, suitable for stage approval; revision entries include construction issue. It is not established as a complete as-built/fabrication package. A Revit model is mentioned but was not downloaded. The council lists further documents; two attempted direct downloads returned 404.

## Matched structural benchmarks: Toyohashi University of Technology

[University source page](https://rc.ace.tut.ac.jp/saito/software_sample_RC02-e.html) supplies 30-, 40- and 50-storey reinforced-concrete examples. Downloaded all three PDFs and matching 3D `.stera` files, plus the 50-storey 2D file. [50-storey PDF](B03_50F_RC_H.pdf) · [matching model](B03_50F_RC_H_3D.stera).

Visually inspected all three pages of the 50-storey PDF: standard-floor grid, beam/reinforcement table and column/reinforcement table. These are structural analysis benchmarks. They are useful for checking member identification against a matching model, but the short PDF is not a complete building or fabrication schedule. Storey-height/model semantics still need extraction from the native analysis model. Downloaded model binaries have not been opened or imported into X-Ray. [Member schedule proof](../../../screenshots/high-rise-sources/B03_50F_RC_H-page-3.png).

## Selection and verification record

Start the real-project reconstruction with Crown Wharf A4. Use the university model as a separate controlled benchmark; do not combine quantities across projects. Full stock procurement still requires the missing discipline/fabrication schedules and actual package dimensions and specified weights.

[File inventory with source URLs, byte counts and SHA-256](file-records.json). Extracted PDF text is saved alongside each PDF. Public access does not establish a redistribution licence; originals remain research inputs rather than bundled product demo assets.

BEXEL's [high-rise sample](https://help.bexelmanager.com/docs/downloads/bexel-sample-models-15846/) is another lead, advertised as 72,325 BIM elements; its download redirected to account sign-in, so it is not counted as an acquired model.

No product code changed and no background services were started for this search.

## Nut-and-bolt completeness

A [fastener evidence check](fastener-evidence-audit.json) found no complete hardware schedule in the downloaded Crown Wharf package. Missing fasteners must remain unknown, not zero. Exact hardware counts require connection/shop drawings or a fabrication model that contains the assemblies, plus their location mapping and coverage of the included trades. The structural research models do not establish that completeness.
