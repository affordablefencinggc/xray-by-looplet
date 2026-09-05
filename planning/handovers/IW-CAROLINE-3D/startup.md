# IW-CAROLINE-3D standalone startup

2026-09-05. This is a standalone handover packet in the retained geometry agent thread, not a fresh chat. The parent reports that the fresh-thread limit was already exhausted. User supplied the actual Caroline PDF during the Ruffles review. **Caroline supersedes Ruffles as the target building.** Ruffles artifacts remain historical and must never be presented as Caroline.

The user source was read from `C:/Users/danie/Downloads/Caroline - Blueprints and Renderings - 2025-08-08.pdf`, then copied byte-for-byte into `engine/fixtures/caroline-blueprints-renderings-2025-08-08.pdf`. Source size: 4,169,029 bytes. SHA-256: `f62cf82411d5343fd67f2c51b9a0092d70c885c147f9e7b417a6204b4edf11eb`. PDF has 19 pages, each 1584 x 1224 points. No original source was modified.

Read the previously applied AGENTS/project instructions and PDF/3D guidance. Used the existing trusted Python executable and isolated PDFium dependency directory. No new dependencies, external AI, credentials, Supabase, migrations, network service, staging or commits are needed. No UI or registry edits belong to this agent. Parent owns registry coordination; UI agent owns renderer integration.

## Inspection result and bounded reconstruction proposal

This source is substantially better specified for reconstruction: complete downstairs and upstairs plans (pages 5/6), four elevations (7/8), two sections (9), roof/foundation plan (4), construction details (10/11), door/window schedules (12), and illustrated cutaway views (14/15/18). Page 13 states 920 square feet and a 16 x 24-foot main mass. It includes an actual wraparound porch, rear kitchen and screen porch, side office/bonus room, downstairs bath, upstairs two bedrooms/bath/hall/closets, and winder stairs. Main gable roof plus low porch/extension roofs are clearly disclosed.

Dimensioned vertical datums on pages 7/9: ground floor 0; second floor +9 feet (2.7432 m); upper eave +17 feet 6 inches (5.334 m); ridge +23 feet (7.0104 m). Main roof 7.5:12, lower roofs 3:12. Floor plans use 1/4 inch = 1 foot (18 page points per foot). The measured 24-foot main width spans 432 page points, supporting the scale directly. The p5 plan origin is approximately (233, 548) page points; final trace endpoints will use the actual plan.

Proposed output remains generic `xray.source-building/v1` triangles in metres, with source-bound materials and evidence references. Caroline-specific fields should include object `level` (ground/upper/roof) and actual `sourceSheets` sizes 1584 x 1224. Source SHA matching selects this model. Public model path proposed: `/models/caroline/source-building.json`, with `/models/caroline/source.pdf` and source page images. Builder/trace names must be Caroline-specific; use previous geometry primitives only when supported by this actual source. No Ruffles building coordinates, heights or roof masses are reused.

Build the complete disclosed layout and stairs, actual dimensioned openings, shutters, porch posts/deck, kitchen/bath fixtures, gable ends and multiple pitched roof surfaces. Retain author attribution/license (Jay Osborne / FreeFarmhouse, CC BY-SA 4.0) from the document. Choose the illustrated conditioned crawlspace presentation; the alternate basement/slab details are options, not additional floors. Substructure depths remain illustrative and source-marked. No site/terrain or alternate houses from page 19 are reconstructed.

## Current state

Source inspection completed. Full contact sheets and page PNG/text extraction: `proof/audit/IW-CAROLINE-3D/source-review/`. `inventory.json` records hashes, dimensions and text lengths. No Caroline reconstruction/UI code has been written yet. Await parent registry contract before owned builder/trace/model writes. Final acceptance requires source-comparison plus actual desktop WebGL roof-on, roof-off and both-floor views, true stair opening and semantic source references. Tests alone do not establish visual fidelity.
