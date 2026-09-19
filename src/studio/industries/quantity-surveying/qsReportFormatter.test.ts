import test from "node:test";
import assert from "node:assert/strict";
import { classifyQuantities } from "./classification.ts";
import {
  buildHierarchicalQuantityRows,
  formatHierarchicalQuantityCsv,
  verifyQuantityTreeIntegrity,
  OVERLAP_WARNING_HEADER,
  HIERARCHICAL_CSV_DISCLAIMER_LINES,
  HIERARCHICAL_CSV_COLUMNS,
  MIN_TOUCH_TARGET_PX,
  addDecimals,
} from "./qsReportFormatter.ts";

function createTestReport() {
  return classifyQuantities({
    hierarchyId: "QS-Commercial-Estimate",
    hierarchyRevision: "Rev-C",
    nodes: [
      { id: "Substructure", label: "01 Substructure", parentId: null },
      { id: "Footings", label: "01.01 Concrete Footings", parentId: "Substructure" },
      { id: "Superstructure", label: "02 Superstructure", parentId: null },
      { id: "Framing", label: "02.01 Structural Framing", parentId: "Superstructure" },
    ],
    items: [
      { id: "item-excavation", quantity: "45.5", unit: "m3", evidence: "measured", source: { documentId: "DWG-001", sha256: "a".repeat(64), revision: "A", sheet: 1, regionId: "reg1", calibrationId: "cal1" } },
      { id: "item-concrete-pad", quantity: "12.25", unit: "m3", evidence: "measured", source: null },
      { id: "item-steel-posts", quantity: "24", unit: "ea", evidence: "sample", source: null },
      { id: "item-timber-joists", quantity: "150.0", unit: "lm", evidence: "inferred", source: null },
      { id: "item-unassigned-site-shed", quantity: "1", unit: "ea", evidence: "unverified", source: null },
    ],
    assignments: [
      { itemId: "item-excavation", nodeId: "Substructure" }, // direct to parent
      { itemId: "item-concrete-pad", nodeId: "Footings" }, // direct to child
      { itemId: "item-steel-posts", nodeId: "Framing" },
      { itemId: "item-timber-joists", nodeId: "Framing" },
    ],
  });
}

test("qsReportFormatter exports exact double-counting disclosure warning header", () => {
  const report = createTestReport();
  const csv = formatHierarchicalQuantityCsv(report);

  assert.ok(csv.includes(OVERLAP_WARNING_HEADER), "Must contain explicit double-counting warning");
  assert.ok(csv.includes("NOTICE: Parent nodes represent aggregate sub-totals. Do not sum total column blindly."));
  for (const line of HIERARCHICAL_CSV_DISCLAIMER_LINES) {
    assert.ok(csv.includes(line), `Must include disclaimer line: ${line}`);
  }
});

test("qsReportFormatter tags every row with SUMMARY_NODE or LEAF_ITEM", () => {
  const report = createTestReport();
  const rows = buildHierarchicalQuantityRows(report);

  assert.ok(rows.length > 0);
  for (const row of rows) {
    assert.ok(
      row.recordType === "SUMMARY_NODE" || row.recordType === "LEAF_ITEM",
      `Row ${row.id} has invalid recordType: ${row.recordType}`
    );

    if (row.recordType === "SUMMARY_NODE") {
      assert.equal(row.overlapWarning, "AGGREGATE SUB-TOTAL — DO NOT SUM WITH LEAF ITEMS");
    } else {
      assert.match(row.overlapWarning, /MEASURED ITEM/);
    }
  }

  const summaryNodes = rows.filter(r => r.recordType === "SUMMARY_NODE");
  const leafItems = rows.filter(r => r.recordType === "LEAF_ITEM");

  // In test report: 4 nodes (Substructure, Footings, Superstructure, Framing)
  // 5 items (excavation, concrete-pad, steel-posts, timber-joists, unassigned)
  assert.equal(leafItems.length, 5, "Must contain all 5 leaf items");
  assert.ok(summaryNodes.length >= 4, "Must contain summary node rows for each classification");
});

