import type { PriceWorkbook } from "./priceWorkbookTable.ts";

/** Parsing is isolated from the main UI; cancellation and deadline terminate the worker. */
export function readPriceWorkbookInWorker(bytes: ArrayBuffer, signal: AbortSignal): Promise<PriceWorkbook> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(Error("Workbook import cancelled.")); return; }
    const worker = new Worker(new URL("./priceWorkbook.worker.ts", import.meta.url), { type: "module" });
    const finish = () => { clearTimeout(deadline); signal.removeEventListener("abort", abort); worker.terminate(); };
    const abort = () => { finish(); reject(Error("Workbook import cancelled.")); };
    const deadline = setTimeout(() => { finish(); reject(Error("Workbook reading exceeded 20 seconds. Export only the supplier sheet you need.")); }, 20000);
    signal.addEventListener("abort", abort, { once: true });
    worker.onerror = () => { finish(); reject(Error("Workbook reader could not start or stopped unexpectedly. No prices were imported.")); };
    worker.onmessage = (event: MessageEvent<{ ok: true; value: PriceWorkbook } | { ok: false; error: string }>) => {
      finish(); event.data.ok ? resolve(event.data.value) : reject(Error(event.data.error));
    };
    worker.postMessage(bytes, [bytes]);
  });
}
