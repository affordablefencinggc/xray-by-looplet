import { useCallback, useEffect, useState } from "react";
import type { DocumentRevision } from "./domain.ts";
import { readSheetLifecycle, sheetLifecycleStorageKey, sheetSourceIdentity, type SheetLifecycle } from "./sheetLifecycle.ts";

export const SHEET_LIFECYCLE_CHANGED = "xray:sheet-lifecycle-changed";
export function notifySheetLifecycleChanged(key: string) {
  window.dispatchEvent(new CustomEvent(SHEET_LIFECYCLE_CHANGED, { detail: { key } }));
}

/** Source-aware display data. A missing/corrupt sidecar yields null, never missing source pages. */
export function useSheetLifecycle(jobId: string, document?: DocumentRevision | null) {
  const identity = document ? sheetSourceIdentity(jobId, document) : null;
  const key = identity ? sheetLifecycleStorageKey(identity) : "";
  const [loaded, setLoaded] = useState<{ key: string; value: SheetLifecycle | null; error: string }>({ key: "", value: null, error: "" });
  const reload = useCallback(() => {
    try { setLoaded({ key, value: identity ? readSheetLifecycle(identity, window.localStorage) : null, error: "" }); }
    catch { setLoaded({ key, value: null, error: "Saved sheet organisation could not be read. Original pages remain available." }); }
  }, [key]);
  useEffect(() => {
    reload();
    const storage = (event: StorageEvent) => { if (event.key === key || event.key === null) reload(); };
    const local = (event: Event) => { if ((event as CustomEvent<{ key: string }>).detail?.key === key) reload(); };
    window.addEventListener("storage", storage);
    window.addEventListener(SHEET_LIFECYCLE_CHANGED, local);
    return () => { window.removeEventListener("storage", storage); window.removeEventListener(SHEET_LIFECYCLE_CHANGED, local); };
  }, [key, reload]);
  return { value: loaded.key === key ? loaded.value : null, error: loaded.key === key ? loaded.error : "", reload };
}
