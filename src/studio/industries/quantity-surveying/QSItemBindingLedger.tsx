import { useMemo } from "react";
import {
  QS_BINDING_STATUSES,
  describeItemBinding,
  evaluateItemBinding,
  type QsBindingStatus,
  type QsEntityGeometry,
  type QsItemBinding,
} from "./qsItemBinding.ts";
import { resolveEntityHighlight, type QsHighlightResolution } from "./qsEntityHighlight.ts";


/** The minimum a row must supply. Accepting this rather than a full
 *  QuantityReport is deliberate: a report only exists once the draft has been
 *  recalculated, and the moment a user edits a quantity the report is withheld.
 *  Rendering from the report alone would blank the ledger exactly when the
 *  evidence matters most — mid-edit. */
export interface QSBindingLedgerRow {
  id: string;
  quantity: string;
  unit: string;
  evidence?: "unverified" | "inferred" | "sample";
  projectId?: string;
}

interface QSItemBindingLedgerProps {
  /** The items to show. Ordered as given; every one is rendered, bound or not. */
  rows: readonly QSBindingLedgerRow[];
  /** Bindings by item id. An item with no binding is unbound, which is a real
   *  state and is rendered as one rather than being hidden. */
  bindings: ReadonlyMap<string, QsItemBinding>;
  /** Live entities by entity id, read at render time. Staleness is derived from
   *  these on every render — nothing here stores a verdict. */
  entities: ReadonlyMap<string, QsEntityGeometry>;
  /** Called when a row is activated, with the row's binding state already
   *  resolved. Absent when no canvas is mounted to receive a highlight, so the
   *  row renders as plain text rather than as a control that would do nothing. */
  onHighlight?: (itemId: string, resolution: QsHighlightResolution) => void;
  /** Whether the 2D plan and 3D model are currently mounted. Passed through to
   *  the resolver so the ledger never claims to have highlighted something no
   *  canvas could draw. */
  surfacesAvailable?: boolean;
}

const STATUS_STYLE: Record<QsBindingStatus, { bg: string; fg: string; border: string; label: string }> = {
  verified: { bg: "rgba(16, 185, 129, 0.18)", fg: "#a7f3d0", border: "rgba(16, 185, 129, 0.5)", label: "✓ VERIFIED" },
  "stale-measurement": { bg: "rgba(220, 38, 38, 0.18)", fg: "#fecaca", border: "rgba(220, 38, 38, 0.55)", label: "✗ STALE MEASUREMENT" },
  "missing-entity": { bg: "rgba(120, 113, 108, 0.22)", fg: "#e7e5e4", border: "rgba(168, 162, 158, 0.5)", label: "✗ ENTITY MISSING" },
  "unit-changed": { bg: "rgba(217, 119, 6, 0.18)", fg: "#fde68a", border: "rgba(217, 119, 6, 0.55)", label: "✗ UNIT CHANGED" },
  uncalibrated: { bg: "rgba(217, 119, 6, 0.18)", fg: "#fde68a", border: "rgba(217, 119, 6, 0.55)", label: "✗ UNCALIBRATED" },
  "ineligible-evidence": { bg: "rgba(217, 119, 6, 0.18)", fg: "#fde68a", border: "rgba(217, 119, 6, 0.55)", label: "✗ INELIGIBLE EVIDENCE" },
};

const UNBOUND_STYLE = { bg: "rgba(71, 85, 105, 0.18)", fg: "#cbd5e1", border: "rgba(100, 116, 139, 0.45)", label: "— NOT BOUND" };

/** Item-level evidence binding ledger (QS-03).
 *
 * Renders one row per cost-plan item stating which measured entity it is bound
 * to, and whether that binding still holds. Staleness is recomputed on every
 * render from the live entity map, so an item whose geometry moved cannot keep a
 * verified badge by being written to once and forgotten.
 *
 * The panel withholds the verified badge rather than the quantity: the measured
 * number is still shown, because hiding a number a user entered is worse than
 * labelling it. What is withheld is any claim that it is verified.
 */
