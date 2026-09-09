# Burj Khalifa: foundations-to-façade source pack

Research date: 2026-09-08. Research slice: BK-R01. Owner: Burj Khalifa research chat.

## Status and ownership

This folder is the sole write surface for this research task. The other chat owns the A–Z checklist and application implementation. No application files, shared checklist rows, build processes or shared walkthrough are changed here.

Public sources support an explanatory reconstruction. A complete, coordinated construction/as-built drawing set has **not** been obtained. There is no calibrated model, verified quantity takeoff, glass order, construction programme or whole-building BOM in this pack.

## Source register

| ID | Source | What it supports | Limit |
|---|---|---|---|
| BK-S01 | [Burj Khalifa official structural overview](https://www.burjkhalifa.ae/the-tower/structures/) | Foundation, buttressed core, exterior cladding, spire and services summaries | Public overview; no coordinated schedules |
| BK-S02 | [SOM project page](https://www.som.com/projects/burj-khalifa/) | Emaar client identity; design, structural form and setbacks | Project narrative; not issued construction drawings |
| BK-S03 | [Guardian Silver 20](https://www.guardianglass.com/ap/en/our-glass/sunguard-solar/silver-20) | Supplier identification of SunGuard Solar Silver 20 for the tower | Current product information does not establish every historical installed glass assembly |
| BK-S04 | [BESIX project page](https://www.besix.com/en/projects/burj-khalifa) | Contractor account of construction logistics, concrete placement and project period | No detailed baseline programme or method statements |
| BK-S05 | [ICC article by Lawrence Novak](https://www.iccsafe.org/building-safety-journal/bsj-technical/a-tall-adventure-the-burj-khalifa-the-worlds-tallest-structure/) | Engineer-authored overview, including Figure 2 typical floor plan | Page includes membership messaging; accessible content is incomplete evidence, not access to member-only documents |
| BK-S06 | [ICC Figure 2 image](https://www.iccsafe.org/wp-content/uploads/bsj/Figure-2-Burj-Khalifa-300x234.jpg) | Published typical floor-plan illustration | Low-resolution illustration, no established calibration, revision or complete sheet identity |
| BK-L01 | [ASCE design and construction planning paper](https://ascelibrary.org/doi/10.1061/41130%28369%29270) | Bibliographic lead for construction planning | Full text not acquired or inspected in this task |

The source snapshots, if successfully retrieved, are identified in `sources/manifest.json` by URL, import time, byte length and SHA-256. Read `downloadStatus` and `contentIdentityCheck`; a URL in this table alone does not mean a local binary was acquired. Hashes establish byte identity only. All acquired material remains `unverified` for measurement and quoting.

## Evidence-backed starting points

- The official overview describes a 3.7 m reinforced-concrete raft, with bored piles reported as 1.5 m diameter and 43 m long. These are published descriptions, not dimensions measured or checked against an issued foundation drawing. [BK-S01](https://www.burjkhalifa.ae/the-tower/structures/)
- SOM explains a Y-shaped arrangement of three wings around a hexagonal central hub, with setbacks coordinated with the structural grid. This supports the structural concept, not exact coordinates for every level. [BK-S02](https://www.som.com/projects/burj-khalifa/)
- The official overview describes double-layer glazing in aluminium frames, approximately 26,000 panels, silver coating, and a hydraulically raised steel spire. These summaries do not establish a panel-by-panel bill of materials. [BK-S01](https://www.burjkhalifa.ae/the-tower/structures/)
- Guardian identifies Solar Silver 20 as a tower glass product. Its reported supplied area must not be substituted for installed net façade area or a quantity measured from drawings. [BK-S03](https://www.guardianglass.com/ap/en/our-glass/sunguard-solar/silver-20)
- BESIX describes vertical-transport logistics, special concrete mixes and night placement, and gives a 2004–2009 building period. These are useful narrative anchors, not a detailed activity schedule. [BK-S04](https://www.besix.com/en/projects/burj-khalifa)

## Reconstruction work packages, from start to finish

The following sequence is a proposed research/model breakdown, **not the verified as-built construction sequence**. Façade and services work can overlap structural work; actual dependencies and dates need the project programme.

| Stage | Public starting evidence | Required before exact reconstruction |
|---|---|---|
| 01 Survey and excavation | Project identity and site context | Survey control, project datum, geotechnical report, excavation and shoring drawings |
| 02 Bored piles | Official foundation description | Pile coordinates/IDs, toe and cut-off levels, diameters, reinforcement, testing and as-built logs |
| 03 Raft and waterproofing | Official raft summary | Dimensioned raft plan/sections, pour boundaries, rebar schedules, joints and waterproofing details |
| 04 Basement and podium | Official podium description | Full plans, sections, ramps, grids, levels, retaining walls and structural interfaces |
| 05 Core and wings | SOM structural concept; ICC typical plan | Every changing floor plate, wall thickness, openings, columns, material zones and reinforcement |
| 06 Slabs and setbacks | SOM setback/grid narrative | Slab profiles, thicknesses, edge coordinates, elevations and transfer/interface details |
| 07 Upper steel and spire | Official spire summary | Member and connection drawings, erection pieces, jack stages and survey tolerances |
| 08 Curtain wall | Official cladding overview; Guardian product identity | Panel IDs, dimensions, glass build-ups, coating surfaces, framing, anchors, seals and test reports |
| 09 Services and lifts | Official/SOM services narratives | Coordinated MEP models, risers, equipment schedules, plant layouts and lift interfaces |
| 10 Interiors and external works | SOM design narrative | Room layouts, finishes, ceilings, doors, landscape and drainage drawings |
| 11 Testing and handover | Construction/operation research leads | Commissioning records, completion revisions, asset register and O&M documentation |

## Glass: unresolved details

Do not apply today's product configurator defaults to the historical façade. Missing information includes inner/outer lite thickness, heat treatment, lamination, cavity dimensions, gas, spacer, edge seal, coating surface, frit/spandrel zones, curvature, panel families, mullion sections, slab anchors and movement allowances. Opening pavilions and tower curtain wall must have separate system identities.

No panel counts are generated from a guessed repeated bay. No unit weights or glass order totals are computed from marketing averages. Any visual placeholder belongs in evidence state `inferred` or `presentation` and cannot enter verified quote totals.

## Conflicts and rejected shortcuts

- SOM's current page lists 160 stories in project facts and refers to 162 in the narrative. Storey numbering needs an authoritative level schedule; do not silently choose one count.
- Published foundation figures use differing length/depth conventions in research leads. Resolve pile length, raft datum and toe elevation against the same drawing revision before comparison.
- Supplied glass area, installed glass area and total cladding area are different quantities. Their scope cannot be reconciled by averaging.
- A diagram titled "Typical Floor Plan" is not evidence for every floor or the foundation layout.
- A searchable paper is not an acquired PDF. Failed URLs are recorded below rather than represented as source drawings.

## Acquisition failures

| Lead | Observed result on research date |
|---|---|
| `global.ctbuh.org/resources/papers/download/1326-engineering-the-worlds-tallest-burj-bubai.pdf` | Search indexed; direct web retrieval returned 404 |
| Corrected `burj-dubai.pdf` spelling and `/paper/1326` | Direct web retrieval returned 404 |
| `sonar.pictures/_files/ugd/718de4_c97a2cb7083948868e5f8f720d6f1878.pdf` | Direct download returned Wix domain-connection error/404 |
| `www.pd1.hk/T03A/Burj%20Khalifa%20%28Design%20%26%20Construction%29.pdf` | Web retrieval failed; direct download could not resolve host |

## Next evidence gate

Use `drawing-request.md` to request an authorized drawing index and approved excerpts from the document custodian. It is an unsent draft. On receipt, retain original bytes, record hashes/revisions/units, reconcile the drawing index, then calibrate identifiable sheets before modelling measurable geometry.

Application implementation and A–Z acceptance remain the responsibility of the other chat. This research pack does not complete any application checklist requirement.
