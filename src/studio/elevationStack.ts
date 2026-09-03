/**
 * X-Ray by Looplet — Multi-Storey Elevation Floor Stacking Engine
 * Generates stacked storey wireframes, inter-floor concrete slab bands,
 * exploded vertical offsets, datum level lines, and active floor isolation.
 */

import { PAL, type Seg } from "./geometry.ts";
import type { Elem } from "./wireframeGl.ts";

export interface ElevationStackOptions {
  buildingSegs: Seg[];
  roofSegs: Seg[];
  floors: number;
  pose: "standing" | "laid";
  skin: "navy" | "paper";
  floorHeight?: number;
  explode?: number;
  activeFloor?: number | null;
  showBld?: boolean;
  showRoof?: boolean;
}

export function segsToElems(segs: Seg[], type: string, colour: string, pose: "standing" | "laid"): Elem[] {
  const yScale = pose === "laid" ? 0.02 : 1;
  return segs.map((seg) => ({
    type,
    colour,
    a: [seg[0], seg[2], seg[1] * yScale],
    b: [seg[3], seg[5], seg[4] * yScale],
  }));
}

export function buildElevationStack(opts: ElevationStackOptions): Elem[] {
  const {
    buildingSegs,
    roofSegs,
    floors,
    pose,
    skin,
    floorHeight = 2.8,
    explode = 0,
    activeFloor = null,
    showBld = true,
    showRoof = true,
  } = opts;

  const navy = skin === "navy";
  const primaryBldCol = navy ? PAL.cyan : PAL.planInk;
  const dimmedBldCol = navy ? "rgba(127, 219, 255, 0.25)" : "rgba(28, 110, 164, 0.25)";
  const slabCol = navy ? "#7fdbff" : "#0f4c81";
  const datumCol = navy ? "rgba(255, 255, 255, 0.4)" : "rgba(0, 0, 0, 0.4)";
  const roofCol = navy ? PAL.roof : "#c9a227";

  const out: Elem[] = [];
  const floorCount = pose === "standing" ? Math.max(1, Math.min(4, floors)) : 1;
  const effectiveExplode = pose === "standing" ? Math.max(0, explode) : 0;
  const stepH = floorHeight + effectiveExplode;

  // 1. Stack building floors
  if (showBld) {
    for (let f = 0; f < floorCount; f++) {
      const isDimmed = activeFloor !== null && activeFloor !== f;
      const col = isDimmed ? dimmedBldCol : primaryBldCol;
      const zOffset = f * stepH;

      const floorElems = segsToElems(buildingSegs, `bld_floor_${f}`, col, pose);
      if (zOffset > 0) {
        floorElems.forEach((el) => {
          el.a[2] += zOffset;
          el.b[2] += zOffset;
        });
      }
      out.push(...floorElems);

      // Inter-floor concrete slab perimeter band (for f > 0 in standing mode)
      if (pose === "standing" && f > 0) {
        const slabZ = zOffset;
        const W = 18;
        const D = 7.2;
        const slabCorners: [number, number, number][] = [
          [0, 0, slabZ],
          [W, 0, slabZ],
          [W, D, slabZ],
          [0, D, slabZ],
        ];
        for (let i = 0; i < 4; i++) {
          const next = slabCorners[(i + 1) % 4];
          out.push({
            type: `slab_band_${f}`,
            colour: isDimmed ? dimmedBldCol : slabCol,
            a: slabCorners[i],
            b: next,
          });
        }
      }

      // Elevation datum lines (floor level markers extending beyond left edge)
      if (pose === "standing") {
        const levelZ = zOffset;
        out.push({
          type: `datum_level_${f}`,
          colour: datumCol,
          a: [-2.0, 0, levelZ],
          b: [0, 0, levelZ],
        });
        out.push({
          type: `datum_level_${f}_tick`,
          colour: datumCol,
          a: [-2.0, -0.2, levelZ],
          b: [-2.0, 0.2, levelZ],
        });
      }
    }
  }

  // 2. Cap with roof on topmost floor
  if (showRoof) {
    const topZ = (floorCount - 1) * stepH;
    const isRoofDimmed = activeFloor !== null && activeFloor !== floorCount - 1;
    const rCol = isRoofDimmed ? (navy ? "rgba(232, 179, 57, 0.3)" : "rgba(201, 162, 39, 0.3)") : roofCol;

    const roofElems = segsToElems(roofSegs, "roof", rCol, pose);
    if (topZ > 0) {
      roofElems.forEach((el) => {
        el.a[2] += topZ;
        el.b[2] += topZ;
      });
    }
    out.push(...roofElems);
  }

  return out;
}
