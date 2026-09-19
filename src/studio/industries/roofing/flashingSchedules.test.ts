import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateFastenerSchedule,
  calculateFlashingSchedule,
  compileRoofingDeliverable,
  exportRoofingPackageToCsv,
  WIND_DENSITY_MAP,
  SUBSTRATE_SCREW_MAP,
} from "./flashingSchedules.ts";
import { calculateRoofTakeoff, generateStandardHipRoof, generateLShapedHipValleyRoof, type Point3D } from "./roofGeometry.ts";
import { assertDeliveryContentIntact } from "../deliveryRecord.ts";
import { sha256Hex } from "../../architect/designedScene.ts";

describe("flashingSchedules — SC-07 Typesafe JEV Engine", () => {
  it("scales fastener density and count monotonically across AS 4055 wind classes", () => {
    const areaM2 = 120.0;
    const n1 = calculateFastenerSchedule(areaM2, "N1", "timber-softwood");
    const n2 = calculateFastenerSchedule(areaM2, "N2", "timber-softwood");
    const n3 = calculateFastenerSchedule(areaM2, "N3", "timber-softwood");
    const n4 = calculateFastenerSchedule(areaM2, "N4", "timber-softwood");
    const n5 = calculateFastenerSchedule(areaM2, "N5", "timber-softwood");

    // Monotonic density increase
    assert.ok(n1.effectiveAverageDensityPerM2 < n2.effectiveAverageDensityPerM2);
    assert.ok(n2.effectiveAverageDensityPerM2 < n3.effectiveAverageDensityPerM2);
    assert.ok(n3.effectiveAverageDensityPerM2 < n4.effectiveAverageDensityPerM2);
    assert.ok(n4.effectiveAverageDensityPerM2 < n5.effectiveAverageDensityPerM2);

    // Screw count increases
    assert.ok(n1.totalFastenersWithSpares < n2.totalFastenersWithSpares);
    assert.ok(n2.totalFastenersWithSpares < n3.totalFastenersWithSpares);
    assert.ok(n3.totalFastenersWithSpares < n4.totalFastenersWithSpares);
    assert.ok(n4.totalFastenersWithSpares < n5.totalFastenersWithSpares);

    // Box counts are positive integers
    assert.ok(n1.boxesRequired >= 1);
    assert.ok(n5.boxesRequired >= n1.boxesRequired);
  });

  it("selects correct screw specification, box size, and cost per substrate", () => {
    const timber = calculateFastenerSchedule(100.0, "N2", "timber-softwood");
    assert.match(timber.screwDescription, /Type 17/i);
    assert.equal(timber.screwCode, "T17-12-50-C4");
    assert.equal(timber.boxSize, 1000);

    const purlins = calculateFastenerSchedule(100.0, "N2", "steel-purlins");
    assert.match(purlins.screwDescription, /Tek/i);
    assert.equal(purlins.screwCode, "TEK-12-45-C4");
    assert.equal(purlins.boxSize, 500);
    assert.ok(purlins.totalFastenerCost > 0);
  });

  it("computes complete flashing schedule with standard girths (300/400/600mm) and lap rules", () => {
    // Standard hip roof has ridge and eaves
    const hipFaces = generateStandardHipRoof(14, 8, 22.5, 0.45);
    const hipTakeoff = calculateRoofTakeoff(hipFaces);

    const flashings = calculateFlashingSchedule(hipTakeoff);
    const ridge = flashings.find((f) => f.kind === "ridge");
    assert.ok(ridge, "Expected ridge capping flashing");
    assert.equal(ridge.girthMm, "300");
    assert.equal(ridge.girthDimensionMm, 300);
    assert.equal(ridge.lapAllowancePct, 5.0);
    assert.ok(ridge.totalLinealM > ridge.linealMetresNet);
    assert.equal(ridge.piecesRequired, Math.ceil(ridge.totalLinealM / 2.4));

    // Two roof planes meeting in an internal trough valley
    const valleyFaces = [
      {
        id: "slope-a",
        name: "Left Slope",
        vertices3D: [
          [0, 5, 2.5],
          [0, 0, 0],
          [6, 0, 0],
          [6, 5, 2.5],
        ] as Point3D[],
      },
      {
        id: "slope-b",
        name: "Right Slope",
        vertices3D: [
          [6, 0, 0],
          [0, 0, 0],
          [0, -5, 2.5],
          [6, -5, 2.5],
        ] as Point3D[],
      },
    ];
    const valleyTakeoff = calculateRoofTakeoff(valleyFaces);
    assert.ok(valleyTakeoff.valleyLinealM > 0, "Expected valley lineal metres > 0");

    const valleyFlashings = calculateFlashingSchedule(valleyTakeoff);
    const valley = valleyFlashings.find((f) => f.kind === "valley");
    assert.ok(valley, "Expected valley gutter flashing");
    assert.equal(valley.girthMm, "400");
    assert.equal(valley.girthDimensionMm, 400);
    assert.equal(valley.lapAllowancePct, 8.0);
    assert.ok(valley.totalLinealM > valley.linealMetresNet);
    assert.ok(valley.piecesRequired >= 1);
  });

  it("compiles cryptographically sealed deliveryRecord with valid SHA-256 and tamper detection", () => {
    const faces = generateStandardHipRoof(14, 8, 22.5, 0.45);
    const takeoff = calculateRoofTakeoff(faces);

    const deliverable = compileRoofingDeliverable(takeoff, {
      projectId: "proj-roof-test-1",
      wind: "N3",
      substrate: "steel-battens",
      timestampIso: "2026-09-19T10:00:00.000Z",
    });

    assert.equal(deliverable.schema, "xray.roofing-deliverable/v1");
    assert.equal(deliverable.deliveryRecord.format, "xray.delivery-record/v1");
    assert.equal(deliverable.deliveryRecord.state, "issued-deliverable");
    assert.equal(deliverable.deliveryRecord.status, "active");
    assert.match(deliverable.deliveryRecord.contentSha256, /^[a-f0-9]{64}$/);

    // Recompute hash from canonical payload to verify tamper-proof seal
    const payloadToHash = {
      schema: "xray.roofing-deliverable/v1",
      projectId: deliverable.projectId,
      generatedAt: deliverable.generatedAt,
      windClassification: deliverable.windClassification,
      battenSubstrate: deliverable.battenSubstrate,
      trueSlopeAreaM2: deliverable.trueSlopeAreaM2,
      projectedAreaM2: deliverable.projectedAreaM2,
      linealEdges: {
        hip: deliverable.linealEdgeTotals.hipLinealM,
        valley: deliverable.linealEdgeTotals.valleyLinealM,
        ridge: deliverable.linealEdgeTotals.ridgeLinealM,
        eaves: deliverable.linealEdgeTotals.eavesLinealM,
        rake: deliverable.linealEdgeTotals.rakeLinealM,
      },
      flashings: deliverable.flashings.map((f) => ({
        name: f.name,
        girth: f.girthMm,
        linealM: f.totalLinealM,
        pieces: f.piecesRequired,
        cost: f.totalCost,
      })),
      fasteners: {
        code: deliverable.fasteners.screwCode,
        count: deliverable.fasteners.totalFastenersWithSpares,
        boxes: deliverable.fasteners.boxesRequired,
        cost: deliverable.fasteners.totalFastenerCost,
      },
      estimatedSubtotal: deliverable.costBreakdown.estimatedRoofSubtotal,
    };

    const canonicalJson = JSON.stringify(payloadToHash, Object.keys(payloadToHash).sort());
    assertDeliveryContentIntact(deliverable.deliveryRecord, canonicalJson, sha256Hex);

    // Tampering test: mutating a number must cause verification failure
    const tamperedPayload = { ...payloadToHash, trueSlopeAreaM2: 999.99 };
    const tamperedJson = JSON.stringify(tamperedPayload, Object.keys(tamperedPayload).sort());
    assert.throws(
      () => {
        assertDeliveryContentIntact(deliverable.deliveryRecord, tamperedJson, sha256Hex);
      },
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.match((err as Error).message, /matches its frozen hash/);
        return true;
      },
    );
  });

  it("exports clean, human-readable and machine-parseable CSV deliverable", () => {
    const faces = generateStandardHipRoof(14, 8, 22.5, 0.45);
    const takeoff = calculateRoofTakeoff(faces);
    const deliverable = compileRoofingDeliverable(takeoff, {
      wind: "N2",
      substrate: "timber-softwood",
    });

    const csv = exportRoofingPackageToCsv(deliverable);
    assert.ok(csv.includes("X-RAY ARCHITECTURAL CAD & TAKEOFF WORKSTATION"));
    assert.ok(csv.includes("--- FLASHING SCHEDULE ---"));
    assert.ok(csv.includes("--- FASTENER SCHEDULE (AS 1170.2) ---"));
    assert.ok(csv.includes("CRYPTOGRAPHIC VERIFICATION SEAL"));
    assert.ok(csv.includes(deliverable.deliveryRecord.contentSha256));
  });
});
