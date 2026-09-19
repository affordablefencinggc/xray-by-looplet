import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateStockNesting,
  generateCutsFromRoofTakeoff,
  STANDARD_STOCK_LENGTHS,
  UnfitCutError,
  type RequiredCut,
} from "./stockNesting.ts";
import { calculateRoofTakeoff, generateStandardHipRoof } from "./roofGeometry.ts";

describe("stockNesting — SC-06 Typesafe JEV Engine", () => {
  it("strictly enforces 5mm kerf deduction and offcut conservation", () => {
    // 6.0m stock sheet, two 2.50m cuts with 5mm kerf
    const cuts: RequiredCut[] = [
      { id: "c1", lengthM: 2.5, label: "Rafter Run 1" },
      { id: "c2", lengthM: 2.5, label: "Rafter Run 2" },
    ];

    const result = calculateStockNesting(cuts, {
      availableStockLengthsM: [6.0],
      kerfMm: 5.0,
      reusableOffcutThresholdM: 1.2,
      salvageRatePerM: 10.0,
      stockCostPerM: 25.0,
    });

    assert.equal(result.totalStockSheets, 1);
    const sheet = result.sheets[0];
    assert.equal(sheet.stockLengthM, 6.0);
    assert.equal(sheet.cuts.length, 2);

    // Cut 1 starts at 0, ends at 2.500m, kerf up to 2.505m
    assert.equal(sheet.cuts[0].startOffsetM, 0);
    assert.equal(sheet.cuts[0].endOffsetM, 2.5);
    assert.equal(sheet.cuts[0].kerfOffsetM, 2.505);

    // Cut 2 starts at 2.505m, ends at 5.005m, kerf up to 5.010m
    assert.equal(sheet.cuts[1].startOffsetM, 2.505);
    assert.equal(sheet.cuts[1].endOffsetM, 5.005);
    assert.equal(sheet.cuts[1].kerfOffsetM, 5.010);

    // Kerf loss = 0.010m (2 cuts * 0.005m)
    assert.equal(sheet.kerfLossM, 0.01);

    // Offcut = 6.0 - 5.010 = 0.990m
    assert.equal(sheet.offcutLengthM, 0.99);

    // 0.990m < 1.20m threshold => classified as scrap
    assert.equal(sheet.offcutClassification, "scrap");
    assert.equal(sheet.salvageCredit, 0);

    // Exact conservation: usedLength (5.0) + kerfLoss (0.01) + offcut (0.99) === stock (6.0)
    assert.equal(sheet.usedLengthM + sheet.kerfLossM + sheet.offcutLengthM, 6.0);
  });

  it("classifies offcuts >= 1.20m as Reusable Stock with salvage credit", () => {
    // 6.0m stock sheet, one 4.0m cut with 5mm kerf
    // Used: 4.0m, kerf: 0.005m, remaining offcut: 1.995m >= 1.20m
    const cuts: RequiredCut[] = [{ id: "c1", lengthM: 4.0, label: "Main Slope Course 1" }];

    const result = calculateStockNesting(cuts, {
      availableStockLengthsM: [6.0],
      kerfMm: 5.0,
      reusableOffcutThresholdM: 1.2,
      salvageRatePerM: 14.5,
      stockCostPerM: 26.8,
    });

    assert.equal(result.totalStockSheets, 1);
    const sheet = result.sheets[0];
    assert.equal(sheet.offcutLengthM, 1.995);
    assert.equal(sheet.offcutClassification, "reusable");

    // Salvage credit = 1.995m * 14.50 $/m = 28.93 $
    assert.equal(sheet.salvageCredit, 28.93);
    assert.equal(result.totalReusableOffcutM, 1.995);
    assert.equal(result.totalScrapM, 0);

    // Net cost = gross cost (6 * 26.8 = 160.80) - salvage credit (28.93) = 131.87
    assert.equal(sheet.grossCost, 160.8);
    assert.equal(sheet.netCost, 131.87);
  });

  it("accurately tests sharp 1.20m classification boundary", () => {
    // Case A: Exactly 1.200m offcut => Reusable
    // Stock 4.8m, Cut 3.595m + 5mm kerf = 3.600m => Offcut exactly 1.200m
    const cutsA: RequiredCut[] = [{ id: "ca", lengthM: 3.595, label: "Boundary Test A" }];
    const resultA = calculateStockNesting(cutsA, {
      availableStockLengthsM: [4.8],
      kerfMm: 5.0,
      reusableOffcutThresholdM: 1.2,
    });
    assert.equal(resultA.sheets[0].offcutLengthM, 1.2);
    assert.equal(resultA.sheets[0].offcutClassification, "reusable");

    // Case B: 1.199m offcut => Scrap
    // Stock 4.8m, Cut 3.596m + 5mm kerf = 3.601m => Offcut 1.199m
    const cutsB: RequiredCut[] = [{ id: "cb", lengthM: 3.596, label: "Boundary Test B" }];
    const resultB = calculateStockNesting(cutsB, {
      availableStockLengthsM: [4.8],
      kerfMm: 5.0,
      reusableOffcutThresholdM: 1.2,
    });
    assert.equal(resultB.sheets[0].offcutLengthM, 1.199);
    assert.equal(resultB.sheets[0].offcutClassification, "scrap");
  });

  it("selects minimal stock length among standard supplier options (3.6m, 4.2m, 4.8m, 6.0m)", () => {
    // Cuts that fit nicely into discrete stock sizes:
    // c1: 3.50m (fits 3.6m)
    // c2: 4.10m (fits 4.2m)
    // c3: 4.70m (fits 4.8m)
    // c4: 5.90m (fits 6.0m)
    const cuts: RequiredCut[] = [
      { id: "c1", lengthM: 3.5, label: "Valley Fill 1" },
      { id: "c2", lengthM: 4.1, label: "Valley Fill 2" },
      { id: "c3", lengthM: 4.7, label: "Main Course 1" },
      { id: "c4", lengthM: 5.9, label: "Main Course 2" },
    ];

    const result = calculateStockNesting(cuts, {
      availableStockLengthsM: [...STANDARD_STOCK_LENGTHS],
      kerfMm: 5.0,
    });

    assert.equal(result.totalStockSheets, 4);
    const stockLengthsUsed = result.sheets.map((s) => s.stockLengthM).sort((a, b) => a - b);
    assert.deepEqual(stockLengthsUsed, [3.6, 4.2, 4.8, 6.0]);

    // High net utilization (> 95%) because stock was tailored
    assert.ok(result.netUtilizationPct > 95, `Expected >95% yield, got ${result.netUtilizationPct}%`);
  });

  it("guarantees spatial non-overlap and monotonic offset order across all cuts", () => {
    const cuts: RequiredCut[] = [
      { id: "c1", lengthM: 1.8, label: "Hip Course 1" },
      { id: "c2", lengthM: 1.8, label: "Hip Course 2" },
      { id: "c3", lengthM: 1.8, label: "Hip Course 3" },
      { id: "c4", lengthM: 2.2, label: "Gable Run 1" },
      { id: "c5", lengthM: 2.2, label: "Gable Run 2" },
      { id: "c6", lengthM: 3.1, label: "Ridge Course 1" },
    ];

    const result = calculateStockNesting(cuts);

    for (const sheet of result.sheets) {
      for (let i = 0; i < sheet.cuts.length; i++) {
        const cut = sheet.cuts[i];
        assert.ok(cut.startOffsetM >= 0);
        assert.ok(cut.endOffsetM > cut.startOffsetM);
        assert.ok(cut.kerfOffsetM >= cut.endOffsetM);

        if (i > 0) {
          const prevCut = sheet.cuts[i - 1];
          assert.ok(
            cut.startOffsetM >= prevCut.kerfOffsetM,
            `Cut overlap detected on sheet ${sheet.sheetIndex}`,
          );
        }
      }
      assert.ok(
        sheet.cuts.length === 0 ||
          sheet.cuts[sheet.cuts.length - 1].kerfOffsetM + sheet.offcutLengthM <=
            sheet.stockLengthM + 0.0001,
      );
    }
  });

  it("throws UnfitCutError when a cut exceeds maximum available stock length", () => {
    const cuts: RequiredCut[] = [
      { id: "c-too-long", lengthM: 6.5, label: "Overlength Single Rafter" },
    ];

    assert.throws(
      () => calculateStockNesting(cuts, { availableStockLengthsM: [3.6, 4.2, 4.8, 6.0] }),
      (err: unknown) => {
        assert.ok(err instanceof UnfitCutError);
        assert.match((err as UnfitCutError).message, /6\.500m/);
        return true;
      },
    );
  });

  it("handles empty cut list with zero-state schema compliance", () => {
    const result = calculateStockNesting([]);
    assert.equal(result.totalStockSheets, 0);
    assert.equal(result.totalStockLengthM, 0);
    assert.equal(result.netUtilizationPct, 0);
    assert.equal(result.sheets.length, 0);
  });

  it("successfully derives realistic cuts from 3D roof takeoff and solves nesting", () => {
    const hipFaces = generateStandardHipRoof(14, 8, 22.5, 0.45);
    const takeoff = calculateRoofTakeoff(hipFaces);

    const derivedCuts = generateCutsFromRoofTakeoff(takeoff, 0.762);
    assert.ok(derivedCuts.length >= 10, "Expected at least 10 derived sheet runs");

    const nesting = calculateStockNesting(derivedCuts);
    assert.ok(nesting.totalStockSheets > 0);
    assert.ok(nesting.totalRequiredCutLengthM > 0);
    assert.ok(nesting.netUtilizationPct > 50);
    assert.ok(nesting.totalStockCost > 0);
  });
});
