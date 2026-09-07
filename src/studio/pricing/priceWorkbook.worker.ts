import { readPriceWorkbook } from "./priceWorkbook.ts";
self.onmessage = (event: MessageEvent<ArrayBuffer>) => {
  try { self.postMessage({ ok: true, value: readPriceWorkbook(new Uint8Array(event.data)) }); }
  catch (error) { self.postMessage({ ok: false, error: error instanceof Error ? error.message : "Workbook could not be read." }); }
};