export function QSItemBindingLedger({
  rows: items, bindings, entities, onHighlight, surfacesAvailable = false,
}: QSItemBindingLedgerProps) {
  const rows = useMemo(
    () => {
      const referenceCounts = new Map<string, number>();
      for (const row of items) {
        const reference = row.id.trim();
        referenceCounts.set(reference, (referenceCounts.get(reference) ?? 0) + 1);
      }
      return items.map((row) => {
        // Draft references may be duplicated while the estimator edits. A map
        // keyed by that reference cannot identify which row owns its binding,
        // so neither duplicate may borrow the other row's measured evidence.
        const ambiguousReference = (referenceCounts.get(row.id.trim()) ?? 0) > 1;
        if (ambiguousReference) return { row, binding: null, evaluation: null, entity: null, ambiguousReference };
        const binding = bindings.get(row.id) ?? null;
        if (binding === null) return { row, binding, evaluation: null, entity: null, ambiguousReference };
        const entity = entities.get(binding.entityId) ?? null;
        return { row, binding, evaluation: evaluateItemBinding(binding, entity, row), entity, ambiguousReference };
      });
    },
    [items, bindings, entities],
  );

  // Resolved per row from the same evaluation that drives the badge, so the
  // highlight can never disagree with the status sitting beside it. Nothing is
  // stored: the resolution is recomputed whenever the ledger re-renders.
  const highlights = useMemo(
    () =>
      rows.map(({ row, binding, evaluation, entity }) =>
        resolveEntityHighlight({
          subject: {
            entityId: binding?.entityId ?? null,
            verified: evaluation?.status === "verified",
            present: entity !== null,
          },
          surfacesAvailable,
        }),
      ),
    [rows, surfacesAvailable],
  );

  const counts = useMemo(() => {
    const tally = new Map<string, number>();
    for (const { binding, evaluation } of rows) {
      const key = binding === null ? "unbound" : evaluation!.status;
      tally.set(key, (tally.get(key) ?? 0) + 1);
    }
    return tally;
  }, [rows]);

  // An unbound item is withheld too, and it is the weakest state of all — nothing
  // claims it was ever measured. Counting only bound-and-failed items would leave
  // a draft where no item is bound rendering its pricing silently withheld.
  const withheldCount = rows.filter(({ binding, evaluation }) => binding === null || !evaluation!.pricingPermitted).length;

  return (
    <section className="qs-item-binding-ledger" aria-label="Item-level evidence binding" data-testid="qs-item-binding-ledger">
      <div style={{ marginBottom: "0.75rem" }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: "0.9375rem", color: "#f8fafc" }}>
          Item-level evidence binding (QS-03)
        </p>
        <p style={{ margin: "0.25rem 0", color: "#94a3b8", fontSize: "0.8125rem" }}>
          Each item is bound to the measured entity it came from. Binding status is recomputed from live geometry on
          every render; nothing here is stored.
        </p>
      </div>

      {withheldCount > 0 && (
        <div
          role="alert"
          data-testid="qs-binding-withheld-notice"
          style={{
            background: "rgba(220, 38, 38, 0.14)",
            border: "1px solid #dc2626",
            borderLeft: "6px solid #b91c1c",
            padding: "0.75rem 1rem",
            borderRadius: "8px",
            marginBottom: "1rem",
          }}
        >
          <strong style={{ color: "#fecaca", display: "block", fontSize: "0.875rem", marginBottom: "0.25rem" }}>
            Pricing withheld on {withheldCount} {withheldCount === 1 ? "item" : "items"}
          </strong>
          <p style={{ margin: 0, fontSize: "0.8125rem", color: "#fca5a5", lineHeight: 1.45 }}>
            {QS_BINDING_STATUSES.filter((s) => s !== "verified")
              .map((s) => `${counts.get(s) ?? 0} ${s}`)
              .join(" · ")}
            {counts.get("unbound") ? ` · ${counts.get("unbound")} unbound` : ""}
          </p>
        </div>
      )}

      <div className="industry-table-wrap" style={{ marginBottom: "1.25rem" }}>
        <table>
          <caption>Measured item bindings — {rows.length} items</caption>
          <thead>
            <tr>
              <th style={{ minWidth: "140px" }}>Item</th>
              <th style={{ minWidth: "110px" }}>Row quantity</th>
              <th style={{ minWidth: "220px" }}>Bound entity</th>
              <th style={{ minWidth: "170px" }}>Binding status</th>
              <th style={{ minWidth: "150px" }}>Pricing</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ row, binding, evaluation, entity, ambiguousReference }, index) => {
              const style = binding === null || evaluation === null ? UNBOUND_STYLE : STATUS_STYLE[evaluation.status];
              const highlight = highlights[index];
              // A row is only a control when there is something to show and somewhere
              // to show it. Otherwise it is a table row, and saying so in the markup
              // is honest where a button that does nothing is not.
              const interactive = onHighlight !== undefined && highlight.resolvable;
              return (
                <tr
                  key={`${row.id}:${index}`}
                  data-testid={`qs-binding-row-${row.id}`}
                  data-binding-status={binding === null ? "unbound" : evaluation!.status}
                  data-ambiguous-reference={ambiguousReference ? "true" : undefined}
                  data-highlight-claim={highlight.claim}
                  data-highlight-resolvable={String(highlight.resolvable)}
                >
                  <td style={{ fontWeight: 600, color: "#f8fafc" }}>{row.id}</td>
                  <td style={{ fontFamily: "monospace" }}>
                    {row.quantity} {row.unit}
                  </td>
                  <td style={{ fontSize: "0.8125rem", color: "#cbd5e1" }}>
                    {binding === null ? (
                      <span style={{ color: "#94a3b8" }}>{ambiguousReference
                        ? "Duplicate item reference: assign a unique reference to identify this row's measured binding."
                        : "No measured entity bound"}</span>
                    ) : (
                      <span title={binding.entityGeometrySha256}>{describeItemBinding(binding)}</span>
                    )}
                    {interactive ? <button
                      type="button"
                      className="qs-binding-highlight"
                      data-testid={`qs-binding-highlight-${row.id}`}
                      onClick={() => onHighlight(row.id, highlight)}
                      title={evaluation && evaluation.status !== "verified" ? evaluation.reasons.join(" ") : highlight.note}
                    >
                      Show in plan + 3D
                    </button> : null}
                  </td>
                  <td>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "0.25rem 0.5rem",
                        borderRadius: "4px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        background: style.bg,
                        color: style.fg,
                        border: `1px solid ${style.border}`,
                      }}
                    >
                      {ambiguousReference ? "AMBIGUOUS REFERENCE" : style.label}
                    </span>
                    {evaluation?.reasons.length ? (
                      <ul style={{ margin: "0.375rem 0 0", paddingLeft: "1rem", fontSize: "0.75rem", color: "#fca5a5" }}>
                        {evaluation.reasons.map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    ) : null}
                  </td>
                  <td data-testid={`qs-binding-pricing-${row.id}`}>
                    {binding === null || !evaluation!.pricingPermitted ? (
                      <span style={{ color: "#fca5a5", fontWeight: 700, fontSize: "0.8125rem" }}>⛔ Withheld</span>
                    ) : (
                      <span style={{ color: "#6ee7b7", fontWeight: 700, fontSize: "0.8125rem" }}>✓ Permitted</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && <p>No items to bind. Recalculate the draft.</p>}
      </div>

      <p className="industry-note" style={{ fontSize: "0.8125rem", color: "#94a3b8" }}>
        A binding records the entity, its geometry hash and the calibration the quantity was measured under. Whether it
        still holds is derived on every render — a stored verdict would let an item keep pricing against geometry that
        changed underneath it.
      </p>
    </section>
  );
}
