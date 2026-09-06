# AI material review: use and verification

Open Components > Project material takeoff > AI review. The existing text/OCR scans and prepared source inventory remain separate from AI runs.

## Connect and interpret

In the desktop app, choose Connection, enter a Gemini API key and model, and choose Use for this session. The key is held in native process memory until the app closes; it is not stored in the material database, exports, backups or chat. Configuration is not a successful provider call. Disconnect clears it.

Open and register the original PDF through Source documents or the public project library. Choose one sheet, optionally narrow the focus, then choose Send selected sheet to Gemini. This user action sends the page images to Google and can incur provider charges. A full page and four overlapping crops are views of the same sheet. Crops retain full-page coordinates and hashes; dense images are compressed to keep requests bounded. Small or illegible annotations still require manual inspection.

The web service is disabled by default. An operator can supply GEMINI_API_KEY (or GOOGLE_API_KEY), optionally XRAY_AI_MODEL, and explicitly set XRAY_AI_WEB_ENABLED=true. Secrets stay server-side. Requests use a fixed Google HTTPS host, no redirects, a 120-second timeout, single-flight protection and a 20-page per-process daily cap. This cap is not a shared quota across serverless instances or a substitute for access control and provider billing limits. This app currently has auth disabled; do not mistake the opt-in endpoint for a per-user authenticated service.

## Review before counting

A successful run saves proposals, source SHA-256/page, request and image hashes, model, time, quotes, regions, unresolved properties and decisions. Proposals do not contribute stock quantities automatically.

View drawing region checks and opens the original source revision. Review material draft opens the existing material editor. Confirm the physical scope, quantity method, unit, dimensions and references before saving; the draft starts unreviewed. Link evidence records another observation of an existing physical item without adding quantity. Exclude requires a reason. Pending proposals prevent signing off their source sheet. AI runs and decisions survive reloads and travel with the existing backup/restore format.

Unknown counts, dimensions, solid volume, shipping volume and weight remain unknown. A model's confidence estimate is not measured accuracy. An assembly description does not establish its hidden subcomponents.

## Measure accuracy

Expand Measure this run against checked quantities. Import a JSON array independently checked for the same page and scope, for example:

```json
[{"key":"D01","quantity":2,"unit":"each"}]
```

Keys match proposal tags, or labels for untagged items. Include every expected item in that scope. Detection precision penalizes extra/duplicate predictions; recall penalizes missed items; exact quantity recall also penalizes unknown, wrong-unit and incorrect quantities. Absolute errors are kept separate by unit. Download benchmark evidence includes the reference, original run and computed scores. The result applies only to that run and reference, never the entire building.

## Current proof boundary

No API key was available during implementation and no live provider interpretation was performed. The HTTP adapter was tested against explicitly labelled deterministic provider fixtures. Web UI tests render a real public PDF into hashed images and intercept only the AI endpoint with fixtures. Native UI tests use real Tauri session-key IPC, then import a clearly labelled fixture backup to exercise review/persistence. Native HTTPS interpretation and real extraction accuracy on web and desktop remain unverified until a configured live run. No coding-agent OAuth credentials or account subscriptions were reused.

The former chat panel returned canned results without executing tools. It now shows honest provider information and links to the working review UI; conversational tool execution is marked planned.

## Reproduce fast UI verification

Run `node proof/audit/IW-AI-MATERIALS/qa.mjs <app URL or desktop exe>` for the current AI review scenarios. Native runs require the dev fixture backup produced by the web run. It uses an isolated browser/profile and saves screenshots and JSON verdicts under screenshots/ai-materials. `npm test` runs the separate logic tests. These are software workflow checks, not real AI accuracy measurements.

Architectural drafting requirements from sascscsc.md are tracked separately in ARCHITECTURE-ROADMAP.md. Layered walls, hosted openings, roof/slab authoring, associative documentation, sheet composition and interoperability remain planned work.
