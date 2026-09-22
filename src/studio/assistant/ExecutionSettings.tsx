import { useEffect, useState } from 'react';
import { DEFAULT_EXECUTION_BUDGET, EXECUTION_BUDGET_KEY, executionBudgetSchema, readExecutionBudget, type ExecutionBudget } from './executionBudget';

export function ExecutionSettings({ busy }: { busy: boolean }) {
  const [budget, setBudget] = useState(() => readExecutionBudget(typeof localStorage === 'undefined' ? null : localStorage));
  const [error, setError] = useState('');
  const save = (next: ExecutionBudget) => {
    const parsed = executionBudgetSchema.safeParse(next);
    if (!parsed.success) { setError('Enter a whole number within the displayed range.'); return; }
    try { localStorage.setItem(EXECUTION_BUDGET_KEY, JSON.stringify(parsed.data)); setBudget(parsed.data); setError(''); }
    catch { setError('Settings could not be saved. Existing limits still apply.'); }
  };
  const fields: Array<{ key: keyof ExecutionBudget; label: string; min: number; max: number; divisor?: number }> = [
    { key: 'maxRounds', label: 'Model rounds per message', min: 1, max: 512 },
    { key: 'maxToolCalls', label: 'Tool calls per message', min: 1, max: 4096 },
    { key: 'maxOutputTokens', label: 'Output tokens per response', min: 1024, max: 65536 },
    { key: 'timeoutMs', label: 'Request timeout (seconds)', min: 10, max: 600, divisor: 1000 },
    { key: 'contextTokens', label: 'Working context tokens (estimated)', min: 16000, max: 900000 },
  ];
  return <>{desktop() && <MinimaxKeySettings busy={busy} />}<fieldset className="assistant-execution-settings" disabled={busy}>
    <legend>Execution limits</legend>
    <p>No app daily request cap. Provider quotas still apply. Changes apply to your next message; larger budgets can use more paid tokens.</p>
    {fields.map(field => <label key={field.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 100px', gap: 8, alignItems: 'center', marginBottom: 8 }}>
      <span>{field.label}<small style={{ display: 'block' }}>{field.min.toLocaleString()} to {field.max.toLocaleString()}</small></span>
      <input key={`${field.key}-${budget[field.key]}`} aria-label={field.label} type="number" min={field.min} max={field.max} step={1}
        defaultValue={budget[field.key] / (field.divisor || 1)} style={{ width: '100%', minWidth: 0, minHeight: 36, border: '1px solid #b8c3d1', borderRadius: 6, background: '#fff', color: '#26303c', padding: '4px 8px' }}
        onBlur={event => save({ ...budget, [field.key]: Number(event.currentTarget.value) * (field.divisor || 1) })} />
    </label>)}
    <button type="button" className="assistant-text-action" onClick={() => save({ ...DEFAULT_EXECUTION_BUDGET })}>Restore default limits</button>
    <p>500 MB per file, 20 files per message. Originals stay in project storage; the assistant reads pages or text sections as needed. Drawing batches support 200 operations.</p>
    {error && <p role="alert">{error}</p>}
  </fieldset></>;
}

const desktop = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
type ProviderStatus = { model: string; configured: boolean; message: string };

/** Desktop only: the key is saved by the native app in its own config folder and never read back. */
function MinimaxKeySettings({ busy }: { busy: boolean }) {
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [key, setKey] = useState('');
  const [model, setModel] = useState('');
  const [message, setMessage] = useState('');
  const call = async <T,>(command: string, args?: Record<string, unknown>) => (await import('@tauri-apps/api/core')).invoke<T>(command, args);
  useEffect(() => { call<ProviderStatus>('xray_minimax_status').then(value => { setStatus(value); setModel(value.model); }).catch(() => setMessage('MiniMax status unavailable.')); }, []);
  const save = async (nextKey: string) => {
    try { const next = await call<ProviderStatus>('xray_configure_minimax', { key: nextKey, model }); setStatus(next); setKey(''); setMessage(nextKey ? 'MiniMax key saved on this device.' : 'MiniMax key removed.'); }
    catch (error) { setMessage(typeof error === 'string' ? error : error instanceof Error ? error.message : 'MiniMax settings could not be saved.'); }
  };
  return <fieldset className="assistant-execution-settings" disabled={busy}>
    <legend>MiniMax on this computer</legend>
    <p>{status ? status.message : 'Checking MiniMax configuration…'}</p>
    <label style={{ display: 'grid', gap: 4, marginBottom: 8 }}><span>MiniMax API key</span>
      <input aria-label="MiniMax API key" type="password" autoComplete="off" value={key} placeholder={status?.configured ? 'Saved (hidden). Paste a new key to replace it.' : 'Paste your MiniMax API key'}
        onChange={event => setKey(event.currentTarget.value)} style={{ minHeight: 36, border: '1px solid #b8c3d1', borderRadius: 6, background: '#fff', color: '#26303c', padding: '4px 8px' }} /></label>
    <label style={{ display: 'grid', gap: 4, marginBottom: 8 }}><span>Model</span>
      <input aria-label="MiniMax model" value={model} onChange={event => setModel(event.currentTarget.value)} placeholder="MiniMax-M3"
        style={{ minHeight: 36, border: '1px solid #b8c3d1', borderRadius: 6, background: '#fff', color: '#26303c', padding: '4px 8px' }} /></label>
    <button type="button" className="assistant-text-action" disabled={!key.trim()} onClick={() => void save(key)}>Save MiniMax key</button>
    {status?.configured && <button type="button" className="assistant-text-action" onClick={() => void save('')}>Remove saved key</button>}
    {message && <p role="status">{message}</p>}
  </fieldset>;
}
