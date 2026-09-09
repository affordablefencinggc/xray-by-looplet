# Multi-View Takeoff, Calibration, and BOM Compiler

## Purpose

This document governs any linear, area, volume, count, estimate, BOM, price-book,
assembly, procurement, or quote output.

## Non-negotiable rule

No takeoff output may be described as verified unless its quantities are derived from
a verified source document and a valid calibration.

## Calibration model

Use two-point ground-truth calibration as a minimum.

```ts
type CalibrationRecord = {
  calibrationId: string;
  documentId: string;
  sourceSha256: string;
  sheetPage: number;
  pointA: { x: number; y: number };
  pointB: { x: number; y: number };
  knownDistance: number;
  unit: "mm" | "cm" | "m";
  metresPerPageUnit: number;
  createdAt: string;
  createdBy?: string;
  residual?: number;
  evidenceState: "source-measured" | "unverified";
};
```

Required checks:

- Points A and B must be distinct.
- Known distance must be finite and greater than zero.
- Unit conversion must be explicit.
- Source hash must match the active document.
- Calibration cannot silently cross sheets unless registration is recorded.
- If multiple calibrations conflict, flag the sheet as conflicted.

## Quantities

Every quantity must retain:

```ts
type QuantityRecord = {
  quantityId: string;
  componentId: string;
  kind: "length" | "area" | "volume" | "count" | "mass";
  netValue: number;
  netUnit: "m" | "m2" | "m3" | "ea" | "kg";
  evidenceState: string;
  calibrationId?: string;
  sourceObjectIds: string[];
  formula?: string;
  assumptions?: string[];
};
```

Do not flatten net, waste, yield, labour, and cost into one opaque number.

## Quantity layers

Keep the layers distinct:

| Layer | Meaning |
|---|---|
| Net measured quantity | Source-backed geometric requirement before waste |
| Waste allowance | Material allowance for cutting, damage, and site loss |
| Yield factor | Coverage/conversion factor between ordered and installed material |
| Labour productivity | Labour-hours per unit or output per crew-hour |
| Procurement quantity | Quantity to purchase after allowance/yield rules |
| Quoted quantity | Quantity and commercial assumptions exposed to customer |

## IFC-style component register

Use a hierarchical component register even if the full IFC standard is not yet adopted.

Supported baseline categories:

```text
IFCProject
IFCSite
IFCBuilding
IFCBuildingStorey
IFCWall
IFCWallStandardCase
IFCSlab
IFCRoof
IFCColumn
IFCBeam
IFCDoor
IFCWindow
IFCCovering
IFCFurnishingElement
IFCStair
IFCMember
IFCBuildingElementProxy
```

Each component must have:

- Stable ID.
- Parent hierarchy.
- Category.
- Geometry/object links.
- Unit-aware dimensions.
- Evidence state.
- Source references.
- Optional supplier/SKU mapping.
- Optional assembly mapping.

## Price books

Price-book records must include:

```ts
type PriceBookItem = {
  sku: string;
  description: string;
  supplier?: string;
  unit: string;
  rate: number;
  currency: string;
  effectiveDate?: string;
  source: "supplier" | "internal" | "manual";
  evidenceState: "verified" | "unverified";
};
```

Never infer price-book certainty from a visual match or an unverified web result.

## BOM compiler rules

The BOM compiler must:

1. Reject or segregate `sample` source documents.
2. Reject or flag missing calibration for measured quantities.
3. Preserve evidence state in every aggregate.
4. Retain links from BOM lines back to component IDs.
5. Keep pricing assumptions separate from measurement assumptions.
6. Identify mixed-evidence aggregates.
7. Provide an auditable expansion from quote line → BOM line → component → source object → source sheet.

## Quote gates

A quote draft must contain:

- Quote status: `draft`, `review-required`, `quote-ready`, or `blocked`.
- Measurement basis.
- Source plan identity.
- Source hash prefix.
- Evidence summary.
- Assumptions.
- Exclusions.
- Date and price-book effective date.
- Clear warning if any line is inferred, uncalibrated, or not quote-ready.

Block quote-ready status if:

- Source is `sample` or `unknown`.
- Hash mismatch is detected.
- Calibration is absent or invalid.
- A required quantity is `inferred` or `unverified`.
- Price source is missing for a commercial total.
