# Caroline source scene contract

Agreed with parent and `/root/audit_engine_release`. Schema remains `xray.source-building/v1`; positions are flat XYZ metres, Y up and Z down the drawing. Source page references use original displayed PDF points, 1584 x 1224. Every object has `id`, `category`, `label`, `positions`, triangular `indices`, `material`, `sourceRefs`, `evidenceState` and `level` (`ground`, `upper`, `roof`).

Additions explicitly coordinated with the UI: `floorElevations: {ground:0, upper:2.7432}`; `source.title`, `source.author`, `source.license`, `source.licenseUrl` as strings; `summary.floors:2`; category `stair`. Existing roof hiding covers roof/roof-trim; all stairs are level ground so lower stair vertices do not alter the upper floor datum. Ruffles and Caroline are separate exact-source registry entries.

Source metadata: title `Caroline's Farmhouse`, author `Jay Osborne / FreeFarmhouse`, license `CC BY-SA 4.0`, URL `https://creativecommons.org/licenses/by-sa/4.0/`. Source SHA-256: `f62cf82411d5343fd67f2c51b9a0092d70c885c147f9e7b417a6204b4edf11eb`, 19 pages. No page 19 alternate designs enter the model.

Public assets: `/models/caroline/source-building.json`, `/models/caroline/source.pdf`, `/models/caroline/source-page-N.png`. SourceSheets includes pages 4, 5, 6, 7, 8, 9, 12, 13, 14, 15, 16, 17 and 18. Source PDF is an exact byte copy. PNGs are rendered from the actual PDF using the prior trusted PDFium environment.

Evidence states are mixed by design: all roof meshes are marked inferred because traced extents and lower attachment elevations are approximate. Their refs separately identify dimensioned main datums and 7.5:12 / 3:12 pitches. Main nominal floor dimensions are source labels; one-point manual trace tolerance remains disclosed. Original page-4 roof regions use the drawing's right-side coordinate registration, rather than mislabelling page-6 floor outlines as roof extents.
