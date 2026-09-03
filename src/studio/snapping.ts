/**
 * X-Ray by Looplet — Vector Snapping Engine
 * Snaps cursor coordinates to CAD linework vertices, wall intersections, and markup points.
 */

import { HOUSE, PLAN, type Seg } from "./geometry.ts";
import type { Markup } from "./store.ts";

export type SnapTarget = {
  point: { x: number; y: number };
  snapped: boolean;
  distance: number;
  kind?: "vertex" | "midpoint" | "markup";
};

// Cache candidate plan vertices
const PLAN_VERTICES: { x: number; y: number }[] = [];
const seen = new Set<string>();

function addCandidate(x: number, y: number) {
  const rx = Math.round(x * 100) / 100;
  const ry = Math.round(y * 100) / 100;
  const key = `${rx},${ry}`;
  if (!seen.has(key)) {
    seen.add(key);
    PLAN_VERTICES.push({ x: rx, y: ry });
  }
}

// Extract vertices from PLAN linework
PLAN.B.forEach((seg: Seg) => {
  addCandidate(seg[0], seg[2]);
  addCandidate(seg[3], seg[5]);
  // Midpoints
  addCandidate((seg[0] + seg[3]) / 2, (seg[2] + seg[5]) / 2);
});

PLAN.R.forEach((seg: Seg) => {
  addCandidate(seg[0], seg[2]);
  addCandidate(seg[3], seg[5]);
});

/**
 * Find the closest snap vertex within snapRadius (in drawing units / metres)
 */
export function getSnapPoint(
  cursor: { x: number; y: number },
  markups: Markup[],
  pending: { x: number; y: number }[],
  snapRadius: number,
  enabled: boolean = true,
  sheetKind: string = "plan",
  floors: number = 1
): SnapTarget {
  if (!enabled) {
    return { point: cursor, snapped: false, distance: 0 };
  }

  let closest: { x: number; y: number } | null = null;
  let minDist = snapRadius;
  let kind: "vertex" | "midpoint" | "markup" = "vertex";

  const candidates: { x: number; y: number }[] = [];
  const seenLocal = new Set<string>();

  const addLocal = (x: number, y: number) => {
    const rx = Math.round(x * 100) / 100;
    const ry = Math.round(y * 100) / 100;
    const key = `${rx},${ry}`;
    if (!seenLocal.has(key)) {
      seenLocal.add(key);
      candidates.push({ x: rx, y: ry });
    }
  };

  if (sheetKind === "elev") {
    const geom = HOUSE;
    for (let f = 0; f < floors; f++) {
      const yOffset = f * 2.8;
      geom.B.forEach((seg) => {
        addLocal(seg[0], seg[1] + yOffset);
        addLocal(seg[3], seg[4] + yOffset);
        addLocal((seg[0] + seg[3]) / 2, ((seg[1] + seg[4]) / 2) + yOffset);
      });
    }
    const topOffset = (floors - 1) * 2.8;
    geom.R.forEach((seg) => {
      addLocal(seg[0], seg[1] + topOffset);
      addLocal(seg[3], seg[4] + topOffset);
    });
  } else {
    candidates.push(...PLAN_VERTICES);
  }

  // Check linework vertices
  for (const v of candidates) {
    const d = Math.hypot(v.x - cursor.x, v.y - cursor.y);
    if (d < minDist) {
      minDist = d;
      closest = v;
      kind = "vertex";
    }
  }

  // Check existing markup points
  for (const m of markups) {
    for (const p of m.points) {
      const d = Math.hypot(p.x - cursor.x, p.y - cursor.y);
      if (d < minDist) {
        minDist = d;
        closest = p;
        kind = "markup";
      }
    }
  }

  // Check pending points
  for (const p of pending) {
    const d = Math.hypot(p.x - cursor.x, p.y - cursor.y);
    if (d < minDist) {
      minDist = d;
      closest = p;
      kind = "markup";
    }
  }

  if (closest) {
    return {
      point: { x: closest.x, y: closest.y },
      snapped: true,
      distance: minDist,
      kind
    };
  }

  return { point: cursor, snapped: false, distance: 0 };
}
