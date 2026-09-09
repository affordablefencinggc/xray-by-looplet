# 52-storey multidisciplinary drawing workflow

Prepared 2026-09-08. **Planning benchmark, not implemented capability or compliance certification.** Queensland is an explicit, unconfirmed assumption. The site, local authority, uses, basement count, podium levels, heights and meaning of “52 storeys” are still unset. The applicable code edition and amendments must be established for the actual project; this document asserts no numerical code clauses.

The adjacent [high-rise-workflow.json](high-rise-workflow.json) contains **45 distinct workflow tasks**, with discipline, stage, dependencies, inputs, editable outputs, checks, professional review, blocked state, terminology and source IDs. Every task is selectable for planning and currently `executable: false`. The task structure and proposed checks are our product-design synthesis; the official references establish the relevant disciplines and information/approval frameworks, not a prescribed universal 45-step process.

## What the benchmark should produce

An editable package must retain more than a rendered tower. It needs persistent object identity, grids, levels, typed walls/slabs/columns/cores, hosted openings, service systems, room/space definitions, annotation and dimension objects, schedules, sections, elevations and sheet layouts. A typical-floor change needs an explicit choice of affected instances; exceptional transfer, refuge or plant floors must not be overwritten as ordinary repetitions. Unconfirmed dimensions remain unconfirmed rather than being filled with plausible numbers.

