import { QSReportPanel } from "./QSReportPanel";
import { QSItemBindingLedger, type QSBindingLedgerRow } from "./QSItemBindingLedger";
import type { QuantityReport } from "./report.ts";
import type { QsEntityGeometry, QsItemBinding } from "./qsItemBinding.ts";

/** Bindings, entities and rows are optional: a report rendered without them shows
 * every item as unbound rather than inventing a verification state. The rows come
 * from the draft rather than from `report` so the ledger keeps rendering while a
 * withheld report has no rows of its own. */
export function QuantityReportView({ report, disabled, rows, bindings, entities }: {
  report: QuantityReport;
  disabled: boolean;
  rows?: readonly QSBindingLedgerRow[];
  bindings?: ReadonlyMap<string, QsItemBinding>;
  entities?: ReadonlyMap<string, QsEntityGeometry>;
}) {
  return <div className="qs-quantity-report">
    {rows && bindings && entities && <QSItemBindingLedger rows={rows} bindings={bindings} entities={entities} />}
    <QSReportPanel report={report} disabled={disabled} />
  </div>;
}
