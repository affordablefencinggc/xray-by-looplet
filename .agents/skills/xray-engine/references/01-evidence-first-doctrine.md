# Evidence-First Doctrine and Data Integrity

## Purpose

This document governs all source documents, geometric measurements, calibration,
takeoff, BIM-like objects, BOM rows, pricing data, quotes, and construction claims.

## Prime directive

> Unproven numbers are not estimates—they are hallucinations.

A number may be useful while remaining uncertain. Its uncertainty must be represented
in the data model, UI, exports, and downstream workflow.

## Source classes

Every document must have exactly one source class:

| Source class | Meaning | May appear in viewer | May produce verified takeoff | May enter quote |
|---|---|---:|---:|---:|
| `sample` | Demo, fixture, tutorial, generated sample | Yes | No | No |
| `web` | Real plan imported from browser/web workflow | Yes | Only after verification | Only after verification |
| `desktop` | Real plan imported from local desktop workflow | Yes | Only after verification | Only after verification |
| `derived` | Output generated from a real source document | Yes | Only if parent is verified | Only if parent is verified |
| `unknown` | Origin has not been established | Limited | No | No |

## Required document identity

Real source drawings must retain:

```ts
type SourceDocumentIdentity = {
  documentId: string;
  source: "web" | "desktop" | "sample" | "derived" | "unknown";
  originalFileName?: string;
  mimeType: string;
  byteLength: number;
  sha256: string;
  importedAt: string;
  parentDocumentId?: string;
  parentSha256?: string;
};
```

The hash proves that the bytes are the same document bytes.

It does not prove:

- Drawing accuracy.
- Survey accuracy.
- Scale correctness.
- Completeness.
- Construction compliance.
- Correct interpretation.
- Engineering adequacy.

## Evidence states

Use only these evidence states:

| State | Meaning |
|---|---|
| `source-measured` | Measured from identifiable source information with a valid calibration |
| `source-traced` | Directly traced from identifiable source geometry |
| `source-derived` | Calculated from source-backed inputs using recorded rules |
| `inferred` | Reconstructed or assumed because source information is incomplete |
| `presentation` | Added only for readability or visual completeness |
| `conflicted` | Source references contradict or cannot be reconciled |
| `unverified` | Data exists but has not passed required checks |
| `approved` | Human reviewer explicitly approved the object or quantity |

`approved` is a review status, not a replacement for an evidence state.

## Object-level provenance

Every renderable or takeoff-relevant object must retain:

```ts
type EvidenceRecord = {
  state:
    | "source-measured"
    | "source-traced"
    | "source-derived"
    | "inferred"
    | "presentation"
    | "conflicted"
    | "unverified";
  sourceDocumentId: string;
  sourceSha256: string;
  sheetReferences: Array<{
    page: number;
    region?: [number, number, number, number];
    role: "plan" | "elevation" | "section" | "detail" | "schedule" | "note";
    note?: string;
  }>;
  assumptions?: string[];
  confidence?: "high" | "medium" | "low";
  calibrationId?: string;
  reviewedBy?: string;
  reviewedAt?: string;
};
```

## Sample-data firewall

The system may display and manipulate sample projects.

The system must not:

- Add sample components to verified BOM totals.
- Add sample measurements to customer quotes.
- Export sample quantities under a verified/customer label.
- Copy sample source identity into real documents.
- Merge sample and verified totals without prominent segregation.
- Persist a sample document as `web` or `desktop`.

Any aggregate that includes sample data must be labelled:

```text
Demonstration output — not verified for quoting or procurement.
```

## Calibrated measurement rule

A dimensional quantity is only `source-measured` when:

1. The source document bytes have a recorded SHA-256 identity.
2. The sheet registration is known or recorded.
3. The calibration uses at least two source points.
4. The real-world distance and unit are known.
5. The calibration residual/error is recorded.
6. The relevant object references the calibration record.
7. The result is not contradicted by another authoritative drawing source.

Otherwise, label the result `inferred`, `unverified`, or `source-traced`, as appropriate.

## Quote and price-book gate

A quote line may be marked quote-ready only if:

- Its source is not `sample` or `unknown`.
- Its source hash matches the currently loaded real plan.
- Its measurement is calibrated.
- Its evidence state is `source-measured`, `source-derived`, or reviewed `approved`.
- Waste, yield, and labour productivity are explicitly separate from net quantity.
- Unit, rate, currency, price-book source, and effective date are recorded.

## UI requirements

Evidence state must be visible in:

- Object inspector.
- Takeoff table.
- BOM export.
- Quote draft.
- PDF proof set.
- 3D selection panel.
- Any screen that displays a quantity or price.

Do not rely on colour alone. Always include a text label.
