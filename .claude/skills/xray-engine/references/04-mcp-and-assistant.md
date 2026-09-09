# MCP and Live Assistant Bridge

## Purpose

This document defines the contract between the X-Ray application, external AI assistants,
MCP tools, and the live Magic Pencil draftsman controller.

## Principle

AI may propose, call permitted tools, and prepare drafts.

AI must not silently:

- Convert inferred geometry into verified geometry.
- Alter calibration records without explicit valid inputs.
- Produce quote-ready outputs from sample or unverified plans.
- Change source hashes or document source classes.
- Trigger destructive or irreversible actions without confirmation.

## Exposed MCP tools

### `engine_info`

Purpose: return the active project and inspection state.

Output must include:

```ts
type EngineInfo = {
  projectId?: string;
  activeDocumentId?: string;
  source?: "sample" | "web" | "desktop" | "derived" | "unknown";
  sourceSha256?: string;
  loadedSheets: Array<{ page: number; label?: string }>;
  inspectionReady: boolean;
  calibrationStatus: "missing" | "valid" | "conflicted" | "unverified";
  takeoffStatus: "blocked" | "draft" | "review-required" | "verified";
};
```

### `run_takeoff`

Purpose: produce a non-verified or explicitly scoped takeoff summary.

Rules:

- May run for sample mode.
- Must label sample output as demonstration-only.
- Must never output quote-ready quantities by default.
- Must include evidence-state summary.

### `run_takeoff_calibrated`

Purpose: produce takeoff data from valid source identity and calibration.

Rules:

- Requires matching source hash.
- Requires valid calibration.
- Requires source not equal to `sample` or `unknown`.
- Must return warnings for inferred components.
- Must block verified result status where required evidence is absent.

### `quote_draft`

Purpose: prepare an auditable commercial draft.

Rules:

- Must never send, approve, issue, or finalise a quote.
- Must include all assumptions and evidence warnings.
- Must remain `draft` or `review-required` unless every gate in the takeoff doctrine passes.
- Must include source hash prefix and price-book date.

### `marked_pdf`

Purpose: render an annotated PDF proof set.

Rules:

- Preserve original PDF identity.
- Overlay annotations as derived assets.
- Do not modify original drawing bytes.
- Include source hash and annotation timestamp in output metadata.

### `wireframe_scene`

Purpose: return source-linked wireframe extraction.

Rules:

- Include object IDs, categories, bounds, evidence state, and source references.
- Do not invent geometry not available in the active model.
- Report if scene is demonstration/sample mode.

## Bidirectional Draftsman Bridge

Primary file:

```text
draftsmanBridge.ts
```

All remote/AI actions must pass strict Zod validation.

Supported action names:

```ts
type DraftsmanActionName =
  | "play"
  | "pause"
  | "seek"
  | "set_speed"
  | "set_pencil_scale"
  | "set_pencil_color"
  | "set_dock_position"
  | "tour"
  | "jump_storey"
  | "blueprint";
```

Example Zod schema:

```ts
const DraftsmanActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("play") }),
  z.object({ type: z.literal("pause") }),
  z.object({
    type: z.literal("seek"),
    progress: z.number().finite().min(0).max(1),
  }),
  z.object({
    type: z.literal("set_speed"),
    speed: z.number().finite().positive().max(8),
  }),
  z.object({
    type: z.literal("set_pencil_scale"),
    pencilScale: z.number().finite().min(0.5).max(2.5),
  }),
  z.object({
    type: z.literal("set_pencil_color"),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  }),
  z.object({
    type: z.literal("set_dock_position"),
    dockPosition: z.enum(["bottom-left", "bottom-center"]),
  }),
  z.object({ type: z.literal("tour") }),
  z.object({
    type: z.literal("jump_storey"),
    storeyId: z.string().min(1),
  }),
  z.object({ type: z.literal("blueprint") }),
]);
```

## DOM readiness event

When the controller is mounted and action-ready, dispatch:

```ts
window.dispatchEvent(
  new CustomEvent("xray:draftsman-controller-ready", {
    detail: {
      version: 1,
      supportedActions: [
        "play",
        "pause",
        "seek",
        "set_speed",
        "set_pencil_scale",
        "set_pencil_color",
        "set_dock_position",
        "tour",
        "jump_storey",
        "blueprint",
      ],
    },
  }),
);
```

Rules:

- Dispatch once the handler is genuinely ready.
- Do not claim readiness before Three.js scene references exist.
- Remove event listeners during unmount.
- Return structured errors for rejected actions.
- Clamp valid numeric values at both schema and state-application layers.

## Assistant response requirements

Assistant-visible action results must state:

- Action accepted or rejected.
- Normalized action payload.
- Current drafting stage.
- Active storey where relevant.
- Any evidence limitation.
- Any blocked operation reason.

Example:

```json
{
  "ok": false,
  "error": "TAKEOFF_BLOCKED_UNCALIBRATED",
  "message": "Verified takeoff cannot run because no valid calibration matches the active source document.",
  "source": "desktop",
  "sourceSha256Prefix": "3a4f8d19",
  "calibrationStatus": "missing"
}
```
