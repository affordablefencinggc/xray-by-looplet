/**
 * flashingSchedules.ts — SC-07: ROOF-05/06 Flashing, Fixing Schedules & Full Takeoff Export Deliverable
 * Typesafe JEV (Justified Executable Verification) Engine
 *
 * Standards:
 * - AS 4055 (Wind Loads for Housing) / AS 1170.2 (Structural Design Actions - Wind)
 * - AS 1562.1 (Design and Installation of Sheet Roof and Wall Cladding)
 * - Cryptographic Delivery Seal (SH-03: xray.delivery-record/v1)
 */

import { z } from "zod";
import type { RoofTakeoffSummary } from "./roofGeometry.ts";
import { sha256Hex } from "../../architect/designedScene.ts";
import {
  DELIVERY_RECORD_SCHEMA,
  deliveryRecordSchema,
  type DeliveryRecord,
} from "../deliveryRecord.ts";

export const WindClassificationSchema = z.enum([
  "N1",
  "N2",
  "N3",
  "N4",
  "N5",
  "C1",
  "C2",
  "C3",
]);
export type WindClassification = z.infer<typeof WindClassificationSchema>;

export const BattenSubstrateSchema = z.enum([
  "timber-softwood",
  "timber-hardwood",
  "steel-battens",
  "steel-purlins",
]);
export type BattenSubstrate = z.infer<typeof BattenSubstrateSchema>;

export const FlashingKindSchema = z.enum([
  "ridge",
  "valley",
  "barge",
  "apron",
  "box-gutter",
  "custom",
]);
export type FlashingKind = z.infer<typeof FlashingKindSchema>;

export const FlashingGirthSchema = z.enum(["300", "400", "600", "custom"]);
export type FlashingGirth = z.infer<typeof FlashingGirthSchema>;

export const FlashingItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: FlashingKindSchema,
  girthMm: FlashingGirthSchema,
  girthDimensionMm: z.number().positive(),
  unitLengthM: z.number().positive().default(2.4),
  linealMetresNet: z.number().nonnegative(),
  lapAllowancePct: z.number().nonnegative(),
  totalLinealM: z.number().nonnegative(),
  piecesRequired: z.number().int().nonnegative(),
  costPerM: z.number().nonnegative(),
  totalCost: z.number().nonnegative(),
});
export type FlashingItem = z.infer<typeof FlashingItemSchema>;

export const FastenerScheduleSchema = z.object({
  windClassification: WindClassificationSchema,
  battenSubstrate: BattenSubstrateSchema,
  screwDescription: z.string(),
  screwCode: z.string(),
  generalDensityPerM2: z.number().positive(),
  perimeterDensityPerM2: z.number().positive(),
  effectiveAverageDensityPerM2: z.number().positive(),
  totalTrueAreaM2: z.number().positive(),
  totalFastenersExact: z.number().nonnegative(),
  totalFastenersWithSpares: z.number().int().positive(),
  boxSize: z.number().int().positive(),
  boxesRequired: z.number().int().positive(),
  costPerBox: z.number().positive(),
  totalFastenerCost: z.number().positive(),
});
export type FastenerSchedule = z.infer<typeof FastenerScheduleSchema>;

export const RoofingDeliverablePackageSchema = z.object({
  schema: z.literal("xray.roofing-deliverable/v1"),
  packageId: z.string(),
  projectId: z.string(),
  generatedAt: z.string(),
  windClassification: WindClassificationSchema,
  battenSubstrate: BattenSubstrateSchema,
  trueSlopeAreaM2: z.number().positive(),
  projectedAreaM2: z.number().positive(),
  linealEdgeTotals: z.object({
    hipLinealM: z.number().nonnegative(),
    valleyLinealM: z.number().nonnegative(),
    ridgeLinealM: z.number().nonnegative(),
    eavesLinealM: z.number().nonnegative(),
    rakeLinealM: z.number().nonnegative(),
    totalLinealM: z.number().nonnegative(),
  }),
  flashings: z.array(FlashingItemSchema),
  fasteners: FastenerScheduleSchema,
  costBreakdown: z.object({
    flashingsSubtotal: z.number().nonnegative(),
    fastenersSubtotal: z.number().nonnegative(),
    estimatedRoofSubtotal: z.number().nonnegative(),
  }),
  deliveryRecord: deliveryRecordSchema,
});
export type RoofingDeliverablePackage = z.infer<typeof RoofingDeliverablePackageSchema>;