Each drawing should retain its discipline owner, source/model revision, units, coordinate basis, scale, issue purpose, checking state and references to details/schedules. Native authoring data must remain editable after save, close and reopen. PDF is an issue representation; IFC exchange must declare its supported version and scope and be validated. IFC support does not itself prove lossless editing in another product. buildingSMART describes IFC as both an information schema and exchange mechanism, with implementation capabilities varying by version/view. [IFC reference](https://www.buildingsmart.org/standards/bsi-standards/industry-foundation-classes/).

## Dependencies from site to handover

| Tasks | Stage and concrete outputs | Gate before dependent production |
|---|---|---|
| HR-01–03 | Brief, accountable design team, classifications, jurisdiction and approval basis | Client scope and actual assessment basis recorded |
| HR-04–07 | Survey/datum, site hazards, geotechnical ground model, verified utility information | Source reports supplied and professionally reviewed |
| HR-08–12 | Editable delivery contract, level/grid register, fire/structural/service concepts | Cross-discipline reservations and design bases agreed |
| HR-13–17 | Excavation/retention, foundations, basement architecture/structure/services | Ground, stability and temporary/permanent interfaces reviewed |
| HR-18–21 | Podium/public realm, transfer structure, continuous core/stairs and lift interfaces | Loads, circulation, shafts and strategy interfaces coordinated |
| HR-22–25 | Typical and exceptional floor families, framing and continuous risers | Each level has explicit type/exception and source-bound design |
| HR-26–29 | Mechanical, hydraulic, electrical/communications and fire-service drawings | Specialist calculations and system interfaces accepted |
| HR-30–35 | Facade, roof, maintenance routes, interiors and critical junction details | Attachment, movement, weather, acoustic and access evidence reviewed |
| HR-36–41 | Energy/access/structural/fire verification, clash resolution and construction risk review | Open design issues and required reviews resolved |
| HR-42–45 | Schedules/quantities, coordinated issue, revision control and handover records | Actual discipline approval, issue evidence and later installed-performance evidence |

Foundation-up describes the drawing/model assembly order; it does not mean fire, lift, structural or services planning can wait until their physical storey is drawn. Their concepts constrain the core, shafts, foundations and podium early. Queensland's approval framework distinguishes building assessment from the drawing process. [Building laws and codes](https://www.business.qld.gov.au/industries/building-property-development/building-construction/laws-codes-standards/building), [approvals and inspections](https://www.business.qld.gov.au/industries/building-property-development/building-construction/approvals-inspections).

Basement and foundation work requires actual ground investigation, utility and adjacent-asset evidence. The app can show intersections or missing references; it cannot infer dependable ground conditions or select a safe excavation method from a tower outline. [WorkSafe Queensland excavation code](https://www.worksafe.qld.gov.au/__data/assets/pdf_file/0018/72630/excavation-work-cop-2021.pdf), [safe design of structures](https://www.worksafe.qld.gov.au/__data/assets/pdf_file/0023/72644/safe-design-of-structures-cop-2021.pdf).

## Checks versus professional judgment

| App-checkable with complete inputs and implemented tools | Responsible professional decision |
|---|---|
| Object IDs, connected geometry, closed room boundaries, coincident levels, drawing/schedule consistency | Design intent, suitable system selection, functional quality and acceptable technical assumptions |
| Measured route lengths, widths, headroom and approach spaces compared with an explicitly supplied criterion | Applicable access/egress requirements, fire strategy and acceptability of a proposed solution |
| Column/core/support graph, missing load references, current calculation-to-drawing revision links | Loads, structural strength/stability/serviceability, geotechnical adequacy and design verification |
| Duct/pipe/cable connectivity, shaft clashes, maintenance/replacement envelopes | Service sizing, protection, pressure, airflow, demand, redundancy and operational performance |
| Facade/roof gaps, overlaps, misplaced openings, drainage topology and missing details | Fire behavior, wind/movement response, weatherproofing, acoustics and product suitability |
| Immutable issue hashes, missing reviews, stale dependencies, broken references, export reimport comparison | Professional approval, statutory assessment, acceptance of installed work and permission to occupy |

A result should be one of **pass against named criteria**, **fail**, **not checked**, or **needs professional review**. “No clash found” must not turn into “safe” or “compliant.” Numeric limits belong to a versioned, applicability-reviewed rule record containing source location, edition, jurisdiction, unit and approver. No limits are invented here. ABCB describes access and fire verification methods as assessment processes; QFD publishes project-relevant referral guidance. [Access verification](https://www.abcb.gov.au/resource/handbook/access-verification-methods-handbook), [fire verification](https://www.abcb.gov.au/resource/handbook/fire-safety-verification-method-handbook), [QFD guidance](https://www.fire.qld.gov.au/compliance-and-planning/referral-agency-advice/referral-agency-advice-guidelines).

Architectural responsibility, structural engineering and MEP engineering must remain separately attributable. Queensland's architecture and engineering regulators describe registration and professional responsibility; an assistant must not apply a professional's name or signature without their actual review and authority. [BOAQ professional role](https://www.boaq.qld.gov.au/BOAQ/Architectural_Practice_Exam__APE_/What_is_an_architect.aspx), [BPEQ supervision](https://bpeq.qld.gov.au/for-engineers/resources-for-engineers/practice-notes/direct-supervison).

## Granular selection before fast execution

The proposed workflow picker lets the user select a stage, discipline, task, level range, floor type or issue set. Nothing is preselected for a “run all.” A selected task opens an execution preview containing:

1. The selected task IDs and exact level/type instances affected.
2. Existing prerequisites and missing inputs; proposed prerequisite work is visible rather than silently added.
3. Named callable tools actually discovered/registered, their argument schemas, expected data/files and intended changes. Planning task IDs are not tool names.
4. Current project/source/revision bindings, limits, provider-use disclosure where relevant, and a recovery point for mutations.
5. The check and professional-review gates that stop downstream work.

After the user chooses that concrete scope, independent read operations can run concurrently. Geometry mutations are serialized or use explicit non-overlapping ownership and revision checks. A cancelled, failed or stale action cannot be marked successful; dependant tasks remain blocked. Existing authorized low-impact actions do not need repetitive permission prompts. Formal design review is a separate project decision, not an excuse to pause every tool call.

Example: select **HR-22, floors 12–18, apartment floor type A**, then **HR-38, architecture/structure coordination**. The preview shows missing reviewed inputs, whether those floors are instances or exceptions, the exact modifications, and the checks to rerun. It does not generate unrelated basement details, revise the whole tower or issue drawings. A core-opening change must flag affected structure/fire/services rather than editing those disciplines silently.

Information ownership and exchange requirements should be agreed at the start. Use element-linked issues with viewpoints, discipline owners, evidence and resolution history; BCF offers an established coordination representation. [Queensland BIM principles](https://www.statedevelopment.qld.gov.au/infrastructure/infrastructure-industry/building-information-modelling), [BCF reference](https://www.buildingsmart.org/standards/bsi-standards/bim-collaboration-format/).

## Concrete acceptance for a future implemented benchmark

- Load an owned, declared fixture with the agreed 52-storey convention, distinct basement/podium/tower/roof levels and at least one non-typical level. Confirm units, datum, scale and every model/drawing relationship.
- Select and execute one bounded foundation task, one typical-floor edit and one services-coordination task through real discovered tools. Show actual changed entities, before/after evidence, persistent save and reopen; retain prior revisions.
- Inject meaningful defects: offset core opening, duplicate facade panel, disconnected stair landing, obstructed plant replacement path, pipe/beam clash and stale calculation revision. Detect each with location/object IDs or explicitly report unsupported checks. Removing a defect only closes its issue after reevaluation.
- Generate editable plans, elevations, sections and schedules from the current revision. Modify a source object and demonstrate every dependent view becomes updated or visibly stale. Test exchange round-trip for the declared subset and disclose loss/unsupported elements.
- At tablet, laptop and desktop sizes, inspect the workflow preview, message composer, drawing canvas and issue navigation. Measure selection latency, peak memory, execution duration and file sizes on stated hardware and fixture; set targets from those measurements rather than promise instant full-tower generation.
- Prove cancel, missing prerequisites, stale revision, failed save, failed tool and partial batch behavior. A completed chat response, beautiful render, count of registered tools or generated PDF alone cannot pass the benchmark.

Current X-Ray readiness must be separately audited against these requirements. This planning work has **not** produced a 52-storey design, connected additional MCP tools, established compliance, or passed those acceptance checks.

## Machine-readable validation

`node planning/assistant/generate-high-rise-workflow.mjs` regenerates the adjacent JSON and checks unique IDs, known dependencies, an acyclic dependency graph and known source references. Initial result: **45 tasks, 45 unique IDs, 16 official sources, valid dependency DAG, all planning-only**. All tasks start blocked because actual project inputs and reviews are absent. These are 45 meaningful workflow tasks, not a count of sheets, tool calls or finished capabilities.