test("qsReportFormatter maintains hierarchical depth and indentation", () => {
  const report = createTestReport();
  const rows = buildHierarchicalQuantityRows(report);

  const sub = rows.find(r => r.id === "Substructure" && r.recordType === "SUMMARY_NODE");
  const foot = rows.find(r => r.id === "Footings" && r.recordType === "SUMMARY_NODE");
  const exc = rows.find(r => r.id === "item-excavation" && r.recordType === "LEAF_ITEM");
  const pad = rows.find(r => r.id === "item-concrete-pad" && r.recordType === "LEAF_ITEM");

  assert.ok(sub);
  assert.ok(foot);
  assert.ok(exc);
  assert.ok(pad);

  // Substructure is depth 0
  assert.equal(sub!.depth, 0);
  // Excavation is directly assigned to Substructure -> depth 1
  assert.equal(exc!.depth, 1);
  assert.ok(exc!.indentedLabel.startsWith("  •"));
  // Footings is child of Substructure -> depth 1
  assert.equal(foot!.depth, 1);
  assert.ok(foot!.indentedLabel.startsWith("  [Footings]"));
  // Concrete pad is child of Footings -> depth 2
  assert.equal(pad!.depth, 2);
  assert.ok(pad!.indentedLabel.startsWith("    •"));
});

test("verifyQuantityTreeIntegrity proves double-counting discrepancy and validates leaf total conservation", () => {
  const report = createTestReport();
  const verdict = verifyQuantityTreeIntegrity(report);

  assert.equal(verdict.isValid, true, "Leaf total must match report.totals exactly");
  assert.equal(verdict.discrepancyDetected, true, "Double counting discrepancy must be detected");
  assert.equal(verdict.totalLeafCount, 5);

  // For m3:
  // leaf: excavation (45.5) + concrete-pad (12.25) = 57.75 m3
  assert.equal(verdict.leafTotalsByUnit["m3"], "57.75");
  // Footings rollup = 12.25
  // Substructure rollup = 45.5 (direct) + 12.25 (footings) = 57.75
  // Total summary m3 = 12.25 + 57.75 = 70.0 m3
  assert.equal(verdict.summaryTotalsByUnit["m3"], "70");
  // Blind sum = 57.75 + 70.0 = 127.75 m3 (more than 2.2x the true quantity!)
  assert.equal(verdict.blindSumByUnit["m3"], "127.75");
  assert.equal(verdict.doubleCountingErrorByUnit["m3"], "70");

  // For lm:
  // leaf: timber-joists (150)
  assert.equal(verdict.leafTotalsByUnit["lm"], "150");
  // summary: Framing (150) + Superstructure (150) = 300
  assert.equal(verdict.summaryTotalsByUnit["lm"], "300");
  // Blind sum = 450 lm (3x true quantity!)
  assert.equal(verdict.blindSumByUnit["lm"], "450");
});

test("formatHierarchicalQuantityCsv produces valid RFC-style CSV with formula protection", () => {
  const report = classifyQuantities({
    hierarchyId: "=FormulaInjectionHierarchy",
    hierarchyRevision: "1",
    nodes: [
      { id: "@MaliciousNode", label: "+Dangerous+Calc", parentId: null },
    ],
    items: [
      { id: "-FormulaItem", quantity: "10.0", unit: "m2", evidence: "measured", source: null },
    ],
    assignments: [
      { itemId: "-FormulaItem", nodeId: "@MaliciousNode" },
    ],
  });

  const csv = formatHierarchicalQuantityCsv(report);

  // Check header columns
  assert.ok(csv.includes(HIERARCHICAL_CSV_COLUMNS.map(c => `"${c}"`).join(",")));

  // Formula characters should be prefixed with apostrophe
  assert.ok(csv.includes("'+Dangerous+Calc") || csv.includes("'-FormulaItem"));
});

test("MIN_TOUCH_TARGET_PX meets WCAG 2.5.5 touch target size standard (>= 44px)", () => {
  assert.ok(MIN_TOUCH_TARGET_PX >= 44, "Touch target must be at least 44 pixels for tablet usability");
});

test("addDecimals handles varied scales and zeroes without binary rounding noise", () => {
  assert.equal(addDecimals("0.1", "0.2"), "0.3");
  assert.equal(addDecimals("0.05", "0.05"), "0.1");
  assert.equal(addDecimals("100.25", "200.75"), "301");
  assert.equal(addDecimals("45.500", "12.25"), "57.75");
  assert.equal(addDecimals("0", "0"), "0");
});
