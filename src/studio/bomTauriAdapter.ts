import type { BomTransportAdapter } from "./bomTransport.ts";

export type TauriInvoke = (command: string, args?: Record<string, unknown>) => Promise<unknown>;

/**
 * Binds one already-inspected source byte sequence to every request sent through
 * this adapter. The Rust boundary re-hashes these bytes against the request's
 * document SHA immediately before the injected runner is called.
 */
export function createTauriBomAdapter(invoke: TauriInvoke, inspectedSourceBytes: Uint8Array): BomTransportAdapter {
  const sourceBytes = inspectedSourceBytes.slice();
  const sourceBytesBase64 = bytesToBase64(sourceBytes);
  return {
    host: "tauri",
    async status(signal) {
      if (signal?.aborted) throw new DOMException("BOM status cancelled.", "AbortError");
      return invoke("xray_bom_status");
    },
    async invoke(requestJson, { signal }) {
      const requestId = requestIdFromJson(requestJson);
      if (signal.aborted) {
        await cancelQuietly(invoke, requestId);
        throw new DOMException("BOM generation cancelled.", "AbortError");
      }
      const cancel = () => void cancelQuietly(invoke, requestId);
      signal.addEventListener("abort", cancel, { once: true });
      try {
        return await invoke("xray_run_bom", { requestJson, sourceBytesBase64 });
      } finally {
        signal.removeEventListener("abort", cancel);
      }
    },
  };
}

function requestIdFromJson(requestJson: string): string {
  try {
    const value = JSON.parse(requestJson) as { requestId?: unknown };
    if (typeof value.requestId === "string" && value.requestId.length > 0 && value.requestId.length <= 160) {
      return value.requestId;
    }
  } catch {
    // The generic transport validates JSON first. Keep this adapter fail-closed
    // when it is invoked directly or with a future transport implementation.
  }
  throw new Error("The BOM request identifier is invalid.");
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(bytes.length, offset + chunkSize)));
  }
  return globalThis.btoa(binary);
}

async function cancelQuietly(invoke: TauriInvoke, requestId: string): Promise<void> {
  try {
    await invoke("xray_cancel_bom", { requestId });
  } catch {
    // Cancellation is best-effort at this adapter seam. The generic transport
    // still returns its own typed cancelled result and rejects late completion.
  }
}
