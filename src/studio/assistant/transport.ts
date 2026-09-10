import { assistantRequestSchema, assistantResponseSchema, type AssistantRequest, type AssistantResponse } from './contract';
import { providerEndpoint, useAssistantProvider } from './provider';
const native = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
/**
 * The route for the provider the user selected in the composer. Native builds ignore it: they
 * carry only the Gemini transport, so the switch is web-only and the native path is unchanged.
 */
const endpoint = () => providerEndpoint(useAssistantProvider.getState().provider);
export async function assistantStatus() {
  if (native()) { const { invoke } = await import('@tauri-apps/api/core'); return invoke<{ provider: string; model: string; configured: boolean; available: boolean; message: string }>('xray_assistant_status'); }
  const response = await fetch(endpoint(), { cache: 'no-store' });
  if (!response.ok) throw Error('Assistant service status unavailable.');
  return response.json() as Promise<{ provider: string; model: string; configured: boolean; available: boolean; message: string }>;
}
export async function assistantTurn(request: AssistantRequest, signal: AbortSignal): Promise<AssistantResponse> {
  signal.throwIfAborted();
  const body = JSON.stringify(assistantRequestSchema.parse(request));
  let result: unknown;
  if (native()) {
    const { invoke } = await import('@tauri-apps/api/core');
    const cancel = () => { void invoke('xray_cancel_assistant', { requestId: request.requestId }).catch(() => {}); };
    signal.addEventListener('abort', cancel, { once: true });
    try { signal.throwIfAborted(); result = await invoke('xray_assistant_turn', { requestJson: body }); }
    finally { signal.removeEventListener('abort', cancel); }
  } else {
    const response = await fetch(endpoint(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal });
    const data = await response.json();
    if (!response.ok) throw Error(data.error || `Assistant request failed (${response.status}).`);
    result = data;
  }
  signal.throwIfAborted();
  const parsed = assistantResponseSchema.parse(result);
  if (parsed.requestId !== request.requestId) throw Error('Assistant response identity mismatch.');
  return parsed;
}
