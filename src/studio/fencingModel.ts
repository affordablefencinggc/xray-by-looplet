import type { Seg } from "./geometry";

/** @deprecated Demo-specific BOM output is unavailable until the versioned job-to-BOM contract ships. */
export interface BomItem {
  item: string;
  qty: number;
  unit: string;
  trust: "reconciled" | "single-source" | "needs-human";
  amount: number;
}

export const FENCING_MODEL_UNAVAILABLE =
  "Preset geometry and pricing are disabled; derive them only from verified job evidence.";

/** @deprecated Production must use the canonical job-to-BOM contract. */
export const FENCING_BOM: readonly BomItem[] = Object.freeze([]);

/** @deprecated There is no price until an evidenced price source is connected. */
export const FENCING_TOTAL: number = Number.NaN;

/** @deprecated Preset geometry is intentionally unavailable in production. */
export function buildFencingGeometry(): Seg[] {
  return [];
}
