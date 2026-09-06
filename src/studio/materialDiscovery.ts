import type { PlanBinary } from "./documentContract";
import { applySheetDiscovery, type ProjectMaterials } from "./construction/projectMaterials";

export async function scanMaterialDocument(
  binary: PlanBinary,
  value: ProjectMaterials,
  onProgress: (page: number, total: number) => void,
  signal: AbortSignal,
): Promise<ProjectMaterials> {
  if (binary.kind !== "pdf")
    throw Error(
      "Automatic text discovery currently supports PDF. Other sources can be recorded and visually reviewed manually.",
    );
  if (!value.sources.some((s) => s.sha256 === binary.sha256))
    throw Error("Register this source before scanning.");
  const actual = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", Uint8Array.from(binary.bytes))),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (actual !== binary.sha256) throw Error("Drawing bytes do not match the source identity.");
  const [{ getDocument, GlobalWorkerOptions }, { default: workerUrl }] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("pdfjs-dist/legacy/build/pdf.worker.mjs?url"),
  ]);
  GlobalWorkerOptions.workerSrc = workerUrl;
  const task = getDocument({
    data: Uint8Array.from(binary.bytes),
    wasmUrl: new URL("/pdfjs/wasm/", location.href).href,
    standardFontDataUrl: new URL("/pdfjs/standard_fonts/", location.href).href,
  });
  try {
    const doc = await task.promise;
    if (doc.numPages !== value.sources.find((s) => s.sha256 === binary.sha256)!.pageCount)
      throw Error("Drawing page count differs from the registered source.");
    let next = value;
    for (let n = 1; n <= doc.numPages; n++) {
      if (signal.aborted) throw Error("Scan cancelled. Previously saved inventory is unchanged.");
      const page = await doc.getPage(n),
        content = await page.getTextContent();
      const strings = content.items
        .filter((item): item is typeof item & { str: string } => "str" in item)
        .map((item) => item.str);
      const text = strings.join(" "),
        sheet = strings.find((s) => /^[ASMEPCLF]\d[.\-]\d{1,3}$/i.test(s.trim()));
      next = applySheetDiscovery(
        next,
        binary.sha256,
        n,
        sheet ? `${sheet.trim()} · page ${n}` : `Page ${n}`,
        text,
      );
      onProgress(n, doc.numPages);
      page.cleanup();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    return next;
  } finally {
    await task.destroy();
  }
}
