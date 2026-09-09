import { ASSISTANT_LIMITS, ASSISTANT_SYSTEM_INSTRUCTION, assistantRequestSchema, assistantResponseSchema, assistantSourceSchema, type AssistantResponse } from "../studio/assistant/contract.ts";
import { materialAiStatus } from "./materialAi.server.ts";

type Environment = Record<string, string | undefined>;
export class AssistantServiceError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) { super(message); this.name = "AssistantServiceError"; this.status = status; }
}
export function assistantAiStatus(env: Environment = process.env) {
  const value = materialAiStatus(env);
  return { ...value, message: !value.configured ? "Assistant provider is not configured." : !value.available ? "The operator has disabled web assistant access." : "Gemini is configured. A request is sent only when you submit a message; configuration does not verify credentials." };
}
/** Origin protection is not account/tenant authorization; web access remains operator opt-in. */
export function allowAssistantRequest(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site"), origin = request.headers.get("origin");
  if (site && site !== "same-origin" && site !== "none") return false;
  return origin ? origin === new URL(request.url).origin : site === "same-origin";
}
export async function readAssistantBody(body: ReadableStream<Uint8Array> | null, limit: number): Promise<string> {
  if (!body) throw new AssistantServiceError("Assistant request or response is empty.");
  const reader = body.getReader(), decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0, raw = "";
  try {
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > limit) { await reader.cancel(); throw new AssistantServiceError("Assistant request or response exceeds its size limit.", 413); }
      raw += decoder.decode(chunk.value, { stream: true });
    }
    return raw + decoder.decode();
  } finally { reader.releaseLock(); }
}
export function assistantFailure(error: unknown): { error: string; status: number } {
  return error instanceof AssistantServiceError ? { error: error.message, status: error.status }
    : { error: "Assistant request failed. No action has been confirmed.", status: 400 };
}

// A process guard, deliberately not advertised as a durable account spending cap.
let running = false, day = "", calls = 0;
export async function assistantAiTurn(raw: string, options: { env?: Environment; fetcher?: typeof fetch; signal?: AbortSignal } = {}): Promise<AssistantResponse> {
  const env = options.env ?? process.env, status = assistantAiStatus(env);
  if (!status.available) throw new AssistantServiceError(status.message, 503);
  if (new TextEncoder().encode(raw).length > ASSISTANT_LIMITS.requestBytes) throw new AssistantServiceError("Assistant request exceeds 12 MB.", 413);
  let request;
  try { request = assistantRequestSchema.parse(JSON.parse(raw)); } catch { throw new AssistantServiceError("Invalid assistant request contract."); }
  if (options.signal?.aborted) throw new AssistantServiceError("Assistant request cancelled.");
  const today = new Date().toISOString().slice(0, 10);
  if (today !== day) { day = today; calls = 0; }
  if (running) throw new AssistantServiceError("An assistant turn is already running. Wait before retrying.", 409);
  if (calls >= 100) throw new AssistantServiceError("This server process has reached its daily 100-turn assistant limit.", 429);
  running = true; calls++;
  const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(ASSISTANT_LIMITS.timeoutMs)]) : AbortSignal.timeout(ASSISTANT_LIMITS.timeoutMs);
  try {
    const tools = request.webSearch ? [{ google_search: {} }] : request.declarations.length ? [{ functionDeclarations: request.declarations }] : [];
    const response = await (options.fetcher ?? fetch)(`https://generativelanguage.googleapis.com/v1beta/models/${status.model}:generateContent`, {
      method: "POST", redirect: "error", signal,
      headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY || env.GOOGLE_API_KEY! },
      body: JSON.stringify({ contents: request.contents, systemInstruction: { parts: [{ text: ASSISTANT_SYSTEM_INSTRUCTION }] }, generationConfig: { maxOutputTokens: 8192 },
        ...(tools.length ? { tools } : {}), ...(!request.webSearch && request.declarations.length ? { toolConfig: { functionCallingConfig: { mode: "AUTO" } } } : {}) }),
    });
    if (!response.ok) throw new AssistantServiceError(`Gemini rejected the assistant request (HTTP ${response.status}). Check provider access and quota.`, response.status === 429 ? 429 : 502);
    const text = await readAssistantBody(response.body, ASSISTANT_LIMITS.responseBytes);
    if (signal.aborted) throw new AssistantServiceError("Assistant request cancelled or timed out.");
    let body;
    try { body = JSON.parse(text); } catch { throw new AssistantServiceError("Assistant returned invalid JSON.", 502); }
    const candidate = body?.candidates?.[0];
    if (candidate?.finishReason !== "STOP" || !candidate.content) throw new AssistantServiceError("Assistant response was blocked or incomplete. No action has been confirmed.", 502);
    const sources: Array<{title: string; url: string}> = [];
    if (request.webSearch) {
      for (const chunk of Array.isArray(candidate.groundingMetadata?.groundingChunks) ? candidate.groundingMetadata.groundingChunks : []) {
        const parsed = assistantSourceSchema.safeParse({ title: chunk?.web?.title ?? "Source", url: chunk?.web?.uri });
        if (parsed.success && !sources.some(s => s.url === parsed.data.url) && sources.length < 50) sources.push(parsed.data);
      }
    }
    const checked = assistantResponseSchema.safeParse({ requestId: request.requestId, content: candidate.content, sources, model: status.model });
    if (!checked.success) throw new AssistantServiceError("Assistant returned unsupported or malformed content.", 502);
    const known = new Set(request.declarations.map(d => d.name));
    if (checked.data.content.parts.some(p => p.functionResponse || (p.functionCall && !known.has(p.functionCall.name)))) throw new AssistantServiceError("Assistant requested an undeclared tool or returned an invalid tool result.", 502);
    const encoded = JSON.stringify(checked.data), key = env.GEMINI_API_KEY || env.GOOGLE_API_KEY;
    if (new TextEncoder().encode(encoded).length > ASSISTANT_LIMITS.responseBytes || (key && encoded.includes(key))) throw new AssistantServiceError("Assistant response failed output validation.", 502);
    return checked.data;
  } catch (error) {
    if (signal.aborted) throw new AssistantServiceError("Assistant request cancelled or timed out.");
    if (error instanceof AssistantServiceError) throw error;
    throw new AssistantServiceError("Assistant connection failed or returned invalid data. No action has been confirmed.", 502);
  } finally { running = false; }
}
