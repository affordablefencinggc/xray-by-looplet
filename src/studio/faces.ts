import { PAL } from "./geometry.ts";
import type { Face } from "./wireframeGl.ts";

export interface FaceState {
  showSurfaces: boolean;
  showSrc: boolean;
  showBld: boolean;
  showRoof: boolean;
  skin: "navy" | "paper";
  pose: "standing" | "laid";
  floors: number;
}

export function computeFaces(s: FaceState): Face[] {
  if (!s.showSurfaces || !s.showSrc) return [];
  const navy = s.skin === "navy";
  const floorCount = s.pose === "standing" ? s.floors : 1;
  const floorH = 2.8;
  const faces: Face[] = [];

  // Building slab and wall faces for each floor (only if showBld is true)
  if (s.showBld) {
    for (let f = 0; f < floorCount; f++) {
      const z = f * floorH;
      // Slab face (horizontal floor)
      faces.push({
        colour: navy ? PAL.cyan : PAL.planInk,
        alpha: 0.12,
        triangles: [
          [0, 0, z], [18, 0, z], [18, 7.2, z],
          [0, 0, z], [18, 7.2, z], [0, 7.2, z]
        ]
      });

      // Outer walls for each floor (shaded solid surfaces)
      const W = 18;
      const D = 7.2;
      const H = floorH;
      const zTop = z + H;
      const wallColour = navy ? PAL.cyan : PAL.planInk;
      const wallAlpha = 0.08;

      // South wall (y = 0)
      faces.push({
        colour: wallColour,
        alpha: wallAlpha,
        triangles: [
          [0, 0, z], [W, 0, z], [W, 0, zTop],
          [0, 0, z], [W, 0, zTop], [0, 0, zTop]
        ]
      });

      // North wall (y = D)
      faces.push({
        colour: wallColour,
        alpha: wallAlpha,
        triangles: [
          [0, D, z], [W, D, z], [W, D, zTop],
          [0, D, z], [W, D, zTop], [0, D, zTop]
        ]
      });

      // West wall (x = 0)
      faces.push({
        colour: wallColour,
        alpha: wallAlpha,
        triangles: [
          [0, 0, z], [0, D, z], [0, D, zTop],
          [0, 0, z], [0, D, zTop], [0, 0, zTop]
        ]
      });

      // East wall (x = W)
      faces.push({
        colour: wallColour,
        alpha: wallAlpha,
        triangles: [
          [W, 0, z], [W, D, z], [W, D, zTop],
          [W, 0, z], [W, D, zTop], [W, 0, zTop]
        ]
      });
    }
  }

  // Roof slope faces
  if (s.showRoof) {
    const topZ = (floorCount - 1) * floorH;
    const eaveZ = topZ + 2.8;
    const ridgeZ = topZ + 4.15;
    const midY = 3.6;
    // South slope
    faces.push({
      colour: PAL.roof,
      alpha: 0.18,
      triangles: [
        [0, 0, eaveZ], [18, 0, eaveZ], [18, midY, ridgeZ],
        [0, 0, eaveZ], [18, midY, ridgeZ], [0, midY, ridgeZ]
      ]
    });
    // North slope
    faces.push({
      colour: PAL.roof,
      alpha: 0.18,
      triangles: [
        [0, midY, ridgeZ], [18, midY, ridgeZ], [18, 7.2, eaveZ],
        [0, midY, ridgeZ], [18, 7.2, eaveZ], [0, 7.2, eaveZ]
      ]
    });
    // Gable ends
    faces.push({
      colour: PAL.roof,
      alpha: 0.22,
      triangles: [
        [0, 0, eaveZ], [0, midY, ridgeZ], [0, 7.2, eaveZ],
        [18, 0, eaveZ], [18, 7.2, eaveZ], [18, midY, ridgeZ]
      ]
    });
  }

  return faces;
}
