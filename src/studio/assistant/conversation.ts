import { assistantResponseSchema, type AssistantContent, type AssistantDeclaration, type AssistantPart, type AssistantRequest, type AssistantResponse } from './contract.ts';
import { DEFAULT_EXECUTION_BUDGET, executionBudgetSchema, type ExecutionBudget } from "./executionBudget.ts";
export type ChatImage = { data: string; mimeType: 'image/png' | 'image/jpeg' | 'image/webp' };
export type ToolResult = { content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>; isError?: boolean; _meta?: Record<string, unknown> };
export type ChatEvent = { kind: 'assistant' | 'tool'; text: string; images?: ChatImage[]; sources?: AssistantResponse['sources']; toolName?: string; toolCallId?: string; failed?: boolean };

/** A completed call replaces its progress row; repeated calls keep distinct identities. */
export function appendChatEvent<T extends { id: string; kind: string; toolCallId?: string }>(entries: readonly T[], entry: T): T[] {
  const index = entry.kind === 'tool' && entry.toolCallId
    ? entries.findIndex(previous => previous.kind === 'tool' && previous.toolCallId === entry.toolCallId) : -1;
  if (index < 0) return [...entries, entry];
  return entries.map((previous, i) => i === index ? { ...entry, id: previous.id } : previous);
}

export async function runConversation(options: {
  execution?: ExecutionBudget;
  contents: AssistantContent[]; declarations: AssistantDeclaration[]; signal: AbortSignal;
  turn: (request: AssistantRequest, signal: AbortSignal) => Promise<AssistantResponse>;
  call: (name: string, args: Record<string, unknown>, signal: AbortSignal) => Promise<ToolResult>;
  emit: (event: ChatEvent) => void; checkpoint: (contents: AssistantContent[]) => void;
  assertContext: () => void;
  beforeFinal?: () => Promise<string | null>;
}) {
  const budget = executionBudgetSchema.parse(options.execution ?? DEFAULT_EXECUTION_BUDGET);
  const contents = structuredClone(options.contents);
  const names = new Set(options.declarations.map(tool => tool.name));
  const callIds = new Set<string>();
  // Repeated call IDs from previous turns must not replay an already attempted mutation.
  for (const entry of contents) for (const part of entry.parts) {
    if (part.functionResponse?.id) callIds.add(part.functionResponse.id);
  }
  let toolCalls = 0;
  let finalCorrections = 0;
  for (let round = 0; round < budget.maxRounds; round++) {
    options.signal.throwIfAborted(); options.assertContext();
    const requestId = crypto.randomUUID();
    const response = assistantResponseSchema.parse(await options.turn({ schema: 'xray.assistant-request/v1', requestId, contents, declarations: options.declarations, webSearch: false, execution: budget }, options.signal));
    options.signal.throwIfAborted(); options.assertContext();
    if (response.requestId !== requestId) throw Error('Assistant response identity mismatch. No response actions executed.');
    contents.push(response.content);
    const text = response.content.parts.filter(part => !part.thought).map(part => part.text || '').join('\n');
    const images = response.content.parts.filter(part => !part.thought && part.inlineData).map(part => part.inlineData!);
    const calls = response.content.parts.flatMap(part => part.functionCall ? [part.functionCall] : []);
    if (calls.length) finalCorrections = 0;
    if (!calls.length && options.beforeFinal) {
      const required = await options.beforeFinal();
      options.signal.throwIfAborted(); options.assertContext();
      if (required) {
        contents.push({ role: 'user', parts: [{ text: `[xray:workflow-check] ${required}` }] });
        options.checkpoint(contents);
        if (++finalCorrections > 2) throw Error('Workflow incomplete after two correction attempts. Completed actions and the next required step are saved.');
        continue;
      }
    }
    if (text || images.length || response.sources.length) options.emit({ kind: 'assistant', text, images, sources: response.sources });
    if (!calls.length) { options.checkpoint(contents); return; }
    const results: AssistantPart[] = [];
    for (const [index, call] of calls.entries()) {
      try { options.signal.throwIfAborted(); options.assertContext(); }
      catch (error) {
        // Keep every completed receipt and pair the remaining calls with explicit
        // non-execution results, so a later turn has a complete tool exchange.
        for (const skipped of calls.slice(index)) {
          const text = 'Not executed: assistant stopped or project context changed before this action.';
          results.push({ functionResponse: { name: skipped.name, ...(skipped.id ? { id: skipped.id } : {}), response: { isError: true, text } } });
          options.emit({ kind: 'tool', toolName: skipped.name, text, failed: true });
        }
        contents.push({ role: 'user', parts: results });
        options.checkpoint(contents);
        throw error;
      }
      const toolCallId = `${requestId}:${index}`;
      options.emit({ kind: 'tool', toolName: call.name, toolCallId, text: `Running ${call.name}…` });
      let result: ToolResult;
      try {
        if (++toolCalls > budget.maxToolCalls) result = { isError: true, content: [{ type: 'text', text: 'Tool budget reached; not executed. Review completed actions before continuing.' }] };
        else if (call.id && callIds.has(call.id)) result = { isError: true, content: [{ type: 'text', text: 'Duplicate tool call ID; not executed. Read current state before retrying.' }] };
        else if (!names.has(call.name)) result = { isError: true, content: [{ type: 'text', text: 'Unknown or unpermitted tool; no action performed.' }] };
        else {
          if (call.id) callIds.add(call.id);
          result = await options.call(call.name, call.args, options.signal);
        }
      }
      catch (error) { result = { isError: true, content: [{ type: 'text', text: error instanceof Error ? error.message : 'Tool failed.' }] }; }
      // Completed actions are recorded even if Stop was pressed during execution.
      const output = result.content.filter(item => item.type === 'text').map(item => item.text || '').join('\n').slice(0, 100000);
      const toolImages = result.content.flatMap(item => item.type === 'image' && item.data && ['image/png', 'image/jpeg', 'image/webp'].includes(item.mimeType || '') ? [{ data: item.data, mimeType: item.mimeType as ChatImage['mimeType'] }] : []);
      let sources: AssistantResponse['sources'] = [];
      if (call.name === 'web_search' && !result.isError) {
        try { const parsed = JSON.parse(output); if (Array.isArray(parsed.sources)) sources = parsed.sources.filter((source: { title?: unknown; url?: unknown }) => typeof source.title === 'string' && typeof source.url === 'string' && /^https?:\/\//.test(source.url)); } catch { /* Non-JSON tool output remains visible. */ }
      }
      options.emit({ kind: 'tool', toolName: call.name, toolCallId, text: output || (result.isError ? 'Tool failed.' : 'Tool completed.'), failed: result.isError, images: toolImages, sources });
      results.push({ functionResponse: { name: call.name, ...(call.id ? { id: call.id } : {}), response: { isError: !!result.isError, text: output, images: toolImages.length } } });
      toolImages.forEach(image => results.push({ inlineData: image }));
    }
    contents.push({ role: 'user', parts: results });
    options.checkpoint(contents);
    if (toolCalls >= budget.maxToolCalls) throw Error(`Paused at the ${budget.maxToolCalls}-tool budget. Completed actions are retained; adjust Execution limits or send another message to continue.`);
  }
  throw Error(`Paused after ${budget.maxRounds} assistant steps. Completed actions are retained; adjust Execution limits or send another message to continue.`);
}
