import { z } from "zod";
import { classificationPath, csvCell, type QuantityReport } from "./report.ts";

/**
 * WCAG 2.5.5 minimum touch target size (44x44px) for tablet and mobile devices.
 */
export const MIN_TOUCH_TARGET_PX = 44;

/**
 * Distinct record types written to hierarchical exports.
 * Eliminates ambiguity between rollup aggregates and measured takeoff items.
 */
export const quantityRecordTypeSchema = z.enum(["SUMMARY_NODE", "LEAF_ITEM"]);
export type QuantityRecordType = z.infer<typeof quantityRecordTypeSchema>;

/**
 * Standard double-counting disclosure notice required on all hierarchical cost and quantity exports.
 */
export const OVERLAP_WARNING_HEADER =
  "NOTICE: Parent nodes represent aggregate sub-totals. Do not sum total column blindly.";

export const HIERARCHICAL_CSV_DISCLAIMER_LINES = [
  `# ${OVERLAP_WARNING_HEADER}`,
  "# Record Type 'SUMMARY_NODE' represents an aggregate sub-total of direct and descendant items.",
  "# Record Type 'LEAF_ITEM' represents an individual measured takeoff item.",
  "# Grand total is the sum of LEAF_ITEM records only. Blindly summing all rows causes double-counting.",
] as const;

export const HIERARCHICAL_CSV_COLUMNS = [
  "Record Type",
  "Hierarchy Depth",
  "Indented Description",
  "Item or Node ID",
  "Quantity",
  "Unit",
  "Evidence Class",
  "Direct Subtotal",
  "Rollup Subtotal",
  "Classification Path",
  "Source Reference",
  "Overlap Warning",
] as const;

export interface HierarchicalExportRow {
  recordType: QuantityRecordType;
  depth: number;
  indentedLabel: string;
  id: string;
  quantity: string;
  unit: string;
  evidence: string;
  directSubtotal: string;
  rollupSubtotal: string;
  classificationPath: string[];
  sourceReference: string;
  overlapWarning: string;
}

/** Exact decimal addition without IEEE-754 binary floating point precision loss. */
export function addDecimals(left: string, right: string): string {
  const [li = "0", lf = ""] = left.split(".");
  const [ri = "0", rf = ""] = right.split(".");
  const scale = Math.max(lf.length, rf.length);
  const value = BigInt(li + lf.padEnd(scale, "0")) + BigInt(ri + rf.padEnd(scale, "0"));
  if (!scale) return value.toString();
  const digits = value.toString().padStart(scale + 1, "0");
  const fraction = digits.slice(-scale).replace(/0+$/, "");
  return digits.slice(0, -scale) + (fraction ? `.${fraction}` : "");
}

/**
 * Recursively traverses a classified quantity report and produces an ordered list
 * of hierarchical rows with explicit SUMMARY_NODE vs LEAF_ITEM tagging.
 */
