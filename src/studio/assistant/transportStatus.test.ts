import test from 'node:test';
import assert from 'node:assert/strict';
import { assistantStatus } from './transport.ts';
import { useAssistantProvider } from './provider.ts';

test('status probes use their captured provider even when the stored selection differs', async () => {
  const originalFetch = globalThis.fetch;
  const originalProvider = useAssistantProvider.getState().provider;
  const requests: string[] = [];
  globalThis.fetch = async input => {
    requests.push(String(input));
    return new Response(JSON.stringify({ provider: 'Gemini', available: false, configured: false, model: '', message: 'Not configured' }));
  };
  try {
    useAssistantProvider.setState({ provider: 'minimax' });
    assert.equal((await assistantStatus('gemini')).provider, 'Gemini');
    assert.deepEqual(requests, ['/api/assistant-ai']);
  } finally {
    globalThis.fetch = originalFetch;
    useAssistantProvider.setState({ provider: originalProvider });
  }
});

test('native MiniMax status comes from its own desktop command, never Gemini or the network', async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalFetch = globalThis.fetch;
  let requests = 0;
  const commands: string[] = [];
  const invoke = async (command: string) => { commands.push(command); return { provider: 'MiniMax', model: 'MiniMax-M3', configured: false, available: false, message: 'MiniMax is not configured.' }; };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { __TAURI_INTERNALS__: { invoke, transformCallback: () => 0 } } });
  globalThis.fetch = async () => { requests++; throw Error('Unexpected network request'); };
  try {
    const status = await assistantStatus('minimax');
    assert.equal(status.provider, 'MiniMax');
    assert.deepEqual(commands, ['xray_minimax_status']);
    assert.equal(requests, 0);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

