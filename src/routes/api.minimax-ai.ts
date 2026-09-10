import { createFileRoute } from "@tanstack/react-router";

/**
 * MiniMax assistant route — a converted copy of /api/assistant-ai.
 *
 * Separate on purpose: the Gemini route keeps serving the verified assistant, and this one can be
 * exercised and proven without any risk to it. Same origin guard, same content-type guard, same
 * 12 MB body limit and the same failure mapping, so nothing about the security posture is relaxed
 * in the copy.
 */
export const Route = createFileRoute("/api/minimax-ai")({
  server: { handlers: {
    GET: async () => {
      const { minimaxAiStatus } = await import("../lib/minimaxAi.server");
      return Response.json(minimaxAiStatus(), { headers: { "Cache-Control": "no-store" } });
    },
    POST: async ({ request }) => {
      const { allowAssistantRequest, assistantFailure, readAssistantBody } = await import("../lib/assistantAi.server");
      const { minimaxAiTurn } = await import("../lib/minimaxAi.server");
      const headers = { "Cache-Control": "no-store" };
      if (!allowAssistantRequest(request)) return Response.json({ error: "Cross-site assistant requests are not allowed." }, { status: 403, headers });
      if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") return Response.json({ error: "Expected JSON." }, { status: 415, headers });
      try {
        const raw = await readAssistantBody(request.body, 12 * 1024 * 1024);
        return Response.json(await minimaxAiTurn(raw, { signal: request.signal }), { headers });
      } catch (error) {
        const failure = assistantFailure(error);
        return Response.json({ error: failure.error }, { status: failure.status, headers });
      }
    },
  } },
});
