# Adversarial verification of the unlock modules — what was refuted and what changed (2026-09-09)

Workflow `wf_c007d1c6-cc1` (20 agents: 5 research, 5 implement, 10 verify — two lenses per module: evidence-authority/safety and correctness-vs-store-semantics). Full verdicts: `workflow-verdicts.json`; implementer reports: `workflow-impl.json`. Six of ten verdicts came back `refuted: true`. Every **major** issue was fixed by the coordinator before wiring; minors were fixed where cheap and are otherwise listed as limitations.

| Module | Major issue (verifier evidence) | Fix applied |
|---|---|---|
| takeoff | `calibrateSheet` silently unlocked and overwrote a locked calibration | Refuses a locked page unless `replaceLocked: true` (documented as "only at the user's explicit request"); receipt carries `previousCalibration` and a notice |
| takeoff | `reviewTakeoffItem` had no sample firewall | Refuses when the active document is the bundled sample |
| takeoff | Assistant-made approvals were indistinguishable from a human click; provenance text the model invents entered the record like human evidence | Review note is prefixed `Recorded through the Live assistant for <actor>.`; calibration provenance `method` is stored with the `Live assistant · ` prefix; tool descriptions require the user's own evidence statement and reviewer name |
| takeoff | Tools contradicted the operating manual ("never change calibration … or evidence approval") | Manual sentence changed in both copies (`skills.ts` and `src-tauri/src/assistant_ai.rs`, byte-identical; parity test passes): such changes go only through the dedicated tools when the user explicitly asked, edits are allowed and the reviewer is named. Native parity therefore needs the next Dans1 build |
| takeoff (minor) | `mergeSpecification` forced `constructionEnabled: true` over an explicit false | Honours the explicit value |
| render | Store placeholder defaults (incl. the literal hint "Optional finish, weather or presentation direction") were sent as user notes | The untouched placeholder is never sent; receipt states `materialsSource` |
| render | Camera in request/receipt came from the recorded brief, not the captured frame | Camera is sent only when the recorded brief matches the source and is labelled `cameraSource: recorded camera brief (may differ…)`, else null |
| render | Full generated image (up to 10 MiB) echoed into the conversation history | Image part returned only when ≤ 2 MiB of base64; larger renders stay on the Render pane (`imageInReply: false` + note) |
| render (minor) | No sample/source-class flag | Receipt carries `sample` and `sourceClass` |
| price import | Model-chosen fileName + hash of model text recorded as if a file import | Default file name `assistant-paste.csv`; stored `sourceReference` prefixed `Live assistant paste · `; scope says the sha256 is of the pasted UTF-8 text |
| price import | No library-revision binding → retries create duplicate revisions | `expectedLibraryRevision` is required and checked against the library |
| exports | Receipt hard-coded "nothing was uploaded" for any injected download handler; no design identity | `deliveryScope` on the delivery deps (browser default keeps the statement); receipt carries `designName` and `demonstration` |
| architect edit | `rename-design` could strip the demonstration marker from sample geometry; overwrote notes/address silently | Marker is preserved (notice added); every changed design field is reported with its previous value in notices |

Not changed (recorded as limitations): edit-then-remove of the same entity in one batch appears in both lists; a no-op edit still bumps the revision; level removal ignores sheet viewports (validator still refuses); archived sheets are not refused by calibrate/trace; IFC and drawing-PDF bytes are not deterministic (timestamps); `browserDownload` has no DOM test; PriceBookPanel has no live refresh listener (receipt tells the user to press Reload library); the abort signal does not reach `requestRender` from the tool wrapper.
