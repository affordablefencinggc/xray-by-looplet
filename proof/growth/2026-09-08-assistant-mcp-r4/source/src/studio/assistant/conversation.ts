import type { AssistantContent, AssistantDeclaration, AssistantPart, AssistantRequest, AssistantResponse } from './contract.ts';
export type ChatImage = { data: string; mimeType: 'image/png' | 'image/jpeg' | 'image/webp' };
export type ToolResult = { content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>; isError?: boolean };
export type ChatEvent = { kind: 'assistant' | 'tool'; text: string; images?: ChatImage[]; sources?: AssistantResponse['sources']; toolName?: string; failed?: boolean };

export async function runConversation(options: {
  contents: AssistantContent[]; declarations: AssistantDeclaration[]; signal: AbortSignal;
  turn: (request: AssistantRequest, signal: AbortSignal) => Promise<AssistantResponse>;
  call: (name: string, args: Record<string, unknown>, signal: AbortSignal) => Promise<ToolResult>;
  emit: (event: ChatEvent) => void; checkpoint: (contents: AssistantContent[]) => void;
  assertContext: () => void;
}) {
  const contents = structuredClone(options.contents);
  const names = new Set(options.declarations.map(tool => tool.name));
  for (let round = 0; round < 8; round++) {
    options.signal.throwIfAborted(); options.assertContext();
    if (contents.length > 38) throw Error('This conversation is full. Start a new chat to continue; completed tool actions remain saved.');
    const response = await options.turn({ schema: 'xray.assistant-request/v1', requestId: crypto.randomUUID(), contents, declarations: options.declarations, webSearch: false }, options.signal);
    options.signal.throwIfAborted(); options.assertContext();
    contents.push(response.content);
    const text = response.content.parts.filter(part => !part.thought).map(part => part.text || '').join('\n');
    const images = response.content.parts.filter(part => !part.thought && part.inlineData).map(part => part.inlineData!);
    if (text || images.length || response.sources.length) options.emit({ kind: 'assistant', text, images, sources: response.sources });
    const calls = response.content.parts.flatMap(part => part.functionCall ? [part.functionCall] : []);
    if (!calls.length) { options.checkpoint(contents); return; }
    const results: AssistantPart[] = [];
    for (const call of calls) {
      options.signal.throwIfAborted(); options.assertContext();
      options.emit({ kind: 'tool', toolName: call.name, text: `Running ${call.name}…` });
      let result: ToolResult;
      try { result = names.has(call.name) ? await options.call(call.name, call.args, options.signal) : { isError: true, content: [{ type: 'text', text: 'Unknown tool; no action performed.' }] }; }
      catch (error) { result = { isError: true, content: [{ type: 'text', text: error instanceof Error ? error.message : 'Tool failed.' }] }; }
      // Completed actions are recorded even if Stop was pressed during execution.
      const output = result.content.filter(item => item.type === 'text').map(item => item.text || '').join('\n').slice(0, 100000);
      const toolImages = result.content.flatMap(item => item.type === 'image' && item.data && ['image/png', 'image/jpeg', 'image/webp'].includes(item.mimeType || '') ? [{ data: item.data, mimeType: item.mimeType as ChatImage['mimeType'] }] : []);
      let sources: AssistantResponse['sources'] = [];
      if (call.name === 'web_search' && !result.isError) {
        try { const parsed = JSON.parse(output); if (Array.isArray(parsed.sources)) sources = parsed.sources.filter((source: { title?: unknown; url?: unknown }) => typeof source.title === 'string' && typeof source.url === 'string' && /^https?:\/\//.test(source.url)); } catch { /* Non-JSON tool output remains visible. */ }
      }
      options.emit({ kind: 'tool', toolName: call.name, text: output || (result.isError ? 'Tool failed.' : 'Tool completed.'), failed: result.isError, images: toolImages, sources });
      results.push({ functionResponse: { name: call.name, ...(call.id ? { id: call.id } : {}), response: { isError: !!result.isError, text: output, images: toolImages.length } } });
      toolImages.forEach(image => results.push({ inlineData: image }));
    }
    contents.push({ role: 'user', parts: results });
    options.checkpoint(contents);
  }
  throw Error('Paused after eight assistant steps. Completed actions are retained; send another message to continue.');
}
