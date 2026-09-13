/** A blanket tool restriction survives contradictory action requests; selective bans are separate. */
export function prohibitsAllTools(objective: string): boolean {
  const text = objective.trim();
  const noTools = /\b(?:do not|don't|never)\s+(?:call|use|run|execute)\s+(?:any\s+)?tools\b|\b(?:no tools|without (?:calling|using|running|executing) (?:any )?tools)\b/i;
  if (!noTools.test(text)) return false;
  if (/\btools\s*[,;:]?\s*(?:except|other than|apart from)\b/i.test(text)) return false;
  return true;
}

/** Explicit explanation-only requests; never a substitute for action/inspection permission checks. */
export function isDiscussionOnlyObjective(objective: string): boolean {
  const text = objective.trim();
  if (!prohibitsAllTools(text)) return false;
  if (!/\b(?:explain|explanation|correct|corrected|correction|summarise|summarize|summary|review|discuss|discussion)\b/i.test(text)) return false;
  // Remove only explicit prohibitions, not a following affirmative command.
  const remaining = text.replace(/\b(?:do not|don't|never)\s+(?:call|use|run|execute)\s+(?:any\s+)?tools\b/gi, '')
    .replace(/\b(?:no tools|without (?:calling|using|running|executing) (?:any )?tools)\b/gi, '')
    .replace(/\b(?:do not|don't|never|or)\s+(?:rerun|repeat)\s+(?:the\s+)?(?:calculator|calculation|tools?|actions?)\b/gi, '');
  // Contradictory/compound action requests stay governed by the normal route.
  const action = '(?:call|run|rerun|execute|use|draw|create|edit|change|delete|remove|save|export|import|calibrate|measure|trace|inspect|read|check|verify|capture|open|navigate|calculate|classify)';
  if (new RegExp(String.raw`(?:^|[.!?;:\n]|\b(?:but|then|also|instead|and))\s*(?:please\s+)?${action}\b`, 'i').test(remaining)) return false;
  if (/\b(?:inspect|read|check|verify)\s+(?:the\s+)?(?:actual|current|live|this)\s+project\b/i.test(remaining)) return false;
  if (new RegExp(String.raw`\b(?:(?:can|could|would)\s+you|(?:I\s+)?want\s+you\s+to|you\s+(?:must|should|need\s+to))\s+(?:please\s+)?${action}\b`, 'i').test(remaining)) return false;
  return true;
}
