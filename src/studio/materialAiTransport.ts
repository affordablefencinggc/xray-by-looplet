import { aiRunSchema, type AiMaterialRequest } from "./construction/aiMaterials";
import { sha256Bytes } from "./materialAiImages";
const desktop = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
export type MaterialAiStatus = {
  provider: string;
  model: string;
  available: boolean;
  configured: boolean;
  message: string;
};
export async function getMaterialAiStatus(): Promise<MaterialAiStatus> {
  if (desktop()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke("xray_material_ai_status");
  }
  const r = await fetch("/api/material-ai", { cache: "no-store" });
  if (!r.ok) throw Error("AI service status is unavailable.");
  return r.json();
}
export async function configureMaterialAi(key: string, model: string): Promise<MaterialAiStatus> {
  if (!desktop()) throw Error("Web AI credentials must be configured by the server operator.");
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke("xray_configure_material_ai", { key, model });
}
export async function runMaterialAi(request: AiMaterialRequest, signal: AbortSignal) {
  const raw = JSON.stringify(request);
  let result: unknown;
  if (desktop()) {
    const { invoke } = await import("@tauri-apps/api/core");
    const cancel = () =>
      void invoke("xray_cancel_material_ai", { requestId: request.requestId }).catch(() => {});
    signal.addEventListener("abort", cancel, { once: true });
    try {
      if (signal.aborted) throw Error("AI interpretation cancelled.");
      result = await invoke("xray_interpret_material_ai", { requestJson: raw });
    } finally {
      signal.removeEventListener("abort", cancel);
    }
  } else {
    const r = await fetch("/api/material-ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: raw,
      signal,
    });
    const data = await r.json();
    if (!r.ok) throw Error(data.error || "AI interpretation failed.");
    result = data.run;
  }
  if (signal.aborted) throw Error("AI interpretation cancelled; no proposals saved.");
  const run = aiRunSchema.parse(result);
  if (
    run.id !== request.requestId ||
    run.sourceSha256 !== request.sourceSha256 ||
    run.page !== request.page ||
    run.inventoryRevision !== request.inventoryRevision ||
    run.requestDigest !== (await sha256Bytes(new TextEncoder().encode(raw))) ||
    JSON.stringify(run.imageHashes) !== JSON.stringify(request.images.map((i) => i.sha256))
  )
    throw Error("AI response does not match the requested drawing page.");
  return run;
}
export const canConfigureMaterialAi = desktop;
