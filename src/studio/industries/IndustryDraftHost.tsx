import { useEffect, useRef, useState, type ComponentType } from 'react';
import type { ZodType } from 'zod';
import type { IndustryDraftPanelProps } from './draftPanel.ts';
import { readIndustryDraftLibrary, saveIndustryDraft, type IndustryDraftId } from './draftStorage.ts';

/** Mount with a project/industry key. Saving continues for accepted edits when panes change. */
export function IndustryDraftHost<T extends Record<string, unknown>>({ projectId, industry, schema, createEmpty, Panel }: {
  projectId: string; industry: IndustryDraftId; schema: ZodType<T>; createEmpty: () => T; Panel: ComponentType<IndustryDraftPanelProps<T>>;
}) {
  const [value, setValue] = useState<T | null>(null), [error, setError] = useState(''), [pending, setPending] = useState(0);
  const current = useRef({ revision: 0, generation: null as string | null, failed: false, queue: Promise.resolve() });
  const alive = useRef(false);
  useEffect(() => {
    alive.current = true;
    try {
      const library = readIndustryDraftLibrary(projectId);
      const saved = library?.drafts[industry];
      current.current.generation = library?.generation ?? null;
      current.current.revision = saved?.revision ?? 0;
      setValue(saved ? schema.parse(saved.form) : createEmpty());
    } catch (failure) { current.current.failed = true; setError(failure instanceof Error ? failure.message : 'Saved draft could not be opened.'); }
    return () => { alive.current = false; };
  }, [projectId, industry, schema, createEmpty]);

  function change(next: T) {
    const session = current.current;
    if (session.failed) return;
    let parsed: T;
    try { parsed = schema.parse(next); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'These draft inputs could not be saved.'); session.failed = true; return; }
    setValue(parsed); setPending(n => n + 1);
    session.queue = session.queue.then(async () => {
      if (session.failed) return;
      const saved = await saveIndustryDraft(projectId, industry, session.revision, parsed, session.generation);
      session.revision = saved.revision;
      session.generation = saved.generation;
    }).catch(failure => {
      session.failed = true;
      if (alive.current) setError(failure instanceof Error ? failure.message : 'Draft could not be saved. Keep this page open.');
    }).finally(() => { if (alive.current) setPending(n => Math.max(0, n - 1)); });
  }
  function downloadInputs() {
    if (!value) return;
    const blob = new Blob([JSON.stringify({ projectId, industry, form: value }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = `${industry}-draft-inputs.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="industry-draft-host" data-draft-industry={industry} data-draft-save={error ? 'error' : pending ? 'saving' : value ? 'saved' : 'loading'}>
    {error && <div className="industry-error" role="alert"><p>{error}</p>{value && <button type="button" onClick={downloadInputs}>Download unsaved inputs</button>}</div>}
    {value ? <><Panel value={value} onChange={change} disabled={!!error} /><p className="industry-note" role="status">{pending ? 'Saving draft inputs…' : error ? 'Draft inputs are not saved.' : current.current.revision ? 'Draft inputs saved on this device for this project.' : 'Inputs will be saved on this device for this project.'}</p></>
      : !error && <p role="status">Opening draft inputs…</p>}
  </div>;
}
