export const CAD_LIMIT = 12_000_000;
export type CadStatus = { available: boolean; reason?: string; translator?: string };
export type CadResult = {
  format: "dwg" | "dxf";
  bytes: Uint8Array<ArrayBuffer>;
  entityCount: number;
  warnings: string[];
};
export const desktopCad = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
export async function getCadStatus(): Promise<CadStatus> {
  if (!desktopCad())
    return {
      available: false,
      reason: "DWG conversion is available in the Windows desktop app. Use DXF on the web.",
    };
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke("xray_cad_status");
}
export function cadBase64(bytes: Uint8Array): string {
  if (!bytes.length || bytes.length > CAD_LIMIT) throw Error("CAD file is empty or exceeds 12 MB.");
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
export function cadBytes(value: string): Uint8Array<ArrayBuffer> {
  if (!value || value.length > Math.ceil(CAD_LIMIT / 3) * 4)
    throw Error("Invalid CAD output size.");
  const binary = atob(value);
  if (binary.length > CAD_LIMIT) throw Error("CAD output exceeds 12 MB.");
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
export async function convertCad(
  action: "to-dwg" | "to-dxf",
  bytes: Uint8Array,
  signal: AbortSignal,
): Promise<CadResult> {
  if (!desktopCad())
    throw Error("DWG conversion is available in the Windows desktop app. Use DXF on the web.");
  if (signal.aborted) throw Error("CAD conversion cancelled.");
  const sourceBase64 = cadBase64(bytes);
  const { invoke } = await import("@tauri-apps/api/core");
  if (signal.aborted) throw Error("CAD conversion cancelled.");
  const requestId = crypto.randomUUID();
  const cancel = () => {
    void invoke("xray_cad_cancel", { requestId }).catch(() => {});
  };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    const result = await invoke<{
      bytesBase64: string;
      format: "dwg" | "dxf";
      entityCount: number;
      warnings: string[];
    }>("xray_cad_convert", { requestId, action, sourceBase64 });
    if (signal.aborted) throw Error("CAD conversion cancelled.");
    if (result.format !== (action === "to-dwg" ? "dwg" : "dxf"))
      throw Error("Unexpected CAD conversion format.");
    return { ...result, bytes: cadBytes(result.bytesBase64) };
  } finally {
    signal.removeEventListener("abort", cancel);
  }
}
