export type ToolClaimOutcome = { name: string; invoked: boolean; isError: boolean; origin: 'app-preflight' | 'model' };
export type UnsupportedToolClaim = { name: string; reason: 'not-executed' | 'failed' | 'wrong-origin' };
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const plain = (text: string) => text.replace(/[`*_]/g, character => character === '_' ? '_' : '');

/** Narrow guard for explicit named-tool requests, not a general natural-language fact checker. */
export function unsupportedFinalToolClaims(objective: string, declaredNames: readonly string[], answer: string, outcomes: readonly ToolClaimOutcome[]): UnsupportedToolClaim[] {
  const request = plain(objective), text = plain(answer);
  const claims: UnsupportedToolClaim[] = [];
  for (const name of declaredNames) {
    const escaped = escape(name);
    const requested = new RegExp(`\\b(?:use|run|call|execute|invoke)\\s+(?:(?:the|actual|available|tool)\\s+){0,4}${escaped}\\b`, 'ig');
    const explicit = [...request.matchAll(requested)].some(match => {
      const prefix = request.slice(0, match.index).split(/[.!?\n]/).at(-1) || '';
      return !/\b(?:do not|don't|never|without)\s*(?:actually\s*)?$/i.test(prefix)
        && !/\b(?:explain|describe|document|how to|example)\b/i.test(prefix);
    });
    if (!explicit) continue;
    const relevant = outcomes.filter(outcome => outcome.name === name && outcome.invoked);
    const sentences = text.split(/(?<=[.!?])\s+|\n/).filter(line => new RegExp(`\\b${escaped}\\b`, 'i').test(line));
    const positive = sentences.filter(line => !/\b(?:not|never|cannot|can't|unable|haven't|didn't|hasn't)\b/i.test(line)
      && !/\b(?:would|could|will|can|if|example|documentation)\b/i.test(line));
    const execution = positive.some(line => /\b(?:executed|called|invoked|ran|used|returned|produced|completed|succeeded)\b/i.test(line));
    const receiptPattern = new RegExp(`(?:tool receipt|actual receipt|result from|output from)[^.!?]{0,160}\\b${escaped}\\b`, 'ig');
    const receipt = [...text.matchAll(receiptPattern)].some(match => {
      const prefix = text.slice(0, match.index).split(/[.!?\n]/).at(-1) || '';
      const segment = text.slice(match.index, match.index! + match[0].length + 100).split(/[.!?\n]/)[0];
      return !/\b(?:no|missing|without|not an?|example)\s+(?:(?:current[- ]turn|fresh|actual|new)\s+)*$/i.test(prefix)
        && !/\b(?:not|never|cannot|can't|unavailable|missing)\b/i.test(segment);
    });
    if (!relevant.length && (execution || receipt)) { claims.push({ name, reason: 'not-executed' }); continue; }
    const success = positive.some(line => /\b(?:successfully|succeeded|completed|produced)\b/i.test(line)
      || /\breturned\b(?![^.!?]*(?:error|failure|refus|invalid|denied))/i.test(line))
      || (receipt && !new RegExp(`\\b${escaped}\\b[\\s\\S]{0,240}\\b(?:error|failed|failure|refused|denied)\\b`, 'i').test(text));
    if (relevant.length && relevant.every(outcome => outcome.isError) && success) { claims.push({ name, reason: 'failed' }); continue; }
    const modelClaim = new RegExp(`\\bI\\s+(?:have\\s+)?(?:called|executed|ran|used)\\s+(?:the\\s+)?${escaped}\\b`, 'i').test(text);
    if (relevant.length && relevant.every(outcome => outcome.origin === 'app-preflight') && modelClaim) claims.push({ name, reason: 'wrong-origin' });
  }
  return claims;
}

export function toolClaimFailure(claim: UnsupportedToolClaim): string {
  if (claim.reason === 'wrong-origin') return `App preflight ran ${claim.name}; the model did not call it. The unsupported attribution was withheld.`;
  return `Requested tool ${claim.name} ${claim.reason === 'failed' ? 'failed' : 'was not executed'} in this turn; no successful result was verified. Unsupported execution claims were withheld.`;
}
