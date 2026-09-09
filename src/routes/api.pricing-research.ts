import { createFileRoute } from "@tanstack/react-router";

const NO_STORE = { "Cache-Control": "no-store" };
const MAX_BODY_BYTES = 64 * 1024;

function failureJson(code: string, message: string, status: number, retryable = false, requestId = "") {
  const now = new Date().toISOString();
  return Response.json(
    { failure: { schema: "xray.pricing-research/v1", requestId, code, message, retryable, startedAt: now, finishedAt: now } },
    { status, headers: NO_STORE },
  );
}

export const Route = createFileRoute("/api/pricing-research")({
  server: {
    handlers: {
      GET: async () => {
        const { pricingResearchStatus } = await import("../lib/pricingResearch.server");
        return Response.json(pricingResearchStatus(), { headers: NO_STORE });
      },
      POST: async ({ request }) => {
        const { allowPricingResearchRequest, searchSupplierProducts, PricingResearchError, failureHttpStatus } =
          await import("../lib/pricingResearch.server");
        if (!allowPricingResearchRequest(request))
          return failureJson("invalid-request", "Cross-site supplier research requests are not allowed.", 403);
        if (!request.headers.get("content-type")?.startsWith("application/json"))
          return failureJson("invalid-request", "Expected an application/json supplier research request.", 415);
        const reader = request.body?.getReader();
        if (!reader) return failureJson("invalid-request", "Empty supplier research request.", 400);
        let size = 0, raw = "";
        const decoder = new TextDecoder();
        try {
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            size += chunk.value.length;
            if (size > MAX_BODY_BYTES) {
              await reader.cancel();
              return failureJson("too-large", "Supplier research request exceeds the 64 KiB limit.", 413);
            }
            raw += decoder.decode(chunk.value, { stream: true });
          }
          raw += decoder.decode();
          const result = await searchSupplierProducts(raw, { signal: request.signal });
          return Response.json({ result }, { status: 200, headers: NO_STORE });
        } catch (error) {
          if (error instanceof PricingResearchError)
            return Response.json({ failure: error.failure }, { status: failureHttpStatus(error.failure.code), headers: NO_STORE });
          return failureJson("upstream-error", "Supplier research failed before a provider answer was recorded. No links were kept.", 502, true);
        }
      },
    },
  },
});
