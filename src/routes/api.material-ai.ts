import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/material-ai")({
  server: {
    handlers: {
      GET: async () => {
        const { materialAiStatus } = await import("../lib/materialAi.server");
        return Response.json(materialAiStatus(), { headers: { "Cache-Control": "no-store" } });
      },
      POST: async ({ request }) => {
        const { allowMaterialAiRequest, interpretMaterialAi } =
          await import("../lib/materialAi.server");
        if (!allowMaterialAiRequest(request))
          return Response.json(
            { error: "Cross-site AI requests are not allowed." },
            { status: 403 },
          );
        if (!request.headers.get("content-type")?.startsWith("application/json"))
          return Response.json({ error: "Expected JSON." }, { status: 415 });
        const reader = request.body?.getReader();
        if (!reader) return Response.json({ error: "Empty AI request." }, { status: 400 });
        let size = 0,
          raw = "";
        const decoder = new TextDecoder();
        try {
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            size += chunk.value.length;
            if (size > 12 * 1024 * 1024) {
              await reader.cancel();
              return Response.json(
                { error: "AI request exceeds the size limit." },
                { status: 413 },
              );
            }
            raw += decoder.decode(chunk.value, { stream: true });
          }
          raw += decoder.decode();
          return Response.json(
            { run: await interpretMaterialAi(raw, { signal: request.signal }) },
            { headers: { "Cache-Control": "no-store" } },
          );
        } catch (e) {
          const message = e instanceof Error ? e.message : "AI interpretation failed.";
          return Response.json(
            {
              error:
                message.length < 600
                  ? message
                  : "AI returned invalid material data. No proposals were saved.",
            },
            { status: 400, headers: { "Cache-Control": "no-store" } },
          );
        }
      },
    },
  },
});
