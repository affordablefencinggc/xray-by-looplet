import type { Seg } from "./geometry";

export interface WtcStats {
  floors: number;
  roofHeightFt: number;
  floorToFloorFt: number;
  grossFloorSf: number;
  totalBuiltSf: string;
  columnLineFt: number;
  perimeterColumns: number;
  coreColumns: number;
  totalColumns: number;
  slenderness: string;
  squareDim: string;
}

export const WTC_STATS: WtcStats = {
  floors: 110,
  roofHeightFt: 1368,
  floorToFloorFt: 12.4,
  grossFloorSf: 42825,
  totalBuiltSf: "4.71M sf",
  columnLineFt: 384408,
  perimeterColumns: 236,
  coreColumns: 45,
  totalColumns: 281,
  slenderness: "6.6 : 1",
  squareDim: "207'-2\" square",
};

/**
 * Builds the structural wireframe segments for WTC 1:
 * - 236 perimeter columns (59 columns per face around the 207'-2" perimeter)
 * - 45 core columns (5 x 9 column grid)
 * - 110 floors with major floor band lines
 */
export function buildWtcGeometry(layers: {
  perimeter: boolean;
  core: boolean;
  floors: boolean;
}): { perimeter: Seg[]; core: Seg[]; floorLines: Seg[] } {
  const perimeter: Seg[] = [];
  const core: Seg[] = [];
  const floorLines: Seg[] = [];

  const S = 16; // half-width in normalized viewport coordinates
  const H = 88; // height in normalized viewport coordinates
  const colsPerSide = 59; // 59 columns per side = 236 total perimeter columns

  // 1. Perimeter columns (236 columns)
  if (layers.perimeter) {
    // Face 1: South (Z = S, X from -S to S)
    for (let i = 0; i < colsPerSide; i++) {
      const x = -S + (2 * S * i) / colsPerSide;
      perimeter.push([x, 0, S, x, H, S]);
    }
    // Face 2: East (X = S, Z from S to -S)
    for (let i = 0; i < colsPerSide; i++) {
      const z = S - (2 * S * i) / colsPerSide;
      perimeter.push([S, 0, z, S, H, z]);
    }
    // Face 3: North (Z = -S, X from S to -S)
    for (let i = 0; i < colsPerSide; i++) {
      const x = S - (2 * S * i) / colsPerSide;
      perimeter.push([x, 0, -S, x, H, -S]);
    }
    // Face 4: West (X = -S, Z from -S to S)
    for (let i = 0; i < colsPerSide; i++) {
      const z = -S + (2 * S * i) / colsPerSide;
      perimeter.push([-S, 0, z, -S, H, z]);
    }
  }

  // 2. Core columns (45 columns: 5 rows of 9 columns in the central core)
  if (layers.core) {
    const coreX = S * 0.42;
    const coreZ = S * 0.65;
    const rows = 5;
    const cols = 9;
    for (let r = 0; r < rows; r++) {
      const z = -coreZ + (2 * coreZ * r) / (rows - 1);
      for (let c = 0; c < cols; c++) {
        const x = -coreX + (2 * coreX * c) / (cols - 1);
        core.push([x, 0, z, x, H, z]);
      }
    }
  }

  // 3. Floor plates (major floor band lines)
  if (layers.floors) {
    const numBands = 11; // 10-floor intervals + roof
    for (let i = 0; i <= numBands; i++) {
      const y = (H * i) / numBands;
      // Outer perimeter ring
      floorLines.push([-S, y, -S, S, y, -S]);
      floorLines.push([S, y, -S, S, y, S]);
      floorLines.push([S, y, S, -S, y, S]);
      floorLines.push([-S, y, S, -S, y, -S]);

      // Inner core ring
      const cx = S * 0.42;
      const cz = S * 0.65;
      floorLines.push([-cx, y, -cz, cx, y, -cz]);
      floorLines.push([cx, y, -cz, cx, y, cz]);
      floorLines.push([cx, y, cz, -cx, y, cz]);
      floorLines.push([-cx, y, cz, -cx, y, -cz]);
    }
  }

  return { perimeter, core, floorLines };
}
