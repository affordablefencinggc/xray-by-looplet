import type { PlanBinary } from "./documentContract";
import { applySheetDiscovery, type ProjectMaterials } from "./construction/projectMaterials";
export async function scanMaterialImagePage(
  binary: PlanBinary,
  value: ProjectMaterials,
  pageNumber: number,
  progress: (text: string) => void,
  signal: AbortSignal,
) {
  if (
    binary.kind !== "pdf" ||
    !value.sources.some((s) => s.sha256 === binary.sha256 && pageNumber <= s.pageCount)
  )
    throw Error("Register the matching PDF before OCR.");
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", Uint8Array.from(binary.bytes))),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (hash !== binary.sha256) throw Error("Source bytes do not match the registered revision.");
  const [{ getDocument, GlobalWorkerOptions }, { default: workerUrl }, { createWorker }] =
    await Promise.all([
      import("pdfjs-dist/legacy/build/pdf.mjs"),
      import("pdfjs-dist/legacy/build/pdf.worker.mjs?url"),
      import("tesseract.js"),
    ]);
  GlobalWorkerOptions.workerSrc = workerUrl;
  const task = getDocument({
    data: Uint8Array.from(binary.bytes),
    wasmUrl: new URL("/pdfjs/wasm/", location.href).href,
    standardFontDataUrl: new URL("/pdfjs/standard_fonts/", location.href).href,
  });
  let worker: Awaited<ReturnType<typeof createWorker>> | null = null;
  try {
    const doc = await task.promise,
      page = await doc.getPage(pageNumber),
      base = page.getViewport({ scale: 1 }),
      viewport = page.getViewport({ scale: Math.min(2, 4096 / Math.max(base.width, base.height)) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    progress("Rendering source for local OCR…");
    await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport }).promise;
    if (signal.aborted) throw Error("OCR cancelled; saved inventory preserved.");
    worker = await createWorker("eng", 1, {
      workerPath: new URL("/ocr/worker.min.js", location.href).href,
      corePath: new URL("/ocr", location.href).href,
      langPath: new URL("/ocr", location.href).href,
      gzip: false,
      cacheMethod: "none",
      logger: (m) => progress(`Local OCR: ${m.status} ${Math.round((m.progress ?? 0) * 100)}%`),
    });
    if (signal.aborted) throw Error("OCR cancelled; saved inventory preserved.");
    let cancel: () => void = () => {};
    const aborted = new Promise<never>((_, reject) => {
      cancel = () => reject(Error("OCR cancelled; saved inventory preserved."));
      signal.addEventListener("abort", cancel, { once: true });
    });
    try {
      const result = await Promise.race([worker.recognize(canvas), aborted]);
      return applySheetDiscovery(
        value,
        binary.sha256,
        pageNumber,
        `Page ${pageNumber} · OCR`,
        result.data.text,
        result.data.confidence,
      );
    } finally {
      signal.removeEventListener("abort", cancel);
      canvas.width = 0;
      canvas.height = 0;
    }
  } finally {
    await worker?.terminate();
    await task.destroy();
  }
}
