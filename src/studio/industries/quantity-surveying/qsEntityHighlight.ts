import { z } from "zod";

/** Highlighting a measured entity in the 2D plan and the 3D model (QS-03, SC-09's human gate).
 *
 * A ledger row names the entity a quantity was measured from. Clicking it should
 * put that entity in front of the user on the canvases they already have. This
 * module is the contract for that hop, and it is deliberately small: the only
 * hard part is deciding what may be *stored*, and the answer is nothing but the
 * user's own click.
 *
 * The selection is not evidence. It states "the user is looking at this object
 * right now", which is a property of the session, not of the measurement. So it
 * is stored as a bare entity id and nothing else — no status, no verdict, no
 * geometry. What the highlight *means* (stale, unbound, missing) is recomputed
 * from the live ledger on every render, exactly as `evaluateItemBinding` is. A
 * stored "highlighting a stale item" flag would be a second source of truth for
 * a fact the ledger already derives, and the copy is the one that goes stale.
 */

export const QS_ENTITY_HIGHLIGHT_SCHEMA = "xray.qs-entity-highlight/v1" as const;

const identifier = z.string().trim().min(1).max(240);

/** Which canvas a highlight request is aimed at. Both, a specific one, or none. */
export const QS_HIGHLIGHT_SURFACES = ["plan-2d", "model-3d"] as const;
export type QsHighlightSurface = (typeof QS_HIGHLIGHT_SURFACES)[number];

