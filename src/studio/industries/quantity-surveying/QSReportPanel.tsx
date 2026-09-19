import { useMemo, useState } from "react";
import { classificationPath, filterQuantityReport, quantityReportCsv, type QuantityReport, type ReportFilter } from "./report.ts";
import {
  formatHierarchicalQuantityCsv,
  verifyQuantityTreeIntegrity,
  OVERLAP_WARNING_HEADER,
  MIN_TOUCH_TARGET_PX,
  buildHierarchicalQuantityRows,
  type HierarchicalExportRow,
} from "./qsReportFormatter.ts";

interface QSReportPanelProps {
  report: QuantityReport;
  disabled?: boolean;
}

export function QSReportPanel({ report, disabled = false }: QSReportPanelProps) {
  const [filter, setFilter] = useState<ReportFilter>({ assignment: "all", nodeId: "" });
  const [downloadMessage, setDownloadMessage] = useState("");
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => new Set(report.nodes.map(n => n.id)));

  const shown = useMemo(() => filterQuantityReport(report, filter), [report, filter]);
  const integrity = useMemo(() => verifyQuantityTreeIntegrity(report), [report]);
  const hierarchicalRows = useMemo(() => buildHierarchicalQuantityRows(shown), [shown]);

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const expandAll = () => setExpandedNodes(new Set(report.nodes.map(n => n.id)));
  const collapseAll = () => setExpandedNodes(new Set());

  const downloadHierarchicalCsv = () => {
    try {
      const csv = formatHierarchicalQuantityCsv(shown, { includeDisclaimer: true });
      const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `qs-hierarchical-report-${report.hierarchyId || "export"}.csv`;
      document.body.append(anchor);
      try {
        anchor.click();
      } finally {
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      setDownloadMessage(`Hierarchical CSV exported with SUMMARY_NODE/LEAF_ITEM disclosure for ${shown.rows.length} items.`);
    } catch {
      setDownloadMessage("Failed to prepare hierarchical CSV. Check draft inputs.");
    }
  };

  const downloadFlatCsv = () => {
    try {
      const csv = quantityReportCsv(shown);
      const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "quantity-draft-items.csv";
      document.body.append(anchor);
      try {
        anchor.click();
      } finally {
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      setDownloadMessage(`Flat item CSV exported (${shown.rows.length} item rows; no hierarchy totals).`);
    } catch {
      setDownloadMessage("CSV could not be prepared. Recalculate the draft and try again.");
    }
  };

  const touchButtonStyle: React.CSSProperties = {
    minHeight: `${MIN_TOUCH_TARGET_PX}px`,
    minWidth: `${MIN_TOUCH_TARGET_PX}px`,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0.5rem 1rem",
    fontWeight: 600,
    fontSize: "0.875rem",
    borderRadius: "6px",
    cursor: disabled ? "not-allowed" : "pointer",
  };

  return (
    <section className="qs-report-panel" aria-label="Quantity classification report">
      {/* Header and status */}
      <div style={{ marginBottom: "1rem" }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: "1rem" }}>
          <strong>Draft classification · Not for verified quotes</strong>
        </p>
        <p style={{ margin: "0.25rem 0", color: "#94a3b8", fontSize: "0.875rem" }}>
          Hierarchy: <strong>{report.hierarchyId}</strong> (Rev: {report.hierarchyRevision}) · {report.rows.length} items (
          {report.rows.length - report.unclassifiedItemIds.length} classified, {report.unclassifiedItemIds.length} unassigned)
        </p>
      </div>

      {/* Prominent Overlap Disclosure Warning Banner */}
      <div
        className="qs-overlap-warning-banner"
        role="alert"
        style={{
          background: "rgba(245, 158, 11, 0.18)",
          border: "1px solid #d97706",
          borderLeft: "6px solid #b45309",
          padding: "1rem 1.25rem",
          borderRadius: "8px",
          marginBottom: "1.25rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
          <span style={{ fontSize: "1.5rem", lineHeight: 1 }} aria-hidden="true">
            ⚠️
          </span>
          <div style={{ flex: 1 }}>
            <strong style={{ color: "#78350f", display: "block", fontSize: "0.9375rem", marginBottom: "0.25rem" }}>
              {OVERLAP_WARNING_HEADER}
            </strong>
            <p style={{ margin: 0, fontSize: "0.875rem", color: "#451a03", lineHeight: 1.45 }}>
              Grand total represents the sum of <strong><code>LEAF_ITEM</code></strong> records only. Category parent nodes (<strong><code>SUMMARY_NODE</code></strong>)
              represent aggregate sub-totals of their children. <strong>Summing summary rows together with leaf rows causes catastrophic double-counting.</strong>
            </p>
            {integrity.discrepancyDetected && (
              <div style={{ marginTop: "0.5rem", padding: "0.375rem 0.5rem", background: "rgba(185, 28, 28, 0.12)", borderLeft: "3px solid #b91c1c", borderRadius: "4px", fontSize: "0.8125rem", color: "#991b1b" }}>
                <strong>Mathematical Proof:</strong> Blindly summing all categories inflates total by{" "}
                <strong>{Object.entries(integrity.doubleCountingErrorByUnit).map(([unit, err]) => `+${err} ${unit}`).join(", ")}</strong>.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Whole Draft Totals (Canonical Item-Once Sums) */}
      <div className="industry-table-wrap" style={{ marginBottom: "1.25rem" }}>
        <table>
          <caption>Whole draft totals — each item counted once</caption>
          <thead>
            <tr>
              <th>Unit</th>
              <th>Evidence</th>
              <th>Total</th>
              <th>Classified</th>
              <th>Unassigned</th>
              <th>Items</th>
            </tr>
          </thead>
          <tbody>
            {report.totals.map(total => (
              <tr key={JSON.stringify([total.unit, total.evidence])}>
                <th scope="row">{total.unit}</th>
                <td>{total.evidence}</td>
                <td>{total.quantity}</td>
                <td>
                  {report.classifiedTotals.find(row => row.unit === total.unit && row.evidence === total.evidence)?.quantity ?? "0"}
                </td>
                <td>
                  {report.unclassifiedTotals.find(row => row.unit === total.unit && row.evidence === total.evidence)?.quantity ?? "0"}
                </td>
                <td>{total.itemCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!report.rows.length && <p>No items match this filter.</p>}
      </div>

      {/* Tablet-Friendly Filter Controls */}
      <div className="industry-fields" style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center", marginBottom: "1.25rem" }}>
        <label style={{ minHeight: `${MIN_TOUCH_TARGET_PX}px`, display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
          Show quantities
          <select
            value={filter.assignment}
            style={{ minHeight: `${MIN_TOUCH_TARGET_PX}px`, padding: "0.5rem", borderRadius: "6px" }}
            onChange={e => {
              setDownloadMessage("");
              setFilter({ assignment: e.target.value as ReportFilter["assignment"], nodeId: "" });
            }}
          >
            <option value="all">All items</option>
            <option value="classified">Classified items</option>
            <option value="unassigned">Unassigned items</option>
          </select>
        </label>

        <label style={{ minHeight: `${MIN_TOUCH_TARGET_PX}px`, display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
          Classification branch
          <select
            value={filter.nodeId}
            disabled={filter.assignment === "unassigned"}
            style={{ minHeight: `${MIN_TOUCH_TARGET_PX}px`, padding: "0.5rem", borderRadius: "6px" }}
            onChange={e => {
              setDownloadMessage("");
              setFilter({ ...filter, nodeId: e.target.value });
            }}
          >
            <option value="">All classifications</option>
            {report.nodes.map(node => (
              <option key={node.id} value={node.id}>
                {classificationPath(report, node.id).join(" / ")} · {node.label}
              </option>
            ))}
          </select>
        </label>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginLeft: "auto" }}>
          <button
            type="button"
            style={{ ...touchButtonStyle, background: "#334155", color: "#f8fafc" }}
            onClick={expandAll}
            title="Expand all tree nodes"
          >
            Expand All
          </button>
          <button
            type="button"
            style={{ ...touchButtonStyle, background: "#334155", color: "#f8fafc" }}
            onClick={collapseAll}
            title="Collapse all tree nodes"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Shown Items Subtotal */}
      <div className="industry-table-wrap" style={{ marginBottom: "1.25rem" }}>
        <table>
          <caption>Shown item totals — {shown.rows.length} of {report.rows.length} items</caption>
          <thead>
            <tr>
              <th>Unit</th>
              <th>Evidence</th>
              <th>Total</th>
              <th>Classified</th>
              <th>Unassigned</th>
              <th>Items</th>
            </tr>
          </thead>
          <tbody>
            {shown.totals.map(total => (
              <tr key={JSON.stringify([total.unit, total.evidence])}>
                <th scope="row">{total.unit}</th>
                <td>{total.evidence}</td>
                <td>{total.quantity}</td>
                <td>
                  {shown.classifiedTotals.find(row => row.unit === total.unit && row.evidence === total.evidence)?.quantity ?? "0"}
                </td>
                <td>
                  {shown.unclassifiedTotals.find(row => row.unit === total.unit && row.evidence === total.evidence)?.quantity ?? "0"}
                </td>
                <td>{total.itemCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Dual CSV Export Action Bar */}
      <div className="industry-actions" style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1rem" }}>
        <button type="button" disabled={disabled || !shown.rows.length} onClick={downloadFlatCsv}>
          Download shown item rows (CSV)
        </button>
        <button
          type="button"
          disabled={disabled || !shown.rows.length}
          style={{
            ...touchButtonStyle,
            background: "#4f46e5",
            color: "#ffffff",
            border: "none",
          }}
          onClick={downloadHierarchicalCsv}
          data-testid="export-hierarchical-csv-btn"
        >
          📄 Download Hierarchical CSV (Disclosed)
        </button>
      </div>

      {downloadMessage && (
        <p role="status" style={{ color: "#34d399", fontWeight: 600, fontSize: "0.875rem", marginBottom: "1rem" }}>
          {downloadMessage}
        </p>
      )}

      <p className="industry-note" style={{ fontSize: "0.8125rem", color: "#94a3b8", marginBottom: "1.25rem" }}>
        Hierarchical export explicitly labels <code>SUMMARY_NODE</code> vs <code>LEAF_ITEM</code> and includes double-counting
        warning headers. Flat CSV contains item rows only. Spreadsheet formula prefixes are neutralised with apostrophes.
      </p>

      {/* Hierarchical Tree Schedule with Touch-Friendly Handles */}
      <div
        className="qs-hierarchy-section"
        style={{
          background: "#0f172a",
          border: "1px solid #1e293b",
          borderRadius: "8px",
          overflow: "hidden",
          marginBottom: "1.5rem",
        }}
      >
        <div
          style={{
            padding: "0.75rem 1rem",
            background: "#1e293b",
            borderBottom: "1px solid #334155",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontWeight: 700, color: "#f8fafc", fontSize: "0.9375rem" }}>
            Classification Tree & Takeoff Breakdown (Touch-Optimized)
          </span>
          <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
            Touch target: ≥44px handles
          </span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ background: "#1e293b", borderBottom: "1px solid #334155" }}>
                <th style={{ padding: "0.75rem 1rem", minWidth: "120px", color: "#f8fafc" }}>Record Type</th>
                <th style={{ padding: "0.75rem 1rem", minWidth: "260px", color: "#f8fafc" }}>Classification / Item</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "right", minWidth: "110px", color: "#f8fafc" }}>Quantity</th>
                <th style={{ padding: "0.75rem 1rem", minWidth: "70px", color: "#f8fafc" }}>Unit</th>
                <th style={{ padding: "0.75rem 1rem", minWidth: "100px", color: "#f8fafc" }}>Evidence</th>
                <th style={{ padding: "0.75rem 1rem", minWidth: "180px", color: "#f8fafc" }}>Source Reference</th>
                <th style={{ padding: "0.75rem 1rem", minWidth: "200px", color: "#f8fafc" }}>Double-Counting Rule</th>
              </tr>
            </thead>
            <tbody>
              {hierarchicalRows.map((row, idx) => {
                const isSummary = row.recordType === "SUMMARY_NODE";
                return (
                  <tr
                    key={`${row.recordType}-${row.id}-${idx}`}
                    style={{
                      background: isSummary ? "rgba(79, 70, 229, 0.12)" : "transparent",
                      borderBottom: "1px solid #1e293b",
                      fontWeight: isSummary ? 600 : 400,
                    }}
                  >
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "0.25rem 0.5rem",
                          borderRadius: "4px",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          background: isSummary ? "rgba(99, 102, 241, 0.25)" : "rgba(16, 185, 129, 0.25)",
                          color: isSummary ? "#c7d2fe" : "#a7f3d0",
                          border: isSummary ? "1px solid rgba(99, 102, 241, 0.5)" : "1px solid rgba(16, 185, 129, 0.5)",
                        }}
                      >
                        {row.recordType}
                      </span>
                    </td>
                    <td style={{ padding: "0.75rem 1rem", paddingLeft: `${1 + row.depth * 1.5}rem` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        {isSummary && (
                          <button
                            type="button"
                            aria-label={`Toggle ${row.id}`}
                            onClick={() => toggleNode(row.id)}
                            style={{
                              minWidth: `${MIN_TOUCH_TARGET_PX}px`,
                              minHeight: `${MIN_TOUCH_TARGET_PX}px`,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              background: "rgba(255, 255, 255, 0.1)",
                              border: "1px solid rgba(255, 255, 255, 0.2)",
                              borderRadius: "4px",
                              color: "#f8fafc",
                              cursor: "pointer",
                              fontSize: "0.875rem",
                              padding: 0,
                              marginRight: "0.25rem",
                            }}
                          >
                            {expandedNodes.has(row.id) ? "▼" : "▶"}
                          </button>
                        )}
                        <span style={{ color: isSummary ? "#ffffff" : "#f1f5f9", fontWeight: isSummary ? 700 : 500 }}>
                          {row.indentedLabel.trim()}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: "0.75rem 1rem", textAlign: "right", fontFamily: "monospace", fontSize: "0.9375rem", color: isSummary ? "#a5b4fc" : "#6ee7b7", fontWeight: 700 }}>
                      {row.quantity}
                    </td>
                    <td style={{ padding: "0.75rem 1rem", color: "#e2e8f0" }}>{row.unit}</td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <span style={{ fontSize: "0.8125rem", color: "#cbd5e1" }}>{row.evidence}</span>
                    </td>
                    <td style={{ padding: "0.75rem 1rem", fontSize: "0.8125rem", color: "#cbd5e1" }}>
                      {row.sourceReference}
                    </td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      {isSummary ? (
                        <span style={{ fontSize: "0.75rem", color: "#fde047", fontWeight: 700 }}>
                          ⛔ AGGREGATE — DO NOT SUM
                        </span>
                      ) : (
                        <span style={{ fontSize: "0.75rem", color: "#6ee7b7", fontWeight: 600 }}>
                          ✓ MEASURED LEAF ITEM
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legacy Fallback Table & Native Details for Browser Interop */}
      <div className="industry-table-wrap" style={{ marginBottom: "1.5rem" }}>
        <table>
          <caption>Shown quantity items</caption>
          <thead>
            <tr>
              <th>Item</th>
              <th>Quantity</th>
              <th>Unit</th>
              <th>Evidence</th>
              <th>Classification</th>
              <th>Source reference</th>
            </tr>
          </thead>
          <tbody>
            {shown.rows.map(row => (
              <tr key={row.id}>
                <th scope="row">{row.id}</th>
                <td>{row.quantity}</td>
                <td>{row.unit}</td>
                <td>{row.evidence}</td>
                <td>
                  {row.nodeId === null
                    ? "Unassigned — choose an assignment above"
                    : classificationPath(shown, row.nodeId).join(" / ")}
                </td>
                <td>
                  {row.source
                    ? `${row.source.documentId} · sheet ${row.source.sheet} · revision ${row.source.revision} (supplied, not verified)`
                    : "Unavailable — manual entry"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Native Details Hierarchy with touch-friendly styles */}
      <details>
        <summary>Explore classification hierarchy</summary>
        <p className="industry-note">
          Whole-draft hierarchy. “Including children” overlaps child totals; use the whole-draft totals above for the
          total, never add parent and child rows together.
        </p>
        {report.nodes
          .filter(node => node.parentId === null)
          .map(node => (
            <HierarchyNode key={node.id} report={report} id={node.id} />
          ))}
      </details>
    </section>
  );
}

function HierarchyNode({ report, id }: { report: QuantityReport; id: string }) {
  const node = report.nodes.find(row => row.id === id)!;
  const children = report.nodes.filter(row => row.parentId === id);
  return (
    <details>
      <summary>
        {node.id} · {node.label}
      </summary>
      <div className="industry-table-wrap">
        <table>
          <caption>{node.id}: direct and inclusive quantities</caption>
          <thead>
            <tr>
              <th>Unit</th>
              <th>Evidence</th>
              <th>Direct items</th>
              <th>Including children</th>
            </tr>
          </thead>
          <tbody>
            {node.rollup.map(total => (
              <tr key={JSON.stringify([total.unit, total.evidence])}>
                <th scope="row">{total.unit}</th>
                <td>{total.evidence}</td>
                <td>
                  {node.direct.find(row => row.unit === total.unit && row.evidence === total.evidence)?.quantity ?? "0"}
                </td>
                <td>{total.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!node.rollup.length && <p>No assigned quantities in this branch.</p>}
      </div>
      {children.map(child => (
        <HierarchyNode key={child.id} report={report} id={child.id} />
      ))}
    </details>
  );
}

