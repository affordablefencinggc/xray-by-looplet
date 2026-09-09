# Production model export acceptance — 4e6d1ebd3a62

**Exports pass; drafting tablet controls pass; bottom model navigation remains OPEN.**

The build badge was checked in both isolated browser sessions. Six relevant source hashes match the worker snapshot. Source archive: 4e6d1ebd3a624e21fa84e9fa03b320e822080d800bb8580fa86470953c5446cc.

- Rapid Solid Finish → Blueprint happened in one synchronous browser turn: frame7→7, complete,2180/2180 meshes. Both actual PNG downloads were inspected and contain the completed tower.
- The actual544,559-byte PDF was parsed, allfive A4landscape pages rendered and inspected. All33 supplied CrownWharf levels appear; notices identify NTS, illustrative, notforconstruction, and unassigned revision.
- Desktop29commands/4.180s; tablets30/3.335s pluscompleted-state15/0.757s. Every draftingbutton/select was at least44×44 and reachedby hit testing at1024×768 and768×1024. Runtimeerror lists wereempty.
- Download originals remain in the browser Downloads directory; exact run-specific copies and SHA256 hashes are in downloads/ and download-inspection.json.

## Open findings

The separate bottom Model navigation toolbar is absent from Explore &Draw preview (DOM confirmed). Root identified the ready-only rendering condition and is preparing a new build. This candidate is not accepted for the user's bottom-button requirement.

The PDF intentionally shows actual triangulation and occludededges. It is a raster illustrative model book, not a clean architecturalcut-plan package or an editable52-storey design. The expanded tablet drafting dock covers partof the model; itscontrols and launcher remain reachable.

## Evidence

- [Self-contained illustrated HTML](acceptance.html)
- [Machine-readable acceptance](acceptance.json)
- [Actualfile inspection](download-inspection.json)
- [Rapid PNG](downloads/2026-09-08-8093-pencil-01-01.png)
- [PDF](downloads/2026-09-08-8093-pencil-01-03.pdf)

- proof/growth/runner/2026-09-08T03-39-25-526Z-growth-pencil-production.log: exit0, 4commands, 1.298s
- proof/growth/runner/2026-09-08T03-40-14-660Z-growth-pencil-production.log: exit0, 29commands, 4.180s
- proof/growth/runner/2026-09-08T03-40-47-194Z-growth-pencil-production-tablet.log: exit0, 30commands, 3.335s
- proof/growth/runner/2026-09-08T03-42-38-574Z-growth-pencil-production-tablet.log: exit0, 15commands, 0.757s

Harness-only BOM correction and actual download-path behavior are recorded in acceptance.json. Historical failed/superseded evidence remains intact. No application source edits were made in this QA task.
