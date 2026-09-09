# Large Live assistant files ? 2026-09-09

User request: allow massive files in Live assistant.

Implemented: 500 MiB (524,288,000 bytes, labelled 500 MB) per original, 20 files per selection/message. PNG/JPEG/WebP use bounded JPEG previews; original blobs and incremental SHA-256 identities persist in project-scoped IndexedDB. Added PDF, TXT/Markdown/CSV/JSON/DXF/IFC/SVG attachments. read_assistant_file lists metadata, renders/extracts one PDF page, produces image previews or pages through raw technical text; originals are not embedded in every provider request. Project files can be reattached/downloaded. File IDs/hashes travel as model metadata rather than visible user-message text. Browser quota failures surface without claiming success. Existing plan-import 100 MB limit remains separate.

Checks: 308 assistant tests pass, including 14 new format/size/hash tests; typecheck and scoped lint pass. Added @noble/hashes as a direct dependency (already installed transitively). Manual parity/generated freshness checked; native expected byte fixture updated. No full production/native build, deployment or installation performed.

Executed browser proof:
- 500 MiB synthetic technical text file passed real upload, incremental hashing, IndexedDB commit and original readback in about 8.6 seconds: runner/2026-09-09T11-43-07-476Z-large-files.json.
- Twenty images accepted, including a PNG over 6 MiB. Preview total 420,780 characters. High byte-offset retrieval from the 500 MiB file and foreign-project denial passed: runner/2026-09-09T11-44-32-030Z-large-files.json. Initial test helper tried reading DataTransfer after the input cleared it; upload itself completed. Failed helper log retained.
- All 22 original records, including the 500 MiB original, survived development reload. Desktop/tablet screenshots inspected: runner/2026-09-09T11-46-31-242Z-large-files.json.
- Real Gemini read QA PDF page 2 via read_assistant_file, returning K/5, S-17, B-04, 120 mm and unassigned reviewer: runner/2026-09-09T11-42-32-170Z-large-files.json. This PDF is an authored test fixture, not real engineering evidence.
- Real Gemini transport accepted 20 image previews and described their slate-blue colour: runner/2026-09-09T11-46-56-591Z-large-files.json. This tested provider transport directly after a development reload cleared pending thumbnails; UI batch preview intake was tested separately.
- Browser connection initially timed out, then recovered on retry. A later UI PDF recheck had a provider connection/invalid-data error before tools; recorded separately, not counted as a pass.

Limits: storage capacity depends on browser/device quota; very complex PDF/image decoding can still fail. 500 MiB ingestion was exercised with text, not every possible 500 MiB PDF or image. IFC/DXF retrieval is raw text inspection, not automatic BIM/model import or clash validation. Attachment originals live in a separate local store and are not yet part of existing full-project backup bundles; use original download. No inferred attachment becomes calibrated/approved evidence. See large-files.diff and test/runner logs for proof. Test profile retained as evidence; task browser closed at completion.

Final stable UI recheck passed after development reloads stopped: runner/2026-09-09T11-51-41-776Z-large-files.json. The reattached PDF was read through the tool, returning 120 mm and unassigned reviewer. Visible chat contains the filename; original hash/ID is retained in metadata. Earlier connection failures remain recorded.
