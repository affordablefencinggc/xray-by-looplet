import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

/** Keyboard-accessible even when the pointer-only affordance is hidden. */
export function CopyAction({ text, label }: { text: string; label: string }) {
  const [status, setStatus] = useState('');
  return <button type="button" className="assistant-hover-copy" aria-label={`Copy ${label}`}
    title={status || `Copy ${label}`} onMouseLeave={() => setStatus('')}
    onClick={async event => {
      event.preventDefault(); event.stopPropagation();
      try { await navigator.clipboard.writeText(text); setStatus('Copied'); }
      catch { setStatus('Could not copy. Select the text and copy it manually.'); }
    }}>
    {status === 'Copied' ? <Check size={14}/> : <Copy size={14}/>}
    <span className="assistant-copy-status" role="status">{status}</span>
  </button>;
}
