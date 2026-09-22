/** Storage-quota decision for the project library. The caller supplies a measured estimate.
 * This module does not invent a percentage when the browser cannot measure usage or quota. */
export const QUOTA_ARCHIVE_THRESHOLD = 0.8;
export const TRANSIENT_RENDER_CACHE = "transient-render-cache";

export type StorageEstimate = { usage?: number; quota?: number } | null | undefined;

export type StorageAssessment =
  | { measurable: false; ratio: null; promptArchive: false; evict: readonly [] }
  | { measurable: true; ratio: number; promptArchive: boolean; evict: readonly [] | readonly [typeof TRANSIENT_RENDER_CACHE] };

export function assessStorageQuota(estimate: StorageEstimate): StorageAssessment {
  const usage = estimate?.usage;
  const quota = estimate?.quota;
  if (typeof usage !== "number" || typeof quota !== "number" || !Number.isFinite(usage) || !Number.isFinite(quota) || quota <= 0 || usage < 0)
    return { measurable: false, ratio: null, promptArchive: false, evict: [] };
  const ratio = usage / quota;
  if (ratio > QUOTA_ARCHIVE_THRESHOLD)
    return { measurable: true, ratio, promptArchive: true, evict: [TRANSIENT_RENDER_CACHE] };
  return { measurable: true, ratio, promptArchive: false, evict: [] };
}
