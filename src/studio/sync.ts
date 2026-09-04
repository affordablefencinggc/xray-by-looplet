/**
 * Fail-closed sync compatibility boundary.
 *
 * Legacy queued records are readable so the browser never strands or silently
 * deletes them. Creating or flushing records is blocked until a real server
 * request and durable acknowledgement contract exists.
 */

export interface SyncRecord {
  id: string;
  jobId: string;
  planName: string;
  action: "upsert_takeoff" | "save_markup" | "sync_bom";
  payload: Record<string, unknown>;
  status: "pending" | "synced" | "failed";
  retryCount: number;
  timestamp: string;
}

export interface SyncBlockedResult {
  synced: 0;
  remaining: number;
  blocked: true;
  reason: string;
}

const SYNC_QUEUE_KEY = "xray_sync_queue";
export const SYNC_UNAVAILABLE =
  "Sync is unavailable until an authenticated server transport and durable acknowledgement receipt are implemented.";

export class SyncUnavailableError extends Error {
  constructor() {
    super(SYNC_UNAVAILABLE);
    this.name = "SyncUnavailableError";
  }
}

export function getSyncQueue(): SyncRecord[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as SyncRecord[]) : [];
  } catch {
    return [];
  }
}

export function queueSyncItem(
  _item: Omit<SyncRecord, "id" | "timestamp" | "status" | "retryCount">,
): never {
  throw new SyncUnavailableError();
}

export async function flushSyncQueue(): Promise<SyncBlockedResult> {
  return {
    synced: 0,
    remaining: getSyncQueue().length,
    blocked: true,
    reason: SYNC_UNAVAILABLE,
  };
}
