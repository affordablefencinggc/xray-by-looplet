import { executionBudgetSchema } from "./executionBudget.ts";
import { z } from "zod";
export { ASSISTANT_OPERATING_MANUAL as ASSISTANT_SYSTEM_INSTRUCTION } from './skills.ts';

export const ASSISTANT_LIMITS = Object.freeze({ requestBytes: 12 * 1024 * 1024, responseBytes: 2 * 1024 * 1024, timeoutMs: 300000, contents: 2048, parts: 64, declarations: 64 });

const name = z.string().regex(/^[A-Za-z_][A-Za-z0-9_.:-]{0,63}$/);
/** JSON payloads remain data: finite, acyclic and bounded before provider transmission. */
function boundedJson(value: unknown): boolean {
  let nodes = 0;
  const seen = new Set<object>();
  function visit(v: unknown, depth: number): boolean {
    if (++nodes > 20000 || depth > 16) return false;
    if (v === null || typeof v === "boolean") return true;
    if (typeof v === "string") return v.length <= 200000;
    if (typeof v === "number") return Number.isFinite(v);
    if (typeof v !== "object" || seen.has(v)) return false;
    seen.add(v);
    const valid = Array.isArray(v) ? v.every(item => visit(item, depth + 1))
      : Object.getPrototypeOf(v) === Object.prototype && Object.entries(v).every(([k, item]) => k.length <= 200 && !["__proto__", "prototype", "constructor"].includes(k) && visit(item, depth + 1));
    seen.delete(v);
    return valid;
  }
  return visit(value, 0);
}
// Check original keys before Zod object construction can omit a __proto__ key.
const object = z.custom<Record<string, unknown>>(value => value !== null && typeof value === "object" && !Array.isArray(value) && boundedJson(value), "Tool JSON exceeds supported bounds.");
function imageHeaderMatches(value: {mimeType: string; data: string}): boolean {
  try {
    const header = atob(value.data.slice(0, 24));
    if (value.mimeType === "image/png") return header.startsWith("\x89PNG\r\n\x1a\n");
    if (value.mimeType === "image/jpeg") return header.startsWith("\xff\xd8\xff");
    return header.startsWith("RIFF") && header.slice(8, 12) === "WEBP";
  } catch { return false; }
}
export const assistantPartSchema = z.object({
  text: z.string().max(524288).optional(),
  inlineData: z.object({ mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]), data: z.string().min(4).max(ASSISTANT_LIMITS.requestBytes).regex(/^[A-Za-z0-9+/]*={0,2}$/).refine(v => v.length % 4 === 0, "Invalid base64 length.") }).strict().refine(imageHeaderMatches, "Image bytes do not match the declared format.").optional(),
  functionCall: z.object({ name, args: object, id: z.string().max(200).optional() }).strict().optional(),
  functionResponse: z.object({ name, response: object, id: z.string().max(200).optional() }).strict().optional(),
  thought: z.boolean().optional(),
  thoughtSignature: z.string().min(1).max(1024 * 1024).optional(),
}).strict().refine(v => {
  const count = [v.text, v.inlineData, v.functionCall, v.functionResponse].filter(p => p !== undefined).length;
  return count === 1 || (count === 0 && v.thoughtSignature !== undefined);
}, "Each part needs one supported payload or a thought signature.");
export type AssistantPart = z.infer<typeof assistantPartSchema>;
export const assistantContentSchema = z.object({ role: z.enum(["user", "model"]), parts: z.array(assistantPartSchema).min(1).max(ASSISTANT_LIMITS.parts) }).strict().refine(v => v.parts.every(p => (!p.functionCall || v.role === "model") && (!p.functionResponse || v.role === "user")), "Tool calls belong to model content and tool results to user content.");
export type AssistantContent = z.infer<typeof assistantContentSchema>;
export const assistantDeclarationSchema = z.object({ name, description: z.string().min(1).max(4000), parametersJsonSchema: object }).strict();
export type AssistantDeclaration = z.infer<typeof assistantDeclarationSchema>;
export const assistantRequestSchema = z.object({
  schema: z.literal("xray.assistant-request/v1"), requestId: z.string().uuid(),
  contents: z.array(assistantContentSchema).min(1).max(ASSISTANT_LIMITS.contents),
  declarations: z.array(assistantDeclarationSchema).max(ASSISTANT_LIMITS.declarations), webSearch: z.boolean(),
  execution: executionBudgetSchema.optional(),
}).strict().superRefine((v, ctx) => {
  if (v.webSearch && v.declarations.length) ctx.addIssue({ code: "custom", message: "Web search and function declarations use separate turns." });
  if (new Set(v.declarations.map(d => d.name)).size !== v.declarations.length) ctx.addIssue({ code: "custom", message: "Duplicate tool declarations." });
  if (v.contents.at(-1)?.role !== "user") ctx.addIssue({ code: "custom", message: "The assistant turn must end with user content or tool results." });
  try {
    if (new TextEncoder().encode(JSON.stringify(v)).length > ASSISTANT_LIMITS.requestBytes) ctx.addIssue({ code: "custom", message: "Assistant request exceeds 12 MB." });
  } catch { ctx.addIssue({ code: "custom", message: "Assistant content must be serializable JSON." }); }
});
export type AssistantRequest = z.infer<typeof assistantRequestSchema>;
export const assistantSourceSchema = z.object({ title: z.string().max(500), url: z.string().max(4000).url().refine(v => { const u = new URL(v); return ["http:", "https:"].includes(u.protocol) && !u.username && !u.password; }) }).strict();
export const assistantResponseSchema = z.object({
  requestId: z.string().uuid(), content: z.object({ role: z.literal("model"), parts: z.array(assistantPartSchema).min(1).max(ASSISTANT_LIMITS.parts) }).strict(),
  sources: z.array(assistantSourceSchema).max(50), model: z.string().regex(/^gemini-[A-Za-z0-9._-]{1,100}$/),
  totalTokens: z.number().int().nonnegative().safe().optional(),
}).strict();
export type AssistantResponse = z.infer<typeof assistantResponseSchema>;