/** A request to show one entity. Emitted on click; consumed by whichever canvases are mounted. */
export const qsHighlightRequestSchema = z
  .object({
    format: z.literal(QS_ENTITY_HIGHLIGHT_SCHEMA),
    /** The item whose row was clicked. Carried so a canvas can report back what it framed. */
    itemId: identifier,
    /** The entity to highlight. Must be present — there is no "highlight nothing" request;
     *  clearing the selection is a separate, explicit action. */
    entityId: identifier,
    /** When the request was made. Not used for correctness — a highlight is live or absent —
     *  but it lets a consumer ignore a replayed event. */
    requestedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type QsHighlightRequest = z.infer<typeof qsHighlightRequestSchema>;

/** Whether a highlight should be drawn, and what the row is allowed to claim while it is.
 *
 * The awkward case is a stale or missing binding. The tempting behaviour is to
 * refuse the highlight: "this measurement is invalid, so there is nothing to
 * show". That is backwards. The moment a measurement goes stale is precisely the
 * moment the user most needs to see *which* wall moved — refusing to point at it
 * hides the one piece of information that makes the problem fixable. So the
 * highlight always resolves; it is the accompanying *claim* that changes.
 *
 * `emphasis` is what the canvas should draw. `claim` is what the UI may say about
 * the entity while it is highlighted, and it distinguishes three genuinely
 * different situations that would otherwise all render as "highlighted wall".
 */
export const QS_HIGHLIGHT_CLAIMS = ["measured-and-current", "measured-then-changed", "not-measured"] as const;
export type QsHighlightClaim = (typeof QS_HIGHLIGHT_CLAIMS)[number];

export const qsHighlightResolutionSchema = z
  .object({
    entityId: identifier,
    /** Whether any mounted canvas has this entity to show. */
    resolvable: z.boolean(),
    emphasis: z.enum(["highlight", "warning", "none"]),
    claim: z.enum(QS_HIGHLIGHT_CLAIMS),
    /** One line stating what the highlight means. Empty only when emphasis is "none". */
    note: z.string().max(300),
  })
  .strict()
  .superRefine((resolution, context) => {
    const issue = (path: (string | number)[], message: string) =>
      context.addIssue({ code: "custom", path, message });

    // An unresolvable entity cannot be drawn, so it cannot be emphasised.
    if (!resolution.resolvable && resolution.emphasis !== "none")
      issue(["emphasis"], "An entity no canvas can resolve is not emphasised.");

    // A claim of "not-measured" with a highlight emphasis would present an
    // unmeasured object as a verified one — the exact confusion this whole slice
    // exists to prevent, arriving through the highlight instead of the ledger.
    if (resolution.claim === "not-measured" && resolution.emphasis === "highlight")
      issue(["emphasis"], "An unmeasured entity is never emphasised as measured.");

    // Every drawn highlight states what it means, or it is decoration.
    if (resolution.emphasis !== "none" && resolution.note.trim() === "")
      issue(["note"], "A drawn highlight states what it means.");
  });

export type QsHighlightResolution = z.infer<typeof qsHighlightResolutionSchema>;

/** The live state of the entity a row points at, as the ledger already computes it. */
export interface QsHighlightSubject {
  /** The entity the row is bound to, or null when the row is unbound. */
  entityId: string | null;
  /** Whether the binding verified against live geometry. False when unbound. */
  verified: boolean;
  /** Whether the entity exists in the workspace at all. */
  present: boolean;
}

/** Decide how to draw a highlight for one clicked row.
 *
 * Pure, and a function of the ledger's own evaluation rather than of a parallel
 * copy of it. The panel passes `verified` and `present` straight from
 * `evaluateItemBinding`, so the highlight cannot disagree with the badge beside
 * it — which is the failure that makes a highlight untrustworthy.
 */
export function resolveEntityHighlight(input: {
  subject: QsHighlightSubject;
  /** Whether the surfaces that could draw it are currently mounted. */
  surfacesAvailable: boolean;
}): QsHighlightResolution {
  const { subject, surfacesAvailable } = input;

  // An unbound row points at nothing. There is no entity to frame, and inventing
  // one from the row's own id would highlight the cost line rather than the wall.
  if (subject.entityId === null)
    return parse({
      entityId: "unbound",
      resolvable: false,
      emphasis: "none",
      claim: "not-measured",
      note: "This item is not bound to a measured entity, so there is nothing to highlight.",
    });

  // The entity exists but no canvas is mounted to show it. Reporting "highlighted"
  // for something that was never drawn is the kind of claim this repo rejects.
  if (!surfacesAvailable)
    return parse({
      entityId: subject.entityId,
      resolvable: false,
      emphasis: "none",
      claim: subject.verified ? "measured-and-current" : "measured-then-changed",
      note: "The 2D plan and 3D model are not open, so the entity cannot be shown.",
    });

  if (!subject.present)
    return parse({
      entityId: subject.entityId,
      resolvable: false,
      emphasis: "none",
      claim: "measured-then-changed",
      note: `Entity ${subject.entityId} is not in the workspace, so there is nothing to highlight.`,
    });

  if (!subject.verified)
    return parse({
      entityId: subject.entityId,
      resolvable: true,
      emphasis: "warning",
      claim: "measured-then-changed",
      note: `Showing ${subject.entityId} — its geometry changed since this item was measured.`,
    });

  return parse({
    entityId: subject.entityId,
    resolvable: true,
    emphasis: "highlight",
    claim: "measured-and-current",
    note: `Showing ${subject.entityId}, the entity this item was measured from.`,
  });
}

function parse(input: z.input<typeof qsHighlightResolutionSchema>): QsHighlightResolution {
  return qsHighlightResolutionSchema.parse(input);
}

/** The DOM dataset attribute a canvas sets to record what it currently frames.
 *
 * Read back by the proof harness and by `canvasContextMenuModel`, so a highlight
 * is inspectable rather than only visible — a screenshot shows a colour, but a
 * test needs a value.
 */
export const QS_HIGHLIGHT_ATTRIBUTE = "data-highlighted-entity";

/** Window event carrying a `QsHighlightRequest` in `detail`.
 *
 * A window event rather than store state, for the same reason the request stores
 * no verdict: a highlight is not project data. It is a momentary instruction from
 * the ledger to canvases in other panes, it must not survive a reload, and it
 * must not appear in a backup. Broadcasting keeps the QS panel from importing the
 * viewer and the viewer from importing the QS panel, which would make either one
 * unable to load without the other.
 */
export const QS_HIGHLIGHT_EVENT = "xray:qs-highlight-entity";

/** Selector for a mounted surface that can draw a highlight.
 *
 * Both surfaces opt in with an explicit typed value. Requiring one of each lets
 * the panel distinguish a complete 2D + 3D evidence view from a coincidental
 * canvas elsewhere in the workspace. */
export const QS_HIGHLIGHT_SURFACE_SELECTOR =
  "[data-qs-highlight-surface='plan-2d'], [data-qs-highlight-surface='model-3d']";
