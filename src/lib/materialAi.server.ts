import { createHash } from "node:crypto";
import {
  aiRequestSchema,
  aiResultSchema,
  AI_RESULT_JSON_SCHEMA,
  AI_MATERIALS_VERSION,
  materialAiPrompt,
} from "../studio/construction/aiMaterials.ts";

const DEFAULT_MODEL = "gemini-3.8-flash";
const MODEL = /^gemini-[a-zA-Z0-9._-]{1,100}$/;
type Environment = Record<string, string | undefined>;
export function materialAiStatus(env: Environment = process.env) {
  const model = env.XRAY_AI_MODEL || DEFAULT_MODEL;
  const configured = Boolean(env.GEMINI_API_KEY || env.GOOGLE_API_KEY) && MODEL.test(model);
  return {
    provider: "Gemini",
    model,
    configured,
    available: configured && env.XRAY_AI_WEB_ENABLED === "true",
    message: !configured
      ? "AI provider not configured. Configure a provider to interpret a sheet."
      : env.XRAY_AI_WEB_ENABLED !== "true"
        ? "AI is configured but web access is disabled by the operator."
        : "Gemini configured. Selected drawing images will be sent only when you start interpretation.",
  };
}
let running = false,
  day = "",
  calls = 0;
export async function interpretMaterialAi(
  raw: string,
  options: { env?: Environment; fetcher?: typeof fetch; signal?: AbortSignal } = {},
) {
  const env = options.env ?? process.env,
    status = materialAiStatus(env);
  if (!status.available) throw Error(status.message);
  if (raw.length > 12 * 1024 * 1024) throw Error("AI request exceeds the size limit.");
  const request = aiRequestSchema.parse(JSON.parse(raw));
  for (const image of request.images) {
    const bytes = Buffer.from(image.jpegBase64, "base64");
    if (
      bytes[0] !== 255 ||
      bytes[1] !== 216 ||
      createHash("sha256").update(bytes).digest("hex") !== image.sha256
    )
      throw Error("Drawing image integrity check failed.");
  }
  const today = new Date().toISOString().slice(0, 10);
  if (day !== today) {
    day = today;
    calls = 0;
  }
  if (running)
    throw Error("An AI interpretation is already running. Wait before starting another.");
  if (calls >= 20) throw Error("This server process has reached its daily 20-page AI limit.");
  running = true;
  calls++;
  try {
    const timeout = AbortSignal.timeout(120000),
      signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
    const response = await (options.fetcher ?? fetch)(
      `https://generativelanguage.googleapis.com/v1beta/models/${status.model}:generateContent`,
      {
        method: "POST",
        redirect: "error",
        signal,
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": env.GEMINI_API_KEY || env.GOOGLE_API_KEY!,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: materialAiPrompt(request) },
                ...request.images.flatMap((i) => [
                  { text: `${i.label}; full-page coordinates ${JSON.stringify(i.box)}` },
                  { inlineData: { mimeType: "image/jpeg", data: i.jpegBase64 } },
                ]),
              ],
            },
          ],
          generationConfig: {
            maxOutputTokens: 12000,
            responseFormat: {
              text: { mimeType: "APPLICATION_JSON", schema: AI_RESULT_JSON_SCHEMA },
            },
          },
        }),
      },
    );
    if (!response.ok)
      throw Error(
        `Gemini rejected the interpretation request (HTTP ${response.status}). Check account access, model availability and quota.`,
      );
    const reader = response.body?.getReader();
    if (!reader) throw Error("Gemini returned no response.");
    let bytes = 0,
      body = "";
    const decoder = new TextDecoder();
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.length;
      if (bytes > 2 * 1024 * 1024) {
        await reader.cancel();
        throw Error("AI response exceeded the safe size limit.");
      }
      body += decoder.decode(chunk.value, { stream: true });
    }
    body += decoder.decode();
    const payload = JSON.parse(body),
      candidate = payload.candidates?.[0];
    if (candidate?.finishReason !== "STOP")
      throw Error("AI response was blocked or incomplete. No proposals were saved.");
    const content = candidate.content?.parts
      ?.filter((p: { text?: string; thought?: boolean }) => p.text && !p.thought)
      .map((p: { text: string }) => p.text)
      .join("");
    const result = aiResultSchema.parse(JSON.parse(content));
    return {
      schema: AI_MATERIALS_VERSION,
      id: request.requestId,
      sourceSha256: request.sourceSha256,
      page: request.page,
      inventoryRevision: request.inventoryRevision,
      provider: status.provider,
      model: status.model,
      createdAt: new Date().toISOString(),
      requestDigest: createHash("sha256").update(raw).digest("hex"),
      imageHashes: request.images.map((i) => i.sha256),
      result,
      decisions: [],
    };
  } finally {
    running = false;
  }
}

export function allowMaterialAiRequest(request: Request) {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
