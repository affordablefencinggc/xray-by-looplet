import { NccResultCards } from './NccResultCards';
import type { NccMatch } from './nccReferences';
import { readNccMatches } from './nccResultReferences';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, LoaderCircle } from 'lucide-react';
import type { ChatEntry } from './useAssistantChat';
import type { ChatImage } from './conversation';
import { SELECT_SHAPE_SUGGESTION, USE_IMAGE_SUGGESTION, latestReplyImage, parseReplyOptions, hasCurrentReplyChoices, type ReplyOption } from './richReply';
import { HANDOVER_CONTINUED_PREFIX } from './contextBudget';
import { useCanvasPick } from './canvasReference';
import { ReplyBlocks } from './ReplyBlocks';
import { describeToolReceipt } from './toolReceipt';
import { quoteIntoComposer, referenceEntityById } from './referenceById';
import '../liveAssistant.css';

export type ConversationViewProps = {
  startedAt?: string;
  selectedNcc?: NccMatch[]; onSelectNcc?: (match: NccMatch) => void;
  entries: ChatEntry[]; busy: boolean; error: string | null; loadingHistory?: boolean;
  /** Sends the clicked pill or inline text immediately (same attachments and permission as the composer). */
  onAction?: (text: string) => void;
  /** Adds a chat image to the pending attachments as a "Reference". */
  onAttachImage?: (image: ChatImage) => void;
  /** Context-aware next-step pills from `suggestionsFor`; rendered below the last assistant entry. */
  suggestions?: string[];
  /** True while the composer is unavailable (busy, reading images or the context is full). */
  disabled?: boolean;
};

const SELECT_SHAPE_PROMPT = 'Click a wall, opening, room, slab, roof or model part to reference it in the chat.';

/** Clickable choices under one assistant reply; the last reply also gets the inline "Other…" input. */
function ReplyOptions({ options, stale, disabled, inline, onAction }: { options: ReplyOption[]; stale: boolean; disabled: boolean; inline: boolean; onAction?: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);
  const submit = () => {
    const value = text.trim();
    if (!value || disabled) return;
    onAction?.(value);
    setText(''); setOpen(false);
  };
  return <div className="assistant-reply-options" role="group" aria-label={stale ? 'Earlier reply options' : 'Reply options'} data-stale={stale || undefined}>
    {options.map((option, index) => <button key={`${index}-${option.send}`} type="button" className="assistant-pill assistant-pill-option" title={stale ? `Earlier choice: ${option.send}` : option.send} disabled={disabled || stale} onClick={() => onAction?.(option.send)}><span className="assistant-pill-index" aria-hidden="true">{index + 1}</span>{option.label}</button>)}
    {inline && !open && <button type="button" className="assistant-pill assistant-pill-other" disabled={disabled} aria-label="Type another answer" onClick={() => setOpen(true)}>Other…</button>}
    {inline && open && <div className="assistant-inline-reply">
      <label className="sr-only" htmlFor="assistant-inline-input">Type another answer</label>
      <input ref={input} id="assistant-inline-input" className="assistant-inline-input" type="text" maxLength={1500} value={text} placeholder="Type your answer… Enter sends, Esc closes" disabled={disabled}
        onChange={event => setText(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); event.stopPropagation(); submit(); }
          else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setText(''); setOpen(false); }
        }} />
      <button type="button" className="assistant-pill" aria-label="Send inline answer" disabled={disabled || !text.trim()} onClick={submit}>Send</button>
    </div>}
  </div>;
}

/**
 * A tool receipt in plain words: title, status and a one-line summary. The raw receipt stays in the
 * DOM but hidden (never displayed, skipped by assistive technology) so automated checks keep their contract.
 */
function ToolRow({ entry }: { entry: ChatEntry }) {
  const view = describeToolReceipt(entry);
  const Icon = view.status === 'running' ? LoaderCircle : view.status === 'failed' ? AlertTriangle : CheckCircle2;
  return <div className={`assistant-tool-row is-${view.status}`}>
    <strong className="assistant-tool-name" hidden>{entry.toolName}</strong>
    <Icon size={14} className={`assistant-tool-icon${view.status === 'running' ? ' is-spinning' : ''}`} aria-hidden="true" />
    <span className="assistant-tool-title">{view.title}</span>
    <span className="assistant-tool-summary">{view.summary}</span>
    {/* [PROVENANCE] Which project this action landed in, and the revision it left behind. Shown on
        completed rows so the transcript itself answers "whose work did this touch?". */}
    {view.status !== 'running' && entry.projectName && (
      <span className="assistant-tool-project" title="The project this action was recorded against">
        in {entry.projectName}
        {typeof entry.projectRevision === 'number' ? ` · revision ${entry.projectRevision}` : ''}
      </span>
    )}
    <span className="assistant-receipt-raw" hidden aria-hidden="true">{view.status === 'running' ? entry.text : view.status === 'failed' ? `Action failed — inspect details${entry.text}` : `Tool result${entry.text}`}</span>
  </div>;
}

