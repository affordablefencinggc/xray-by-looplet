# Handoff: Fencing Data Model Decoupling & Multi-Trade Architecture

**Status:** Technical Handoff & Architecture Analysis  
**Target Repository:** `xray-by-looplet`  
**Related Specifications:** [XRAY-WORKBENCH-CONTRACT.md](file:///c:/Users/danie/repo/xray-by-looplet/XRAY-WORKBENCH-CONTRACT.md), [planning/industry-contract.md](file:///c:/Users/danie/repo/xray-by-looplet/planning/industry-contract.md), [src/studio/construction/contract.ts](file:///c:/Users/danie/repo/xray-by-looplet/src/studio/construction/contract.ts)

---

## 1. Context & Problem Statement

Front-of-house UI labels and review headers have been generalized (e.g., *"Takeoff runs and openings"*, *"Assembly / system"*, *"Trace at least one takeoff run"*). However, **the underlying application state, Zod domain schemas, readiness validation rules, and BOM engines remain structurally coupled to the legacy `FencingJob` (`xray.fencing-job/v2`)**.

Surface copy updates alone do not resolve this:
- An architectural drawing (like the 19-page *Caroline - Blueprints and Renderings*) still forces the estimator into fencing options (Colorbond, Timber paling, Bay width, Posts, Sleepers).
- Canonical readiness (`getJobBlockers`) still penalizes the user unless linear fence specifications are populated and approved.
- The Cost/BOM engine only knows how to calculate fence posts, rails, infills, and post concrete.

---

## 2. Inventory of Remaining Fencing Dependencies in the Data Model

### A. Root Workbench State (`FencingJob`)
* **Files:** [src/studio/domain.ts](file:///c:/Users/danie/repo/xray-by-looplet/src/studio/domain.ts#L294-L326) & [src/studio/store.ts](file:///c:/Users/danie/repo/xray-by-looplet/src/studio/store.ts#L155)
* **Hardcoded Trade:** `trade: z.literal("fencing")` is an invariant on `fencingJobDataSchema`.
* **Hardcoded Collections:** State only stores `runs: z.array(fenceRunSchema)` and `gates: z.array(gateSchema)`. Generic area polygons, point counts, volume slabs, or MEP routes have no first-class persisted entity in `useStudio.job`.
* **Storage Key:** Hardcoded to `xray:fencing-job:v2` in [src/studio/persistence.ts](file:///c:/Users/danie/repo/xray-by-looplet/src/studio/persistence.ts).

### B. Run Specification Schema & Validation (`FenceSpecification`)
* **File:** [src/studio/domain.ts](file:///c:/Users/danie/repo/xray-by-looplet/src/studio/domain.ts#L80-L106)
* **System Enum:** `fenceSystemSchema = z.enum(["unselected", "colorbond", "timber-paling", "pool", "chain-wire", "custom"])`.
* **Field Dependencies:** Every run carries mandatory fields for fence topology:
  * `bayWidthM` (post-to-post spacing)
  * `heightM` (panel height)
  * `sleepers` (`"none" | "timber" | "concrete" | "custom"`)
  * `postOverrides` (`postSize`, `embedmentM`, `lengthM`)
  * `corners` (corner treatments)
* **Blocker Penalties (`missingRunSpecificationFields`):** If a user draws a general wall or takeoff line, `getJobBlockers` flags the entity as blocked unless `bay width`, `fence system`, `ground`, and `sleepers` are specified.

### C. Readiness Blockers (`getJobBlockers`)
* **File:** [src/studio/domain.ts](file:///c:/Users/danie/repo/xray-by-looplet/src/studio/domain.ts#L1129-L1147)
* **Linear Run Gate:** Canonical readiness hard-requires `job.runs.length > 0`. A job containing only area takeoffs (flooring, slab, roof), point counts (fixtures, electrical), or 3D volume cannot pass readiness without an artificial linear run.

### D. Bill of Materials Engine (`BOM Compiler` & `BOM Rules`)
* **Files:** [src/studio/bomCompiler.ts](file:///c:/Users/danie/repo/xray-by-looplet/src/studio/bomCompiler.ts), [src/studio/bomRules.ts](file:///c:/Users/danie/repo/xray-by-looplet/src/studio/bomRules.ts), [src/studio/fencingRecipes.ts](file:///c:/Users/danie/repo/xray-by-looplet/src/studio/fencingRecipes.ts)
* **Recipe Coupling:** `compileBomRequest` requires a `BomRecipeSet` bound to `FENCING_RECIPE_STATE_SCHEMA` (`xray.fencing-recipe-state/v1`).
* **Formula Coupling:** `calculateFencingRunBom()` evaluates physical items strictly as:
  * Posts (end, corner, intermediate)
  * Rail rows (Colorbond rails / timber rails)
  * Infill sheets (Colorbond infills / palings)
  * Fasteners (Tek screws / brackets)
  * Post concrete embedment (bags / m³)
  * Sleeper retaining
* Any attempt to generate a BOM for general building assemblies fails closed because the compiler cannot evaluate anything other than fencing recipes.

---

## 3. The Target Decoupled Architecture (`ConstructionJob`)

The target contract has already been designed in **[src/studio/construction/contract.ts](file:///c:/Users/danie/repo/xray-by-looplet/src/studio/construction/contract.ts)** (`xray.construction-job/v1`) and verified under the `IW022` runtime foundation:

```
                  ┌────────────────────────────────────────┐
                  │      ConstructionJob (v1 Contract)     │
                  │   schema: "xray.construction-job/v1"   │
                  └───────────────────┬────────────────────┘
                                      │
         ┌────────────────────────────┼────────────────────────────┐
         │                            │                            │
         ▼                            ▼                            ▼
┌──────────────────┐        ┌──────────────────┐        ┌──────────────────┐
│   Core Sources   │        │Universal Takeoffs│        │  Work Packages   │
├──────────────────┤        ├──────────────────┤        ├──────────────────┤
│• PDF / DXF / SVG │        │• Count  (ea)     │        │• Electrical      │
│• Model elements  │        │• Length (m)      │        │• Drywall         │
│• Calibrations    │        │• Area   (m²)     │        │• Concrete        │
│• Source evidence │        │• Volume (m³)     │        │• Fencing (Legacy)│
└──────────────────┘        └──────────────────┘        └────────┬─────────┘
                                                                 │
                                                    ┌────────────┴────────────┐
                                                    │ Optional Trade Pack     │
                                                    │ (e.g. Fencing Recipes)  │
                                                    └─────────────────────────┘
```

### Key Architectural Invariants:
1. **Universal Quantities Are Trade-Agnostic:** `count`, `length`, `area`, and `volume` belong to the core. They require no trade-specific attributes, bay widths, or post specs.
2. **Work Packages Are Pluggable:** Trade is an arbitrary string (`trade: string`), not an enum. Fencing is merely an optional work package (`trade: "fencing"`), not the application spine.
3. **Legacy Fencing Is an Isolated Adapter:** Handled via [importLegacyFencingJob](file:///c:/Users/danie/repo/xray-by-looplet/src/studio/construction/legacy.ts) which encapsulates historical fencing state in `extensions.legacyFencing` without polluting universal measurements.

---

## 4. Phased Migration Roadmap

| Phase | Scope | Description | Exit Criteria |
|---|---|---|---|
| **Phase 1** *(Done)* | **UI Copy Generalization** | Replaced user-facing "fence run" and "runs and gates" copy with "takeoff run" and "runs and openings". | Clean test suite (`npm test`, 305 tests passing). |
| **Phase 2** *(Immediate Next)* | **Domain Specification Relaxation** | Make `FenceSpecification` fields optional/extensible in [domain.ts](file:///c:/Users/danie/repo/xray-by-looplet/src/studio/domain.ts). Permit generic assembly systems (`wall`, `partition`, `slab`, `conduit`, `generic`) so non-fencing runs don't demand bay width or sleepers. | `getJobBlockers` passes on generic takeoffs without fencing attributes. |
| **Phase 3** | **Multi-Quantity Readiness** | Update `getJobBlockers` so that any evidenced takeoff (count, area, length) satisfies readiness, rather than strictly requiring a linear run. | Single-area (flooring/roofing) and point-count (electrical) readiness tests pass. |
| **Phase 4** | **Store & Persistence Migration** | Migrate `useStudio` state in [store.ts](file:///c:/Users/danie/repo/xray-by-looplet/src/studio/store.ts) from `FencingJob` to `ConstructionJob` (`xray.construction-job/v1`), using the already-verified IndexedDB repository from `src/studio/construction/runtime/`. | Storage round-trip with multi-trade work packages and Caroline high-rise sheets. |
| **Phase 5** | **Modular BOM Packaging** | Isolate `calculateFencingRunBom` inside an optional specialist pack adapter; core BOM compiler evaluates generic assembly formulas against universal units (`ea`, `m`, `m²`, `m³`). | Multi-trade BOM calculations produce accurate quantities without fencing recipes. |
