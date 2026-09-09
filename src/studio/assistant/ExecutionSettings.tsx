import { useState } from 'react';
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
  return <fieldset className="assistant-execution-settings" disabled={busy}>
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
  </fieldset>;
}
