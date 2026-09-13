import { useState } from 'react';

export type ChatHistorySummary = {
  id: string; title: string; updatedAt: string; active: boolean; archived: boolean;
  messages: number; tools: number; request: string; reply: string;
};

export function ChatHistoryPanel({ threads, disabled, onOpen, onContinue, onArchive }: {
  threads: ChatHistorySummary[]; disabled: boolean;
  onOpen: (id: string) => void; onContinue: (id: string) => void; onArchive: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [archived, setArchived] = useState(false);
  const visible = threads.filter(t => t.archived === archived);
  return <div className="assistant-chat-history">
    <p>Select a conversation to preview it. Opening or continuing is your choice.</p>
    <button type="button" onClick={() => {setArchived(!archived); setExpanded(null);}}>
      {archived ? 'Back to conversations' : `Archived chats (${threads.filter(t => t.archived).length})`}
    </button>
    {!visible.length && <p>No {archived ? 'archived chats' : 'conversations'} yet.</p>}
    {visible.map(thread => <section className="assistant-history-item" key={thread.id}>
      <button className="assistant-history-summary" type="button" aria-expanded={expanded === thread.id}
        aria-current={thread.active ? 'true' : undefined} onClick={() => setExpanded(expanded === thread.id ? null : thread.id)}>
        <strong>{thread.title}</strong>
        <small>{thread.active ? 'Current · ' : ''}{new Date(thread.updatedAt).toLocaleString()}</small>
      </button>
      {expanded === thread.id && <div className="assistant-history-preview">
        <small>{thread.messages} messages · {thread.tools} tool events</small>
        <strong>Request</strong><p>{thread.request || 'No question sent yet.'}</p>
        <strong>Latest reply</strong><p>{thread.reply || 'No reply saved yet.'}</p>
        <div className="assistant-history-actions">
          <button type="button" disabled={disabled} onClick={() => onOpen(thread.id)}>{thread.archived ? 'Restore and open' : 'Open chat'}</button>
          <button type="button" disabled={disabled || !thread.messages} onClick={() => onContinue(thread.id)}>Continue with handover</button>
          {!thread.archived && <button type="button" disabled={disabled} onClick={() => onArchive(thread.id)}>Archive chat</button>}
        </div>
      </div>}
    </section>)}
  </div>;
}
