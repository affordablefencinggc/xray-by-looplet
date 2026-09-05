# High-rise download inventory

**Correction during user-directed cleanup:** the package exists at repo-relative `downloads/high_rise_plans` (four PDFs, two IFCs and README.md). The original check below covered only Windows Downloads and was incomplete. Files remain unchanged; binary assets are locally ignored. Inspection/import assessment is paused by the user, not blocked by missing files. README claims and PDF/model compatibility remain unverified.

## Original limited-path observation (superseded)

Date: 2026-09-05 (Australia/Brisbane).

Status: **Requested input directory missing; inventory cannot yet assess the new high-rise package.** This is a concrete missing-input result, not a successful model/drawing assessment.

## Scope and evidence

- Requested location: `C:\Users\danie\Downloads\high_rise_plans`.
- `Get-ChildItem -LiteralPath` returned `PathNotFound` for that exact location.
- Windows User Shell Folders registry confirms Downloads resolves to `C:\Users\danie\Downloads`; no redirected Downloads location was found.
- Read-only listing of Downloads found no immediate folder or archive whose name matches `high`, `rise`, `plan`, or `bim`.
- A filename-only recursive search under Downloads found no `.ifc`, `.ifczip`, `.rvt`, `.rfa`, `.dwg`, `.dxf`, `.glb`, or `.gltf` candidates. This search did not examine archive contents and is not proof that no BIM file exists inside an unrelated archive.
- Existing drawing filenames include the previously known `Caroline - Blueprints and Renderings - 2025-08-08.pdf` (4,169,029 bytes) and exported workspace fixtures `residential-ruffles-seeka.pdf`, `shed-manners-aline.pdf`, and `electrical-schedule.pdf`. They are not evidence of the new high-rise package; their contents were not inspected for this task.

No downloaded code or executables ran. No originals were changed or copied. No network, dependencies, app source, database, or git operations were performed. The PDF skill was read in preparation, but no PDF rendering was needed because the requested source was absent.

## Candidate decision

There are **no selected high-rise import candidates** and therefore no source hashes to record. Drawing/model building identity, sheet count, storeys, coordinates, units, provenance, and license remain unknown. No pairing or model fidelity claim is justified.

## Bounded next test once the package is available

1. Confirm the actual local package path, list files and archive entries without executing bundled content, and hash selected PDF and BIM originals using SHA-256.
2. Use existing trusted parsers to inspect PDF metadata/title blocks and IFC/glTF metadata where available. Record exact drawing revision, model export revision, building/project identifiers, storey names, units, origins, and provenance/license evidence. RVT may need a separately authorized export workflow if no trusted parser is installed.
3. Select one representative floor-plan PDF page and test the existing PDF source-import flow, checking visible geometry, text, page scale, and import completion. Keep BIM assessment separate until supported conversion/import work is explicitly scoped.
4. Establish that drawings and model describe the same building using explicit identifiers plus a shared floor/grid/dimension comparison; similar filenames alone do not establish a match.

Current capability boundary provided by the orchestrator: source import supports PDF/DXF/SVG; Three model handling is curated and source-matched for Caroline/Ruffles. **An arbitrary IFC/RVT/glTF importer is not established.** Availability of a BIM download must not be represented as support for importing or accurately reconstructing it.
