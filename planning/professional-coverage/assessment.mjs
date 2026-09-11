const states = new Set(['not-assessed','gap','partial','in-progress','failed','dependency-blocked','verified']);

/** The reviewed Markdown is authoritative; generating a report must never reset it. */
export function readAssessment(markdown, expectedIds) {
  const rows = new Map();
  for (const line of markdown.split(/\r?\n/)) {
    const match = line.match(/^- \[([ x])\] \*\*([A-Z]{1,2}-\d{2}) [^*]+\*\*.*?State: ([a-z-]+)(.*)$/);
    if (!match) continue;
    const [, tick, id, state] = match;
    if (!states.has(state)) throw Error(`${id}: unknown assessment state ${state}`);
    if (rows.has(id)) throw Error(`${id}: duplicate assessment`);
    if (tick === 'x' && state !== 'verified') throw Error(`${id}: checked without verified state`);
    const paths = [...new Set(line.match(/(?:src|scripts|proof|screenshots)\/[\w./-]+\.[\w]+/g) ?? [])];
    rows.set(id, { state, checked: tick === 'x', assessmentText: line.slice(line.indexOf('State: ')),
      code: paths.filter(p => /^(src|scripts)\//.test(p)), evidence: paths.filter(p => /^(proof|screenshots)\//.test(p)) });
  }
  for (const id of expectedIds) if (!rows.has(id)) throw Error(`${id}: missing assessment`);
  for (const id of rows.keys()) if (!expectedIds.includes(id)) throw Error(`${id}: unknown requirement`);
  const section = markdown.split('## Current concrete findings')[1]?.split('\n## ')[0] ?? '';
  const findings = section.split(/\r?\n/).filter(line => line.startsWith('| ') && !line.startsWith('| User concern'))
    .map(line => line.split('|').slice(1,-1).map(cell => cell.trim())).filter(cells => cells.length >= 3);
  return { rows, findings };
}
