import { useMemo, useState } from 'react';
import { classificationPath, filterQuantityReport, quantityReportCsv, type QuantityReport, type ReportFilter } from './report';

function Totals({ report, caption }: { report: QuantityReport; caption: string }) {
  return <div className="industry-table-wrap"><table><caption>{caption}</caption>
    <thead><tr><th>Unit</th><th>Evidence</th><th>Total</th><th>Classified</th><th>Unassigned</th><th>Items</th></tr></thead>
    <tbody>{report.totals.map(total => <tr key={JSON.stringify([total.unit, total.evidence])}>
      <th scope="row">{total.unit}</th><td>{total.evidence}</td><td>{total.quantity}</td>
      <td>{report.classifiedTotals.find(row => row.unit === total.unit && row.evidence === total.evidence)?.quantity ?? '0'}</td>
      <td>{report.unclassifiedTotals.find(row => row.unit === total.unit && row.evidence === total.evidence)?.quantity ?? '0'}</td><td>{total.itemCount}</td>
    </tr>)}</tbody></table>{!report.rows.length && <p>No items match this filter.</p>}</div>;
}

function HierarchyNode({ report, id }: { report: QuantityReport; id: string }) {
  const node = report.nodes.find(row => row.id === id)!;
  const children = report.nodes.filter(row => row.parentId === id);
  return <details><summary>{node.id} · {node.label}</summary>
    <div className="industry-table-wrap"><table><caption>{node.id}: direct and inclusive quantities</caption>
      <thead><tr><th>Unit</th><th>Evidence</th><th>Direct items</th><th>Including children</th></tr></thead>
      <tbody>{node.rollup.map(total => <tr key={JSON.stringify([total.unit, total.evidence])}>
        <th scope="row">{total.unit}</th><td>{total.evidence}</td>
        <td>{node.direct.find(row => row.unit === total.unit && row.evidence === total.evidence)?.quantity ?? '0'}</td><td>{total.quantity}</td>
      </tr>)}</tbody></table>{!node.rollup.length && <p>No assigned quantities in this branch.</p>}</div>
    {children.map(child => <HierarchyNode key={child.id} report={report} id={child.id} />)}
  </details>;
}

export function QuantityReportView({ report, disabled }: { report: QuantityReport; disabled: boolean }) {
  const [filter, setFilter] = useState<ReportFilter>({ assignment: 'all', nodeId: '' });
  const [downloadMessage, setDownloadMessage] = useState('');
  const shown = useMemo(() => filterQuantityReport(report, filter), [report, filter]);
  const download = () => {
    try {
      const url = URL.createObjectURL(new Blob(['\uFEFF', quantityReportCsv(shown)], { type: 'text/csv;charset=utf-8' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'quantity-draft-items.csv';
      document.body.append(anchor);
      try { anchor.click(); } finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
      setDownloadMessage(`CSV download requested for ${shown.rows.length} item rows. No hierarchy totals are exported.`);
    } catch { setDownloadMessage('CSV could not be prepared. Recalculate the draft and try again.'); }
  };
  return <section aria-label="Quantity classification report">
    <p><strong>Draft classification · Not for verified quotes</strong></p>
    <Totals report={report} caption="Whole draft totals — each item counted once" />
    <p>{report.rows.length} items: {report.rows.length - report.unclassifiedItemIds.length} classified, {report.unclassifiedItemIds.length} unassigned. Assignment does not verify a quantity.</p>
    <div className="industry-fields">
      <label>Show quantities<select value={filter.assignment} onChange={event => { setDownloadMessage(''); setFilter({ assignment: event.target.value as ReportFilter['assignment'], nodeId: '' }); }}>
        <option value="all">All items</option><option value="classified">Classified items</option><option value="unassigned">Unassigned items</option>
      </select></label>
      <label>Classification branch<select value={filter.nodeId} disabled={filter.assignment === 'unassigned'} onChange={event => { setDownloadMessage(''); setFilter({ ...filter, nodeId: event.target.value }); }}>
        <option value="">All classifications</option>{report.nodes.map(node => <option key={node.id} value={node.id}>{classificationPath(report, node.id).join(' / ')} · {node.label}</option>)}
      </select></label>
    </div>
    <Totals report={shown} caption={`Shown item totals — ${shown.rows.length} of ${report.rows.length} items`} />
    <div className="industry-actions"><button type="button" disabled={disabled || !shown.rows.length} onClick={download}>Download shown item rows (CSV)</button></div>
    {downloadMessage && <p role="status">{downloadMessage}</p>}
    <p className="industry-note">CSV contains item rows only. Source references remain unavailable for manually entered quantities. Spreadsheet formula-like text is prefixed with an apostrophe for safety.</p>
    <div className="industry-table-wrap"><table><caption>Shown quantity items</caption>
      <thead><tr><th>Item</th><th>Quantity</th><th>Unit</th><th>Evidence</th><th>Classification</th><th>Source reference</th></tr></thead>
      <tbody>{shown.rows.map(row => <tr key={row.id}><th scope="row">{row.id}</th><td>{row.quantity}</td><td>{row.unit}</td><td>{row.evidence}</td>
        <td>{row.nodeId === null ? 'Unassigned — choose an assignment above' : classificationPath(shown, row.nodeId).join(' / ')}</td>
        <td>{row.source ? `${row.source.documentId} · sheet ${row.source.sheet} · revision ${row.source.revision} (supplied, not verified)` : 'Unavailable — manual entry'}</td>
      </tr>)}</tbody></table></div>
    <details><summary>Explore classification hierarchy</summary>
      <p className="industry-note">Whole-draft hierarchy. “Including children” overlaps child totals; use the whole-draft totals above for the total, never add parent and child rows together.</p>
      {report.nodes.filter(node => node.parentId === null).map(node => <HierarchyNode key={node.id} report={report} id={node.id} />)}
    </details>
  </section>;
}
