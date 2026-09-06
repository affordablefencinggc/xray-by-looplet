# General construction runs

Import a drawing, open **Measure**, calibrate against a known dimension and lock the scale. Trace a run. A new source project starts with **General construction**; an existing fencing job keeps its established type.

Select an assembly and enter the trade/work package and source reference. Choose:

| Basis | Calculation |
|---|---|
| Run length | Calibrated traced length, m |
| Strip / face area | Length × section width or height, m² |
| Rectangular volume | Length × width/height × depth/thickness, m³ |

These are gross geometry quantities. Openings, overlaps and waste are not deducted. Use Materials & storage for packaged stock volume and specified weights.

The inspector and **Cost** show each run's formula and review state. Missing required fields or unverified source/scale withhold quantities. Changes invalidate prior approval. Both general and fencing specifications survive type switching and reload.

General runs do not generate fence materials. Polygon/count workflows, full project-storage migration and general material assembly rules remain future phases.

The test drawing is explicitly marked QA demonstration data: 10 m × 2 m × 0.2 m = 4 m³. It is not a measured high-rise stock quantity.

[Desktop proof](../../screenshots/general-runs/built/02-cost-quantities.png) · [Mobile proof](../../screenshots/general-runs/built/03-mobile-editor.png) · [Tests and exact code changes](../../proof/audit/IW-GENERAL-RUNS/completion.md)