// Standard Flashing Defaults
export const FLASHING_DEFAULTS: Record<
  FlashingKind,
  { name: string; girthMm: FlashingGirth; dimMm: number; lapPct: number; costPerM: number }
> = {
  ridge: {
    name: "Roll Top Ridge Capping",
    girthMm: "300",
    dimMm: 300,
    lapPct: 5.0,
    costPerM: 19.5,
  },
  valley: {
    name: "Internal Valley Gutter",
    girthMm: "400",
    dimMm: 400,
    lapPct: 8.0,
    costPerM: 25.0,
  },
  barge: {
    name: "Barge / Verge Capping",
    girthMm: "300",
    dimMm: 300,
    lapPct: 5.0,
    costPerM: 21.0,
  },
  apron: {
    name: "Abutment Apron Flashing",
    girthMm: "300",
    dimMm: 300,
    lapPct: 6.0,
    costPerM: 18.0,
  },
  "box-gutter": {
    name: "Commercial Box Gutter",
    girthMm: "600",
    dimMm: 600,
    lapPct: 10.0,
    costPerM: 48.0,
  },
  custom: {
    name: "Custom Profile Flashing",
    girthMm: "custom",
    dimMm: 400,
    lapPct: 5.0,
    costPerM: 28.0,
  },
};

/** Fastener density (screws/m²) according to AS 4055 wind class */
export const WIND_DENSITY_MAP: Record<
  WindClassification,
  { general: number; perimeter: number }
> = {
  N1: { general: 4.5, perimeter: 6.0 },
  N2: { general: 5.0, perimeter: 7.0 },
  N3: { general: 6.0, perimeter: 8.5 },
  N4: { general: 7.5, perimeter: 10.5 },
  N5: { general: 9.0, perimeter: 12.5 },
  C1: { general: 6.0, perimeter: 8.5 },
  C2: { general: 7.5, perimeter: 10.5 },
  C3: { general: 9.5, perimeter: 13.0 },
};

/** Screw specification by substrate */
export const SUBSTRATE_SCREW_MAP: Record<
  BattenSubstrate,
  { desc: string; code: string; boxSize: number; costPerBox: number }
> = {
  "timber-softwood": {
    desc: "12-11 x 50mm Type 17 Hex Head with EPDM Neo Washer (Class 4 Colorbond)",
    code: "T17-12-50-C4",
    boxSize: 1000,
    costPerBox: 115.0,
  },
  "timber-hardwood": {
    desc: "12-11 x 65mm Type 17 Hex Head Heavy Duty with EPDM Washer",
    code: "T17-12-65-C4",
    boxSize: 1000,
    costPerBox: 138.0,
  },
  "steel-battens": {
    desc: "12-14 x 20mm AutoTek Hex Head Self-Drilling with Neo Washer (0.75-1.5mm BMT)",
    code: "TEK-12-20-C4",
    boxSize: 1000,
    costPerBox: 108.0,
  },
  "steel-purlins": {
    desc: "12-14 x 45mm Tek Hex Head Heavy Commercial Self-Drilling (1.5-4.5mm steel)",
    code: "TEK-12-45-C4",
    boxSize: 500,
    costPerBox: 86.0,
  },
};

/**
 * Calculate complete flashing schedule from 3D roof takeoff lineal geometry.
 */
