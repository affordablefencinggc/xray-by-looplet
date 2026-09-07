import { executeVoice, parseVoiceRequest, readVoiceBody } from "./voiceCore.ts";
type Environment = Record<string, string | undefined>;
export function voiceStatus(env: Environment = process.env) {
  const configured = Boolean(env.DEEPGRAM_API_KEY || (env.XRAY_VOICE_EDGE_URL && env.XRAY_VOICE_EDGE_TOKEN));
  return { provider: "Deepgram", configured, available: configured && env.XRAY_VOICE_WEB_ENABLED === "true" };
}
let active = 0, windowStart = 0, calls = 0;
export async function runVoice(raw: string, signal?: AbortSignal, env: Environment = process.env, fetcher: typeof fetch = fetch) {
  const request = parseVoiceRequest(raw);
  if (!voiceStatus(env).available) throw Error("Voice is not enabled on this server.");
  const now = Date.now();
  if (now - windowStart > 3600000) { calls = 0; windowStart = now; }
  if (active >= 2 || calls >= 120) throw Error("Voice is busy or has reached this server's hourly limit.");
  active++; calls++;
  try {
    if (env.XRAY_VOICE_EDGE_URL && env.XRAY_VOICE_EDGE_TOKEN) {
      const url = new URL(env.XRAY_VOICE_EDGE_URL);
      if (url.protocol !== "https:" || !url.hostname.endsWith(".supabase.co")) throw Error("Invalid voice service configuration.");
      const response = await fetcher(url, { method: "POST", redirect: "error",
        headers: { "Content-Type": "application/json", "x-xray-voice-key": env.XRAY_VOICE_EDGE_TOKEN },
        body: JSON.stringify(request), signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(35000)]) : AbortSignal.timeout(35000),
      });
      if (!response.ok) { await response.body?.cancel(); throw Error(`Voice service failed (HTTP ${response.status}).`); }
      return JSON.parse(new TextDecoder().decode(await readVoiceBody(response, 5 * 1024 * 1024)));
    }
    return await executeVoice(request, env.DEEPGRAM_API_KEY!, fetcher, signal);
  } finally { active--; }
}
