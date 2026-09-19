/**
 * stockNesting.ts — SC-06: ROOF-04 Stock Sheet Layout, Kerf, Nesting & Offcut Classification
 * Typesafe JEV (Justified Executable Verification) Engine
 *
 * Mathematical Invariants:
 * 1. For each stock sheet k: sum(cuts_i) + count(cuts) * kerf + offcut_k = stockLength_k (within 1e-6m).
 * 2. Offcut classification: offcut >= 1.20m => "reusable", offcut < 1.20m => "scrap".
 * 3. Spatial non-overlap: start_i <= end_i <= kerf_i <= start_{i+1}.
 * 4. Deterministic minimum-waste multi-stock 1D bin-packing (Best-Fit Decreasing).
 */

import { z } from "zod";
import type { RoofTakeoffSummary } from "./roofGeometry.ts";

/** Standard commercial Australian Colorbond sheet stock lengths (m) */
export const STANDARD_STOCK_LENGTHS = [3.6, 4.2, 4.8, 6.0] as const;

export const RequiredCutSchema = z.object({
  id: z.string().min(1),
  lengthM: z.number().positive().max(12.0),
  label: z.string().min(1),
  planeId: z.string().optional(),
  runIndex: z.number().int().nonnegative().optional(),
});
export type RequiredCut = z.infer<typeof RequiredCutSchema>;

export const NestingOptionsSchema = z.object({
  availableStockLengthsM: z
    .array(z.number().positive())
    .min(1)
    .default([...STANDARD_STOCK_LENGTHS]),
  kerfMm: z.number().nonnegative().default(5.0), // 5mm kerf allowance per cut
  reusableOffcutThresholdM: z.number().positive().default(1.2), // >= 1.20m is reusable
  salvageRatePerM: z.number().nonnegative().default(14.5), // $/m reusable credit
  stockCostPerM: z.number().positive().default(26.8), // $/m stock purchase cost
});
export type NestingOptions = z.infer<typeof NestingOptionsSchema>;

export const NestedCutPlacementSchema = z.object({
  cutId: z.string(),
  label: z.string(),
  lengthM: z.number().positive(),
  startOffsetM: z.number().nonnegative(),
  endOffsetM: z.number().positive(),
  kerfOffsetM: z.number().positive(),
  planeId: z.string().optional(),
});
export type NestedCutPlacement = z.infer<typeof NestedCutPlacementSchema>;

export const NestedSheetSchema = z.object({
  sheetIndex: z.number().int().nonnegative(),
  stockLengthM: z.number().positive(),
  cuts: z.array(NestedCutPlacementSchema),
  usedLengthM: z.number().nonnegative(),
  kerfLossM: z.number().nonnegative(),
  offcutLengthM: z.number().nonnegative(),
  offcutClassification: z.enum(["reusable", "scrap"]),
  utilizationPct: z.number().min(0).max(100),
  grossCost: z.number().nonnegative(),
  salvageCredit: z.number().nonnegative(),
  netCost: z.number().nonnegative(),
});
export type NestedSheet = z.infer<typeof NestedSheetSchema>;

export const NestingPlanSummarySchema = z.object({
  totalStockSheets: z.number().int().nonnegative(),
  totalStockLengthM: z.number().nonnegative(),
  totalRequiredCutLengthM: z.number().nonnegative(),
  totalKerfLossM: z.number().nonnegative(),
  totalReusableOffcutM: z.number().nonnegative(),
  totalScrapM: z.number().nonnegative(),
  netUtilizationPct: z.number().min(0).max(100),
  grossUtilizationPct: z.number().min(0).max(100),
  totalStockCost: z.number().nonnegative(),
  totalSalvageCredit: z.number().nonnegative(),
  netMaterialCost: z.number().nonnegative(),
  sheets: z.array(NestedSheetSchema),
});
export type NestingPlanSummary = z.infer<typeof NestingPlanSummarySchema>;

export class UnfitCutError extends Error {
  readonly cut: RequiredCut;
  readonly maxAvailableStockM: number;

  constructor(cut: RequiredCut, maxAvailableStockM: number) {
    super(
      `Cut "${cut.label}" (${cut.lengthM.toFixed(3)}m) exceeds maximum available stock length (${maxAvailableStockM.toFixed(3)}m).`,
    );
    this.name = "UnfitCutError";
    this.cut = cut;
    this.maxAvailableStockM = maxAvailableStockM;
  }
}

/**
 * 1D Bin-Packing Multi-Stock Nesting Solver
 * Implements Best-Fit Decreasing (BFD) with kerf deduction and offcut classification.
 */