export function calculateFlashingSchedule(
  takeoff: RoofTakeoffSummary,
  unitLengthM = 2.4,
): FlashingItem[] {
  const items: FlashingItem[] = [];

  // 1. Ridge Capping (300mm girth)
  if (takeoff.ridgeLinealM > 0) {
    const d = FLASHING_DEFAULTS.ridge;
    const totalLineal = round2(takeoff.ridgeLinealM * (1 + d.lapPct / 100));
    const pieces = Math.max(1, Math.ceil(totalLineal / unitLengthM));
    items.push({
      id: "flashing-ridge",
      name: d.name,
      kind: "ridge",
      girthMm: d.girthMm,
      girthDimensionMm: d.dimMm,
      unitLengthM,
      linealMetresNet: round2(takeoff.ridgeLinealM),
      lapAllowancePct: d.lapPct,
      totalLinealM: totalLineal,
      piecesRequired: pieces,
      costPerM: d.costPerM,
      totalCost: round2(totalLineal * d.costPerM),
    });
  }

  // 2. Valley Gutters (400mm girth)
  if (takeoff.valleyLinealM > 0) {
    const d = FLASHING_DEFAULTS.valley;
    const totalLineal = round2(takeoff.valleyLinealM * (1 + d.lapPct / 100));
    const pieces = Math.max(1, Math.ceil(totalLineal / unitLengthM));
    items.push({
      id: "flashing-valley",
      name: d.name,
      kind: "valley",
      girthMm: d.girthMm,
      girthDimensionMm: d.dimMm,
      unitLengthM,
      linealMetresNet: round2(takeoff.valleyLinealM),
      lapAllowancePct: d.lapPct,
      totalLinealM: totalLineal,
      piecesRequired: pieces,
      costPerM: d.costPerM,
      totalCost: round2(totalLineal * d.costPerM),
    });
  }

  // 3. Barge / Rake Verge Capping (300mm girth)
  if (takeoff.rakeLinealM > 0) {
    const d = FLASHING_DEFAULTS.barge;
    const totalLineal = round2(takeoff.rakeLinealM * (1 + d.lapPct / 100));
    const pieces = Math.max(1, Math.ceil(totalLineal / unitLengthM));
    items.push({
      id: "flashing-barge",
      name: d.name,
      kind: "barge",
      girthMm: d.girthMm,
      girthDimensionMm: d.dimMm,
      unitLengthM,
      linealMetresNet: round2(takeoff.rakeLinealM),
      lapAllowancePct: d.lapPct,
      totalLinealM: totalLineal,
      piecesRequired: pieces,
      costPerM: d.costPerM,
      totalCost: round2(totalLineal * d.costPerM),
    });
  }

  // 4. Abutment / Apron (if any abutment edges exist)
  const abutmentEdges = takeoff.edges.filter((e) => e.kind === "abutment");
  const abutmentLineal = abutmentEdges.reduce((sum, e) => sum + e.length3D, 0);
  if (abutmentLineal > 0) {
    const d = FLASHING_DEFAULTS.apron;
    const totalLineal = round2(abutmentLineal * (1 + d.lapPct / 100));
    const pieces = Math.max(1, Math.ceil(totalLineal / unitLengthM));
    items.push({
      id: "flashing-apron",
      name: d.name,
      kind: "apron",
      girthMm: d.girthMm,
      girthDimensionMm: d.dimMm,
      unitLengthM,
      linealMetresNet: round2(abutmentLineal),
      lapAllowancePct: d.lapPct,
      totalLinealM: totalLineal,
      piecesRequired: pieces,
      costPerM: d.costPerM,
      totalCost: round2(totalLineal * d.costPerM),
    });
  }

  return items;
}

/**
 * Calculate fastener schedule per AS 4055 / AS 1170.2.
 * Factor in general field area (85%) vs local pressure perimeter/eave edge zone (15%).
 */
