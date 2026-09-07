export const MAX_VOICE_REQUEST = 3 * 1024 * 1024;
export type VoiceRequest = { action: "transcribe"; audioBase64: string; mimeType: string } | { action: "speak"; text: string };
export function parseVoiceRequest(raw: string): VoiceRequest {
  if (raw.length > MAX_VOICE_REQUEST) throw Error("Voice recording is too large. Use a shorter recording.");
  const value = JSON.parse(raw);
  if (value?.action === "speak" && typeof value.text === "string" && value.text.trim().length > 0 && value.text.length <= 3000)
    return { action: "speak", text: value.text.trim() };
  if (value?.action === "transcribe" && typeof value.audioBase64 === "string" && value.audioBase64.length > 0
    && /^[A-Za-z0-9+/]+={0,2}$/.test(value.audioBase64)
    && /^(audio\/(webm|ogg|wav|mpeg|mp4))(;codecs=[a-z0-9.,-]+)?$/.test(value.mimeType))
    return { action: "transcribe", audioBase64: value.audioBase64, mimeType: value.mimeType };
  throw Error("Invalid voice request.");
}
export async function readVoiceBody(request: Request | Response, limit = MAX_VOICE_REQUEST) {
  const reader = request.body?.getReader();
  if (!reader) throw Error("Voice request is empty.");
  const chunks: Uint8Array[] = []; let total = 0;
  while (true) {
    const chunk = await reader.read(); if (chunk.done) break;
    total += chunk.value.length;
    if (total > limit) { await reader.cancel(); throw Error("Voice payload exceeds the size limit."); }
    chunks.push(chunk.value);
  }
  const bytes = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}
export function voiceBase64(bytes: Uint8Array) {
  let text = "";
  for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(text);
}
export async function executeVoice(request: VoiceRequest, key: string, fetcher: typeof fetch = fetch, signal?: AbortSignal) {
  if (!key) throw Error("Deepgram voice is not configured.");
  const speak = request.action === "speak";
  const response = await fetcher(speak
    ? "https://api.deepgram.com/v1/speak?model=aura-2-thalia-en"
    : "https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&language=en", {
    method: "POST", redirect: "error",
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000),
    headers: { Authorization: `Token ${key}`, "Content-Type": speak ? "application/json" : request.mimeType },
    body: speak ? JSON.stringify({ text: request.text }) : Uint8Array.from(atob(request.audioBase64), c => c.charCodeAt(0)),
  });
  if (!response.ok) { await response.body?.cancel(); throw Error(`Deepgram voice request failed (HTTP ${response.status}).`); }
  const bytes = await readVoiceBody(response);
  if (speak) {
    if (!response.headers.get("content-type")?.startsWith("audio/")) throw Error("Deepgram returned no playable audio.");
    return { audioBase64: voiceBase64(bytes), mimeType: "audio/mpeg" };
  }
  const body = JSON.parse(new TextDecoder().decode(bytes));
  const transcript = body.results?.channels?.[0]?.alternatives?.[0]?.transcript;
  if (typeof transcript !== "string") throw Error("Deepgram returned no transcript.");
  return { transcript: transcript.slice(0, 1500) };
}
