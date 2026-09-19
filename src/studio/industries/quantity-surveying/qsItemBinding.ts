import { z } from "zod";

/** Item-level evidence binding for a measured cost-plan line (QS-03).
 *
 * A cost plan row today carries a source reference at the worksheet header
 * (see classification.ts, `item.source`). That says which document the work came
 * from, but not which physical thing was measured. A binding closes that gap: it
 * names the exact measured entity, the revision of its geometry, and the
 * calibration the quantity was derived under.
 *
 * The binding stores identity, never a verdict. Whether a binding is still valid
 * is a pure function of the binding and the live entity (`evaluateItemBinding`),
 * for the same reason `frozenDeliveryState` is a function of state rather than a
 * field: a stored verdict is a second source of truth, and the copy is the one
 * that goes stale. A stored "stale-measurement" flag would let an item keep
 * pricing against geometry that changed underneath it — exactly the outcome this
 * slice exists to prevent.
 */

export const QS_ITEM_BINDING_SCHEMA = "xray.qs-item-binding/v1" as const;

/** SHA-256 as lowercase hex. Byte-identical to `backupDigest` in projectBackup.ts,
 * and deliberately duplicated here rather than imported: projectBackup.ts pulls in
 * the whole backup graph (draftStorage, priceBooks, documents), and a worksheet
 * render has no business loading it. An unproven hex string is not an option —
 * the binding's whole claim rests on this being a real digest of real bytes. */
export async function qsDigest(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map(n => n.toString(16).padStart(2, "0")).join("");
}

const identifier = z.string().trim().min(1).max(240);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const timestamp = z.string().datetime({ offset: true });

/** The geometry classes a quantity can be measured from. Kept narrow on purpose:
 * an entity type outside this list cannot be bound, because nothing in the
 * workspace can produce a measured quantity for it. */
export const QS_BINDABLE_ENTITY_TYPES = ["wall-run", "room-area", "roof-plane", "duct-run"] as const;
export type QsBindableEntityType = (typeof QS_BINDABLE_ENTITY_TYPES)[number];

/** Quantities are exact decimal strings, matching classification.ts. They are
 * never floats and never rounded — a bound measurement that rounds will drift
 * against the report totals it is supposed to reconcile with. */
const quantity = z
  .string()
  .max(80)
  .regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/)
  .transform((value) => (value.includes(".") ? value.replace(/0+$/, "").replace(/\.$/, "") : value));

export const qsItemBindingSchema = z
  .object({
    format: z.literal(QS_ITEM_BINDING_SCHEMA),
    /** The cost-plan row this binding belongs to. */
    itemId: identifier,
    projectId: identifier,
    entityId: identifier,
    entityType: z.enum(QS_BINDABLE_ENTITY_TYPES),
    /** The quantity as measured from the entity, in `unit`. Not a re-typed copy of
     * the row quantity: these are compared, and a mismatch is a finding. */
    measuredQuantity: quantity,
    unit: identifier,
    /** SHA-256 of the entity geometry at the moment of measurement. This is the
     * value staleness is decided against. */
    entityGeometrySha256: sha256,
    /** The document the entity was traced from, when the entity has one. */
    sourceSha256: sha256.nullable(),
    /** The calibration the derivation used. Null means uncalibrated, which is a
     * real state and must remain visible rather than being defaulted away. */
    calibrationId: identifier.nullable(),
    boundAt: timestamp,
    boundBy: identifier,
  })
  .strict()
  .superRefine((binding, context) => {
    const issue = (path: (string | number)[], message: string) =>
      context.addIssue({ code: "custom", path, message });

    // A source document hash without a calibration is a claim that a measurement
    // is reproducible when nothing records the scale it was taken at.
    if (binding.sourceSha256 !== null && binding.calibrationId === null)
      issue(
        ["calibrationId"],
        "A binding traced from a source document records the calibration it was measured under.",
      );

    // The same invariant the rest of the codebase enforces: a traversal-free identity.
    if (binding.entityId === binding.itemId)
      issue(["entityId"], "An item cannot be bound to itself; the entity is a separate measured object.");
  });

export type QsItemBinding = z.infer<typeof qsItemBindingSchema>;

/** The live geometry state of an entity, as read at render time. */
export const qsEntityGeometrySchema = z
  .object({
    entityId: identifier,
    entityType: z.enum(QS_BINDABLE_ENTITY_TYPES),
    geometrySha256: sha256,
    /** Null when the entity has no calibration or its calibration was cleared. */
    calibrationId: identifier.nullable(),
    unit: identifier,
    measuredQuantity: quantity,
  })
  .strict();

export type QsEntityGeometry = z.infer<typeof qsEntityGeometrySchema>;

export const QS_BINDING_STATUSES = [
  "verified",
  "stale-measurement",
  "missing-entity",
  "unit-changed",
  "uncalibrated",
] as const;
export type QsBindingStatus = (typeof QS_BINDING_STATUSES)[number];