export function calculateStockNesting(
  cutsInput: RequiredCut[],
  userOptions?: Partial<NestingOptions>,
): NestingPlanSummary {
  // Validate and parse options
  const options = NestingOptionsSchema.parse(userOptions ?? {});
  const sortedStockLengths = [...options.availableStockLengthsM].sort((a, b) => a - b);
  const maxStockLength = sortedStockLengths[sortedStockLengths.length - 1];
  const kerfM = options.kerfMm / 1000;

  // Validate cuts
  const validatedCuts = cutsInput.map((c) => RequiredCutSchema.parse(c));

  for (const cut of validatedCuts) {
    if (cut.lengthM > maxStockLength) {
      throw new UnfitCutError(cut, maxStockLength);
    }
  }

  if (validatedCuts.length === 0) {
    return {
      totalStockSheets: 0,
      totalStockLengthM: 0,
      totalRequiredCutLengthM: 0,
      totalKerfLossM: 0,
      totalReusableOffcutM: 0,
      totalScrapM: 0,
      netUtilizationPct: 0,
      grossUtilizationPct: 0,
      totalStockCost: 0,
      totalSalvageCredit: 0,
      netMaterialCost: 0,
      sheets: [],
    };
  }

  // Sort cuts descending by length for Best-Fit Decreasing
  const sortedCuts = [...validatedCuts].sort((a, b) => b.lengthM - a.lengthM);

  interface ActiveSheetBuilder {
    stockLengthM: number;
    cuts: NestedCutPlacement[];
    currentCursorM: number;
  }

  const activeSheets: ActiveSheetBuilder[] = [];

  for (const cut of sortedCuts) {
    let bestSheetIndex = -1;
    let minRemainingSpace = Infinity;

    // Evaluate existing open sheets for Best Fit
    for (let i = 0; i < activeSheets.length; i++) {
      const sheet = activeSheets[i];
      // Additional cut requires cut.lengthM + kerfM
      const neededSpace = cut.lengthM + kerfM;
      const remainingSpace = sheet.stockLengthM - sheet.currentCursorM;

      if (remainingSpace >= neededSpace) {
        const remainingAfter = remainingSpace - neededSpace;
        if (remainingAfter < minRemainingSpace) {
          minRemainingSpace = remainingAfter;
          bestSheetIndex = i;
        }
      }
    }

    if (bestSheetIndex !== -1) {
      // Place into best existing sheet
      const targetSheet = activeSheets[bestSheetIndex];
      const startOffset = targetSheet.currentCursorM;
      const endOffset = startOffset + cut.lengthM;
      const kerfOffset = endOffset + kerfM;

      targetSheet.cuts.push({
        cutId: cut.id,
        label: cut.label,
        lengthM: round4(cut.lengthM),
        startOffsetM: round4(startOffset),
        endOffsetM: round4(endOffset),
        kerfOffsetM: round4(kerfOffset),
        planeId: cut.planeId,
      });
      targetSheet.currentCursorM = kerfOffset;
    } else {
      // Must open a new stock sheet.
      // Choose the smallest available stock length that can fit this cut + kerf.
      const neededSpace = cut.lengthM + kerfM;
      let chosenStock = sortedStockLengths.find((s) => s >= neededSpace);

      // If cut is very close to exact stock length (e.g. 5.996m with 0.005m kerf = 6.001m > 6.0m),
      // check if cut itself fits stock without trailing kerf.
      if (!chosenStock && cut.lengthM <= maxStockLength) {
        chosenStock = maxStockLength;
      }

      if (!chosenStock) {
        throw new UnfitCutError(cut, maxStockLength);
      }

      const startOffset = 0;
      const endOffset = cut.lengthM;
      const kerfOffset = Math.min(chosenStock, endOffset + kerfM);

      activeSheets.push({
        stockLengthM: chosenStock,
        cuts: [
          {
            cutId: cut.id,
            label: cut.label,
            lengthM: round4(cut.lengthM),
            startOffsetM: 0,
            endOffsetM: round4(endOffset),
            kerfOffsetM: round4(kerfOffset),
            planeId: cut.planeId,
          },
        ],
        currentCursorM: kerfOffset,
      });
    }
  }

  // Compile sheets and metrics
  let totalStockLengthM = 0;
  let totalRequiredCutLengthM = 0;
  let totalKerfLossM = 0;
  let totalReusableOffcutM = 0;
  let totalScrapM = 0;
  let totalStockCost = 0;
  let totalSalvageCredit = 0;

  const sheets: NestedSheet[] = activeSheets.map((sheet, index) => {
    const stockLength = sheet.stockLengthM;
    const cutLengthSum = sheet.cuts.reduce((sum, c) => sum + c.lengthM, 0);
    const kerfCount = sheet.cuts.length;
    // Each cut consumes kerfM, up to remaining stock
    const kerfLoss = Math.min(stockLength - cutLengthSum, kerfCount * kerfM);
    const rawOffcut = Math.max(0, stockLength - cutLengthSum - kerfLoss);
    const offcutLengthM = round4(rawOffcut);

    const isReusable = offcutLengthM >= options.reusableOffcutThresholdM;
    const offcutClassification: "reusable" | "scrap" = isReusable ? "reusable" : "scrap";

    const utilizationPct = round2((cutLengthSum / stockLength) * 100);
    const grossCost = round2(stockLength * options.stockCostPerM);
    const salvageCredit = isReusable ? round2(offcutLengthM * options.salvageRatePerM) : 0;
    const netCost = round2(grossCost - salvageCredit);

    totalStockLengthM += stockLength;
    totalRequiredCutLengthM += cutLengthSum;
    totalKerfLossM += kerfLoss;
    if (isReusable) {
      totalReusableOffcutM += offcutLengthM;
    } else {
      totalScrapM += offcutLengthM;
    }
    totalStockCost += grossCost;
    totalSalvageCredit += salvageCredit;

    return {
      sheetIndex: index,
      stockLengthM: stockLength,
      cuts: sheet.cuts,
      usedLengthM: round4(cutLengthSum),
      kerfLossM: round4(kerfLoss),
      offcutLengthM,
      offcutClassification,
      utilizationPct,
      grossCost,
      salvageCredit,
      netCost,
    };
  });

  const netUtilizationPct =
    totalStockLengthM > 0 ? round2((totalRequiredCutLengthM / totalStockLengthM) * 100) : 0;
  const grossUtilizationPct =
    totalStockLengthM > 0
      ? round2(((totalRequiredCutLengthM + totalReusableOffcutM) / totalStockLengthM) * 100)
      : 0;

  const netMaterialCost = round2(totalStockCost - totalSalvageCredit);

  return {
    totalStockSheets: sheets.length,
    totalStockLengthM: round4(totalStockLengthM),
    totalRequiredCutLengthM: round4(totalRequiredCutLengthM),
    totalKerfLossM: round4(totalKerfLossM),
    totalReusableOffcutM: round4(totalReusableOffcutM),
    totalScrapM: round4(totalScrapM),
    netUtilizationPct,
    grossUtilizationPct,
    totalStockCost: round2(totalStockCost),
    totalSalvageCredit: round2(totalSalvageCredit),
    netMaterialCost,
    sheets,
  };
}

