import type { ChatEntry } from './useAssistantChat';
export function ConversationView({ entries, busy, error }: { entries: ChatEntry[]; busy: boolean; error: string | null }) {
  return <div className="assistant-conversation" role="log" aria-label="Assistant conversation" aria-live="polite">
    {!entries.length && <p className="assistant-welcome">Ask about your project, draw a layout, search the web or attach an image. Tool activity and source links appear here.</p>}
    {entries.map(entry => <article key={entry.id} className={`assistant-chat-entry is-${entry.kind}`} data-tool={entry.toolName} data-failed={entry.failed || undefined}>
      <strong>{entry.kind === 'user' ? 'You' : entry.kind === 'tool' ? entry.toolName : 'Assistant'}</strong>
      {entry.kind === 'tool' ? <details open={entry.failed}><summary>{entry.failed ? 'Action failed — inspect details' : entry.text.startsWith('Running ') ? entry.text : 'Tool result'}</summary><p>{entry.text}</p></details> : <p>{entry.text}</p>}
      {entry.images?.map((image, index) => <figure key={index}><img src={`data:${image.mimeType};base64,${image.data}`} alt={entry.kind === 'user' ? `Attached reference ${index + 1}` : `Assistant tool image ${index + 1}`} /><figcaption>{entry.kind === 'user' ? 'Attached reference' : 'Image result'}</figcaption></figure>)}
      {!!entry.sources?.length && <ul className="assistant-sources" aria-label="Web sources">{entry.sources.map((source, index) => <li key={`${source.url}-${index}`}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title || source.url}</a></li>)}</ul>}
    </article>)}
    {busy && <p role="status">Assistant is working…</p>}
    {error && <p className="assistant-chat-error" role="alert">{error}</p>}
  </div>;
}
