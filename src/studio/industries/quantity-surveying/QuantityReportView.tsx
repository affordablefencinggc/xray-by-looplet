import { QSReportPanel } from "./QSReportPanel";
import type { QuantityReport } from "./report.ts";

export function QuantityReportView({ report, disabled }: { report: QuantityReport; disabled: boolean }) {
  return <QSReportPanel report={report} disabled={disabled} />;
}
