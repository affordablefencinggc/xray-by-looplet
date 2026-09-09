import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/assistant-ai")({
  server: { handlers: {
    GET: async () => {
      const { assistantAiStatus } = await import("../lib/assistantAi.server");
      return Response.json(assistantAiStatus(), { headers: { "Cache-Control": "no-store" } });
    },
    POST: async ({ request }) => {
      const { allowAssistantRequest, assistantAiTurn, assistantFailure, readAssistantBody } = await import("../lib/assistantAi.server");
      const headers = { "Cache-Control": "no-store" };
      if (!allowAssistantRequest(request)) return Response.json({ error: "Cross-site assistant requests are not allowed." }, { status: 403, headers });
      if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") return Response.json({ error: "Expected JSON." }, { status: 415, headers });
      try {
        const raw = await readAssistantBody(request.body, 12 * 1024 * 1024);
        return Response.json(await assistantAiTurn(raw, { signal: request.signal }), { headers });
      } catch (error) {
        const failure = assistantFailure(error);
        return Response.json({ error: failure.error }, { status: failure.status, headers });
      }
    },
  } },
});