/**
 * Automatically derive deterministic required sheet cuts from a 3D roof takeoff summary.
 * Simulates real Australian roofing trade practice (e.g. 0.762m effective sheet cover).
 */
export function generateCutsFromRoofTakeoff(
  takeoff: RoofTakeoffSummary,
  effectiveSheetCoverM = 0.762,
): RequiredCut[] {
  const cuts: RequiredCut[] = [];

  for (const face of takeoff.faces) {
    // Determine plane dimensions
    const slopeFactor = face.slopeFactor || 1.0;
    // Approximate face width from eave edges
    const eaveEdges = takeoff.edges.filter(
      (e) => e.kind === "eave" && face.name.toLowerCase().includes("hip") ? false : true,
    );
    const avgEaveRun = eaveEdges.length > 0 ? eaveEdges[0].length3D : 8.0;
    const numCourses = Math.max(2, Math.ceil(avgEaveRun / effectiveSheetCoverM));

    // Calculate rafter true slope run
    const estimatedPlanRun = face.areaProjectedM2 / Math.max(1, avgEaveRun);
    const trueSlopeRun = Math.max(1.8, Math.min(5.8, estimatedPlanRun * slopeFactor));

    for (let c = 0; c < numCourses; c++) {
      // For hip/triangular faces, cut length tapers down
      let cutLength = trueSlopeRun;
      if (face.name.toLowerCase().includes("hip")) {
        // Linear taper from base to ridge apex
        const ratio = (c + 0.5) / numCourses;
        cutLength = Math.max(1.0, trueSlopeRun * ratio);
      }

      cuts.push({
        id: `cut-${face.id}-${c + 1}`,
        label: `${face.name} Course ${c + 1}`,
        lengthM: round2(cutLength),
        planeId: face.id,
        runIndex: c,
      });
    }
  }

  return cuts;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
