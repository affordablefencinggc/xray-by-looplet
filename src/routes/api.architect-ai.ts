import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/architect-ai")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { allowMaterialAiRequest } = await import("../lib/materialAi.server");
        if (!allowMaterialAiRequest(request))
          return Response.json({ error: "Cross-site AI request blocked." }, { status: 403 });
        if (!request.headers.get("content-type")?.startsWith("application/json"))
          return Response.json({ error: "Expected JSON." }, { status: 415 });
        const reader = request.body?.getReader();
        if (!reader) return Response.json({ error: "Empty request." }, { status: 400 });
        let raw = "",
          size = 0;
        const decoder = new TextDecoder();
        try {
          while (true) {
            const c = await reader.read();
            if (c.done) break;
            size += c.value.length;
            if (size > 12000) {
              await reader.cancel();
              return Response.json({ error: "Request too large." }, { status: 413 });
            }
            raw += decoder.decode(c.value, { stream: true });
          }
          raw += decoder.decode();
          const { proposeArchitectAi } = await import("../lib/architectAi.server");
          return Response.json(
            { run: await proposeArchitectAi(raw, { signal: request.signal }) },
            { headers: { "Cache-Control": "no-store" } },
          );
        } catch (e) {
          return Response.json(
            {
              error:
                e instanceof Error && e.message.length < 600
                  ? e.message
                  : "Invalid AI layout response; nothing saved.",
            },
            { status: 400, headers: { "Cache-Control": "no-store" } },
          );
        }
      },
    },
  },
});