export function buildHierarchicalQuantityRows(report: QuantityReport): HierarchicalExportRow[] {
  const rows: HierarchicalExportRow[] = [];
  const nodeMap = new Map(report.nodes.map(n => [n.id, n]));
  const childrenMap = new Map<string | null, typeof report.nodes>();

  for (const node of report.nodes) {
    const parent = node.parentId;
    const list = childrenMap.get(parent) ?? [];
    list.push(node);
    childrenMap.set(parent, list);
  }

  // Items mapped by assigned node
  const directItemsByNode = new Map<string, typeof report.rows>();
  const unassignedItems: typeof report.rows = [];

  for (const row of report.rows) {
    if (row.nodeId === null) {
      unassignedItems.push(row);
    } else {
      const list = directItemsByNode.get(row.nodeId) ?? [];
      list.push(row);
      directItemsByNode.set(row.nodeId, list);
    }
  }

  function visitNode(nodeId: string, depth: number) {
    const node = nodeMap.get(nodeId);
    if (!node) return;

    const path = classificationPath(report, nodeId);
    const directItems = directItemsByNode.get(nodeId) ?? [];

    // Output summary node row(s) for this node
    // A node may have multiple unit rollups (e.g. m2 and lm)
    if (node.rollup.length > 0) {
      for (const subtotal of node.rollup) {
        const directSub = node.direct.find(d => d.unit === subtotal.unit);
        rows.push({
          recordType: "SUMMARY_NODE",
          depth,
          indentedLabel: "  ".repeat(depth) + `[${node.id}] ${node.label}`,
          id: node.id,
          quantity: subtotal.quantity,
          unit: subtotal.unit,
          evidence: "aggregate",
          directSubtotal: directSub ? directSub.quantity : "0",
          rollupSubtotal: subtotal.quantity,
          classificationPath: path,
          sourceReference: `Aggregate of ${subtotal.itemCount} item(s)`,
          overlapWarning: "AGGREGATE SUB-TOTAL — DO NOT SUM WITH LEAF ITEMS",
        });
      }
    } else {
      // Node has no quantities assigned
      rows.push({
        recordType: "SUMMARY_NODE",
        depth,
        indentedLabel: "  ".repeat(depth) + `[${node.id}] ${node.label} (Empty)`,
        id: node.id,
        quantity: "0",
        unit: "-",
        evidence: "aggregate",
        directSubtotal: "0",
        rollupSubtotal: "0",
        classificationPath: path,
        sourceReference: "No items assigned",
        overlapWarning: "EMPTY SUMMARY NODE",
      });
    }

    // Output direct leaf items assigned to this node
    for (const item of directItems) {
      const src = item.source
        ? `${item.source.documentId} · p.${item.source.sheet} · rev.${item.source.revision}`
        : "Unavailable — manual entry";
      rows.push({
        recordType: "LEAF_ITEM",
        depth: depth + 1,
        indentedLabel: "  ".repeat(depth + 1) + `• ${item.id}`,
        id: item.id,
        quantity: item.quantity,
        unit: item.unit,
        evidence: item.evidence,
        directSubtotal: item.quantity,
        rollupSubtotal: item.quantity,
        classificationPath: path,
        sourceReference: src,
        overlapWarning: "MEASURED ITEM",
      });
    }

    // Recursively visit child nodes
    const children = childrenMap.get(nodeId) ?? [];
    for (const child of children) {
      visitNode(child.id, depth + 1);
    }
  }

  // Traverse from top-level root nodes
  const rootNodes = childrenMap.get(null) ?? [];
  for (const root of rootNodes) {
    visitNode(root.id, 0);
  }

  // Append unassigned items if any exist
  if (unassignedItems.length > 0) {
    for (const item of unassignedItems) {
      const src = item.source
        ? `${item.source.documentId} · p.${item.source.sheet} · rev.${item.source.revision}`
        : "Unavailable — manual entry";
      rows.push({
        recordType: "LEAF_ITEM",
        depth: 0,
        indentedLabel: `• ${item.id} (Unassigned)`,
        id: item.id,
        quantity: item.quantity,
        unit: item.unit,
        evidence: item.evidence,
        directSubtotal: item.quantity,
        rollupSubtotal: item.quantity,
        classificationPath: [],
        sourceReference: src,
        overlapWarning: "MEASURED ITEM (UNASSIGNED)",
      });
    }
  }

  return rows;
}

/**
 * Formats a hierarchical quantity report into CSV with strict disclosure headers
 * and distinct SUMMARY_NODE vs LEAF_ITEM record tagging.
 */
