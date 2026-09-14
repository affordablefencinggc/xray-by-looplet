import { classifyQuantities } from './classification.ts';

export type QuantityReport = ReturnType<typeof classifyQuantities>;
export type ReportFilter = { assignment: 'all' | 'classified' | 'unassigned'; nodeId: string };

/** Inclusive hierarchy paths identify membership; they are never added together as totals. */
export function classificationPath(report: QuantityReport, nodeId: string | null): string[] {
  if (nodeId === null) return [];
  const nodes = new Map(report.nodes.map(node => [node.id, node]));
  const path: string[] = [];
  const seen = new Set<string>();
  let current: string | null = nodeId;
  while (current !== null) {
    if (seen.has(current)) throw Error('Classification hierarchy contains a cycle.');
    seen.add(current);
    const node = nodes.get(current);
    if (!node) throw Error('Classification reference unavailable. Recalculate the draft.');
    path.unshift(node.id);
    current = node.parentId;
  }
  return path;
}

export function filterQuantityReport(report: QuantityReport, filter: ReportFilter): QuantityReport {
  if (filter.nodeId && !report.nodes.some(node => node.id === filter.nodeId)) throw Error('Selected classification unavailable.');
  const items = report.rows.filter(row =>
    (filter.assignment === 'all' || (filter.assignment === 'unassigned' ? row.nodeId === null : row.nodeId !== null)) &&
    (!filter.nodeId || classificationPath(report, row.nodeId).includes(filter.nodeId)));
  // Reuse the domain decimal/evidence accumulator on actual rows, never on hierarchy subtotals.
  return classifyQuantities({
    hierarchyId: report.hierarchyId, hierarchyRevision: report.hierarchyRevision,
    nodes: report.nodes.map(({ id, label, parentId }) => ({ id, label, parentId })),
    items: items.map(({ nodeId: _, ...item }) => item),
    assignments: items.flatMap(row => row.nodeId === null ? [] : [{ itemId: row.id, nodeId: row.nodeId }]),
  });
}

/** RFC-style quoting plus spreadsheet formula neutralisation for untrusted labels/references. */
export function csvCell(value: string): string {
  const safe = /^[\s\u0000-\u001f\u007f-\u009f]*[=+\-@]/u.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** The exact CSV columns, in export order. Shared with the assistant boundary so an
 * explanation of the export is grounded in the real header rather than inferred. */
export const CSV_COLUMNS = ['Hierarchy', 'Hierarchy revision', 'Item reference', 'Quantity', 'Unit', 'Evidence',
  'Assignment', 'Classification', 'Classification path', 'Source reference status', 'Document ID',
  'Source SHA-256', 'Source revision', 'Sheet (1-based)', 'Region ID', 'Calibration ID', 'Report status', 'Verified quote eligible'] as const;

/** Exactly one row per actual item, including items directly assigned to a parent. No rollup rows. */
export function quantityReportCsv(report: QuantityReport): string {
  // Fail rather than produce a partial export if the caller supplied broken hierarchy/source data.
  const checked = filterQuantityReport(report, { assignment: 'all', nodeId: '' });
  const header = [...CSV_COLUMNS];
  const rows = checked.rows.map(row => [checked.hierarchyId, checked.hierarchyRevision, row.id, row.quantity, row.unit,
    row.evidence, row.nodeId === null ? 'Unassigned' : 'Classified', row.nodeId ?? '',
    JSON.stringify(classificationPath(checked, row.nodeId)), row.source === null ? 'Unavailable' : 'Supplied reference; not independently verified',
    row.source?.documentId ?? '', row.source?.sha256 ?? '', row.source?.revision ?? '',
    row.source?.sheet.toString() ?? '', row.source?.regionId ?? '', row.source?.calibrationId ?? '',
    checked.status, String(checked.verifiedQuoteEligible)]);
  return [header, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
