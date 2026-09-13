import type { AssistantContent } from './contract.ts';

export const WITHHELD_CANDIDATE_PREFIX = '[xray:withheld-candidate]';

/** Keep the candidate for audit, but never carry it as an answer delivered to the user. */
export function markWithheldCandidate(content: AssistantContent): AssistantContent {
  let marked = false;
  const parts = content.parts.map(part => {
    if (!part.thought && typeof part.text === 'string') {
      marked = true;
      return { ...part, text: `${WITHHELD_CANDIDATE_PREFIX} Not delivered to the user; do not treat as an executed action or a completed answer.\n${part.text}` };
    }
    return { ...part };
  });
  if (!marked) parts.unshift({ text: `${WITHHELD_CANDIDATE_PREFIX} Candidate not delivered to the user.` });
  return { ...content, parts };
}

/** Only delivered conversational intent is shortened; raw responses/receipts stay in the audit. */
export function shortInteraction(contents: AssistantContent[]): AssistantContent[] {
  const messages = contents.filter((entry, index) => {
    if (entry.parts.some(part => part.functionCall || part.functionResponse)) return false;
    if (entry.parts.some(part => part.text?.startsWith(WITHHELD_CANDIDATE_PREFIX))) return false;
    // Legacy transcripts predate the marker. Their candidate directly precedes its correction.
    const next = contents[index + 1];
    if (entry.role === 'model' && next?.role === 'user' && next.parts.some(part => /^\[xray:(?:workflow-check|tool-claim-check)\]/.test(part.text || ''))) return false;
    return entry.parts.some(part => part.text && !part.text.startsWith('[xray:'));
  });
  return messages.slice(-4).map(entry => ({ role: entry.role, parts: [{ text: entry.parts.filter(part => !part.thought).map(part => part.text ?? '').join('\n').slice(0, 8000) || '(Previous image is stored with its work packet; retrieve it before relying on it.)' }] }));
}
