import type { Seg } from "./geometry";

export interface BomItem {
  item: string;
  qty: number;
  unit: string;
  trust: "reconciled" | "single-source" | "needs-human";
  amount: number;
}

export const FENCING_BOM: BomItem[] = [
  { item: "Fence posts", qty: 21, unit: "ea", trust: "reconciled", amount: 388.5 },
  { item: "Gates", qty: 1, unit: "ea", trust: "single-source", amount: 240.0 },
  { item: "Colorbond steel rails", qty: 96, unit: "lm", trust: "single-source", amount: 912.0 },
  { item: "Colorbond sheets", qty: 20, unit: "ea", trust: "single-source", amount: 960.0 },
  { item: "Footings", qty: 21, unit: "ea", trust: "single-source", amount: 252.0 },
  { item: "Concrete (footings)", qty: 0.62, unit: "m³", trust: "needs-human", amount: 198.08 },
  { item: "Post caps", qty: 21, unit: "ea", trust: "single-source", amount: 94.5 },
];

export const FENCING_TOTAL = 3045.08;

export function buildFencingGeometry(): Seg[] {
  const segs: Seg[] = [];
  const numPosts = 21;
  const postSpacing = 2.4; // 48m total run / 20 bays = 2.4m bay
  const postHeight = 1.8;

  for (let i = 0; i < numPosts; i++) {
    const x = i * postSpacing - 24;
    const z = (Math.sin(i * 0.15) * 2); // subtle topography curve
    // Post vertical line
    segs.push([x, 0, z, x, postHeight, z]);
    // Post cap
    segs.push([x - 0.05, postHeight, z, x + 0.05, postHeight, z]);
    // Footing line below ground
    segs.push([x, 0, z, x, -0.6, z]);

    if (i < numPosts - 1) {
      const nextX = (i + 1) * postSpacing - 24;
      const nextZ = (Math.sin((i + 1) * 0.15) * 2);
      // Top rail
      segs.push([x, postHeight - 0.1, z, nextX, postHeight - 0.1, nextZ]);
      // Bottom rail
      segs.push([x, 0.15, z, nextX, 0.15, nextZ]);
      // Vertical corrugated infill sheet lines
      for (let s = 1; s <= 3; s++) {
        const sx = x + ((nextX - x) * s) / 4;
        const sz = z + ((nextZ - z) * s) / 4;
        segs.push([sx, 0.15, sz, sx, postHeight - 0.1, sz]);
      }
    }
  }

  return segs;
}