export function calculateFastenerSchedule(
  trueAreaM2: number,
  wind: WindClassification = "N2",
  substrate: BattenSubstrate = "timber-softwood",
  spareAllowancePct = 5.0,
): FastenerSchedule {
  const densities = WIND_DENSITY_MAP[wind] ?? WIND_DENSITY_MAP.N2;
  const screwInfo = SUBSTRATE_SCREW_MAP[substrate] ?? SUBSTRATE_SCREW_MAP["timber-softwood"];

  // Weighted average: 85% general field, 15% edge/perimeter (AS 1170.2 Kl=1.5 multiplier)
  const effectiveDensity = round2(0.85 * densities.general + 0.15 * densities.perimeter);
  const exactCount = round2(trueAreaM2 * effectiveDensity);
  const withSpares = Math.ceil(exactCount * (1 + spareAllowancePct / 100));

  const boxSize = screwInfo.boxSize;
  const boxes = Math.max(1, Math.ceil(withSpares / boxSize));
  const totalCost = round2(boxes * screwInfo.costPerBox);

  return {
    windClassification: wind,
    battenSubstrate: substrate,
    screwDescription: screwInfo.desc,
    screwCode: screwInfo.code,
    generalDensityPerM2: densities.general,
    perimeterDensityPerM2: densities.perimeter,
    effectiveAverageDensityPerM2: effectiveDensity,
    totalTrueAreaM2: round2(trueAreaM2),
    totalFastenersExact: exactCount,
    totalFastenersWithSpares: withSpares,
    boxSize,
    boxesRequired: boxes,
    costPerBox: screwInfo.costPerBox,
    totalFastenerCost: totalCost,
  };
}

/**
 * Compile the complete, cryptographically sealed Roofing Takeoff Deliverable (SH-03).
 */
export function compileRoofingDeliverable(
  takeoff: RoofTakeoffSummary,
  options?: {
    projectId?: string;
    wind?: WindClassification;
    substrate?: BattenSubstrate;
    timestampIso?: string;
  },
): RoofingDeliverablePackage {
  const projectId = options?.projectId ?? "proj-xray-roofing";
  const wind = options?.wind ?? "N2";
  const substrate = options?.substrate ?? "timber-softwood";
  const now = options?.timestampIso ?? new Date().toISOString();

  const flashings = calculateFlashingSchedule(takeoff);
  const fasteners = calculateFastenerSchedule(takeoff.trueSlopeAreaM2, wind, substrate);

  const flashingsSubtotal = round2(flashings.reduce((sum, f) => sum + f.totalCost, 0));
  const fastenersSubtotal = fasteners.totalFastenerCost;
  const estimatedRoofSubtotal = round2(flashingsSubtotal + fastenersSubtotal);

  const payloadToHash = {
    schema: "xray.roofing-deliverable/v1",
    projectId,
    generatedAt: now,
    windClassification: wind,
    battenSubstrate: substrate,
    trueSlopeAreaM2: round2(takeoff.trueSlopeAreaM2),
    projectedAreaM2: round2(takeoff.projectedAreaM2),
    linealEdges: {
      hip: round2(takeoff.hipLinealM),
      valley: round2(takeoff.valleyLinealM),
      ridge: round2(takeoff.ridgeLinealM),
      eaves: round2(takeoff.eavesLinealM),
      rake: round2(takeoff.rakeLinealM),
    },
    flashings: flashings.map((f) => ({
      name: f.name,
      girth: f.girthMm,
      linealM: f.totalLinealM,
      pieces: f.piecesRequired,
      cost: f.totalCost,
    })),
    fasteners: {
      code: fasteners.screwCode,
      count: fasteners.totalFastenersWithSpares,
      boxes: fasteners.boxesRequired,
      cost: fasteners.totalFastenerCost,
    },
    estimatedSubtotal: estimatedRoofSubtotal,
  };

  const canonicalJson = JSON.stringify(payloadToHash, Object.keys(payloadToHash).sort());
  const contentSha256 = sha256Hex(canonicalJson);

  const deliveryRecord: DeliveryRecord = {
    format: DELIVERY_RECORD_SCHEMA,
    id: `deliv-roof-${Date.now()}`,
    kind: "roofing",
    projectId,
    state: "issued-deliverable",
    revision: 1,
    createdAt: now,
    reviewedAt: now,
    issuedAt: now,
    sourceBinding: null,
    contentSha256,
    status: "active",
  };

  // Validate delivery record
  deliveryRecordSchema.parse(deliveryRecord);

  return {
    schema: "xray.roofing-deliverable/v1",
    packageId: deliveryRecord.id,
    projectId,
    generatedAt: now,
    windClassification: wind,
    battenSubstrate: substrate,
    trueSlopeAreaM2: round2(takeoff.trueSlopeAreaM2),
    projectedAreaM2: round2(takeoff.projectedAreaM2),
    linealEdgeTotals: {
      hipLinealM: round2(takeoff.hipLinealM),
      valleyLinealM: round2(takeoff.valleyLinealM),
      ridgeLinealM: round2(takeoff.ridgeLinealM),
      eavesLinealM: round2(takeoff.eavesLinealM),
      rakeLinealM: round2(takeoff.rakeLinealM),
      totalLinealM: round2(
        takeoff.hipLinealM +
          takeoff.valleyLinealM +
          takeoff.ridgeLinealM +
          takeoff.eavesLinealM +
          takeoff.rakeLinealM,
      ),
    },
    flashings,
    fasteners,
    costBreakdown: {
      flashingsSubtotal,
      fastenersSubtotal,
      estimatedRoofSubtotal,
    },
    deliveryRecord,
  };
}

