import { executeVoice, parseVoiceRequest, readVoiceBody } from "../../../src/lib/voiceCore.ts";

let active = 0, calls = 0, windowStart = 0;
// Backend-only endpoint. The secret is held by the web server and native process, never the browser bundle.
Deno.serve(async (request: Request) => {
  const secret = Deno.env.get("XRAY_VOICE_EDGE_TOKEN");
  const supplied = request.headers.get("x-xray-voice-key") ?? "";
  const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  if (!secret || !supplied || supplied.length > 256) return json({ error: "Unauthorized" }, 401);
  const digest = async (s: string) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  const [a, b] = await Promise.all([digest(secret), digest(supplied)]);
  let mismatch = 0; for (let i = 0; i < a.length; i++) mismatch |= a[i] ^ b[i];
  if (mismatch) return json({ error: "Unauthorized" }, 401);
  if (request.method !== "POST") return json({ error: "POST required" }, 405);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return json({ error: "JSON required" }, 415);
  const now = Date.now(); if (now - windowStart > 3600000) { calls = 0; windowStart = now; }
  if (active >= 2 || calls >= 120) return json({ error: "Voice rate limit reached" }, 429);
  active++; calls++;
  try {
    const input = parseVoiceRequest(new TextDecoder().decode(await readVoiceBody(request)));
    return json(await executeVoice(input, Deno.env.get("DEEPGRAM_API_KEY") ?? "", fetch, request.signal));
  } catch { return json({ error: "Voice processing failed. Check configuration or shorten the recording." }, 400); }
  finally { active--; }
});
