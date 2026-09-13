# Mapping render service

`POST /api/looplet-site-render` lets the mapping backend use X-Ray's existing image renderer without opening X-Ray or creating an X-Ray account. The mapping backend must verify the mapping user's session and explicit operator allowlist before signing. Local plan IDs are correlation IDs, not proof of database/CRM ownership. No CRM code is involved.

## Configuration

Keep all credentials on servers. Never use VITE variables for service or provider secrets.

- `XRAY_LOOPLET_RENDER_ENABLED=true`
- `XRAY_LOOPLET_RENDER_SECRET`: shared with the trusted mapping backend, at least 32 characters of cryptographically random secret material.
- Existing renderer configuration: `GEMINI_API_KEY` (or `GOOGLE_API_KEY`), `XRAY_AI_WEB_ENABLED=true`, optional `XRAY_RENDER_MODEL`. `XRAY_AI_RENDER_ENABLED=false` disables rendering.

Nothing is enabled or deployed by adding these files. No real provider request was made during verification.

## Signed request

The backend sends JSON content with no browser Origin or Sec-Fetch-Site header:

- `X-Looplet-Timestamp`: UTC Unix milliseconds, as a 13-digit decimal string.
- `X-Looplet-Signature`: lowercase hex HMAC-SHA256 using the shared secret over the exact UTF-8 string `timestamp + '.' + rawRequestBody`.

Body fields: `schema: 'looplet.site-render-service/v1'`, `organizationId`, `planId`, `planRevision` (SHA-256), `source`, and `render` following `renderAiRequestSchema` in `src/studio/assistant/renderTool.ts`. `source` is the actual captured metadata object: `schema: 'looplet.site-visual-source/v1'`, valid `[longitude,latitude]` center, `verticalScale: 1`, and terrain with finite `elevationsM` and matching finite `[x,y]` `localCoordinates`. Other source fields are preserved. Source JSON is capped at 2 MiB. Both `planRevision` and `render.view.sourceSha256` must equal SHA-256 of UTF-8 `JSON.stringify(source)` with unchanged field order. `render.projectId` must equal `planId`; target must be `looplet-site`; captured camera is required. Total body is capped at 12 MiB. PNG bytes, hash and dimensions use the existing renderer's validation.

Measured source metadata is transmitted to and integrity-checked by X-Ray, but the existing image model renders the captured PNG and appearance brief. This does not reconstruct or verify a new geometric model. The measured source accompanies the mapping report separately from the generated illustration.

The successful response is `{schema:'looplet.site-render-service-result/v1', organizationId, planId, planRevision, result}`. `result` is the existing `RenderAiResult`, including the generated image, captured image hash, request digest, model and AI provenance. Its `requestDigest` hashes the JSON serialization of the validated nested render request. The mapping backend must validate this response and bind it to the original immutable request/revision before saving the image. No result changes measured geometry or constitutes measurement verification.

## Limits and retries

Signatures expire after five minutes. Repeated organization/plan/request IDs are rejected with 409 before another provider call, including concurrent duplicates, re-signed requests and retries after provider failure. Do not automatically submit a new ID on timeout or failure. Failed attempts may already have consumed provider quota.

This X-Ray replay ledger is process-local, bounded to 1,024 attempts for 24 hours. The existing renderer's one-at-a-time guard and daily 30-call cap are also process-local. These are **not global or durable account limits**. Production needs the mapping backend's durable per-user idempotency/quota ledger plus provider spending limits; a multi-instance service must not rely on these local guards alone. If the durable broker is absent, deployment must remain limited to an explicitly controlled single-instance setup with its limitations understood.

The service has no CORS allowlist, accepts no arbitrary provider URL, and does not fetch model resources. Missing service configuration fails closed. Provider generation is only initiated by a signed, validated explicit request.

## Verification

Focused DANS1 tests use a fake provider response and a unit-only key. They cover disabled/unsigned requests, signature expiry and browser rejection, project/view mismatch, size rejection, correlated responses, replay rejection, provider failure and concurrent duplicates. Live credentials, deployment and paid image generation remain unverified.
