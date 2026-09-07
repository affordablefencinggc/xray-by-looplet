import { voiceBase64, type VoiceRequest } from "../lib/voiceCore";
const desktop = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
export async function getVoiceStatus(): Promise<{ available: boolean; configured: boolean }> {
  if (desktop()) { const { invoke } = await import("@tauri-apps/api/core"); return invoke("xray_voice_status"); }
  const response = await fetch("/api/voice", { cache: "no-store" });
  if (!response.ok) throw Error("Voice status unavailable.");
  return response.json();
}
export async function requestVoice(input: VoiceRequest, signal: AbortSignal): Promise<{ transcript?: string; audioBase64?: string; mimeType?: string }> {
  if (signal.aborted) throw Error("Voice cancelled.");
  if (desktop()) {
    const { invoke } = await import("@tauri-apps/api/core");
    const result = await invoke<{ transcript?: string; audioBase64?: string; mimeType?: string }>("xray_voice_request", { requestJson: JSON.stringify(input) });
    if (signal.aborted) throw Error("Voice cancelled.");
    return result;
  }
  const response = await fetch("/api/voice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), signal });
  if (!response.ok) throw Error("Voice could not complete. Check your connection and try again.");
  return response.json();
}
export async function recordingRequest(blob: Blob): Promise<VoiceRequest> {
  if (!blob.size || blob.size > 2 * 1024 * 1024) throw Error("Recording is empty or too large. Try a shorter message.");
  return { action: "transcribe", audioBase64: voiceBase64(new Uint8Array(await blob.arrayBuffer())), mimeType: blob.type };
}
