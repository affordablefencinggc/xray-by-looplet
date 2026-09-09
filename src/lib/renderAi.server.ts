import { createHash } from "node:crypto";
import { AssistantServiceError, allowAssistantRequest, assistantFailure, readAssistantBody } from "./assistantAi.server.ts";
import { materialAiStatus } from "./materialAi.server.ts";
import { assistantPartSchema } from "../studio/assistant/contract.ts";
import { RENDER_AI_LIMITS, RENDER_AI_PROVENANCE, RENDER_AI_RESULT_SCHEMA, renderAiPrompt, renderAiRequestSchema, renderAiResultSchema, type RenderAiResult } from "../studio/assistant/renderTool.ts";

export { AssistantServiceError, RENDER_AI_LIMITS, allowAssistantRequest, assistantFailure, readAssistantBody };
/** Image-capable Gemini model; the GET status never verifies that the key can use it. */
export const DEFAULT_RENDER_MODEL = "gemini-2.5-flash-image";
const MODEL = /^gemini-[a-zA-Z0-9._-]{1,100}$/;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
type Environment = Record<string, string | undefined>;

/** Shares the assistant key (GEMINI_API_KEY / GOOGLE_API_KEY) and web opt-in; XRAY_RENDER_MODEL selects the image model. */
export function renderAiStatus(env: Environment = process.env): { provider: "Gemini"; model: string; configured: boolean; available: boolean; message: string } {
  const base = materialAiStatus(env), model = env.XRAY_RENDER_MODEL || DEFAULT_RENDER_MODEL;
  const configured = base.configured && MODEL.test(model);
  const available = configured && env.XRAY_AI_WEB_ENABLED === "true" && env.XRAY_AI_RENDER_ENABLED !== "false";
  return { provider: "Gemini", model, configured, available,
    message: !configured ? "Image renderer is not configured." : env.XRAY_AI_WEB_ENABLED !== "true" ? "The operator has disabled web AI access." : !available ? "The operator has disabled AI rendering."
      : `Gemini image model ${model} is configured. The captured view is sent only when you generate; configuration does not verify credentials or model availability.` };
}

// A process guard, deliberately not advertised as a durable account spending cap.
let running = false, day = "", calls = 0;
export async function generateRenderAi(raw: string, options: { env?: Environment; fetcher?: typeof fetch; signal?: AbortSignal; now?: () => Date } = {}): Promise<RenderAiResult> {
  const env = options.env ?? process.env, now = options.now ?? (() => new Date()), status = renderAiStatus(env);
  if (!status.available) throw new AssistantServiceError(status.message, 503);
  if (new TextEncoder().encode(raw).length > RENDER_AI_LIMITS.requestBytes) throw new AssistantServiceError("Render request exceeds 12 MB.", 413);
  let request;
  try { request = renderAiRequestSchema.parse(JSON.parse(raw)); } catch { throw new AssistantServiceError("Invalid render request contract."); }
  const bytes = Buffer.from(request.image.data, "base64");
  if (bytes.length > RENDER_AI_LIMITS.inputImageBytes || PNG_SIGNATURE.some((value, index) => bytes[index] !== value) || createHash("sha256").update(bytes).digest("hex") !== request.image.sha256) throw new AssistantServiceError("Captured image integrity check failed.");
  if (options.signal?.aborted) throw new AssistantServiceError("Render request cancelled.");
  const today = now().toISOString().slice(0, 10);
  if (today !== day) { day = today; calls = 0; }
  if (running) throw new AssistantServiceError("A render is already running. Wait before retrying.", 409);
  if (calls >= RENDER_AI_LIMITS.dailyCalls) throw new AssistantServiceError(`This server process has reached its daily ${RENDER_AI_LIMITS.dailyCalls}-render limit.`, 429);
  running = true; calls++;
  const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(RENDER_AI_LIMITS.timeoutMs)]) : AbortSignal.timeout(RENDER_AI_LIMITS.timeoutMs);
  try {
    const prompt = renderAiPrompt(request), key = env.GEMINI_API_KEY || env.GOOGLE_API_KEY!;
    // Image models take no systemInstruction, tools or responseFormat; the response modalities request the picture.
    const response = await (options.fetcher ?? fetch)(`https://generativelanguage.googleapis.com/v1beta/models/${status.model}:generateContent`, {
      method: "POST", redirect: "error", signal,
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }, { inlineData: { mimeType: "image/png", data: request.image.data } }] }],
        generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
      }),
    });
    if (!response.ok) throw new AssistantServiceError(`Gemini rejected the render request (HTTP ${response.status}). Check provider access, image-model availability and quota.`, response.status === 429 ? 429 : 502);
    const text = await readAssistantBody(response.body, RENDER_AI_LIMITS.responseBytes);
    if (signal.aborted) throw new AssistantServiceError("Render request cancelled or timed out.");
    let body;
    try { body = JSON.parse(text); } catch { throw new AssistantServiceError("Renderer returned invalid JSON.", 502); }
    const candidate = body?.candidates?.[0];
    if (body?.promptFeedback?.blockReason || candidate?.finishReason !== "STOP" || !Array.isArray(candidate.content?.parts)) throw new AssistantServiceError("Render was blocked or incomplete. No image was produced.", 502);
    const parts: Array<{ text?: unknown; inlineData?: unknown; thought?: unknown }> = candidate.content.parts;
    const imagePart = parts.find(part => part && typeof part === "object" && part.inlineData && !part.thought);
    if (!imagePart) throw new AssistantServiceError("Renderer returned no image.", 502);
    const image = assistantPartSchema.safeParse({ inlineData: imagePart.inlineData });
    if (!image.success || !image.data.inlineData || image.data.inlineData.data.length > RENDER_AI_LIMITS.outputImageChars) throw new AssistantServiceError("Renderer returned an unsupported image.", 502);
    const modelText = parts.filter(part => typeof part?.text === "string" && !part.thought).map(part => part.text as string).join("\n").slice(0, RENDER_AI_LIMITS.textChars) || null;
    const checked = renderAiResultSchema.safeParse({
      schema: RENDER_AI_RESULT_SCHEMA, id: request.requestId, projectId: request.projectId, view: request.view, provider: "Gemini", model: status.model, promptUsed: prompt, text: modelText,
      image: { mimeType: image.data.inlineData.mimeType, data: image.data.inlineData.data }, sourceImageSha256: request.image.sha256,
      requestDigest: createHash("sha256").update(raw).digest("hex"), createdAt: now().toISOString(), provenance: RENDER_AI_PROVENANCE,
    });
    if (!checked.success) throw new AssistantServiceError("Render response failed output validation.", 502);
    const encoded = JSON.stringify(checked.data);
    if (new TextEncoder().encode(encoded).length > RENDER_AI_LIMITS.responseBytes || encoded.includes(key)) throw new AssistantServiceError("Render response failed output validation.", 502);
    return checked.data;
  } catch (error) {
    if (signal.aborted) throw new AssistantServiceError("Render request cancelled or timed out.");
    if (error instanceof AssistantServiceError) throw error;
    throw new AssistantServiceError("Render connection failed or returned invalid data. No image was produced.", 502);
  } finally { running = false; }
}