export function formatHierarchicalQuantityCsv(
  report: QuantityReport,
  options: { includeDisclaimer?: boolean } = {}
): string {
  const includeDisclaimer = options.includeDisclaimer ?? true;
  const rows = buildHierarchicalQuantityRows(report);

  const lines: string[] = [];

  if (includeDisclaimer) {
    for (const disclaimerLine of HIERARCHICAL_CSV_DISCLAIMER_LINES) {
      lines.push(disclaimerLine);
    }
  }

  // Header row
  lines.push(HIERARCHICAL_CSV_COLUMNS.map(csvCell).join(","));

  // Data rows
  for (const row of rows) {
    const cells = [
      row.recordType,
      row.depth.toString(),
      row.indentedLabel,
      row.id,
      row.quantity,
      row.unit,
      row.evidence,
      row.directSubtotal,
      row.rollupSubtotal,
      JSON.stringify(row.classificationPath),
      row.sourceReference,
      row.overlapWarning,
    ];
    lines.push(cells.map(csvCell).join(","));
  }

  return lines.join("\r\n") + "\r\n";
}

export interface TreeIntegrityVerdict {
  isValid: boolean;
  leafTotalsByUnit: Record<string, string>;
  summaryTotalsByUnit: Record<string, string>;
  blindSumByUnit: Record<string, string>;
  doubleCountingErrorByUnit: Record<string, string>;
  totalLeafCount: number;
  totalSummaryCount: number;
  discrepancyDetected: boolean;
}

/**
 * Proves mathematically that summing all CSV rows blindly leads to double-counting,
 * while summing only LEAF_ITEM rows matches the true report totals.
 */
export function verifyQuantityTreeIntegrity(report: QuantityReport): TreeIntegrityVerdict {
  const rows = buildHierarchicalQuantityRows(report);

  const leafTotalsByUnit: Record<string, string> = {};
  const summaryTotalsByUnit: Record<string, string> = {};
  const blindSumByUnit: Record<string, string> = {};
  const doubleCountingErrorByUnit: Record<string, string> = {};

  let totalLeafCount = 0;
  let totalSummaryCount = 0;

  for (const row of rows) {
    if (row.recordType === "LEAF_ITEM") {
      totalLeafCount++;
      leafTotalsByUnit[row.unit] = addDecimals(leafTotalsByUnit[row.unit] ?? "0", row.quantity);
      blindSumByUnit[row.unit] = addDecimals(blindSumByUnit[row.unit] ?? "0", row.quantity);
    } else if (row.recordType === "SUMMARY_NODE" && row.unit !== "-") {
      totalSummaryCount++;
      summaryTotalsByUnit[row.unit] = addDecimals(summaryTotalsByUnit[row.unit] ?? "0", row.quantity);
      blindSumByUnit[row.unit] = addDecimals(blindSumByUnit[row.unit] ?? "0", row.quantity);
    }
  }

  let discrepancyDetected = false;
  for (const unit of Object.keys(blindSumByUnit)) {
    const leaf = leafTotalsByUnit[unit] ?? "0";
    const blind = blindSumByUnit[unit] ?? "0";
    const summary = summaryTotalsByUnit[unit] ?? "0";

    if (summary !== "0") {
      discrepancyDetected = true;
      doubleCountingErrorByUnit[unit] = summary;
    } else {
      doubleCountingErrorByUnit[unit] = "0";
    }
  }

  // Validate that leafTotalsByUnit matches report.totals
  let isValid = true;
  for (const total of report.totals) {
    const calculated = leafTotalsByUnit[total.unit];
    // In report.totals, totals are grouped by unit and evidence. Let's sum across evidence for the unit.
    const expectedUnitTotal = report.totals
      .filter(t => t.unit === total.unit)
      .reduce((acc, curr) => addDecimals(acc, curr.quantity), "0");

    if (calculated !== expectedUnitTotal) {
      isValid = false;
    }
  }

  return {
    isValid,
    leafTotalsByUnit,
    summaryTotalsByUnit,
    blindSumByUnit,
    doubleCountingErrorByUnit,
    totalLeafCount,
    totalSummaryCount,
    discrepancyDetected,
  };
}
