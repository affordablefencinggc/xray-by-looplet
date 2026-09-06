import type { PlanBinary } from "./documentContract";
import {
  aiRequestSchema,
  AI_MATERIALS_VERSION,
  type AiMaterialRequest,
} from "./construction/aiMaterials";
import type { ProjectMaterials } from "./construction/projectMaterials";

export async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes))))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export async function prepareMaterialAiPage(
  binary: PlanBinary,
  value: ProjectMaterials,
  pageNumber: number,
  focus: string,
  signal: AbortSignal,
): Promise<AiMaterialRequest> {
  const source = value.sources.find((s) => s.sha256 === binary.sha256);
  if (!source || binary.kind !== "pdf" || pageNumber < 1 || pageNumber > source.pageCount)
    throw Error("Register the matching PDF and select a valid sheet first.");
  if ((await sha256Bytes(binary.bytes)) !== source.sha256)
    throw Error("Drawing bytes do not match the registered source revision.");
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
  const canvas = document.createElement("canvas"),
    images: AiMaterialRequest["images"] = [];
  try {
    const doc = await task.promise;
    if (doc.numPages !== source.pageCount)
      throw Error("Drawing page count differs from the registered source.");
    const page = await doc.getPage(pageNumber),
      base = page.getViewport({ scale: 1 }),
      viewport = page.getViewport({ scale: Math.min(3, 4096 / Math.max(base.width, base.height)) });
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const render = page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport }),
      cancel = () => render.cancel();
    signal.addEventListener("abort", cancel, { once: true });
    try {
      await render.promise;
    } finally {
      signal.removeEventListener("abort", cancel);
    }
    const boxes = [
      { x: 0, y: 0, width: 1, height: 1 },
      ...[
        [0, 0],
        [0.45, 0],
        [0, 0.45],
        [0.45, 0.45],
      ].map(([x, y]) => ({ x, y, width: 0.55, height: 0.55 })),
    ];
    for (const [index, box] of boxes.entries()) {
      if (signal.aborted) throw Error("AI page preparation cancelled.");
      const tile = document.createElement("canvas"),
        scale = Math.min(
          1,
          (index === 0 ? 1600 : 2200) /
            Math.max(canvas.width * box.width, canvas.height * box.height),
        );
      tile.width = Math.ceil(canvas.width * box.width * scale);
      tile.height = Math.ceil(canvas.height * box.height * scale);
      tile
        .getContext("2d")!
        .drawImage(
          canvas,
          box.x * canvas.width,
          box.y * canvas.height,
          box.width * canvas.width,
          box.height * canvas.height,
          0,
          0,
          tile.width,
          tile.height,
        );
      // Keep the total JSON below common 4.5 MB serverless body limits.
      // Retain image dimensions first; dense pages may need lower JPEG quality.
      let blob: Blob | null = null;
      for (const quality of [0.9, 0.8, 0.65, 0.5]) {
        if (signal.aborted) throw Error("AI page preparation cancelled.");
        blob = await new Promise<Blob>((resolve, reject) =>
          tile.toBlob(
            (b) => (b ? resolve(b) : reject(Error("Drawing image could not be prepared."))),
            "image/jpeg",
            quality,
          ),
        );
        if (blob.size <= 580000) break;
      }
      if (!blob || blob.size > 580000)
        throw Error(
          "This sheet is too dense for a bounded AI image request. Split it into a smaller source sheet before retrying.",
        );
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let encoded = "";
      for (let i = 0; i < bytes.length; i += 32768)
        encoded += String.fromCharCode(...bytes.subarray(i, i + 32768));
      images.push({
        label: index === 0 ? "Full source page" : `Overlapping detail ${index}`,
        box,
        sha256: await sha256Bytes(bytes),
        jpegBase64: btoa(encoded),
      });
      tile.width = 0;
      tile.height = 0;
    }
    return aiRequestSchema.parse({
      schema: AI_MATERIALS_VERSION,
      requestId: crypto.randomUUID(),
      projectId: value.projectId,
      inventoryRevision: value.revision,
      sourceSha256: source.sha256,
      page: pageNumber,
      sourceName: source.name,
      focus,
      images,
    });
  } finally {
    canvas.width = 0;
    canvas.height = 0;
    await task.destroy();
  }
}