export const qsBindingEvaluationSchema = z
  .object({
    status: z.enum(QS_BINDING_STATUSES),
    /** Whether the row may carry a price. Derived from status, never stored. */
    pricingPermitted: z.boolean(),
    reasons: z.array(z.string().min(1).max(300)),
  })
  .strict()
  .superRefine((evaluation, context) => {
    const issue = (path: (string | number)[], message: string) =>
      context.addIssue({ code: "custom", path, message });

    // Pricing is permitted if and only if the binding verified. Stating it as an
    // invariant stops a future caller from rendering a price beside a stale row.
    if (evaluation.pricingPermitted !== (evaluation.status === "verified"))
      issue(["pricingPermitted"], "Only a verified binding may permit pricing.");

    // A non-verified status with no reason is an unexplainable withheld price.
    if (evaluation.status !== "verified" && evaluation.reasons.length === 0)
      issue(["reasons"], "A binding that does not verify states at least one reason.");

    // A verified binding carries no findings.
    if (evaluation.status === "verified" && evaluation.reasons.length > 0)
      issue(["reasons"], "A verified binding carries no findings.");
  });

export type QsBindingEvaluation = z.infer<typeof qsBindingEvaluationSchema>;

/** Decide whether a binding still describes the entity it was measured from.
 *
 * Pure: same binding plus same geometry always yields the same verdict, so the
 * verdict can never be persisted wrongly. Order of checks is deliberate — a
 * missing entity outranks a hash mismatch, because there is nothing to compare
 * once the entity is gone, and reporting "stale" for a deleted wall would send a
 * user looking for a geometry edit that never happened.
 */
export function evaluateItemBinding(
  binding: QsItemBinding,
  entity: QsEntityGeometry | null,
): QsBindingEvaluation {
  if (entity === null)
    return evaluate({ status: "missing-entity", reasons: [`Entity ${binding.entityId} is no longer in the workspace.`] });

  if (entity.entityId !== binding.entityId)
    return evaluate({
      status: "missing-entity",
      reasons: [`Bound entity ${binding.entityId} resolved to ${entity.entityId}.`],
    });

  if (entity.unit !== binding.unit)
    return evaluate({
      status: "unit-changed",
      reasons: [`Unit changed from ${binding.unit} to ${entity.unit}; the measured quantity is not comparable.`],
    });

  // `uncalibrated` describes how the binding was made, never what happened to the
  // entity afterwards. A binding with no calibration can never verify, because a
  // quantity taken without a scale is not a measurement.
  if (binding.calibrationId === null)
    return evaluate({
      status: "uncalibrated",
      reasons: ["The binding was made without a calibration, so its quantity is not a verified measurement."],
    });

  // Past this point the binding is calibrated. An entity that has lost its
  // calibration, or moved to a different one, changed underneath a measurement
  // that was taken against the old scale — that is staleness, not an uncalibrated
  // binding, and the user needs to re-measure rather than re-calibrate.
  if (entity.calibrationId !== binding.calibrationId)
    return evaluate({
      status: "stale-measurement",
      reasons: [`Calibration changed from ${binding.calibrationId} to ${entity.calibrationId}.`],
    });

  if (entity.geometrySha256 !== binding.entityGeometrySha256)
    return evaluate({
      status: "stale-measurement",
      reasons: [`Entity ${binding.entityId} geometry changed since the item was measured.`],
    });

  if (entity.measuredQuantity !== binding.measuredQuantity)
    return evaluate({
      status: "stale-measurement",
      reasons: [
        `Measured quantity changed from ${binding.measuredQuantity} to ${entity.measuredQuantity} ${binding.unit}.`,
      ],
    });

  return evaluate({ status: "verified", reasons: [] });
}

function evaluate(input: { status: QsBindingStatus; reasons: string[] }): QsBindingEvaluation {
  return qsBindingEvaluationSchema.parse({
    status: input.status,
    pricingPermitted: input.status === "verified",
    reasons: input.reasons,
  });
}

/** Compare a bound quantity against the row's own quantity. A disagreement is a
 * finding, not a correction: neither number is silently preferred. */
export function reconcileBoundQuantity(
  binding: QsItemBinding,
  rowQuantity: string,
): { agrees: boolean; binding: string; row: string } {
  return { agrees: binding.measuredQuantity === rowQuantity, binding: binding.measuredQuantity, row: rowQuantity };
}

/** The audit line a report renders for a binding. States the identity, never a verdict. */
export function describeItemBinding(binding: QsItemBinding): string {
  const calibration = binding.calibrationId === null ? "uncalibrated" : binding.calibrationId;
  return `${binding.entityType} ${binding.entityId} · ${binding.measuredQuantity} ${binding.unit} · ${calibration} · geometry ${binding.entityGeometrySha256.slice(0, 12)}…`;
}

/** Whether a pending pin may replace the one in force.
 *
 * A pin is the record of "these are the numbers the user confirmed". It may only
 * be replaced when the draft has been recalculated — that is, when the user has
 * just re-confirmed the current values — and only when it would actually record
 * something new.
 *
 * The tempting bug is to re-pin whenever the rows change. That folds an edit into
 * the binding: the binding is re-derived from the very value it is supposed to be
 * checked against, the geometry hash trivially matches itself, and the ledger
 * reports a clean verification of a number nobody confirmed. Stated as a function
 * so that it can be tested directly rather than only through a render.
 */
export function shouldRepin(input: {
  calculated: boolean;
  draftKey: string;
  pinnedFor: string;
}): boolean {
  if (!input.calculated) return false;
  if (input.draftKey === "") return false;
  return input.pinnedFor !== input.draftKey;
}
