import {
  layoutRequestSchema,
  layoutResultSchema,
  layoutPrompt,
  LAYOUT_JSON_SCHEMA,
} from "../studio/architect/layoutAi.ts";
import { materialAiStatus } from "./materialAi.server.ts";
import { createHash } from "node:crypto";
let running = false,
  day = "",
  calls = 0;
export async function proposeArchitectAi(
  raw: string,
  options: {
    env?: Record<string, string | undefined>;
    fetcher?: typeof fetch;
    signal?: AbortSignal;
  } = {},
) {
  const env = options.env ?? process.env,
    status = materialAiStatus(env);
  if (!status.available) throw Error(status.message);
  if (raw.length > 12000) throw Error("Layout request exceeds limit.");
  const r = layoutRequestSchema.parse(JSON.parse(raw)),
    today = new Date().toISOString().slice(0, 10);
  if (day !== today) {
    day = today;
    calls = 0;
  }
  if (running || calls >= 20)
    throw Error("AI is busy or has reached this process daily 20-layout limit.");
  running = true;
  calls++;
  try {
    const response = await (options.fetcher ?? fetch)(
      `https://generativelanguage.googleapis.com/v1beta/models/${status.model}:generateContent`,
      {
        method: "POST",
        redirect: "error",
        signal: options.signal
          ? AbortSignal.any([options.signal, AbortSignal.timeout(120000)])
          : AbortSignal.timeout(120000),
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": env.GEMINI_API_KEY || env.GOOGLE_API_KEY!,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: layoutPrompt(r) }] }],
          generationConfig: {
            maxOutputTokens: 10000,
            responseFormat: { text: { mimeType: "APPLICATION_JSON", schema: LAYOUT_JSON_SCHEMA } },
          },
        }),
      },
    );
    if (!response.ok) throw Error(`Gemini rejected layout request (HTTP ${response.status}).`);
    const reader = response.body?.getReader();
    if (!reader) throw Error("AI returned no response.");
    let bytes = 0,
      text = "";
    const decoder = new TextDecoder();
    while (true) {
      const c = await reader.read();
      if (c.done) break;
      bytes += c.value.length;
      if (bytes > 1024 * 1024) {
        await reader.cancel();
        throw Error("AI result exceeds limit.");
      }
      text += decoder.decode(c.value, { stream: true });
    }
    text += decoder.decode();
    const candidate = JSON.parse(text).candidates?.[0];
    if (candidate?.finishReason !== "STOP") throw Error("AI response incomplete; no design saved.");
    const result = layoutResultSchema.parse(
      JSON.parse(
        candidate.content.parts
          .filter((p: { thought?: boolean; text?: string }) => p.text && !p.thought)
          .map((p: { text: string }) => p.text)
          .join(""),
      ),
    );
    return {
      schema: "xray.architect-ai/v1",
      id: r.requestId,
      projectId: r.projectId,
      designRevision: r.designRevision,
      result,
      provider: "Gemini",
      model: status.model,
      requestDigest: createHash("sha256").update(raw).digest("hex"),
    };
  } finally {
    running = false;
  }
}
