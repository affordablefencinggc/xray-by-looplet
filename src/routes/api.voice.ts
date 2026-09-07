import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/voice")({ server: { handlers: {
  GET: async () => { const { voiceStatus } = await import("../lib/voice.server"); return Response.json(voiceStatus(), { headers: { "Cache-Control": "no-store" } }); },
  POST: async ({ request }) => {
    const { allowMaterialAiRequest } = await import("../lib/materialAi.server");
    if (!allowMaterialAiRequest(request)) return Response.json({ error: "Cross-site voice request blocked." }, { status: 403 });
    if (!request.headers.get("content-type")?.startsWith("application/json")) return Response.json({ error: "Expected JSON." }, { status: 415 });
    try {
      const { readVoiceBody } = await import("../lib/voiceCore");
      const { runVoice } = await import("../lib/voice.server");
      return Response.json(await runVoice(new TextDecoder().decode(await readVoiceBody(request)), request.signal), { headers: { "Cache-Control": "no-store" } });
    } catch { return Response.json({ error: "Voice request could not complete. Check the connection, recording length and provider configuration." }, { status: 400, headers: { "Cache-Control": "no-store" } }); }
  },
} } });
