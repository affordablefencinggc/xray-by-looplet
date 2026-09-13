import { assistantRequestSchema, assistantResponseSchema, type AssistantRequest, type AssistantResponse } from './contract.ts';
import { providerEndpoint, providerToolError, useAssistantProvider, type AssistantProvider } from './provider.ts';
const native = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
/**
 * Use the selected provider; unsupported native providers fail without rerouting.
 */
export async function assistantStatus(provider: AssistantProvider = useAssistantProvider.getState().provider) {
  if (native() && provider === 'minimax') return { provider: 'MiniMax', model: '', configured: false, available: false, message: 'MiniMax is unavailable in this native build. No Gemini request was sent.' };
  if (native()) { const { invoke } = await import('@tauri-apps/api/core'); return invoke<{ provider: string; model: string; configured: boolean; available: boolean; message: string }>('xray_assistant_status'); }
  const response = await fetch(providerEndpoint(provider), { cache: 'no-store' });
  if (!response.ok) throw Error('Assistant service status unavailable.');
  return response.json() as Promise<{ provider: string; model: string; configured: boolean; available: boolean; message: string }>;
}
export async function assistantTurn(request: AssistantRequest, signal: AbortSignal, provider: AssistantProvider = useAssistantProvider.getState().provider): Promise<AssistantResponse> {
  signal.throwIfAborted();
  if (provider === 'minimax' && native()) throw Error('MiniMax is unavailable in this native build. No Gemini request was sent.');
  if (provider === 'minimax' && request.webSearch) throw Error(providerToolError(provider, 'web_search'));
  const body = JSON.stringify(assistantRequestSchema.parse(request));
  let result: unknown;
  if (native()) {
    const { invoke } = await import('@tauri-apps/api/core');
    const cancel = () => { void invoke('xray_cancel_assistant', { requestId: request.requestId }).catch(() => {}); };
    signal.addEventListener('abort', cancel, { once: true });
    try { signal.throwIfAborted(); result = await invoke('xray_assistant_turn', { requestJson: body }); }
    finally { signal.removeEventListener('abort', cancel); }
  } else {
    const response = await fetch(providerEndpoint(provider), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal });
    const data = await response.json();
    if (!response.ok) throw Error(data.error || `Assistant request failed (${response.status}).`);
    result = data;
  }
  signal.throwIfAborted();
  const parsed = assistantResponseSchema.parse(result);
  if (parsed.requestId !== request.requestId) throw Error('Assistant response identity mismatch.');
  return parsed;
}
