import { useEffect, useId, useState } from 'react';
import { listWorkPackets, readWorkEvents } from './workPacketStore';
import type { WorkPacket } from './workPacket';
import './workPacket.css';

export function WorkPacketPanel({ projectId, current }: { projectId: string; current?: WorkPacket }) {
  const [saved, setSaved] = useState<WorkPacket[]>([]);
  const [error, setError] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const historyId = useId();
  useEffect(() => {
    let live = true;
    void listWorkPackets(projectId).then(rows => { if (live) { setSaved(rows); setError(''); } }, e => { if (live) setError(e instanceof Error ? e.message : 'Work packets could not be read.'); });
    return () => { live = false; };
  }, [projectId, current?.sequence, current?.id]);
  const packet = current?.projectId === projectId ? current : saved.find(p => p.projectId === projectId);
  const history = [ ...(current?.projectId === projectId ? [current] : []), ...saved.filter(p => p.projectId === projectId && p.id !== current?.id) ];
  const exportRecord = async () => {
    if (!packet) return;
    try {
      const events = await readWorkEvents(packet.id);
      const blob = new Blob([JSON.stringify({ packet, events, scope: 'Internal unreviewed task record. Local hash chain; no professional signature or issue authority.' }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = `work-packet-${packet.id}.json`; a.click(); URL.revokeObjectURL(url);
    } catch (e) { setError(e instanceof Error ? e.message : 'Task export failed.'); }
  };
  return <section className="assistant-work-packet-shell" aria-label="Work packet" onKeyDown={e => { if (e.key === 'Escape' && historyOpen) { e.stopPropagation(); setHistoryOpen(false); e.currentTarget.querySelector<HTMLButtonElement>('.assistant-work-history-toggle')?.focus(); } }}>
    <button type="button" className="assistant-work-history-toggle" aria-label="Task history" title="Task history" aria-expanded={historyOpen} aria-controls={historyId} onClick={() => setHistoryOpen(v => !v)}>
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="2.5" y="2.5" width="15" height="15" rx="2"/><path d="M8 3v14M11 7h4M11 10h4M11 13h3"/></svg>
    </button>
    <details className="assistant-work-packet" data-packet-id={packet?.id} data-packet-state={packet?.state}>
    <summary>Work packet <span>{packet ? packet.state.replaceAll('-', ' ') : 'Ready for a task'}</span></summary>
    {error && <p role="alert">{error}</p>}
    {packet ? <div>
      <p><strong>{packet.snapshot.projectName}</strong> · Project revision {packet.snapshot.projectRevision}{packet.snapshot.designRevision ? ` · Design revision ${packet.snapshot.designRevision}` : ''}</p>
      <p>{packet.objective.slice(0, 350)}</p>
      <dl><dt>Governing revisions</dt><dd>Not established</dd><dt>Decision owner</dt><dd>{packet.decisionOwner || 'Unassigned'}</dd><dt>Authority</dt><dd>Internal draft only · professional authority unverified</dd></dl>
      {packet.snapshot.sources.length > 0 && <ul>{packet.snapshot.sources.slice(0, 6).map(s => <li key={s.id}>{s.name} · {s.revision || 'Revision unknown'} · {s.informationStatus}</li>)}</ul>}
      <p>{packet.nextAction}</p>
      <p>{packet.sequence} saved audit events · {saved.length} task records on this device</p>
      <button type="button" onClick={() => void exportRecord()}>Export task record</button>
    </div> : <p>Each assistant request creates a saved task record. Sources, revisions and unknowns stay separate from the conversation.</p>}
  </details>
  {historyOpen && <section id={historyId} className="assistant-work-history" aria-label="Task history">
    <header><strong>History</strong><span>{history.length} topics · this project</span></header>
    <p className="assistant-work-history-note">Saved on this device · reported tokens across recorded responses</p>
    {error && <p role="alert">{error}</p>}
    {history.length ? <ol>{history.map(item => <li key={item.id}>
      <details>
        <summary><strong>{item.objective.replace(/^#+\s*/, '').split('\n').find(line => line.trim()) || 'Untitled task'}</strong>
          <span className="assistant-work-history-meta"><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</time>
          <span>{item.tokenUsage?.recordedResponses ? `${item.tokenUsage.total.toLocaleString()} tokens${item.tokenUsage.missingResponses ? ' · partial' : ''}` : 'Tokens · Not recorded'}</span></span>
        </summary>
        <div className="assistant-work-history-detail"><span>{item.state.replaceAll('-', ' ')}</span><p>{item.objective}</p><p>{item.nextAction}</p></div>
      </details>
    </li>)}</ol> : <p>No saved topics yet. Your first task will appear here.</p>}
  </section>}
  </section>;
}