export function ConversationView({ startedAt, selectedNcc = [], onSelectNcc, entries, busy, error, loadingHistory = false, onAction, onAttachImage, suggestions, disabled = false }: ConversationViewProps) {
  // The seeded handover note is context, never a set of choices to re-send.
  const parsed = useMemo(() => new Map(entries.filter(entry => entry.kind === 'assistant' && !entry.text.startsWith(HANDOVER_CONTINUED_PREFIX)).map(entry => [entry.id, parseReplyOptions(entry.text)] as const)), [entries]);
  const lastAssistantId = [...entries].reverse().find(entry => entry.kind === 'assistant')?.id;
  const replyImage = latestReplyImage(entries);
  const hasChoices = hasCurrentReplyChoices(entries.map(entry => {
    let selectableReference = entry.kind !== 'user' && !!onAttachImage && !!entry.images?.length;
    if (entry.kind === 'tool' && entry.toolName === 'search_standards_library' && !entry.failed && onSelectNcc) {
      try { selectableReference ||= readNccMatches(JSON.parse(entry.text).matches).length > 0; } catch { /* No rendered references. */ }
    }
    return { kind: entry.kind, text: entry.text.startsWith(HANDOVER_CONTINUED_PREFIX) ? '' : entry.text, selectableReference };
  }));
  const locked = disabled || busy;
  const suggest = (text: string) => {
    if (text === SELECT_SHAPE_SUGGESTION) { useCanvasPick.getState().start({ prompt: SELECT_SHAPE_PROMPT, accept: ['architect-entity', 'source-part'] }); return; }
    if (text === USE_IMAGE_SUGGESTION) { if (replyImage) onAttachImage?.(replyImage); return; }
    onAction?.(text);
  };
  return <>
  <div className="assistant-conversation" role="log" aria-label="Assistant conversation" aria-live="polite">
    {!loadingHistory && <p className="assistant-conversation-start">{startedAt ? <>Conversation started <time dateTime={startedAt}>{new Date(startedAt).toLocaleString()}</time></> : 'Conversation start time was not recorded'}</p>}
    {!entries.length && !loadingHistory && <p className="assistant-welcome">Ask about your project, draw a layout, search the web or attach an image. Tool activity and source links appear here.</p>}
    {entries.map(entry => {
      const reply = entry.kind === 'assistant' ? parsed.get(entry.id) : undefined;
      const last = entry.id === lastAssistantId;
      const handover = entry.kind === 'assistant' && entry.text.startsWith(HANDOVER_CONTINUED_PREFIX);
      return <article key={entry.id} className={`assistant-chat-entry is-${entry.kind}${handover ? ' is-handover' : ''}`} data-tool={entry.toolName} data-failed={entry.failed || undefined}>
        {entry.kind === 'tool'
          ? <ToolRow entry={entry} />
          : <>
            <strong>{entry.kind === 'user' ? 'You' : 'Assistant'}</strong>
            {entry.kind === 'user'
              ? <p>{entry.text}</p>
              : <ReplyBlocks text={entry.text} disabled={locked} onReply={quote => quoteIntoComposer(quote)} onReference={id => void referenceEntityById(id)} />}
          </>}
        {entry.kind === 'tool' && entry.toolName === 'search_standards_library' && !entry.failed && onSelectNcc && <NccResultCards receipt={entry.text} selected={selectedNcc} disabled={locked} onSelect={onSelectNcc} />}
        {entry.images?.map((image, index) => <figure key={index}>
          <img src={`data:${image.mimeType};base64,${image.data}`} alt={entry.kind === 'user' ? `Attached reference ${index + 1}` : `Assistant tool image ${index + 1}`} />
          <figcaption>{entry.kind === 'user' ? 'Attached reference' : 'Image result'}</figcaption>
          {entry.kind !== 'user' && onAttachImage && <button type="button" className="assistant-pill assistant-image-reference" aria-label={`Use image ${index + 1} as reference`} disabled={locked} onClick={() => onAttachImage(image)}>Use as reference</button>}
        </figure>)}
        {!!entry.sources?.length && <ul className="assistant-sources" aria-label="Web sources">{entry.sources.map((source, index) => <li key={`${source.url}-${index}`}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title || source.url}</a></li>)}</ul>}
        {reply && (reply.options.length > 0 || (last && reply.questions.length > 0)) && <ReplyOptions key={`${entry.id}-${last}`} options={reply.options} stale={!last} inline={last} disabled={locked} onAction={onAction} />}
        {entry.kind !== 'tool' && <small className="assistant-message-time">{entry.timestamp ? <time dateTime={entry.timestamp} title={new Date(entry.timestamp).toLocaleString()}>{new Date(entry.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</time> : 'Time not recorded'}</small>}
      </article>;
    })}
    {busy && <p role="status" className="assistant-working"><LoaderCircle size={14} className="is-spinning" aria-hidden="true" />Assistant is working…</p>}
    {error && <p className="assistant-chat-error" role="alert">{error}</p>}
  </div>
  {/* Suggestions sit outside the live region so screen readers are not re-read every pill after each reply. */}
  {!busy && !hasChoices && !!suggestions?.length && <div className="assistant-suggestions" role="group" aria-label="Suggested next steps">
    {suggestions.map(text => <button key={text} type="button" className="assistant-pill assistant-suggestion" disabled={text === SELECT_SHAPE_SUGGESTION ? busy : (locked || (text === USE_IMAGE_SUGGESTION && !replyImage))} onClick={() => suggest(text)}>{text}</button>)}
  </div>}
  </>;
}