/**
 * Format full package as clean CSV transmittal.
 */
export function exportRoofingPackageToCsv(pkg: RoofingDeliverablePackage): string {
  const lines: string[] = [];
  lines.push("X-RAY ARCHITECTURAL CAD & TAKEOFF WORKSTATION");
  lines.push(`ROOFING & CLADDING SCHEDULE (SH-03 DELIVERABLE),Package ID: ${pkg.packageId}`);
  lines.push(`Generated: ${pkg.generatedAt},Cryptographic SHA-256: ${pkg.deliveryRecord.contentSha256}`);
  lines.push(`Wind Classification: ${pkg.windClassification} (AS 4055),Substrate: ${pkg.battenSubstrate}`);
  lines.push(`True Slope Area (m²): ${pkg.trueSlopeAreaM2.toFixed(2)},Projected Plan Area (m²): ${pkg.projectedAreaM2.toFixed(2)}`);
  lines.push("");

  lines.push("--- FLASHING SCHEDULE ---");
  lines.push("Item,Kind,Girth (mm),Net Lineal (m),Lap %,Order Lineal (m),Pieces (2.4m),Rate ($/m),Total ($)");
  for (const f of pkg.flashings) {
    lines.push(
      `"${f.name}",${f.kind},${f.girthMm},${f.linealMetresNet.toFixed(2)},${f.lapAllowancePct}%,${f.totalLinealM.toFixed(2)},${f.piecesRequired},${f.costPerM.toFixed(2)},${f.totalCost.toFixed(2)}`,
    );
  }
  lines.push("");

  lines.push("--- FASTENER SCHEDULE (AS 1170.2) ---");
  lines.push(`Fastener Description,"${pkg.fasteners.screwDescription}"`);
  lines.push(`Screw Code,${pkg.fasteners.screwCode}`);
  lines.push(`Fastener Density (screws/m²),${pkg.fasteners.effectiveAverageDensityPerM2.toFixed(2)} (General: ${pkg.fasteners.generalDensityPerM2}, Perimeter: ${pkg.fasteners.perimeterDensityPerM2})`);
  lines.push(`Total Fasteners (incl 5% spares),${pkg.fasteners.totalFastenersWithSpares}`);
  lines.push(`Boxes Required (${pkg.fasteners.boxSize}/box),${pkg.fasteners.boxesRequired}`);
  lines.push(`Rate per Box,${pkg.fasteners.costPerBox.toFixed(2)}`);
  lines.push(`Total Fastener Cost,${pkg.fasteners.totalFastenerCost.toFixed(2)}`);
  lines.push("");

  lines.push("--- FINANCIAL SUMMARY ---");
  lines.push(`Flashing Subtotal,${pkg.costBreakdown.flashingsSubtotal.toFixed(2)}`);
  lines.push(`Fasteners Subtotal,${pkg.costBreakdown.fastenersSubtotal.toFixed(2)}`);
  lines.push(`Total Package Cost (AUD),${pkg.costBreakdown.estimatedRoofSubtotal.toFixed(2)}`);
  lines.push("");
  lines.push(`CRYPTOGRAPHIC VERIFICATION SEAL: ${pkg.deliveryRecord.contentSha256}`);

  return lines.join("\n");
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
