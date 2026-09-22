# PROOF-LARGE-PDF-05 — the 20 MB export criterion currently fails, and the ZIP is not the reason

SC-15's remaining acceptance names "large real-PDF export under two seconds". This measures it against the real container on a genuine 21.9 MB PDF. **It fails: 4.34 s.** The cost is not compression — it is the base64 + JSON re-validation layer that the plan bytes still pass through.

## Executed

`SC15_FIXTURE_AT=2026-09-21T00:00:00.000Z node --experimental-strip-types proof/growth/2026-09-21-archive-clean/machine/large-pdf-archive-timing.mjs` — exit 0, [receipt](../machine/large-pdf-archive-timing.json) and [harness](../machine/large-pdf-archive-timing.mjs) (`xray.sc15-large-pdf-container-timing/v1`).

The fixture is built by the product's own writer, `buildBlueprintPdf` (`src/studio/blueprintBook.ts:136`), from noise PNGs until the exported PDF passes 20 MB — 8 sheets, **21,900,178 bytes**, SHA-256 `620287f1d8e58d4e6b597de25e432eb4f7acbd7048cb2a1a6a419bb592ad4b78`. It is not a padded header: `PDFDocument.load` reopens it as 8 pages, and the app's own `inspectPlanBytes` detects `pdf` and counts 8 pages. The writer's date is pinned so the digest is reproducible from the script; the PDF itself is written to the temp directory, not into this repository.

## Measured

| Step | ms |
| :--- | ---: |
| `captureProjectBackup` | 2,539 |
| `createProjectArchive` (**the export**) | **4,342** |
| `parseProjectArchive` (the import) | 3,235 |

Inside the export, on the same primitives the module uses:

| Phase | ms |
| :--- | ---: |
| `JSON.stringify(backup)` | 25 |
| `parseProjectBackup` on the 29.2 M-char result | **2,267** |
| base64 decode of the plan bytes | **2,374** |
| base64 encode of the plan bytes | 636 |
| `zipSync` (level 0, the whole 21.9 MB) | **38** |
| `unzipSync` | 4 |

Fidelity is exact at this size: the manifest entry, the stored `drawings/0.pdf`, and the restored asset all carry SHA-256 `620287f1…`, and the restored asset is 21,900,178 bytes. The archive is 21,902,805 bytes.

## What this means

Compressing and storing 21.9 MB costs 38 ms. **Roughly 4.6 s of the 4.3 s export is spent moving plan bytes through base64 and re-parsing a 29 MB JSON string** — `createProjectArchive` begins with `parseProjectBackup(JSON.stringify(input))` (`src/studio/persistence/projectArchive.ts:108`), and `decodeBackupBytes` validates canonicity by re-encoding what it just decoded (`src/studio/projectBackup.ts:74-81`), so each plan byte is transformed several times before it reaches the ZIP, which then stores it verbatim.

The archive already stores raw bytes; base64 is a legacy property of the backup envelope, and the module's own comment anticipates this ("Until restoration consumes raw assets directly…", `projectArchive.ts:106-107`). Meeting the two-second criterion therefore needs the plan path to carry bytes rather than base64-in-JSON, not a faster compressor.

## Limits — read before citing this

- **This is not the UI criterion.** It times the container in Node. The browser export additionally captures records, base64-encodes, builds a Blob and hands it to the download API; the measured 2.5 s capture is already an underestimate of that. The real UI duration is at least what is recorded here, and is **unmeasured**.
- No browser ran, no DANS1 receipt, no IndexedDB restoration, no storage-wipe fidelity check.
- The fixture is synthetic imagery, representative in size and valid as a PDF, but it is not a surveyor's drawing set; pdfjs parsing cost on real plan content is not exercised.
- SC-15 remains `[[pending]]`, and this step makes it **harder**, not easier: a named criterion is measured as unmet.
