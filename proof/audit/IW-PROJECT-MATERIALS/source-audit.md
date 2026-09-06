# Source audit: general material takeoff

The official City of Thornton Fire Station 8 bid documents are a real, low-rise multidisciplinary trial. They are not a high-rise completeness proof. The source library contains ten byte-verified originals: 136 drawing pages and 1,124 specification pages. Attachment IDs 21721 through 21730 were verified by actual rendered titles, hashes and page counts. The server ignores the filename segment, so initial research download names were corrected in the published library.

Canonical identities and direct official URLs: [library manifest](../../../public/sources/thornton-materials/library.json). Prepared inventory: [definition](../../../src/studio/construction/thorntonMaterials.ts).

## Independent quantity checks

A8.0, architecture PDF page 23, contains 40 unique door marks. Five are overhead assemblies: 119B and 128A through 128D. The other 35 marks include two pairs (124 and 201), therefore 37 swinging door leaves. The 35 non-overhead marks each specify a frame; the five overhead rows leave the frame column blank, so no additional frame quantity was inferred. Units are leaves for swinging doors and complete assemblies for overhead doors and frames. Hardware group codes are retained, but hardware contents are unresolved.

Door width, height and thickness were manually transcribed from the rendered schedule and converted from inches using exactly 0.0254 m/in. Bounding dimensions do not establish solid volume for hollow-metal, glazed or composite doors. Source image: [door schedule](../../../artifacts/research/project-materials-2026-09-06/door-schedule.png). OCR output from this dense table was poor and was not used to establish these quantities.

The bounded structural selection is eight interior W10x22 roof beams, sixteen connection plates and thirty-two 7/8-inch A325N bolts. The scope and lesser-depth rule are documented in [the prior independent structural audit](../IW-CONNECTION-COUNT/source-audit.md). Other roof spans, connections, nuts and washers remain outside these quantities.

M1.1, mechanical PDF page 2, specifies one unique RTU-1 tag with unit/operating weight 2,200 lb. Repeated references in M2.1 and M2.2 describe the same unit. Exact conversion: 2,200 x 0.45359237 = 997.903214 kg. Schedule note 4 includes the 24-inch curb, economizer and hail guard. This is not a shipping-package weight. Source image: [mechanical schedules](../../../artifacts/research/project-materials-2026-09-06/review-thornton-mechanical.pdf-2.png).

Result: 79 material lines across doors, frames, overhead assemblies, structural steel, connection plates, fixings and HVAC. Every entry is pending independent review. No solid-material or packed-volume total can be established for this prepared inventory. Only one line has specified weight.

## Boundaries and remaining reconciliation

Most drawings are issued 2024-09-27; the station-alerting set is an earlier 2024-06-21 permit issue. Station alerting is not sprinkler/fire-protection design. Sprinkler/shop/fabrication details and complete procurement packaging information are not supplied in the gathered set. Architecture and landscape contain image-based pages; civil and mechanical are mixed raster/text. Local OCR supplies unverified candidates with confidence, never counted physical materials.

The text scan of 23 structural sheets finds 260 candidate labels at page scope. Repeated labels increment mentions, never quantities. Full drawing-to-specification-to-physical-material reconciliation is still open across the 1,260 pages. Registering a source or importing prepared rows does not mark any sheet reviewed. Coverage is always preliminary until manual reconciliation, and absent disciplines stay explicit.

## Third-party runtime assets

Tesseract.js 7 and tesseract.js-core are bundled with their supplied licenses. English fast-model data comes from https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/eng.traineddata (Apache-2.0 repository). PDF.js decoder WASM and standard fonts are copied from the installed pdfjs-dist package with their supplied licenses. All processing occurs locally in the browser/WebView; drawings are not sent to an OCR service.
