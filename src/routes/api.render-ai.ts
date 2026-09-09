import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/render-ai")({
  server: { handlers: {
    GET: async () => {
      const { renderAiStatus } = await import("../lib/renderAi.server");
      return Response.json(renderAiStatus(), { headers: { "Cache-Control": "no-store" } });
    },
    POST: async ({ request }) => {
      const { RENDER_AI_LIMITS, allowAssistantRequest, assistantFailure, generateRenderAi, readAssistantBody } = await import("../lib/renderAi.server");
      const headers = { "Cache-Control": "no-store" };
      if (!allowAssistantRequest(request)) return Response.json({ error: "Cross-site render requests are not allowed." }, { status: 403, headers });
      if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") return Response.json({ error: "Expected JSON." }, { status: 415, headers });
      try {
        const raw = await readAssistantBody(request.body, RENDER_AI_LIMITS.requestBytes);
        return Response.json(await generateRenderAi(raw, { signal: request.signal }), { headers });
      } catch (error) {
        const failure = assistantFailure(error);
        return Response.json({ error: failure.error }, { status: failure.status, headers });
      }
    },
  } },
});
